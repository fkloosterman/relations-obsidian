import { App, Menu, Notice, TFile } from 'obsidian';
import type ParentRelationPlugin from './main';
import type { RelationSidebarView } from './sidebar-view';
import { TreeNode } from './tree-model';
import { FrontmatterEditor } from './frontmatter-editor';
import { ConfirmationModal } from './components/confirmation-modal';

/**
 * Context information for building a node context menu
 */
export interface NodeMenuContext {
	/** The tree node that was right-clicked */
	node: TreeNode;

	/** The file represented by the node */
	file: TFile;

	/** Which section the node appears in */
	section: 'ancestors' | 'descendants' | 'siblings';

	/** Currently selected parent field */
	parentField: string;

	/** Display name of the parent field */
	parentFieldDisplayName: string;

	/** Display name of the section */
	sectionDisplayName: string;

	/** Display name of the ancestors section (for siblings menu) */
	ancestorsSectionDisplayName?: string;

	/** Display name of the descendants section (for siblings menu) */
	descendantsSectionDisplayName?: string;

	/** Reference to the sidebar instance */
	sidebarView: RelationSidebarView;

	/** Whether the sidebar is currently pinned */
	isPinned: boolean;

	/** DOM element that was clicked */
	targetElement: HTMLElement;

	/** The mouse event that triggered the menu (if applicable) */
	event?: MouseEvent;
}

/**
 * Extended context for advanced menu actions (Milestone 4.3B)
 */
export interface AdvancedMenuContext extends NodeMenuContext {
	/** The frontmatter editor instance */
	frontmatterEditor: FrontmatterEditor;

	/** Whether the node is currently a parent of active file */
	isCurrentParent: boolean;

	/** Whether the active file is currently a parent of this node (i.e., this node is a child) */
	isCurrentChild: boolean;

	/** Whether the node has children that can be expanded */
	hasExpandableChildren: boolean;
}

/**
 * Configuration for the context menu builder
 */
export interface ContextMenuConfig {
	/** Whether to show navigation actions */
	showNavigation?: boolean;

	/** Whether to show pin actions */
	showPin?: boolean;

	/** Whether to show copy actions */
	showCopy?: boolean;

	/** Whether to show relationship actions (Milestone 4.3B) */
	showRelationship?: boolean;

	/** Whether to show tree manipulation actions (Milestone 4.3B) */
	showTreeActions?: boolean;
}

/**
 * Default configuration for context menus
 */
const DEFAULT_MENU_CONFIG: Required<ContextMenuConfig> = {
	showNavigation: true,
	showPin: true,
	showCopy: true,
	showRelationship: true,   // Milestone 4.3B - now enabled
	showTreeActions: true      // Milestone 4.3B - now enabled
};

/**
 * Builds context menus for tree nodes in the relation sidebar.
 *
 * Supports section-aware menus with actions for navigation, pinning,
 * copying, and (in Milestone 4.3B) relationship modification.
 */
export class ContextMenuBuilder {
	private app: App;
	private plugin: ParentRelationPlugin;
	private config: Required<ContextMenuConfig>;
	private frontmatterEditor: FrontmatterEditor;

	/**
	 * Creates a new context menu builder.
	 *
	 * @param app - The Obsidian app instance
	 * @param plugin - The parent relation plugin instance
	 * @param config - Optional configuration for menu features
	 */
	constructor(
		app: App,
		plugin: ParentRelationPlugin,
		config: ContextMenuConfig = {}
	) {
		this.app = app;
		this.plugin = plugin;
		this.config = { ...DEFAULT_MENU_CONFIG, ...config };
		this.frontmatterEditor = new FrontmatterEditor(app);
	}

