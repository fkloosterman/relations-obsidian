import { Notice, TFile } from 'obsidian';
import type ParentRelationPlugin from '../main';
import { exportTreeToMarkdown } from '../utils/markdown-exporter';
import { buildAncestorTree } from '../tree-model';

/**
 * Registers utility commands for all configured parent fields.
 *
 * These commands provide utilities like graph validation
 * and tree export functionality.
 *
 * Commands are registered per-field, allowing users to validate and export
 * different relationship graphs independently.
 */
export function registerUtilityCommands(
	plugin: ParentRelationPlugin
): void {
	const { app } = plugin;

	// Register commands for each configured parent field
	plugin.settings.parentFields.forEach(fieldConfig => {
		const fieldName = fieldConfig.name;
		const fieldLabel = fieldConfig.displayName || fieldName;

		// Command: Validate relationship graph
		plugin.addCommand({
			id: `validate-graph-${fieldName}`,
			name: `Validate graph [${fieldLabel}]`,
			callback: () => {
				validateGraph(plugin, fieldName);
			}
		});

		// Command: Export tree as markdown
		plugin.addCommand({
			id: `export-tree-markdown-${fieldName}`,
			name: `Export ancestor tree [${fieldLabel}]`,
			checkCallback: (checking: boolean) => {
				const activeFile = app.workspace.getActiveFile();
				if (!activeFile) return false;

				if (!checking) {
					exportTreeAsMarkdown(plugin, activeFile, fieldName);
				}
				return true;
			}
		});
	});
}

/**
 * Validates the relationship graph and shows diagnostics.
 *
 * Checks for cycles, orphaned nodes, and other graph issues.
 *
 * @param plugin - Plugin instance
 * @param fieldName - Parent field to validate
 */
function validateGraph(plugin: ParentRelationPlugin, fieldName: string): void {
	const graph = plugin.getGraphForField(fieldName);

	if (!graph) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	const diagnostics = graph.getDiagnostics();

	// Display diagnostics in console
	console.log('=== Relationship Graph Validation ===');
	console.log(`Field: ${fieldName}`);
	console.log('');

	// Log statistics
	console.log('Statistics:');
	console.log(`  Nodes: ${diagnostics.totalNodes}`);
	console.log(`  Edges: ${diagnostics.totalEdges}`);
	console.log('');

	// Log issues by severity
	const errors = diagnostics.issues.filter(i => i.severity === 'error');
	const warnings = diagnostics.issues.filter(i => i.severity === 'warning');
	const infos = diagnostics.issues.filter(i => i.severity === 'info');

	if (errors.length > 0) {
		console.log('Errors:');
		errors.forEach((error, i) => {
			console.log(`  ${i + 1}. ${error.message}`);
			if (error.context) {
				console.log(`     Context:`, error.context);
			}
		});
		console.log('');
	}

	if (warnings.length > 0) {
		console.log('Warnings:');
		warnings.forEach((warning, i) => {
			console.log(`  ${i + 1}. ${warning.message}`);
			if (warning.context) {
				console.log(`     Context:`, warning.context);
			}
		});
		console.log('');
	}

	// Show summary notice
	if (errors.length > 0 || warnings.length > 0) {
		new Notice(
			`Graph validation [${fieldName}]: ${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}. Check console for details.`,
			5000
		);
	} else {
		new Notice(`Graph validation [${fieldName}] passed! No errors or warnings found.`);
	}
}

/**
 * Exports current note's ancestor tree as markdown to clipboard.
 *
 * Builds the ancestor tree and exports it in markdown format
 * with wiki-links and cycle indicators.
 *
 * @param plugin - Plugin instance
 * @param file - File to export tree for
 * @param fieldName - Parent field to use
 */
async function exportTreeAsMarkdown(
	plugin: ParentRelationPlugin,
	file: TFile,
	fieldName: string
): Promise<void> {
	const graph = plugin.getGraphForField(fieldName);
	const engine = plugin.getEngineForField(fieldName);

	if (!graph || !engine) {
		new Notice(`Parent field "${fieldName}" not found`);
		return;
	}

	// Build ancestor tree for current file
	const tree = buildAncestorTree(file, engine, graph, {
		maxDepth: 10,
		detectCycles: true,
		includeMetadata: false
	});

	// Export to markdown
	const markdown = exportTreeToMarkdown(
		tree,
		`Ancestors of ${file.basename} [${fieldName}]`,
		{
			useWikiLinks: true,
			showCycles: true,
			includeHeader: true
		}
	);

	// Copy to clipboard
	try {
		await navigator.clipboard.writeText(markdown);
		new Notice(`Ancestor tree [${fieldName}] exported to clipboard!`);
	} catch (error) {
		console.error('Failed to copy to clipboard:', error);
		new Notice('Failed to copy to clipboard. Check console for details.');
	}
}
