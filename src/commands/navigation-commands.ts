import { Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type ParentRelationPlugin from '../main';
import { RelationSidebarView, VIEW_TYPE_RELATION_SIDEBAR } from '../sidebar-view';
import { NoteSelectorModal } from './modal-selector';

/**
 * Command ID and name mappings.
 */
export const COMMANDS = {
	SHOW_PARENT_TREE: {
		id: 'show-parent-tree',
		name: 'Show parent tree in sidebar'
	},
	SHOW_CHILD_TREE: {
		id: 'show-child-tree',
		name: 'Show child tree in sidebar'
	},
	SHOW_FULL_LINEAGE: {
		id: 'show-full-lineage',
		name: 'Show full lineage in sidebar'
	},
	TOGGLE_SIDEBAR: {
		id: 'toggle-sidebar',
		name: 'Toggle relation sidebar'
	},
	GO_TO_PARENT: {
		id: 'go-to-parent',
		name: 'Go to parent note'
	},
	GO_TO_CHILD: {
		id: 'go-to-child',
		name: 'Go to child note'
	}
} as const;

/**
 * Registers all basic navigation commands.
 *
 * @param plugin - The plugin instance
 */
export function registerNavigationCommands(plugin: ParentRelationPlugin): void {
	registerShowParentTreeCommand(plugin);
	registerShowChildTreeCommand(plugin);
	registerShowFullLineageCommand(plugin);
	registerToggleSidebarCommand(plugin);
	registerGoToParentCommand(plugin);
	registerGoToChildCommand(plugin);
}

/**
 * Command: Show parent tree in sidebar.
 *
 * Opens the relation sidebar and configures it to show only the ancestors
 * section for the currently active file.
 *
 * @param plugin - The plugin instance
 */
function registerShowParentTreeCommand(plugin: ParentRelationPlugin): void {
	plugin.addCommand({
		id: COMMANDS.SHOW_PARENT_TREE.id,
		name: COMMANDS.SHOW_PARENT_TREE.name,
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;

			if (!checking) {
				showTreeInSidebar(plugin, file, 'ancestors');
			}
			return true;
		}
	});
}

/**
 * Command: Show child tree in sidebar.
 *
 * Opens the relation sidebar and configures it to show only the descendants
 * section for the currently active file.
 *
 * @param plugin - The plugin instance
 */
function registerShowChildTreeCommand(plugin: ParentRelationPlugin): void {
	plugin.addCommand({
		id: COMMANDS.SHOW_CHILD_TREE.id,
		name: COMMANDS.SHOW_CHILD_TREE.name,
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;

			if (!checking) {
				showTreeInSidebar(plugin, file, 'descendants');
			}
			return true;
		}
	});
}

/**
 * Command: Show full lineage in sidebar.
 *
 * Opens the relation sidebar and configures it to show all relationship
 * sections (ancestors, descendants, and siblings) for the currently active file.
 *
 * @param plugin - The plugin instance
 */
function registerShowFullLineageCommand(plugin: ParentRelationPlugin): void {
	plugin.addCommand({
		id: COMMANDS.SHOW_FULL_LINEAGE.id,
		name: COMMANDS.SHOW_FULL_LINEAGE.name,
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;

			if (!checking) {
				showTreeInSidebar(plugin, file, 'all');
			}
			return true;
		}
	});
}

/**
 * Command: Toggle relation sidebar.
 *
 * Opens the relation sidebar if it's closed, or closes all relation sidebar
 * instances if any are open.
 *
 * @param plugin - The plugin instance
 */
function registerToggleSidebarCommand(plugin: ParentRelationPlugin): void {
	plugin.addCommand({
		id: COMMANDS.TOGGLE_SIDEBAR.id,
		name: COMMANDS.TOGGLE_SIDEBAR.name,
		callback: () => {
			toggleSidebar(plugin);
		}
	});
}

/**
 * Helper: Shows a tree in the sidebar.
 *
 * Opens the sidebar if needed, pins it to the specified file, and configures
 * which sections are visible based on the tree type.
 *
 * @param plugin - Plugin instance
 * @param file - File to show tree for
 * @param treeType - Type of tree to show (ancestors, descendants, or all)
 */
