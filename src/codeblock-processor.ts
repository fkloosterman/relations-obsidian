/**
 * Codeblock processor for relation-tree codeblocks.
 *
 * Handles parsing, validation, and rendering of relationship trees
 * embedded in markdown notes via codeblocks.
 */

import { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import type ParentRelationPlugin from './main';
import {
	parseCodeblockParams,
	validateCodeblockParams,
	CodeblockValidationError,
	CodeblockParams,
	RelationType
} from './codeblock-params';
import { TreeRenderer } from './tree-renderer';
import {
	buildAncestorTree,
	buildDescendantTree,
	buildSiblingTree,
	buildCousinsTree,
	TreeNode
} from './tree-model';
import {
	buildFilterFunction,
	countTreeNodes,
	truncateTree,
	FilterFunction
} from './codeblock-filters';

/**
 * Resolves a note reference to a TFile.
 *
 * Supports wiki-link format ([[Note]]) and plain file paths.
 * Handles aliases and heading references.
 *
 * @param noteRef - Wiki-link or file path (e.g., "[[My Note]]" or "path/to/note.md")
 * @param sourcePath - Path of the file containing the codeblock
 * @param app - Obsidian app instance
 * @returns Resolved TFile or null if not found
 *
 * @example
 * ```typescript
 * resolveNoteReference("[[My Note]]", "source.md", app);
 * // Returns: TFile for "My Note"
 *
 * resolveNoteReference("[[My Note|Alias]]", "source.md", app);
 * // Returns: TFile for "My Note" (alias ignored)
 *
 * resolveNoteReference("[[My Note#Heading]]", "source.md", app);
 * // Returns: TFile for "My Note" (heading ignored)
 * ```
 */
export function resolveNoteReference(
	noteRef: string,
	sourcePath: string,
	app: App
): TFile | null {
	// Remove wiki-link brackets if present
	let cleanRef = noteRef.trim();
	if (cleanRef.startsWith('[[') && cleanRef.endsWith(']]')) {
		cleanRef = cleanRef.substring(2, cleanRef.length - 2);
	}

	// Handle link with alias (e.g., "My Note|Alias")
	const pipeIndex = cleanRef.indexOf('|');
	if (pipeIndex >= 0) {
		cleanRef = cleanRef.substring(0, pipeIndex);
	}

	// Handle link with heading (e.g., "My Note#Heading")
	const hashIndex = cleanRef.indexOf('#');
	if (hashIndex >= 0) {
		cleanRef = cleanRef.substring(0, hashIndex);
	}

	// Try to resolve as link path
	const file = app.metadataCache.getFirstLinkpathDest(cleanRef, sourcePath);

	return file;
}

/**
 * Gets the current note being viewed/edited.
 *
 * @param app - Obsidian app instance
 * @returns Active file or null
 */
export function getCurrentNote(app: App): TFile | null {
	return app.workspace.getActiveFile();
}

/**
 * Processes relation-tree codeblocks.
 *
 * Main processor class that handles parsing parameters, resolving notes,
 * building trees, and rendering results with error handling.
 */
export class CodeblockProcessor {
	constructor(
		private app: App,
		private plugin: ParentRelationPlugin
	) {}

	/**
	 * Main processing function for relation-tree codeblocks.
	 *
	 * @param source - Raw codeblock content
	 * @param el - Container element to render into
	 * @param ctx - Processing context with source file information
	 *
	 * @example
	 * ```typescript
	 * const processor = new CodeblockProcessor(app, plugin);
	 * processor.process(codeblockContent, containerElement, context);
	 * ```
	 */
	async process(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): Promise<void> {
		try {
			// Parse parameters
			const params = parseCodeblockParams(source);

			// Get available fields
			const availableFields = this.plugin.settings.parentFields.map(f => f.name);

			// Validate parameters
			validateCodeblockParams(params, availableFields);

			// Resolve target note
			const targetFile = this.resolveTargetNote(params, ctx);

			if (!targetFile) {
				this.renderError(
					el,
					`Note not found: "${params.note || 'current note'}"`,
					'note'
				);
				return;
			}

			// Get parent field to use
			const fieldName = params.field || this.plugin.settings.defaultParentField;

			// Get graph and engine for this field
			const graph = this.plugin.getGraphForField(fieldName);
			const engine = this.plugin.getEngineForField(fieldName);

			if (!graph || !engine) {
				this.renderError(
					el,
					`Parent field not found: "${fieldName}"`,
					'field'
				);
				return;
			}

			// Build filter function from parameters
			const filterFunction = buildFilterFunction(params, this.app);

			// Build tree based on type (with filter)
			const tree = this.buildTree(
				params.type,
				targetFile,
				engine,
				graph,
				params,
				filterFunction
			);

			// Apply max-nodes truncation if specified
			let finalTree = tree;
			let truncatedCount = 0;

			if (params.maxNodes !== undefined && tree) {
				const nodeCount = countTreeNodes(tree);

				if (nodeCount > params.maxNodes) {
					const result = truncateTree(tree, params.maxNodes);
					finalTree = result.tree;
					truncatedCount = result.truncatedCount;
				}
			}

			// Render tree
			this.renderTree(el, finalTree, params, truncatedCount, filterFunction !== null, targetFile, fieldName);

		} catch (error) {
			if (error instanceof CodeblockValidationError) {
				this.renderError(el, error.message, error.field);
			} else {
				this.renderError(
					el,
					`Unexpected error: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}

	/**
	 * Resolves the target note from parameters.
	 *
	 * If no note is specified, uses the current note (file containing codeblock).
	 *
	 * @param params - Parsed codeblock parameters
	 * @param ctx - Processing context
	 * @returns Resolved TFile or null
	 */
	private resolveTargetNote(
		params: CodeblockParams,
		ctx: MarkdownPostProcessorContext
	): TFile | null {
		// If no note specified, use the current note (file containing codeblock)
		if (!params.note) {
			const sourcePath = ctx.sourcePath;
			return this.app.vault.getAbstractFileByPath(sourcePath) as TFile;
		}

		// Resolve note reference
		return resolveNoteReference(params.note, ctx.sourcePath, this.app);
	}

	/**
	 * Builds tree based on relationship type.
	 *
	 * @param type - Relationship type (ancestors, descendants, siblings, cousins)
	 * @param file - Target file to build tree for
	 * @param engine - Relationship engine for the parent field
	 * @param graph - Relation graph for the parent field
	 * @param params - Codeblock parameters
	 * @param filter - Optional filter function to apply to nodes
	 * @returns Built tree node(s) or null
	 */
	private buildTree(
		type: RelationType,
		file: TFile,
		engine: any,
		graph: any,
		params: CodeblockParams,
		filter: FilterFunction | null
	): TreeNode | TreeNode[] | null {
		const buildOptions = {
			maxDepth: params.depth,
			detectCycles: params.showCycles ?? true,
			includeMetadata: true,
			filter: filter || undefined
		};

		switch (type) {
			case 'ancestors':
				return buildAncestorTree(file, engine, graph, buildOptions);

			case 'descendants':
				return buildDescendantTree(file, engine, graph, buildOptions);

			case 'siblings':
				return buildSiblingTree(file, engine, graph, buildOptions);

			case 'cousins':
				return buildCousinsTree(file, engine, graph, buildOptions);

			default:
				return null;
		}
	}

	/**
	 * Renders tree to DOM.
	 *
	 * @param container - Container element to render into
	 * @param tree - Tree node(s) to render
	 * @param params - Codeblock parameters for styling
	 * @param truncatedCount - Number of nodes truncated (0 if none)
	 * @param hasFilters - Whether filters are active
	 * @param targetFile - Target file for the tree (used in title)
	 * @param fieldName - Name of the parent field being displayed
	 */
	private renderTree(
		container: HTMLElement,
		tree: TreeNode | TreeNode[] | null,
		params: CodeblockParams,
		truncatedCount: number = 0,
		hasFilters: boolean = false,
		targetFile?: TFile,
		fieldName?: string
	): void {
		container.empty();
		container.addClass('relation-codeblock-container');

		// Add mode class for styling
		if (params.mode) {
			container.addClass(`relation-codeblock-mode-${params.mode}`);
		}

		// Add style variant class
		if (params.style) {
			container.addClass(`relation-codeblock-style-${params.style}`);
		}

		// Add data attribute when filters are active
		if (hasFilters) {
			container.setAttribute('data-filtered', 'true');
		}

		// Render title if requested
		if (params.title && params.title !== 'none') {
			this.renderTitle(container, params, hasFilters, targetFile, fieldName);
		}

		// Handle empty result
		if (!tree || (Array.isArray(tree) && tree.length === 0)) {
			const emptyEl = container.createDiv('relation-codeblock-empty');
			emptyEl.setText(`No ${params.type} found`);
			return;
		}

		// Create a separate container for tree content
		// (TreeRenderer clears the container, so we need to keep title separate)
		const treeContainer = container.createDiv('relation-codeblock-tree-content');

		// Create renderer
		const renderer = new TreeRenderer(this.app, {
			collapsible: params.mode === 'tree',
			initialDepth: params.collapsed ? 0 : 2,
			enableNavigation: true,
			showCycleIndicators: params.showCycles ?? true,
			cssPrefix: 'relation-codeblock'
		}, this.plugin);

		// Render tree(s) into the tree container
		if (Array.isArray(tree)) {
			// Flat list (siblings, cousins) - render as list not as trees
			this.renderNodeList(tree, treeContainer);
		} else {
			// Single tree (ancestors, descendants)
			renderer.render(tree, treeContainer);
		}

		// Add truncation indicator if nodes were truncated
		if (truncatedCount > 0) {
			const truncationEl = container.createDiv('relation-codeblock-truncation');
			truncationEl.setText(`(+${truncatedCount} more...)`);
			truncationEl.setAttribute('title', `${truncatedCount} nodes hidden due to max-nodes limit`);
		}
	}

	/**
	 * Renders a flat list of nodes (for siblings/cousins).
	 *
	 * @param nodes - Array of TreeNode objects to render as a list
	 * @param container - Container element to render into
	 */
	private renderNodeList(nodes: TreeNode[], container: HTMLElement): void {
		const listContainer = container.createDiv('relation-codeblock-list');

		nodes.forEach(node => {
			const item = listContainer.createDiv('relation-codeblock-list-item');

			// File icon
			const icon = item.createDiv('relation-codeblock-list-icon');
			icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';

			// File name (clickable)
			const name = item.createSpan('relation-codeblock-list-name');
			name.setText(node.file.basename);

			// Make clickable with navigation support
			item.addClass('relation-codeblock-list-item-clickable');

			// Click to open file
			name.addEventListener('click', async (e) => {
				e.preventDefault();
				e.stopPropagation();

				try {
					// Open file in split pane if Ctrl/Cmd is held
					if (e.ctrlKey || e.metaKey) {
						await this.app.workspace.openLinkText(node.file.basename, '', 'split');
					} else {
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(node.file);
					}
				} catch (error) {
					console.error('[Codeblock Processor] Error opening file:', error);
				}
			});

			// Hover preview
			name.addEventListener('mouseenter', (e) => {
				this.app.workspace.trigger('hover-link', {
					event: e,
					source: 'relation-codeblock',
					hoverParent: item,
					targetEl: name,
					linktext: node.file.path
				});
			});
		});
	}

	/**
	 * Renders title for the codeblock.
	 *
	 * @param container - Container element to render into
	 * @param params - Codeblock parameters
	 * @param hasFilters - Whether filters are active
	 * @param targetFile - Target file for the tree
	 * @param fieldName - Name of the parent field being displayed
	 */
	private renderTitle(
		container: HTMLElement,
		params: CodeblockParams,
		hasFilters: boolean,
		targetFile?: TFile,
		fieldName?: string
	): void {
		const titleEl = container.createDiv('relation-codeblock-title');

		// Get display name for the relation type from configured settings
		let typeName: string;
		const actualFieldName = fieldName || this.plugin.settings.defaultParentField;
		const fieldConfig = this.plugin.settings.parentFields.find(f => f.name === actualFieldName);

		if (fieldConfig) {
			// Use configured display name for the section
			switch (params.type) {
				case 'ancestors':
					typeName = fieldConfig.ancestors.displayName;
					break;
				case 'descendants':
					typeName = fieldConfig.descendants.displayName;
					break;
				case 'siblings':
					typeName = fieldConfig.siblings.displayName;
					break;
				case 'cousins':
					// Cousins doesn't have its own section, use a sensible default
					typeName = 'Cousins';
					break;
			}
		} else {
			// Fallback to capitalized type name if config not found
			typeName = params.type.charAt(0).toUpperCase() + params.type.slice(1);
		}

		// Generate title text based on mode
		let titleText = '';
		const noteName = targetFile?.basename || params.note || 'Current note';

		if (params.title === 'simple') {
			// Simple mode: "Descendants of Note"
			titleText = `${typeName} of ${noteName}`;
		} else if (params.title === 'detailed') {
			// Detailed mode: Include filtering information
			titleText = `${typeName} of ${noteName}`;

			// Add filter details on a separate line in smaller font
			const filterParts: string[] = [];
			if (params.filterTag) {
				filterParts.push(`tag: ${params.filterTag}`);
			}
			if (params.filterFolder) {
				filterParts.push(`folder: ${params.filterFolder}`);
			}
			if (params.exclude) {
				const excludeCount = params.exclude.split(',').length;
				filterParts.push(`excluding ${excludeCount} note${excludeCount > 1 ? 's' : ''}`);
			}
			if (params.maxNodes) {
				filterParts.push(`max: ${params.maxNodes}`);
			}

			if (filterParts.length > 0) {
				// Create main title text
				const mainTitleEl = titleEl.createSpan('relation-codeblock-title-main');
				mainTitleEl.setText(titleText);

				// Create details on separate line
				const detailsEl = titleEl.createDiv('relation-codeblock-title-details');
				detailsEl.setText(filterParts.join(', '));
				return; // Early return since we've already populated titleEl
			}
		}

		titleEl.setText(titleText);
	}

	/**
	 * Renders error message.
	 *
	 * @param container - Container element to render into
	 * @param message - Error message to display
	 * @param field - Optional field name that caused the error
	 */
	private renderError(
		container: HTMLElement,
		message: string,
		field?: string
	): void {
		container.empty();
		container.addClass('relation-codeblock-error');

		const errorBox = container.createDiv('relation-codeblock-error-box');

		const errorIcon = errorBox.createSpan('relation-codeblock-error-icon');
		errorIcon.setText('⚠️');

		const errorMessage = errorBox.createDiv('relation-codeblock-error-message');
		errorMessage.setText(message);

		if (field) {
			const errorField = errorBox.createDiv('relation-codeblock-error-field');
			errorField.setText(`Field: ${field}`);
		}
	}
}

/**
 * Creates a new codeblock processor instance.
 *
 * @param app - Obsidian app instance
 * @param plugin - Parent relation plugin instance
 * @returns New CodeblockProcessor instance
 */
export function createCodeblockProcessor(
	app: App,
	plugin: ParentRelationPlugin
): CodeblockProcessor {
	return new CodeblockProcessor(app, plugin);
}
