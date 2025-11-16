import { App, Menu, Notice, TFile } from 'obsidian';
import type ParentRelationPlugin from './main';
import type { RelationSidebarView } from './sidebar-view';
import { TreeNode } from './tree-model';

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
	showRelationship: false,  // Milestone 4.3B
	showTreeActions: false     // Milestone 4.3B
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
	}

	/**
	 * Builds and shows a context menu for a tree node.
	 *
	 * @param context - The menu context information
	 */
	showContextMenu(context: NodeMenuContext): void {
		const menu = new Menu();

		// Build menu sections
		this.addCoreActions(menu, context);

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
		// TODO: Implement proper path traversal in Milestone 4.3B
		const indent = '  '.repeat(context.node.depth);
		return `${indent}${context.file.basename}`;
	}
}
