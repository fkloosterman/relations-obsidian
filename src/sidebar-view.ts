import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import type ParentRelationPlugin from './main';
import { TreeRenderer } from './tree-renderer';
import { buildAncestorTree, TreeNode } from './tree-model';

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

		// Create header
		this.createHeader(container);

		// Create content container
		this.contentContainer = container.createDiv('relation-sidebar-content');

		// Prevent sidebar container from bubbling events to ItemView, except for toggle buttons and clickable names
		this.containerEl.addEventListener('click', (e) => {
			const target = e.target as Element;
			if (target && !target.closest('.relation-tree-toggle') && !target.closest('.relation-tree-name-clickable')) {
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
	}

	/**
	 * Creates the header section with title and controls.
	 */
	private createHeader(container: HTMLElement): void {
		const header = container.createDiv('relation-sidebar-header');

		// Title
		const title = header.createDiv('relation-sidebar-title');
		title.setText('Relation Explorer');

		// We'll add mode selector and controls in Milestone 4.2
		// For now, just show the title
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
				// Only update if the changed file is currently displayed
				if (this.currentFile && file.path === this.currentFile.path) {
					this.updateView();
				}
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
	 * Renders the tree for the given file.
	 */
	private renderTree(file: TFile): void {
		try {
			// Build tree based on current mode
			const tree = this.buildTreeForMode(file);

			console.log('[Relation Explorer] Built tree for', file.basename);

			if (!tree) {
				this.showNoRelationsState();
				return;
			}

			// Render tree
			this.renderer.render(tree, this.contentContainer);

		} catch (error) {
			console.error('[Relation Explorer] Error rendering tree:', error);
			this.showErrorState(error);
		}
	}

	/**
	 * Builds a tree based on the current display mode.
	 */
	private buildTreeForMode(file: TFile) {
		const engine = this.plugin.relationshipEngine;
		const graph = this.plugin.relationGraph;

		switch (this.viewState.mode) {
			case SidebarDisplayMode.ANCESTORS:
				// Debug: Check what ancestors are found
				const ancestors = engine.getAncestors(file, this.plugin.settings.maxDepth);
				console.log('[Relation Explorer] Raw ancestors from engine:', ancestors);
				console.log('[Relation Explorer] Ancestors length:', ancestors.length);
				
				return buildAncestorTree(file, engine, graph, {
					maxDepth: this.plugin.settings.maxDepth,
					detectCycles: true,
					includeMetadata: true
				});

			case SidebarDisplayMode.DESCENDANTS:
				// Will be implemented in future milestone
				// For now, fall back to ancestors
				return buildAncestorTree(file, engine, graph, {
					maxDepth: this.plugin.settings.maxDepth,
					detectCycles: true,
					includeMetadata: true
				});

			case SidebarDisplayMode.FULL_LINEAGE:
				// Will be implemented in future milestone
				return buildAncestorTree(file, engine, graph, {
					maxDepth: this.plugin.settings.maxDepth,
					detectCycles: true,
					includeMetadata: true
				});

			case SidebarDisplayMode.SIBLINGS:
				// Will be implemented in future milestone
				return buildAncestorTree(file, engine, graph, {
					maxDepth: this.plugin.settings.maxDepth,
					detectCycles: true,
					includeMetadata: true
				});

			default:
				return buildAncestorTree(file, engine, graph, {
					maxDepth: this.plugin.settings.maxDepth,
					detectCycles: true,
					includeMetadata: true
				});
		}
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
		empty.createEl('p', {
			text: `This note has no ${this.viewState.mode}`,
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
	 * Refreshes the view (forces re-render).
	 */
	refresh(): void {
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