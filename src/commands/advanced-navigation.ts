import { Notice, TFile } from 'obsidian';
import type ParentRelationPlugin from '../main';
import { selectNote } from '../modals/note-selection-modal';
import { showResults } from '../modals/results-modal';
import { findShortestPath, NotePath } from '../utils/path-finder';
import { exportPathToMarkdown } from '../utils/markdown-exporter';

/**
 * Registers advanced navigation commands for all configured parent fields.
 *
 * These commands provide sophisticated navigation through the relationship
 * graph, including siblings, cousins, and path finding.
 *
 * Commands are registered per-field, allowing users to navigate different
 * relationship graphs independently.
 */
export function registerAdvancedNavigationCommands(
	plugin: ParentRelationPlugin
): void {
	const { app } = plugin;

	// Register commands for each configured parent field
	plugin.settings.parentFields.forEach(fieldConfig => {
		const fieldName = fieldConfig.name;
		const fieldLabel = fieldConfig.displayName || fieldName;

		// Command: Show siblings of current note
		plugin.addCommand({
			id: `show-siblings-${fieldName}`,
			name: `Show siblings [${fieldLabel}]`,
			checkCallback: (checking: boolean) => {
				const activeFile = app.workspace.getActiveFile();
				if (!activeFile) return false;

				if (!checking) {
					showSiblings(plugin, activeFile, fieldName);
				}
				return true;
			}
		});

		// Command: Show cousins of current note
		plugin.addCommand({
			id: `show-cousins-${fieldName}`,
			name: `Show cousins [${fieldLabel}]`,
			checkCallback: (checking: boolean) => {
				const activeFile = app.workspace.getActiveFile();
				if (!activeFile) return false;

				if (!checking) {
					showCousins(plugin, activeFile, fieldName);
				}
				return true;
			}
		});

		// Command: Find shortest path to note
		plugin.addCommand({
			id: `find-path-to-note-${fieldName}`,
			name: `Find shortest path [${fieldLabel}]`,
			checkCallback: (checking: boolean) => {
				const activeFile = app.workspace.getActiveFile();
				if (!activeFile) return false;

				if (!checking) {
					findPathToNote(plugin, activeFile, fieldName);
				}
				return true;
			}
		});
	});
}

/**
 * Shows siblings of a note in a results modal.
 *
 * Siblings are notes that share the same parent(s).
 *
 * @param plugin - Plugin instance
 * @param file - File to find siblings for
 * @param fieldName - Parent field to use
 */
async function showSiblings(
	plugin: ParentRelationPlugin,
	file: TFile,
	fieldName: string
): Promise<void> {
	const engine = plugin.getEngineForField(fieldName);

	if (!engine) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	const siblings = engine.getSiblings(file, false); // Exclude self

	if (siblings.length === 0) {
		new Notice(`${file.basename} has no siblings in ${fieldName}`);
		return;
	}

	showResults(
		plugin.app,
		siblings,
		`Siblings of ${file.basename} [${fieldName}] (${siblings.length})`,
		(note) => {
			// Open note when selected
			plugin.app.workspace.getLeaf().openFile(note);
		}
	);
}

/**
 * Shows cousins of a note in a results modal.
 *
 * Cousins are notes that share the same grandparent(s) but different parents.
 *
 * @param plugin - Plugin instance
 * @param file - File to find cousins for
 * @param fieldName - Parent field to use
 */
async function showCousins(
	plugin: ParentRelationPlugin,
	file: TFile,
	fieldName: string
): Promise<void> {
	const engine = plugin.getEngineForField(fieldName);

	if (!engine) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	const cousins = engine.getCousins(file, 1); // First cousins

	if (cousins.length === 0) {
		new Notice(`${file.basename} has no cousins in ${fieldName}`);
		return;
	}

	showResults(
		plugin.app,
		cousins,
		`Cousins of ${file.basename} [${fieldName}] (${cousins.length})`,
		(note) => {
			// Open note when selected
			plugin.app.workspace.getLeaf().openFile(note);
		}
	);
}

/**
 * Finds and displays shortest path to a user-selected note.
 *
 * Uses BFS to find the shortest path through parent-child relationships.
 *
 * @param plugin - Plugin instance
 * @param startFile - Starting file
 * @param fieldName - Parent field to use
 */
async function findPathToNote(
	plugin: ParentRelationPlugin,
	startFile: TFile,
	fieldName: string
): Promise<void> {
	const graph = plugin.getGraphForField(fieldName);

	if (!graph) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	// Get all files for selection
	const allFiles = graph.getAllFiles();
	const otherFiles = allFiles.filter(f => f.path !== startFile.path);

	if (otherFiles.length === 0) {
		new Notice('No other notes in vault');
		return;
	}

	// Prompt user to select target note
	const targetFile = await selectNote(
		plugin.app,
		otherFiles,
		`Select target note [${fieldName}]...`
	);

	if (!targetFile) {
		return; // User cancelled
	}

	// Find shortest path
	const path = findShortestPath(startFile, targetFile, graph);

	if (!path) {
		new Notice(`No path found from ${startFile.basename} to ${targetFile.basename} in ${fieldName}`);
		return;
	}

	// Display path
	displayPath(plugin, path, fieldName);
}

/**
 * Displays a path in a notice.
 *
 * @param plugin - Plugin instance
 * @param path - Path to display
 * @param fieldName - Parent field used
 */
function displayPath(plugin: ParentRelationPlugin, path: NotePath, fieldName: string): void {
	const pathMarkdown = exportPathToMarkdown(path.path, { useWikiLinks: false });

	const message = [
		`Path from ${path.start.basename} to ${path.end.basename} [${fieldName}]`,
		`Length: ${path.length} (${path.direction})`,
		``,
		pathMarkdown
	].join('\n');

	new Notice(message, 10000); // Show for 10 seconds
}