async function showTreeInSidebar(
	plugin: ParentRelationPlugin,
	file: TFile,
	treeType: 'ancestors' | 'descendants' | 'all'
): Promise<void> {
	// Ensure sidebar is open
	const leaf = await ensureSidebarOpen(plugin);
	if (!leaf) return;

	const view = leaf.view as RelationSidebarView;
	if (!(view instanceof RelationSidebarView)) return;

	// Pin to the specified file
	view.pinToFile(file);

	// Configure visible sections based on tree type
	switch (treeType) {
		case 'ancestors':
			view.setSectionsVisible({
				ancestors: true,
				descendants: false,
				siblings: false
			});
			break;
		case 'descendants':
			view.setSectionsVisible({
				ancestors: false,
				descendants: true,
				siblings: false
			});
			break;
		case 'all':
			view.setSectionsVisible({
				ancestors: true,
				descendants: true,
				siblings: true
			});
			break;
	}

	// Make sure the sidebar leaf is revealed
	plugin.app.workspace.revealLeaf(leaf);

	new Notice(`Showing ${treeType === 'all' ? 'full lineage' : treeType} for ${file.basename}`);
}

/**
 * Helper: Ensures sidebar is open and returns the leaf.
 *
 * Checks if a relation sidebar is already open. If so, returns the existing
 * leaf. Otherwise, opens a new sidebar in the right sidebar and returns the
 * new leaf.
 *
 * @param plugin - The plugin instance
 * @returns The workspace leaf containing the sidebar, or null if failed to open
 */
async function ensureSidebarOpen(plugin: ParentRelationPlugin): Promise<WorkspaceLeaf | null> {
	// Check if sidebar is already open
	const existingLeaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_RELATION_SIDEBAR);

	if (existingLeaves.length > 0) {
		// Use existing sidebar
		return existingLeaves[0];
	}

	// Open new sidebar
	const leaf = plugin.app.workspace.getRightLeaf(false);
	if (!leaf) {
		new Notice('Could not open relation sidebar');
		return null;
	}

	await leaf.setViewState({
		type: VIEW_TYPE_RELATION_SIDEBAR,
		active: true
	});

	return leaf;
}

/**
 * Helper: Toggles sidebar visibility.
 *
 * If any relation sidebar instances are open, closes them all. Otherwise,
 * opens a new sidebar in the right sidebar.
 *
 * @param plugin - The plugin instance
 */
function toggleSidebar(plugin: ParentRelationPlugin): void {
	const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_RELATION_SIDEBAR);

	if (leaves.length > 0) {
		// Close all relation sidebar instances
		leaves.forEach(leaf => leaf.detach());
		new Notice('Relation sidebar closed');
	} else {
		// Open new sidebar
		const leaf = plugin.app.workspace.getRightLeaf(false);
		if (leaf) {
			leaf.setViewState({
				type: VIEW_TYPE_RELATION_SIDEBAR,
				active: true
			});
			new Notice('Relation sidebar opened');
		}
	}
}

/**
 * Command: Go to parent note.
 *
 * Navigates to the parent note of the currently active file. If the file
 * has a single parent, navigates directly. If it has multiple parents,
 * shows a modal to select which parent to navigate to.
 *
 * @param plugin - The plugin instance
 */
function registerGoToParentCommand(plugin: ParentRelationPlugin): void {
	plugin.addCommand({
		id: COMMANDS.GO_TO_PARENT.id,
		name: COMMANDS.GO_TO_PARENT.name,
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;

			// Get parents using default field
			const fieldName = plugin.settings.defaultParentField;
			const graph = plugin.relationGraphs.get(fieldName);
			if (!graph) return false;

			const parents = graph.getParents(file);
			if (parents.length === 0) return false;

			if (!checking) {
				if (parents.length === 1) {
					// Single parent - navigate directly
					plugin.app.workspace.getLeaf().openFile(parents[0]);
				} else {
					// Multiple parents - show modal
					new NoteSelectorModal(
						plugin.app,
						parents,
						'Select Parent Note',
						(selected) => {
							plugin.app.workspace.getLeaf().openFile(selected);
						}
					).open();
				}
			}
			return true;
		}
	});
}

/**
 * Command: Go to child note.
 *
 * Navigates to a child note of the currently active file. If the file
 * has a single child, navigates directly. If it has multiple children,
 * shows a modal to select which child to navigate to.
 *
 * @param plugin - The plugin instance
 */
function registerGoToChildCommand(plugin: ParentRelationPlugin): void {
	plugin.addCommand({
		id: COMMANDS.GO_TO_CHILD.id,
		name: COMMANDS.GO_TO_CHILD.name,
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;

			// Get children using default field
			const fieldName = plugin.settings.defaultParentField;
			const graph = plugin.relationGraphs.get(fieldName);
			if (!graph) return false;

			const children = graph.getChildren(file);
			if (children.length === 0) return false;

			if (!checking) {
				if (children.length === 1) {
					// Single child - navigate directly
					plugin.app.workspace.getLeaf().openFile(children[0]);
				} else {
					// Multiple children - show modal
					new NoteSelectorModal(
						plugin.app,
						children,
						'Select Child Note',
						(selected) => {
							plugin.app.workspace.getLeaf().openFile(selected);
						}
					).open();
				}
			}
			return true;
		}
	});
}
