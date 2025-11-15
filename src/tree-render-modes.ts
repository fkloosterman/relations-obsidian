import { TFile, MetadataCache } from 'obsidian';
import { TreeNode, TreeNodeMetadata, TreeBuildOptions, buildAncestorTree, buildDescendantTree, buildFullLineageTree, buildSiblingTree, buildCousinsTree, countNodes, calculateTreeDepth } from './tree-model';
import { RelationshipEngine } from './relationship-engine';
import { RelationGraph } from './relation-graph';
import { FilterConfig, createFilter } from './tree-filters';
import { SortConfig, sortTreeNodes } from './tree-sorters';

/**
 * Enumeration of available tree rendering modes.
 */
export enum TreeRenderMode {
	/** Show ancestors (parents, grandparents, etc.) */
	ANCESTORS = 'ancestors',

	/** Show descendants (children, grandchildren, etc.) */
	DESCENDANTS = 'descendants',

	/** Show both ancestors and descendants (full lineage) */
	FULL_LINEAGE = 'full-lineage',

	/** Show siblings (notes sharing same parent) */
	SIBLINGS = 'siblings',

	/** Show cousins (notes sharing same grandparent) */
	COUSINS = 'cousins'
}

/**
 * Configuration for tree rendering modes.
 */
export interface RenderModeConfig {
	/** Primary rendering mode */
	mode: TreeRenderMode;

	/** Additional modes to combine with primary mode */
	additionalModes?: TreeRenderMode[];

	/** Maximum depth for tree traversal */
	maxDepth?: number;

	/** Filter configuration */
	filter?: FilterConfig;

	/** Sort configuration */
	sort?: SortConfig;

	/** Show path to root for descendant trees */
	showPathToRoot?: boolean;

	/** Detect and mark cycles */
	detectCycles?: boolean;

	/** Include rendering metadata */
	includeMetadata?: boolean;

	/** Custom metadata provider */
	metadataProvider?: (file: TFile, depth: number) => Partial<TreeNodeMetadata>;
}

/**
 * Result of building a tree with a specific mode.
 */
export interface ModeTreeResult {
	/** The root node(s) of the tree */
	roots: TreeNode[];

	/** The mode used to build the tree */
	mode: TreeRenderMode;

	/** Total number of nodes in the tree */
	nodeCount: number;

	/** Maximum depth of the tree */
	maxDepth: number;

	/** Whether any cycles were detected */
	hasCycles: boolean;
}

/**
 * Builds a tree using the specified rendering mode.
 *
 * @param file - The file to build the tree from
 * @param config - Rendering mode configuration
 * @param engine - The relationship engine
 * @param graph - The relation graph
 * @param metadataCache - Obsidian's metadata cache
 * @returns Mode tree result with root nodes
 */
export function buildModeTree(
	file: TFile,
	config: RenderModeConfig,
	engine: RelationshipEngine,
	graph: RelationGraph,
	metadataCache: MetadataCache
): ModeTreeResult {
	// Create filter function
	const filterFn = config.filter
		? createFilter(config.filter, metadataCache)
		: undefined;

	// Build tree options
	const buildOptions: TreeBuildOptions = {
		maxDepth: config.maxDepth,
		detectCycles: config.detectCycles ?? true,
		includeMetadata: config.includeMetadata ?? true,
		filter: filterFn,
		metadataProvider: config.metadataProvider
	};

	// Build primary mode tree
	let roots: TreeNode[];

	switch (config.mode) {
		case TreeRenderMode.ANCESTORS:
			roots = [buildAncestorModeTree(file, engine, graph, buildOptions)];
			break;

		case TreeRenderMode.DESCENDANTS:
			roots = [buildDescendantModeTree(file, engine, graph, buildOptions, config.showPathToRoot)];
			break;

		case TreeRenderMode.FULL_LINEAGE:
			roots = [buildFullLineageModeTree(file, engine, graph, buildOptions)];
			break;

		case TreeRenderMode.SIBLINGS:
			roots = buildSiblingModeTree(file, engine, graph, buildOptions);
			break;

		case TreeRenderMode.COUSINS:
			roots = buildCousinModeTree(file, engine, graph, buildOptions);
			break;

		default:
			throw new Error(`Unknown render mode: ${config.mode}`);
	}

	// Combine with additional modes if specified
	if (config.additionalModes && config.additionalModes.length > 0) {
		for (const additionalMode of config.additionalModes) {
			const additionalConfig = { ...config, mode: additionalMode, additionalModes: undefined };
			const additionalResult = buildModeTree(file, additionalConfig, engine, graph, metadataCache);
			roots = combineTreeRoots(roots, additionalResult.roots);
		}
	}

	// Apply sorting if configured
	if (config.sort) {
		roots = sortTreeNodes(roots, config.sort);
	}

	// Calculate result metadata
	const nodeCount = roots.reduce((sum, root) => sum + countNodes(root), 0);
	const maxDepth = roots.reduce((max, root) => Math.max(max, calculateTreeDepth(root)), 0);
	const hasCycles = roots.some(root => treeHasCycles(root));

	return {
		roots,
		mode: config.mode,
		nodeCount,
		maxDepth,
		hasCycles
	};
}

