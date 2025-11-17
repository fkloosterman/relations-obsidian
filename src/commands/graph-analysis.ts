import { Notice, TFile } from 'obsidian';
import type ParentRelationPlugin from '../main';
import { findRootNotes, findLeafNotes, computeGraphStatistics } from '../utils/graph-analyzer';
import { showResults } from '../modals/results-modal';

/**
 * Registers graph analysis commands for all configured parent fields.
 *
 * These commands analyze the relationship graph structure,
 * finding special nodes like roots and leaves.
 *
 * Commands are registered per-field, allowing users to analyze different
 * relationship graphs independently.
 */
export function registerGraphAnalysisCommands(
	plugin: ParentRelationPlugin
): void {
	const { app } = plugin;

	// Register commands for each configured parent field
	plugin.settings.parentFields.forEach(fieldConfig => {
		const fieldName = fieldConfig.name;
		const fieldLabel = fieldConfig.displayName || fieldName;

		// Command: Show all root notes
		plugin.addCommand({
			id: `show-root-notes-${fieldName}`,
			name: `Show root notes [${fieldLabel}]`,
			callback: () => {
				showRootNotes(plugin, fieldName);
			}
		});

		// Command: Show all leaf notes
		plugin.addCommand({
			id: `show-leaf-notes-${fieldName}`,
			name: `Show leaf notes [${fieldLabel}]`,
			callback: () => {
				showLeafNotes(plugin, fieldName);
			}
		});

		// Command: Show graph statistics
		plugin.addCommand({
			id: `show-graph-statistics-${fieldName}`,
			name: `Show graph statistics [${fieldLabel}]`,
			callback: () => {
				showGraphStatistics(plugin, fieldName);
			}
		});
	});
}

/**
 * Shows all root notes in a modal.
 *
 * Root notes are notes with no parents in the relationship graph.
 *
 * @param plugin - Plugin instance
 * @param fieldName - Parent field to use
 */
function showRootNotes(plugin: ParentRelationPlugin, fieldName: string): void {
	const graph = plugin.getGraphForField(fieldName);

	if (!graph) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	const roots = findRootNotes(graph);

	if (roots.length === 0) {
		new Notice(`No root notes found in ${fieldName} (all notes have parents)`);
		return;
	}

	showResults(
		plugin.app,
		roots,
		`Root Notes [${fieldName}] (${roots.length})`,
		(note) => {
			// Open note when selected
			plugin.app.workspace.getLeaf().openFile(note);
		}
	);
}

/**
 * Shows all leaf notes in a modal.
 *
 * Leaf notes are notes with no children in the relationship graph.
 *
 * @param plugin - Plugin instance
 * @param fieldName - Parent field to use
 */
function showLeafNotes(plugin: ParentRelationPlugin, fieldName: string): void {
	const graph = plugin.getGraphForField(fieldName);

	if (!graph) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	const leaves = findLeafNotes(graph);

	if (leaves.length === 0) {
		new Notice(`No leaf notes found in ${fieldName} (all notes have children)`);
		return;
	}

	showResults(
		plugin.app,
		leaves,
		`Leaf Notes [${fieldName}] (${leaves.length})`,
		(note) => {
			// Open note when selected
			plugin.app.workspace.getLeaf().openFile(note);
		}
	);
}

/**
 * Shows graph statistics in a notice and console.
 *
 * Computes and displays various metrics about the relationship graph.
 *
 * @param plugin - Plugin instance
 * @param fieldName - Parent field to use
 */
function showGraphStatistics(plugin: ParentRelationPlugin, fieldName: string): void {
	const graph = plugin.getGraphForField(fieldName);

	if (!graph) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	const stats = computeGraphStatistics(graph);

	// Log to console
	console.log('=== Graph Statistics ===');
	console.log(`Field: ${fieldName}`);
	console.log(`Total nodes: ${stats.totalNodes}`);
	console.log(`Total edges: ${stats.totalEdges}`);
	console.log(`Root notes: ${stats.rootCount}`);
	console.log(`Leaf notes: ${stats.leafCount}`);
	console.log(`Max depth: ${stats.maxDepth}`);
	console.log(`Max breadth: ${stats.maxBreadth}`);
	console.log(`Cycles: ${stats.cycleCount}`);
	console.log(`Average children: ${stats.averageChildren.toFixed(2)}`);

	// Show summary notice
	const message = [
		`Graph Statistics [${fieldName}]:`,
		`Nodes: ${stats.totalNodes}, Edges: ${stats.totalEdges}`,
		`Roots: ${stats.rootCount}, Leaves: ${stats.leafCount}`,
		`Max Depth: ${stats.maxDepth}, Max Breadth: ${stats.maxBreadth}`,
		`Cycles: ${stats.cycleCount}`
	].join('\n');

	new Notice(message, 8000); // Show for 8 seconds
}