	/**
	 * Builds and shows a context menu for a tree node.
	 *
	 * @param context - The menu context information
	 */
	showContextMenu(context: NodeMenuContext): void {
		const menu = new Menu();

		// Create advanced context with detection
		const advancedContext = this.createAdvancedContext(context);

		// Build menu sections
		this.addCoreActions(menu, context);

		// Add advanced actions (Milestone 4.3B)
		if (this.config.showRelationship || this.config.showTreeActions) {
			this.addAdvancedActions(menu, advancedContext);
		}

		// Show menu at mouse position or element position
		if (context.event) {
			menu.showAtMouseEvent(context.event);
		} else {
			// Keyboard trigger - show at element position
			const rect = context.targetElement.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom });
		}
	}

	/**
	 * Creates an advanced context with relationship detection.
	 *
	 * @param context - The basic menu context
	 * @returns Extended context with detection flags
	 */
	private createAdvancedContext(context: NodeMenuContext): AdvancedMenuContext {
		const currentFile = this.app.workspace.getActiveFile();

		return {
			...context,
			frontmatterEditor: this.frontmatterEditor,
			isCurrentParent: this.isNodeParentOfFile(context.file, currentFile, context.parentField),
			isCurrentChild: this.isNodeChildOfFile(context.file, currentFile, context.parentField),
			hasExpandableChildren: context.node.children.length > 0
		};
	}

	/**
	 * Checks if a node is a parent of the given file.
	 *
	 * @param nodeFile - The node's file
	 * @param targetFile - The file to check
	 * @param parentField - The parent field to check
	 * @returns True if nodeFile is a parent of targetFile
	 */
	private isNodeParentOfFile(nodeFile: TFile, targetFile: TFile | null, parentField: string): boolean {
		if (!targetFile) return false;

		const wikiLink = `[[${nodeFile.basename}]]`;
		return this.frontmatterEditor.hasFieldValue(targetFile, parentField, wikiLink);
	}

	/**
	 * Checks if a node is a child of the given file.
	 *
	 * @param nodeFile - The node's file
	 * @param targetFile - The file to check
	 * @param parentField - The parent field to check
	 * @returns True if nodeFile is a child of targetFile
	 */
	private isNodeChildOfFile(nodeFile: TFile, targetFile: TFile | null, parentField: string): boolean {
		if (!targetFile) return false;

		const wikiLink = `[[${targetFile.basename}]]`;
		return this.frontmatterEditor.hasFieldValue(nodeFile, parentField, wikiLink);
	}

	/**
	 * Adds core actions (navigation, pin, copy) to the menu.
	 *
	 * @param menu - The menu to add items to
	 * @param context - The menu context
	 */
	private addCoreActions(menu: Menu, context: NodeMenuContext): void {
		// Pin actions
		if (this.config.showPin) {
			this.addPinActions(menu, context);
			menu.addSeparator();
		}

		// Navigation actions
		if (this.config.showNavigation) {
			this.addNavigationActions(menu, context);
			menu.addSeparator();
		}

		// Copy actions
		if (this.config.showCopy) {
			this.addCopyActions(menu, context);
		}
	}

	/**
	 * Adds pin-related actions to the menu.
	 *
	 * @param menu - The menu to add items to
	 * @param context - The menu context
	 */
	private addPinActions(menu: Menu, context: NodeMenuContext): void {
		// Pin this note
		menu.addItem(item => {
			item
				.setTitle('Pin this note')
				.setIcon('pin')
				.onClick(() => this.pinNote(context));
		});

		// Pin in new sidebar
		menu.addItem(item => {
			item
				.setTitle('Pin in new sidebar')
				.setIcon('layout-sidebar-right')
				.onClick(() => this.pinInNewSidebar(context));
		});

		// Unpin sidebar (only if currently pinned)
		if (context.isPinned) {
			menu.addItem(item => {
				item
					.setTitle('Unpin sidebar')
					.setIcon('pin-off')
					.onClick(() => this.unpinSidebar(context));
			});
		}
	}

	/**
	 * Adds navigation actions to the menu.
	 *
	 * @param menu - The menu to add items to
	 * @param context - The menu context
	 */
	private addNavigationActions(menu: Menu, context: NodeMenuContext): void {
		// Open in new pane
		menu.addItem(item => {
			item
				.setTitle('Open in new pane')
				.setIcon('file-plus')
				.onClick(() => this.openInNewPane(context));
		});

		// Open to the right
		menu.addItem(item => {
			item
				.setTitle('Open to the right')
				.setIcon('separator-vertical')
				.onClick(() => this.openToRight(context));
		});

		// Reveal in file explorer
		menu.addItem(item => {
			item
				.setTitle('Reveal in file explorer')
				.setIcon('folder-tree')
				.onClick(() => this.revealInExplorer(context));
		});
	}

	/**
	 * Adds copy actions to the menu.
	 *
	 * @param menu - The menu to add items to
	 * @param context - The menu context
	 */
	private addCopyActions(menu: Menu, context: NodeMenuContext): void {
		// Copy link
		menu.addItem(item => {
			item
				.setTitle('Copy link')
				.setIcon('link')
				.onClick(() => this.copyLink(context));
		});

		// Copy path to node
		menu.addItem(item => {
			item
				.setTitle('Copy path to node')
				.setIcon('arrow-right-from-line')
				.onClick(() => this.copyPathToNode(context));
		});
	}

	//
	// Action Handlers
	//

	/**
	 * Pins the clicked note to the current sidebar.
	 *
	 * @param context - The menu context
	 */
	private pinNote(context: NodeMenuContext): void {
		context.sidebarView.pinToFile(context.file);
	}

	/**
	 * Opens a new sidebar instance pinned to the clicked note.
	 *
	 * @param context - The menu context
	 */
	private async pinInNewSidebar(context: NodeMenuContext): Promise<void> {
		await this.plugin.openNewSidebarPinnedTo(
			context.file,
			context.parentField
		);
	}

	/**
	 * Unpins the current sidebar.
	 *
	 * @param context - The menu context
	 */
	private unpinSidebar(context: NodeMenuContext): void {
		context.sidebarView.unpin();
	}

	/**
	 * Opens the file in a new editor pane.
	 *
	 * @param context - The menu context
	 */
	private async openInNewPane(context: NodeMenuContext): Promise<void> {
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.openFile(context.file);
	}

	/**
	 * Opens the file in a split pane to the right.
	 *
	 * @param context - The menu context
	 */
	private async openToRight(context: NodeMenuContext): Promise<void> {
		const leaf = this.app.workspace.getLeaf('split', 'vertical');
		await leaf.openFile(context.file);
	}

	/**
	 * Reveals the file in the file explorer.
	 *
	 * @param context - The menu context
	 */
	private revealInExplorer(context: NodeMenuContext): void {
		// Get the file explorer leaf
		const fileExplorer = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (fileExplorer && fileExplorer.view) {
			// Use type assertion as revealInFolder is not in official types
			(fileExplorer.view as any).revealInFolder(context.file);
		}
	}

	/**
	 * Copies a wiki-link to the file to the clipboard.
	 *
	 * @param context - The menu context
	 */
	private async copyLink(context: NodeMenuContext): Promise<void> {
		const link = `[[${context.file.basename}]]`;
		await navigator.clipboard.writeText(link);
		new Notice('Link copied to clipboard');
	}

	/**
	 * Copies the hierarchical path from root to this node.
	 *
	 * @param context - The menu context
	 */
	private async copyPathToNode(context: NodeMenuContext): Promise<void> {
		const path = this.buildPathToNode(context);
		await navigator.clipboard.writeText(path);
		new Notice('Path copied to clipboard');
	}

	/**
	 * Builds a hierarchical path string for a node.
	 *
	 * This is a simplified version that uses the node's depth to
	 * create a basic indented representation. A full implementation
	 * would traverse the tree to build the actual parent path.
	 *
	 * @param context - The menu context
	 * @returns Path string like "Root > Parent > Current"
	 */
	private buildPathToNode(context: NodeMenuContext): string {
		// For now, create a simple path based on depth
		// TODO: Implement proper path traversal
		const indent = '  '.repeat(context.node.depth);
		return `${indent}${context.file.basename}`;
	}

	//
	// Advanced Actions (Milestone 4.3B)
	//

	/**
	 * Adds advanced actions (relationship modification and tree manipulation).
	 *
	 * @param menu - The menu to add items to
	 * @param context - The advanced menu context
	 */
	private addAdvancedActions(menu: Menu, context: AdvancedMenuContext): void {
		// Relationship modification (section-specific)
		if (this.config.showRelationship && this.shouldShowRelationshipActions(context)) {
			menu.addSeparator();
			this.addRelationshipActions(menu, context);
		}

		// Tree manipulation actions
		if (this.config.showTreeActions && this.shouldShowTreeActions(context)) {
			menu.addSeparator();
			this.addTreeActions(menu, context);
		}
	}

	/**
	 * Determines if relationship actions should be shown.
	 *
	 * @param context - The advanced menu context
	 * @returns True if relationship actions should be shown
	 */
	private shouldShowRelationshipActions(context: AdvancedMenuContext): boolean {
		const { section } = context;

		// Show in ancestors/siblings for "Set as parent" (and "Remove as parent" if applicable)
		if (section === 'ancestors' || section === 'siblings') return true;

		// Show in descendants for "Remove as child"
		if (section === 'descendants') return true;

		return false;
	}

	/**
	 * Converts plural section names to singular form (simple heuristic).
	 *
	 * @param name - The section display name (potentially plural)
	 * @returns Singular form of the name
	 */
	private singularize(name: string): string {
		// Simple heuristic: if ends with 's', remove it
		// This works for: Ancestors → Ancestor, Descendants → Descendant, Siblings → Sibling
		// May not work perfectly for all cases (e.g., "Categories" → "Categorie")
		// but is good enough for most common section names
		if (name.endsWith('s') && name.length > 1) {
			return name.slice(0, -1);
		}
		return name;
	}

	/**
	 * Adds relationship modification actions to the menu.
	 *
	 * @param menu - The menu to add items to
	 * @param context - The advanced menu context
	 */
	private addRelationshipActions(menu: Menu, context: AdvancedMenuContext): void {
		const { section, sectionDisplayName, ancestorsSectionDisplayName, descendantsSectionDisplayName, isCurrentParent, isCurrentChild } = context;

		// Convert section name to singular for menu labels (ancestors/descendants only)
		const singularSectionName = this.singularize(sectionDisplayName);

		// For ancestors section: "Set as Ancestor" / "Remove as Ancestor"
		if (section === 'ancestors') {
			if (!isCurrentParent) {
				menu.addItem(item => {
					item
						.setTitle(`Set as ${singularSectionName}`)
						.setIcon('arrow-up')
						.onClick(() => this.handleSetAsParent(context));
				});
			}
			if (isCurrentParent) {
				menu.addItem(item => {
					item
						.setTitle(`Remove as ${singularSectionName}`)
						.setIcon('x')
						.onClick(() => this.handleRemoveAsParent(context));
				});
			}
		}

		// For descendants section: "Set as Descendant" / "Remove as Descendant"
		if (section === 'descendants') {
			if (!isCurrentChild) {
				menu.addItem(item => {
					item
						.setTitle(`Set as ${singularSectionName}`)
						.setIcon('arrow-down')
						.onClick(() => this.handleSetAsChild(context));
				});
			}
			if (isCurrentChild) {
				menu.addItem(item => {
					item
						.setTitle(`Remove as ${singularSectionName}`)
						.setIcon('x')
						.onClick(() => this.handleRemoveAsChild(context));
				});
			}
		}

		// For siblings section: use ancestor/descendant display names
		if (section === 'siblings') {
			const ancestorLabel = ancestorsSectionDisplayName ? this.singularize(ancestorsSectionDisplayName) : 'Parent';
			const descendantLabel = descendantsSectionDisplayName ? this.singularize(descendantsSectionDisplayName) : 'Child';

			if (!isCurrentParent) {
				menu.addItem(item => {
					item
						.setTitle(`Set as ${ancestorLabel}`)
						.setIcon('arrow-up')
						.onClick(() => this.handleSetAsParent(context));
				});
			}
			if (isCurrentParent) {
				menu.addItem(item => {
					item
						.setTitle(`Remove as ${ancestorLabel}`)
						.setIcon('x')
						.onClick(() => this.handleRemoveAsParent(context));
				});
			}
			menu.addItem(item => {
				item
					.setTitle(`Set as ${descendantLabel}`)
					.setIcon('arrow-down')
					.onClick(() => this.handleSetAsChild(context));
			});
		}
	}

	/**
	 * Handles "Set as [Field] parent" action.
	 *
	 * Adds the clicked node as a parent to the current file's frontmatter.
	 *
	 * @param context - The advanced menu context
	 */
	private async handleSetAsParent(context: AdvancedMenuContext): Promise<void> {
		const { file, frontmatterEditor, parentField, section, sectionDisplayName, ancestorsSectionDisplayName, sidebarView } = context;
		const currentFile = this.app.workspace.getActiveFile();

		if (!currentFile) {
			new Notice('No active file');
			return;
		}

		// Create wiki-link format
		const wikiLink = `[[${file.basename}]]`;

		// Add to current file's parent field
		const result = await frontmatterEditor.addToField(
			currentFile,
			parentField,
			wikiLink,
			{ createIfMissing: true }
		);

		if (result.success) {
			// Use ancestor label for siblings section, singular section name for ancestors
			const label = section === 'siblings'
				? (ancestorsSectionDisplayName ? this.singularize(ancestorsSectionDisplayName) : 'Parent')
				: this.singularize(sectionDisplayName);
			new Notice(`Added as ${label}`);
			// Trigger sidebar refresh
			sidebarView.refresh();
		} else {
			new Notice(`Failed to add: ${result.error}`);
		}
	}

	/**
	 * Handles "Set as [Field] child" action.
	 *
	 * Adds the current file as a child to the clicked node's frontmatter.
	 * This is the inverse of "Set as parent".
	 *
	 * @param context - The advanced menu context
	 */
	private async handleSetAsChild(context: AdvancedMenuContext): Promise<void> {
		const { file, frontmatterEditor, parentField, section, sectionDisplayName, descendantsSectionDisplayName, sidebarView } = context;
		const currentFile = this.app.workspace.getActiveFile();

		if (!currentFile) {
			new Notice('No active file');
			return;
		}

		// Create wiki-link format for current file
		const wikiLink = `[[${currentFile.basename}]]`;

		// Add current file to clicked node's parent field
		const result = await frontmatterEditor.addToField(
			file,
			parentField,
			wikiLink,
			{ createIfMissing: true }
		);

		if (result.success) {
			// Use descendant label for siblings section, singular section name for descendants
			const label = section === 'siblings'
				? (descendantsSectionDisplayName ? this.singularize(descendantsSectionDisplayName) : 'Child')
				: this.singularize(sectionDisplayName);
			new Notice(`Added as ${label}`);
			// Trigger sidebar refresh
			sidebarView.refresh();
		} else {
			new Notice(`Failed to add: ${result.error}`);
		}
	}

	/**
	 * Handles "Remove as [Field] parent" action.
	 *
	 * Removes the clicked node as a parent from the current file's frontmatter.
	 *
	 * @param context - The advanced menu context
	 */
	private async handleRemoveAsParent(context: AdvancedMenuContext): Promise<void> {
		const { file, frontmatterEditor, parentField, section, sectionDisplayName, ancestorsSectionDisplayName, sidebarView } = context;
		const currentFile = this.app.workspace.getActiveFile();

		if (!currentFile) {
			new Notice('No active file');
			return;
		}

		// Use ancestor label for siblings section, singular section name for ancestors
		const singularName = section === 'siblings'
			? (ancestorsSectionDisplayName ? this.singularize(ancestorsSectionDisplayName) : 'Parent')
			: this.singularize(sectionDisplayName);

		// Confirm destructive action
		const confirmed = await this.confirmAction(
			'Remove Relationship',
			`Remove "${file.basename}" as ${singularName}?`
		);

		if (!confirmed) return;

		// Create wiki-link format
		const wikiLink = `[[${file.basename}]]`;

		// Remove from current file's parent field
		const result = await frontmatterEditor.removeFromField(
			currentFile,
			parentField,
			wikiLink,
			{ removeIfEmpty: true }
		);

		if (result.success) {
			new Notice(`Removed as ${singularName}`);
			// Trigger sidebar refresh
			sidebarView.refresh();
		} else {
			new Notice(`Failed to remove: ${result.error}`);
		}
	}

	/**
	 * Handles "Remove as [Field] child" action.
	 *
	 * Removes the current file as a child from the clicked node's frontmatter.
	 *
	 * @param context - The advanced menu context
	 */
	private async handleRemoveAsChild(context: AdvancedMenuContext): Promise<void> {
		const { file, frontmatterEditor, parentField, section, sectionDisplayName, descendantsSectionDisplayName, sidebarView } = context;
		const currentFile = this.app.workspace.getActiveFile();

		if (!currentFile) {
			new Notice('No active file');
			return;
		}

		// Use descendant label for siblings section, singular section name for descendants
		const singularName = section === 'siblings'
			? (descendantsSectionDisplayName ? this.singularize(descendantsSectionDisplayName) : 'Child')
			: this.singularize(sectionDisplayName);

		// Confirm destructive action
		const confirmed = await this.confirmAction(
			'Remove Relationship',
			`Remove current note as ${singularName} of "${file.basename}"?`
		);

		if (!confirmed) return;

		// Create wiki-link format for current file
		const wikiLink = `[[${currentFile.basename}]]`;

		// Remove from other file's parent field
		const result = await frontmatterEditor.removeFromField(
			file,
			parentField,
			wikiLink,
			{ removeIfEmpty: true }
		);

		if (result.success) {
			new Notice(`Removed as ${singularName}`);
			// Trigger sidebar refresh
			sidebarView.refresh();
		} else {
			new Notice(`Failed to remove: ${result.error}`);
		}
	}

	//
	// Tree Manipulation Actions (Milestone 4.3B Phase 3)
	//

	/**
	 * Determines if tree manipulation actions should be shown.
	 *
	 * @param context - The advanced menu context
	 * @returns True if tree actions should be shown
	 */
	private shouldShowTreeActions(context: AdvancedMenuContext): boolean {
		// Only show for nodes with children
		return context.hasExpandableChildren;
	}

	/**
	 * Adds tree manipulation actions to the menu.
	 *
	 * @param menu - The menu to add items to
	 * @param context - The advanced menu context
	 */
	private addTreeActions(menu: Menu, context: AdvancedMenuContext): void {
		// Expand all children
		menu.addItem(item => {
			item
				.setTitle('Expand all children')
				.setIcon('chevrons-down')
				.onClick(() => this.handleExpandAllChildren(context));
		});

		// Collapse all children
		menu.addItem(item => {
			item
				.setTitle('Collapse all children')
				.setIcon('chevrons-up')
				.onClick(() => this.handleCollapseAllChildren(context));
		});
	}

	/**
	 * Handles "Expand all children" action.
	 *
	 * @param context - The advanced menu context
	 */
	private handleExpandAllChildren(context: AdvancedMenuContext): void {
		const { file, sidebarView } = context;

		console.log('[ContextMenuBuilder] handleExpandAllChildren called for:', file.path);

		// Get the tree renderer from the sidebar view
		const renderer = (sidebarView as any).renderer;
		if (!renderer) {
			console.error('[ContextMenuBuilder] Tree renderer not available');
			new Notice('Tree renderer not available');
			return;
		}

		console.log('[ContextMenuBuilder] Calling renderer.expandAllChildren');
		// Expand all children of this node
		renderer.expandAllChildren(file.path);
		// Note: The renderer will log the count
	}

	/**
	 * Handles "Collapse all children" action.
	 *
	 * @param context - The advanced menu context
	 */
	private handleCollapseAllChildren(context: AdvancedMenuContext): void {
		const { file, sidebarView } = context;

		console.log('[ContextMenuBuilder] handleCollapseAllChildren called for:', file.path);

		// Get the tree renderer from the sidebar view
		const renderer = (sidebarView as any).renderer;
		if (!renderer) {
			console.error('[ContextMenuBuilder] Tree renderer not available');
			new Notice('Tree renderer not available');
			return;
		}

		console.log('[ContextMenuBuilder] Calling renderer.collapseAllChildren');
		// Collapse all children of this node
		renderer.collapseAllChildren(file.path);
		// Note: The renderer will log the count
	}

	/**
	 * Shows a confirmation dialog for destructive actions.
	 *
	 * @param title - The dialog title
	 * @param message - The confirmation message
	 * @returns Promise that resolves to true if confirmed, false if cancelled
	 */
	private async confirmAction(title: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmationModal(this.app, title, message, (confirmed) => {
				resolve(confirmed);
			});
			modal.open();
		});
	}
}