/**
 * Builds an ancestor mode tree.
 * Shows ancestors as a hierarchical tree.
 */
function buildAncestorModeTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions
): TreeNode {
	return buildAncestorTree(file, engine, graph, options);
}

/**
 * Builds a descendant mode tree.
 * Shows descendants as a hierarchical tree.
 * Optionally shows path to root for context.
 */
function buildDescendantModeTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions,
	showPathToRoot: boolean = false
): TreeNode {
	const tree = buildDescendantTree(file, engine, graph, options);

	if (showPathToRoot) {
		// Add breadcrumb path to root
		const pathToRoot = buildPathToRoot(file, engine);
		tree.metadata.pathToRoot = pathToRoot.map(f => f.basename).join(' > ');
	}

	return tree;
}

/**
 * Builds a full lineage mode tree.
 * Shows both ancestors and descendants with the file in the middle.
 */
function buildFullLineageModeTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions
): TreeNode {
	return buildFullLineageTree(file, engine, graph, options);
}

/**
 * Builds a sibling mode tree.
 * Returns siblings as separate root nodes.
 */
function buildSiblingModeTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions
): TreeNode[] {
	return buildSiblingTree(file, engine, graph, options);
}

/**
 * Builds a cousin mode tree.
 * Returns cousins as separate root nodes.
 */
function buildCousinModeTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions
): TreeNode[] {
	return buildCousinsTree(file, engine, graph, options);
}

/**
 * Builds a path to root for showing context.
 */
function buildPathToRoot(file: TFile, engine: RelationshipEngine): TFile[] {
	const path: TFile[] = [file];
	const visited = new Set<string>([file.path]);

	let current = file;
	let depth = 0;
	const maxDepth = 10; // Prevent infinite loops

	while (depth < maxDepth) {
		const ancestors = engine.getAncestors(current, 1);
		if (ancestors.length === 0 || ancestors[0].length === 0) {
			break;
		}

		// Take first parent
		const parent = ancestors[0][0];

		// Check for cycle
		if (visited.has(parent.path)) {
			break;
		}

		path.unshift(parent);
		visited.add(parent.path);
		current = parent;
		depth++;
	}

	return path;
}

/**
 * Combines multiple tree root arrays, removing duplicates.
 */
function combineTreeRoots(roots1: TreeNode[], roots2: TreeNode[]): TreeNode[] {
	const combined = [...roots1];
	const existingPaths = new Set(roots1.map(r => r.file.path));

	for (const root of roots2) {
		if (!existingPaths.has(root.file.path)) {
			combined.push(root);
			existingPaths.add(root.file.path);
		}
	}

	return combined;
}

/**
 * Checks if a tree contains any cycle nodes.
 */
function treeHasCycles(node: TreeNode): boolean {
	if (node.isCycle) return true;
	return node.children.some(treeHasCycles);
}

/**
 * Preset mode combinations for common use cases.
 */
export const ModePresets = {
	/**
	 * Family view: Shows ancestors, descendants, and siblings
	 */
	family: (file: TFile): RenderModeConfig => ({
		mode: TreeRenderMode.FULL_LINEAGE,
		additionalModes: [TreeRenderMode.SIBLINGS],
		maxDepth: 3
	}),

	/**
	 * Context view: Shows immediate relations (parents, children, siblings)
	 */
	context: (file: TFile): RenderModeConfig => ({
		mode: TreeRenderMode.DESCENDANTS,
		additionalModes: [TreeRenderMode.ANCESTORS, TreeRenderMode.SIBLINGS],
		maxDepth: 1
	}),

	/**
	 * Ancestry view: Deep ancestor tree
	 */
	ancestry: (file: TFile): RenderModeConfig => ({
		mode: TreeRenderMode.ANCESTORS,
		maxDepth: 10,
		showPathToRoot: true
	}),

	/**
	 * Lineage view: Deep descendant tree
	 */
	lineage: (file: TFile): RenderModeConfig => ({
		mode: TreeRenderMode.DESCENDANTS,
		maxDepth: 10,
		showPathToRoot: true
	}),

	/**
	 * Network view: Shows extended family (ancestors, descendants, siblings, cousins)
	 */
	network: (file: TFile): RenderModeConfig => ({
		mode: TreeRenderMode.FULL_LINEAGE,
		additionalModes: [TreeRenderMode.SIBLINGS, TreeRenderMode.COUSINS],
		maxDepth: 2
	})
};

/**
 * Helper to create a mode configuration with common defaults.
 */
export function createModeConfig(
	mode: TreeRenderMode,
	options: Partial<RenderModeConfig> = {}
): RenderModeConfig {
	return {
		mode,
		maxDepth: 5,
		detectCycles: true,
		includeMetadata: true,
		...options
	};
}
