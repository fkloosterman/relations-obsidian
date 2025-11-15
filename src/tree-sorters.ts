import { TFile } from 'obsidian';
import { TreeNode } from './tree-model';

/**
 * Sort order direction.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort criteria.
 */
export type SortCriteria =
	| 'alphabetical'      // By file basename
	| 'created'           // By creation date
	| 'modified'          // By modification date
	| 'size'              // By file size
	| 'custom';           // Custom comparator

/**
 * Configuration for sorting tree nodes.
 */
export interface SortConfig {
	/** Primary sort criteria */
	criteria: SortCriteria;

	/** Sort order */
	order?: SortOrder;

	/** Custom comparator function (used when criteria is 'custom') */
	comparator?: (a: TFile, b: TFile) => number;

	/** Sort children recursively */
	recursive?: boolean;
}

/**
 * Creates a comparator function from a sort configuration.
 *
 * @param config - The sort configuration
 * @returns Comparator function for TFile objects
 */
export function createComparator(config: SortConfig): (a: TFile, b: TFile) => number {
	const order = config.order || 'asc';
	const multiplier = order === 'asc' ? 1 : -1;

	let baseComparator: (a: TFile, b: TFile) => number;

	switch (config.criteria) {
		case 'alphabetical':
			baseComparator = (a, b) =>
				a.basename.localeCompare(b.basename);
			break;

		case 'created':
			baseComparator = (a, b) =>
				a.stat.ctime - b.stat.ctime;
			break;

		case 'modified':
			baseComparator = (a, b) =>
				a.stat.mtime - b.stat.mtime;
			break;

		case 'size':
			baseComparator = (a, b) =>
				a.stat.size - b.stat.size;
			break;

		case 'custom':
			if (!config.comparator) {
				throw new Error('Custom sort requires a comparator function');
			}
			baseComparator = config.comparator;
			break;

		default:
			baseComparator = (a, b) =>
				a.basename.localeCompare(b.basename);
	}

	return (a, b) => multiplier * baseComparator(a, b);
}

/**
 * Sorts tree nodes in place or returns a sorted copy.
 *
 * @param nodes - Array of tree nodes to sort
 * @param config - Sort configuration
 * @param inPlace - Whether to sort in place or create a copy
 * @returns Sorted array of nodes
 */
export function sortTreeNodes(
	nodes: TreeNode[],
	config: SortConfig,
	inPlace: boolean = false
): TreeNode[] {
	const comparator = createComparator(config);
	const sorted = inPlace ? nodes : [...nodes];

	// Sort by comparing the file property
	sorted.sort((a, b) => comparator(a.file, b.file));

	// Recursively sort children if requested
	if (config.recursive) {
		sorted.forEach(node => {
			if (node.children.length > 0) {
				node.children = sortTreeNodes(node.children, config, inPlace);
			}
		});
	}

	return sorted;
}

/**
 * Common sort presets for convenience.
 */
export const SortPresets: Record<string, SortConfig> = {
	/** Alphabetical A-Z */
	alphabetical: { criteria: 'alphabetical', order: 'asc' },

	/** Alphabetical Z-A */
	alphabeticalReverse: { criteria: 'alphabetical', order: 'desc' },

	/** Newest first */
	newestFirst: { criteria: 'modified', order: 'desc' },

	/** Oldest first */
	oldestFirst: { criteria: 'modified', order: 'asc' },

	/** Recently created */
	recentlyCreated: { criteria: 'created', order: 'desc' },

	/** Largest first */
	largestFirst: { criteria: 'size', order: 'desc' }
};
