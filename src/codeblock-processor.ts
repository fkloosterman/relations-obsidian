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

			// Build tree based on type
			const tree = this.buildTree(
				params.type,
				targetFile,
				engine,
				graph,
				params
			);

			// Render tree
			this.renderTree(el, tree, params);

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
	 * @returns Built tree node(s) or null
	 */
	private buildTree(
		type: RelationType,
		file: TFile,
		engine: any,
		graph: any,
		params: CodeblockParams
	): TreeNode | TreeNode[] | null {
		const buildOptions = {
			maxDepth: params.depth,
			detectCycles: params.showCycles ?? true,
			includeMetadata: true
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
	 */
	private renderTree(
		container: HTMLElement,
		tree: TreeNode | TreeNode[] | null,
		params: CodeblockParams
	): void {
		container.empty();
		container.addClass('relation-codeblock-container');

		// Add mode class for styling
		if (params.mode) {
			container.addClass(`relation-codeblock-mode-${params.mode}`);
		}

		// Handle empty result
		if (!tree || (Array.isArray(tree) && tree.length === 0)) {
			const emptyEl = container.createDiv('relation-codeblock-empty');
			emptyEl.setText(`No ${params.type} found`);
			return;
		}

		// Create renderer
		const renderer = new TreeRenderer(this.app, {
			collapsible: params.mode === 'tree',
			initialDepth: params.collapsed ? 0 : 2,
			enableNavigation: true,
			showCycleIndicators: params.showCycles ?? true,
			cssPrefix: 'relation-codeblock'
		}, this.plugin);

		// Render tree(s)
		if (Array.isArray(tree)) {
			// Multiple trees (siblings, cousins)
			tree.forEach(node => {
				renderer.render(node, container);
			});
		} else {
			// Single tree (ancestors, descendants)
			renderer.render(tree, container);
		}
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
