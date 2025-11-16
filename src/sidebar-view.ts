import { ItemView, WorkspaceLeaf, TFile, setIcon } from 'obsidian';
import type ParentRelationPlugin from './main';
import { TreeRenderer } from './tree-renderer';
import { buildAncestorTree, buildDescendantTree, buildSiblingTree, TreeNode } from './tree-model';
import { ParentFieldSelector } from './parent-field-selector';

/**
 * View type identifier for the relation sidebar
 */
export const VIEW_TYPE_RELATION_SIDEBAR = 'relation-sidebar-view';

/**
 * Display mode for the sidebar
 */
export enum SidebarDisplayMode {
	ANCESTORS = 'ancestors',
	DESCENDANTS = 'descendants',
	FULL_LINEAGE = 'full-lineage',
	SIBLINGS = 'siblings'
}

/**
 * Sidebar view state (persisted across sessions)
 */
export interface SidebarViewState {
	/** Currently selected parent field name */
	selectedParentField: string;

	/** Pin state per parent field (fieldName -> filePath) */
	pinnedFiles: Record<string, string>;

	/** Collapsed sections per parent field */
	collapsedSections: Record<string, string[]>;  // fieldName -> ['ancestors', 'descendants', 'siblings']
}

/**
 * Default view state
 */
const DEFAULT_VIEW_STATE: SidebarViewState = {
	selectedParentField: 'parent',
	pinnedFiles: {},
	collapsedSections: {}
};

/**
 * Sidebar view for displaying relationship trees.
 *
 * Features:
 * - Auto-updates when active note changes
 * - Supports multiple display modes
 * - Can be pinned to a specific note
 * - Persists state across sessions
 */
export class RelationSidebarView extends ItemView {
	private plugin: ParentRelationPlugin;
	private renderer: TreeRenderer;
	private currentFile: TFile | null = null;
	private viewState: SidebarViewState;
	private contentContainer!: HTMLElement;
	private headerContainer!: HTMLElement;
	private fieldSelector: ParentFieldSelector | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ParentRelationPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.viewState = { ...DEFAULT_VIEW_STATE };

