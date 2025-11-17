import { Notice, TFile } from 'obsidian';
import type ParentRelationPlugin from '../main';
import { NoteSelectorModal } from './modal-selector';

/**
 * Registers basic navigation commands for all configured parent fields.
 *
 * @param plugin - The plugin instance
 */
export function registerNavigationCommands(plugin: ParentRelationPlugin): void {
	// Register per-field navigation commands
	plugin.settings.parentFields.forEach(fieldConfig => {
		const fieldName = fieldConfig.name;
		const fieldLabel = fieldConfig.displayName || fieldName;

		registerGoToParentCommand(plugin, fieldName, fieldLabel);
		registerGoToChildCommand(plugin, fieldName, fieldLabel);
	});
}

/**
 * Command: Go to parent note.
 *
 * Navigates to the parent note of the currently active file. If the file
 * has a single parent, navigates directly. If it has multiple parents,
 * shows a modal to select which parent to navigate to.
 *
 * @param plugin - The plugin instance
 * @param fieldName - The parent field to use
 * @param fieldLabel - The display label for the field
 */
function registerGoToParentCommand(
	plugin: ParentRelationPlugin,
	fieldName: string,
	fieldLabel: string
): void {
	plugin.addCommand({
		id: `go-to-parent-${fieldName}`,
		name: `Go to parent note [${fieldLabel}]`,
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;

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
						`Select Parent Note [${fieldLabel}]`,
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
 * @param fieldName - The parent field to use
 * @param fieldLabel - The display label for the field
 */
function registerGoToChildCommand(
	plugin: ParentRelationPlugin,
	fieldName: string,
	fieldLabel: string
): void {
	plugin.addCommand({
		id: `go-to-child-${fieldName}`,
		name: `Go to child note [${fieldLabel}]`,
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;

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
						`Select Child Note [${fieldLabel}]`,
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