		// Initialize tree renderer
		this.renderer = new TreeRenderer(this.app, {
			collapsible: true,
			initiallyCollapsed: false,
			enableNavigation: true,
			showCycleIndicators: true,
			cssPrefix: 'relation-tree'
		});
	}

	/**
	 * Returns the view type identifier.
	 */
	getViewType(): string {
		return VIEW_TYPE_RELATION_SIDEBAR;
	}

	/**
	 * Returns the display text for the view.
	 */
	getDisplayText(): string {
		return 'Relation Explorer';
	}

	/**
	 * Returns the icon for the view.
	 */
	getIcon(): string {
		return 'git-fork'; // Obsidian's built-in icon
	}

	/**
	 * Called when the view is opened.
	 */
	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('relation-sidebar-container');

		// Create header container
		this.headerContainer = container.createDiv('relation-sidebar-header-wrapper');
		this.createHeader();

		// Create content container
		this.contentContainer = container.createDiv('relation-sidebar-content');

		// Prevent sidebar container from bubbling events to ItemView, except for interactive elements
		this.containerEl.addEventListener('click', (e) => {
			const target = e.target as Element;
			// Allow clicks on: tree toggles, tree names, section headers, sibling names, field selector buttons, and pin button
			if (target &&
				!target.closest('.relation-tree-toggle') &&
				!target.closest('.relation-tree-name-clickable') &&
				!target.closest('.relation-section-header') &&
				!target.closest('.relation-sibling-name') &&
				!target.closest('.parent-field-segment') &&
				!target.closest('.parent-field-dropdown') &&
				!target.closest('.relation-sidebar-pin-button')) {
				e.stopPropagation();
			}
		}, { capture: true });

		// Register event handlers
		this.registerEventHandlers();

		// Initial render (delayed to allow metadata to load)
		setTimeout(() => this.updateView(), 100);
	}

	/**
	 * Called when the view is closed.
	 */
	async onClose(): Promise<void> {
		// Cleanup renderer
		this.renderer.destroy();

		// Cleanup field selector
		if (this.fieldSelector) {
			this.fieldSelector.destroy();
		}
	}

	/**
	 * Creates the header section with title and controls.
	 */
	private createHeader(): void {
		// Clear existing header
		this.headerContainer.empty();

		// Cleanup existing field selector
		if (this.fieldSelector) {
			this.fieldSelector.destroy();
			this.fieldSelector = null;
		}

		const header = this.headerContainer.createDiv('relation-sidebar-header');

		// Title
		const title = header.createDiv('relation-sidebar-title');
		title.setText('Relation Explorer');

		// Parent field selector (only shown if multiple fields)
		if (this.plugin.settings.parentFields.length > 1) {
			const selectorContainer = header.createDiv('parent-field-selector-container');

			this.fieldSelector = new ParentFieldSelector(
				this.app,
				selectorContainer,
				{
					fields: this.plugin.settings.parentFields,
					selectedField: this.viewState.selectedParentField,
					uiStyle: this.plugin.settings.uiStyle,
					onChange: (fieldName: string) => {
						this.onFieldChange(fieldName);
					}
				}
			);
		}
	}

	/**
	 * Handles field selection change.
	 */
	private onFieldChange(fieldName: string): void {
		this.viewState.selectedParentField = fieldName;
		this.updateView();
	}

	/**
	 * Updates the pin button appearance based on current pin state.
	 */
	private updatePinButton(button: HTMLElement): void {
		button.empty();
		const isPinned = this.isPinned();

		if (isPinned) {
			setIcon(button, 'pin');
			button.addClass('is-active');
			button.setAttribute('aria-label', 'Unpin from this note');
			// Bold visual feedback for pinned state
			button.style.color = 'var(--text-on-accent)';
			button.style.backgroundColor = 'var(--interactive-accent)';
			button.style.borderRadius = '4px';
			button.style.padding = '6px';
			button.style.opacity = '1';
		} else {
			setIcon(button, 'pin');
			button.removeClass('is-active');
			button.setAttribute('aria-label', 'Pin to this note');
			// Subtle visual feedback for unpinned state
			button.style.color = 'var(--icon-color)';
			button.style.backgroundColor = 'transparent';
			button.style.borderRadius = '4px';
			button.style.padding = '6px';
			button.style.opacity = '0.6';
		}

		// Hover effect
		button.onmouseenter = () => {
			if (!isPinned) {
				button.style.backgroundColor = 'var(--background-modifier-hover)';
				button.style.opacity = '1';
			}
		};
		button.onmouseleave = () => {
			if (!isPinned) {
				button.style.backgroundColor = 'transparent';
				button.style.opacity = '0.6';
			}
		};
	}

	/**
	 * Toggles the pin state for the current parent field.
	 */
	private togglePin(): void {
		if (this.isPinned()) {
			this.unpin();
		} else {
			this.pin();
		}
		// Note: pin() and unpin() already call updateView() which refreshes everything
	}

	/**
	 * Registers event handlers for auto-updating.
	 */
	private registerEventHandlers(): void {
		// Update when active file changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				// Check if pinned for the current field
				const isPinnedToCurrentField = !!this.viewState.pinnedFiles[this.viewState.selectedParentField];
				if (!isPinnedToCurrentField) {
					const newActiveFile = this.app.workspace.getActiveFile();
					if (!this.currentFile || !newActiveFile || this.currentFile.path !== newActiveFile.path) {
						this.updateView();
					}
				}
			})
		);

		// Update when file content changes (metadata)
		this.registerEvent(
			this.app.metadataCache.on('changed', (file: TFile) => {
				// Always update when metadata changes, since any file's parent field
				// change could affect the relationships of the currently displayed file
				// (e.g., a new descendant was added, or a sibling's parent changed)
				this.updateView();
			})
		);

		// Update when file is renamed
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				console.log('[Relation Sidebar] Rename event:', oldPath, '->', file.path);
				if (file instanceof TFile) {
					// Update if the renamed file is currently displayed
					if (this.currentFile && oldPath === this.currentFile.path) {
						console.log('[Relation Sidebar] Updating current file from', this.currentFile.basename, 'to', file.basename);
						this.currentFile = file;
					}

					// Update if pinned file was renamed (for any field)
					for (const [fieldName, pinnedPath] of Object.entries(this.viewState.pinnedFiles)) {
						if (pinnedPath === oldPath) {
							console.log('[Relation Sidebar] Updating pinned file path for field', fieldName);
							this.viewState.pinnedFiles[fieldName] = file.path;
						}
					}

					// Always refresh the view since the renamed file might appear in the tree
					// (e.g., as an ancestor, descendant, or sibling of the displayed file)
					this.updateView();
				}
			})
		);

		// Update when file is deleted
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					// Clear view if displayed file is deleted
					if (this.currentFile && file.path === this.currentFile.path) {
						this.currentFile = null;
						this.updateView();
					}

					// Unpin if pinned file is deleted (for any field)
					for (const [fieldName, pinnedPath] of Object.entries(this.viewState.pinnedFiles)) {
						if (pinnedPath === file.path) {
							delete this.viewState.pinnedFiles[fieldName];
							this.updateView();
						}
					}
				}
			})
		);
	}

	/**
	 * Updates the view content based on current state.
	 */
	private updateView(): void {
		console.log('[Relation Sidebar] updateView called, currentFile:', this.currentFile?.basename);

		// Validate that selected field still exists
		const fieldExists = this.plugin.settings.parentFields.some(
			f => f.name === this.viewState.selectedParentField
		);

		if (!fieldExists) {
			// Fall back to default field
			this.viewState.selectedParentField = this.plugin.settings.defaultParentField;
		}

		// Clear content
		this.contentContainer.empty();

		// Determine which file to display
		const fileToDisplay = this.getFileToDisplay();
		console.log('[Relation Sidebar] fileToDisplay:', fileToDisplay?.basename);

		if (!fileToDisplay) {
			this.showEmptyState();
			return;
		}

		// Update current file
		this.currentFile = fileToDisplay;

		// Build and render tree based on mode
		this.renderTree(fileToDisplay);
	}

	/**
	 * Gets the file to display based on view state.
	 */
	private getFileToDisplay(): TFile | null {
		// If pinned for current field, use pinned file
		const pinnedPath = this.viewState.pinnedFiles[this.viewState.selectedParentField];
		if (pinnedPath) {
			const pinnedFile = this.app.vault.getAbstractFileByPath(pinnedPath);
			if (pinnedFile instanceof TFile) {
				return pinnedFile;
			}
			// Pinned file not found, unpin
			delete this.viewState.pinnedFiles[this.viewState.selectedParentField];
		}

		// Otherwise, use active file
		const activeFile = this.app.workspace.getActiveFile();
		return activeFile;
	}

	/**
	 * Renders the tree for the given file with three sections.
	 */
	private renderTree(file: TFile): void {
		try {
			// Get the field configuration
			const fieldConfig = this.plugin.settings.parentFields.find(
				f => f.name === this.viewState.selectedParentField
			);

			if (!fieldConfig) {
				this.showErrorState(new Error('Field configuration not found'));
				return;
			}

			// Get the engine and graph for the current field
			const engine = this.plugin.getEngineForField(this.viewState.selectedParentField);
			const graph = this.plugin.getGraphForField(this.viewState.selectedParentField);

			if (!engine || !graph) {
				this.showErrorState(new Error('Engine or graph not found'));
				return;
			}

			// Check if any sections will be visible
			const hasVisibleSections = fieldConfig.ancestors.visible ||
				fieldConfig.descendants.visible ||
				fieldConfig.siblings.visible;

			if (!hasVisibleSections) {
				this.showNoRelationsState();
				return;
			}

			// Render reference note header (current file with pin button)
			this.renderReferenceNote(file);

			// Render ancestors section
			if (fieldConfig.ancestors.visible) {
				this.renderSection('ancestors', file, fieldConfig, engine, graph);
			}

			// Render descendants section
			if (fieldConfig.descendants.visible) {
				this.renderSection('descendants', file, fieldConfig, engine, graph);
			}

			// Render siblings section
			if (fieldConfig.siblings.visible) {
				this.renderSection('siblings', file, fieldConfig, engine, graph);
			}

		} catch (error) {
			console.error('[Relation Explorer] Error rendering tree:', error);
			this.showErrorState(error);
		}
	}

	/**
	 * Renders the reference note header with pin button.
	 */
	private renderReferenceNote(file: TFile): void {
		const referenceContainer = this.contentContainer.createDiv('relation-reference-note');
		// Flex container for horizontal layout
		referenceContainer.style.display = 'flex';
		referenceContainer.style.alignItems = 'center';
		referenceContainer.style.justifyContent = 'space-between';
		referenceContainer.style.padding = '8px 12px';
		referenceContainer.style.marginBottom = '8px';
		referenceContainer.style.backgroundColor = 'var(--background-secondary)';
		referenceContainer.style.borderRadius = '6px';

		const nameContainer = referenceContainer.createDiv('relation-reference-note-content');
		nameContainer.style.display = 'flex';
		nameContainer.style.alignItems = 'center';
		nameContainer.style.gap = '8px';

		// File icon
		const icon = nameContainer.createDiv('relation-reference-note-icon');
		icon.style.display = 'flex';
		icon.style.alignItems = 'center';
		icon.style.opacity = '0.7';
		setIcon(icon, 'file');

		// File name
		const name = nameContainer.createDiv('relation-reference-note-name');
		name.setText(file.basename);
		name.style.fontWeight = '500';

		// Pin button
		const pinButton = referenceContainer.createDiv('relation-sidebar-pin-button');
		pinButton.style.display = 'flex';
		pinButton.style.alignItems = 'center';
		pinButton.style.cursor = 'pointer';
		this.updatePinButton(pinButton);

		pinButton.addEventListener('click', () => {
			this.togglePin();
		});
	}

	/**
	 * Renders a single collapsible section (ancestors, descendants, or siblings).
	 */
	private renderSection(
		sectionType: 'ancestors' | 'descendants' | 'siblings',
		file: TFile,
		fieldConfig: any,
		engine: any,
		graph: any
	): void {
		const sectionConfig = fieldConfig[sectionType];
		const sectionContainer = this.contentContainer.createDiv('relation-section');
		sectionContainer.addClass(`relation-section-${sectionType}`);

		// Check if section should be collapsed
		const collapsedSections = this.viewState.collapsedSections[this.viewState.selectedParentField] || [];
		const isCollapsed = sectionConfig.collapsed || collapsedSections.includes(sectionType);

		// Create section header (clickable to toggle)
		const header = sectionContainer.createDiv('relation-section-header');

		// Add toggle button
		const toggle = header.createDiv('relation-section-toggle');
		toggle.setText(isCollapsed ? '▶' : '▼');

		const title = header.createDiv('relation-section-title');
		title.setText(sectionConfig.displayName || sectionType);

		// Make entire header clickable
		header.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleSection(sectionType);
		});

		// Create section content
		const content = sectionContainer.createDiv('relation-section-content');
		if (isCollapsed) {
			content.addClass('is-collapsed');
			content.style.display = 'none';
		}

		// Build and render tree/list for this section
		if (sectionType === 'siblings') {
			// Render siblings as a flat list
			this.renderSiblingsList(file, engine, content);
		} else {
			// Build and render tree for ancestors/descendants
			const tree = this.buildTreeForSection(sectionType, file, fieldConfig, engine, graph);

			// Check if tree has any children (ancestors/descendants exist)
			if (tree && tree.children && tree.children.length > 0) {
				// Add tree container class for styling
				content.classList.add(`${this.renderer['options'].cssPrefix}-container`);

				// Render only the children, not the root node (current file)
				// Adjust depth to remove indentation from skipped root
				tree.children.forEach(childNode => {
					const adjustedNode = this.adjustTreeDepth(childNode, -1);
					// Use renderNode() directly to preserve collapse state across multiple nodes
					const nodeElement = this.renderer['renderNode'](adjustedNode, 0);
					content.appendChild(nodeElement);
				});
			} else {
				// Show empty message for this section
				const emptyMessage = content.createDiv('relation-section-empty');
				emptyMessage.setText(this.getEmptyMessage(sectionType));
			}
		}
	}

	/**
	 * Renders siblings as a flat list instead of a tree.
	 */
	private renderSiblingsList(file: TFile, engine: any, container: HTMLElement): void {
		const siblings = engine.getSiblings(file, false); // Exclude self

		if (siblings.length === 0) {
			const emptyMessage = container.createDiv('relation-section-empty');
			emptyMessage.setText(this.getEmptyMessage('siblings'));
			return;
		}

		const listContainer = container.createDiv('relation-siblings-list');
		// Match font size with tree views
		listContainer.style.fontSize = 'var(--font-ui-small)';

		siblings.forEach((sibling: TFile) => {
			const item = listContainer.createDiv('relation-sibling-item');

			// File icon
			const icon = item.createDiv('relation-sibling-icon');
			icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';

			// File name (clickable)
			const name = item.createSpan('relation-sibling-name');
			name.setText(sibling.basename);

			// Click to open file
			name.addEventListener('click', async (e) => {
				e.preventDefault();
				e.stopPropagation();

				try {
					// Open file in split pane if Ctrl/Cmd is held
					if (e.ctrlKey || e.metaKey) {
						await this.app.workspace.openLinkText(sibling.basename, '', 'split');
					} else {
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(sibling);
					}
				} catch (error) {
					console.error('[Relation Sidebar] Error opening file:', error);
				}
			});

			// Hover preview
			name.addEventListener('mouseenter', (e) => {
				this.app.workspace.trigger('hover-link', {
					event: e,
					source: 'relation-explorer',
					hoverParent: item,
					targetEl: name,
					linktext: sibling.path
				});
			});
		});
	}

	/**
	 * Toggles a section's collapsed state.
	 */
	private toggleSection(sectionType: string): void {
		const fieldName = this.viewState.selectedParentField;

		// Initialize collapsed sections for this field if needed
		if (!this.viewState.collapsedSections[fieldName]) {
			this.viewState.collapsedSections[fieldName] = [];
		}

		const collapsedSections = this.viewState.collapsedSections[fieldName];
		const index = collapsedSections.indexOf(sectionType);

		if (index >= 0) {
			// Expand
			collapsedSections.splice(index, 1);
		} else {
			// Collapse
			collapsedSections.push(sectionType);
		}

		// Re-render to update UI
		this.updateView();
	}

	/**
	 * Gets an empty message for a section.
	 */
	private getEmptyMessage(sectionType: string): string {
		switch (sectionType) {
			case 'ancestors':
				return 'No ancestors found';
			case 'descendants':
				return 'No descendants found';
			case 'siblings':
				return 'No siblings found';
			default:
				return 'No relationships found';
		}
	}

	/**
	 * Adjusts the depth of a tree node and all its descendants.
	 * Used to fix indentation when rendering subtrees without their root.
	 *
	 * @param node - The tree node to adjust
	 * @param adjustment - Amount to add to depth (can be negative)
	 * @returns A new tree node with adjusted depth
	 */
	private adjustTreeDepth(node: TreeNode, adjustment: number): TreeNode {
		return {
			...node,
			depth: Math.max(0, node.depth + adjustment),
			children: node.children.map(child => this.adjustTreeDepth(child, adjustment))
		};
	}

	/**
	 * Builds a tree for a specific section type.
	 */
	private buildTreeForSection(
		sectionType: 'ancestors' | 'descendants' | 'siblings',
		file: TFile,
		fieldConfig: any,
		engine: any,
		graph: any
	): TreeNode | null {
		const sectionConfig = fieldConfig[sectionType];

		try {
			switch (sectionType) {
				case 'ancestors':
					return buildAncestorTree(file, engine, graph, {
						maxDepth: sectionConfig.maxDepth ?? 5,
						detectCycles: true,
						includeMetadata: true
					});

				case 'descendants':
					return buildDescendantTree(file, engine, graph, {
						maxDepth: sectionConfig.maxDepth ?? 5,
						detectCycles: true,
						includeMetadata: true
					});

			case 'siblings':
				// buildSiblingTree returns TreeNode[], so we need to wrap it
				const siblings = buildSiblingTree(file, engine, graph, {
					detectCycles: true,
					includeMetadata: true
				});

				// If no siblings, return null
				if (siblings.length === 0) {
					return null;
				}

				// Create a container node for siblings
				return {
					file: file,
					children: siblings,
					depth: 0,
					isCycle: false,
					metadata: {
						type: 'siblings-container'
					}
				};

				default:
					return null;
			}
		} catch (error) {
			console.error(`[Relation Explorer] Error building ${sectionType} tree:`, error);
			return null;
		}
	}

	/**
	 * Builds a tree based on the current display mode.
	 * @deprecated Use buildTreeForSection instead
	 */
	private buildTreeForMode(file: TFile) {
		// Get the engine and graph for the currently selected parent field
		const engine = this.plugin.getEngineForField(this.viewState.selectedParentField);
		const graph = this.plugin.getGraphForField(this.viewState.selectedParentField);

		if (!engine || !graph) {
			console.error('[Relation Explorer] No engine or graph found for field:', this.viewState.selectedParentField);
			return null;
		}

		// Get the field configuration for maxDepth
		const fieldConfig = this.plugin.settings.parentFields.find(
			f => f.name === this.viewState.selectedParentField
		);
		const maxDepth = fieldConfig?.ancestors.maxDepth ?? 5;

		// For now, always show ancestors (Phase 2 will add mode switching)
		// Debug: Check what ancestors are found
		const ancestors = engine.getAncestors(file, maxDepth);
		console.log('[Relation Explorer] Raw ancestors from engine:', ancestors);
		console.log('[Relation Explorer] Ancestors length:', ancestors.length);

		return buildAncestorTree(file, engine, graph, {
			maxDepth: maxDepth,
			detectCycles: true,
			includeMetadata: true
		});
	}

	/**
	 * Shows empty state when no file is active.
	 */
	private showEmptyState(): void {
		const empty = this.contentContainer.createDiv('relation-sidebar-empty');
		empty.createEl('p', {
			text: 'No active file',
			cls: 'relation-sidebar-empty-text'
		});
		empty.createEl('p', {
			text: 'Open a note to see its relationships',
			cls: 'relation-sidebar-empty-hint'
		});
	}

	/**
	 * Shows state when file has no relations.
	 */
	private showNoRelationsState(): void {
		const empty = this.contentContainer.createDiv('relation-sidebar-empty');
		empty.createEl('p', {
			text: 'No relationships found',
			cls: 'relation-sidebar-empty-text'
		});

		// Get the display name of the current field
		const fieldConfig = this.plugin.settings.parentFields.find(
			f => f.name === this.viewState.selectedParentField
		);
		const fieldDisplayName = fieldConfig?.displayName || this.viewState.selectedParentField;

		empty.createEl('p', {
			text: `This note has no ancestors in the "${fieldDisplayName}" hierarchy`,
			cls: 'relation-sidebar-empty-hint'
		});
	}

	/**
	 * Shows error state.
	 */
	private showErrorState(error: any): void {
		const errorContainer = this.contentContainer.createDiv('relation-sidebar-error');
		errorContainer.createEl('p', {
			text: 'Error loading relationships',
			cls: 'relation-sidebar-error-text'
		});
		errorContainer.createEl('p', {
			text: error.message || 'Unknown error',
			cls: 'relation-sidebar-error-details'
		});
	}

	/**
	 * Gets the current view state for persistence.
	 */
	getState(): Record<string, unknown> {
		return {
			...this.viewState
		};
	}

	/**
	 * Restores view state from saved data.
	 */
	async setState(state: any, result: any): Promise<void> {
		if (state) {
			this.viewState = {
				...DEFAULT_VIEW_STATE,
				...state
			};
		}

		await super.setState(state, result);

		// Update view with restored state
		this.updateView();
	}

	/**
	 * Updates the field selector with current settings.
	 */
	private updateFieldSelector(): void {
		const hadMultipleFields = this.fieldSelector !== null;
		const hasMultipleFields = this.plugin.settings.parentFields.length > 1;

		// If field count changed (1 <-> multiple), recreate header
		if (hadMultipleFields !== hasMultipleFields) {
			this.createHeader();
			return;
		}

		// Otherwise just update the existing selector
		if (this.fieldSelector) {
			this.fieldSelector.update({
				fields: this.plugin.settings.parentFields,
				selectedField: this.viewState.selectedParentField,
				uiStyle: this.plugin.settings.uiStyle
			});
		}
	}

	/**
	 * Refreshes the view (forces re-render).
	 */
	refresh(): void {
		this.updateFieldSelector();
		this.updateView();
	}

	/**
	 * Sets the display mode.
	 * @deprecated Multi-field architecture uses parent field selection instead
	 */
	setMode(mode: SidebarDisplayMode): void {
		// This method is kept for backward compatibility but is no longer used
		// in the multi-field architecture
		this.updateView();
	}

	/**
	 * Pins the view to the current file for the current parent field.
	 */
	pin(): void {
		if (this.currentFile) {
			this.viewState.pinnedFiles[this.viewState.selectedParentField] = this.currentFile.path;
			this.updateView();
		}
	}

	/**
	 * Unpins the view for the current parent field.
	 */
	unpin(): void {
		delete this.viewState.pinnedFiles[this.viewState.selectedParentField];
		this.updateView();
	}

	/**
	 * Checks if the view is currently pinned for the current parent field.
	 */
	isPinned(): boolean {
		return !!this.viewState.pinnedFiles[this.viewState.selectedParentField];
	}
}