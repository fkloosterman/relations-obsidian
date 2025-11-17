import { TFile } from 'obsidian';
import { RelationshipEngine } from './relationship-engine';
import { RelationGraph } from './relation-graph';

/**
 * Represents a node in a relationship tree.
 *
 * This structure is used for rendering relationship trees in both
 * the sidebar view and codeblock renderer.
 */
export interface TreeNode {
	/** The file this node represents */
	file: TFile;

	/** Child nodes in the tree */
	children: TreeNode[];

	/** Depth of this node in the tree (0 = root) */
	depth: number;

	/** True if this node is part of a cycle */
	isCycle: boolean;

	/** Additional metadata for rendering hints */
	metadata: TreeNodeMetadata;
}

/**
 * Metadata for rendering hints and additional information.
 */
export interface TreeNodeMetadata {
	/** Optional icon name for custom rendering */
	icon?: string;

	/** Optional color for highlighting */
	color?: string;

	/** Optional CSS class names */
	className?: string;

	/** Optional tooltip text */
	tooltip?: string;

	/** Whether this node should be initially collapsed */
	collapsed?: boolean;

	/** Cycle information if node is part of a cycle */
	cycleInfo?: {
		/** Full cycle path */
		path: string[];
		/** Cycle length */
		length: number;
	};

	/** Custom data for extensions */
	[key: string]: any;
}

/**
 * Options for building trees.
 */
export interface TreeBuildOptions {
	/** Maximum depth to build (default: from settings) */
	maxDepth?: number;

	/** Whether to mark cycle nodes */
	detectCycles?: boolean;

	/** Whether to include metadata */
	includeMetadata?: boolean;

	/** Filter function for nodes */
	filter?: (file: TFile) => boolean;

	/** Custom metadata provider */
	metadataProvider?: (file: TFile, depth: number) => Partial<TreeNodeMetadata>;
}

/**
 * Internal helper to create a tree node.
 */
function createTreeNode(
	file: TFile,
	depth: number,
	isCycle: boolean,
	options: TreeBuildOptions,
	graph?: RelationGraph
): TreeNode {
	const metadata: TreeNodeMetadata = {};

	if (options.includeMetadata && options.metadataProvider) {
		Object.assign(metadata, options.metadataProvider(file, depth));
	}

	// Add default cycle indicator with enhanced information
	if (isCycle && options.includeMetadata) {
		metadata.icon = 'cycle';
		metadata.className = (metadata.className || '') + ' is-cycle';

		// Get detailed cycle information if graph is available
		if (graph) {
			const cycleInfo = graph.detectCycle(file);
			if (cycleInfo && cycleInfo.cyclePath) {
				// Store cycle path as basenames
				metadata.cycleInfo = {
					path: cycleInfo.cyclePath.map(f => f.basename),
					length: cycleInfo.length
				};

				// Create enhanced tooltip
				const cyclePath = cycleInfo.cyclePath.map(f => f.basename).join(' → ');
				metadata.tooltip = `Cycle detected: ${cyclePath}\nLength: ${cycleInfo.length} note${cycleInfo.length === 1 ? '' : 's'}`;
			} else {
				// Fallback if cycle detection fails
				metadata.tooltip = 'This note is part of a cycle';
			}
		} else {
			// Fallback if graph not available
			metadata.tooltip = 'This note is part of a cycle';
		}
	}

	return {
		file,
		children: [],
		depth,
		isCycle,
		metadata
	};
}

/**
 * Internal helper to build tree nodes from generations.
 */
function buildTreeFromGenerations(
	file: TFile,
	depth: number,
	generations: TFile[][],
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions,
	visitedPath: Set<string> = new Set()
): TreeNode {
	// Cycle detection: only mark files that are directly part of a cycle path
	// Check if this file appears twice in current traversal path
	const isPathCycle = visitedPath.has(file.path);

	// Check if file is part of a global cycle by checking the cycle path
	let isInCyclePath = false;
	if (options.detectCycles !== false && !isPathCycle) {
		const globalCycleInfo = graph.detectCycle(file);
		if (globalCycleInfo && globalCycleInfo.cyclePath) {
			// File is marked as cycle only if it's IN the cycle path
			isInCyclePath = globalCycleInfo.cyclePath.some(f => f.path === file.path);
		}
	}

	// Mark as cycle if file is in a cycle path OR repeats in current path
	const isCycle = options.detectCycles !== false && (isPathCycle || isInCyclePath);

	// Create node (pass graph for enhanced cycle info)
	const node = createTreeNode(file, depth, isCycle, options, graph);

	// Check if we've reached max depth or detected a PATH cycle (stop traversing to prevent infinite loop)
	const maxDepth = options.maxDepth ?? Infinity;
	if (depth >= maxDepth || isPathCycle) {
		return node;
	}

	// Add current file to visited path
	const newVisitedPath = new Set(visitedPath);
	newVisitedPath.add(file.path);

	// If we have more generations, build children
	if (generations.length > 0) {
		const nextGeneration = generations[0];
		const remainingGenerations = generations.slice(1);

		for (const child of nextGeneration) {
			// Apply filter if provided
			if (options.filter && !options.filter(child)) {
				continue;
			}

			// Recursively build child nodes with updated visited path
			const childNode = buildTreeFromGenerations(
				child,
				depth + 1,
				remainingGenerations,
				engine,
				graph,
				options,
				newVisitedPath
			);

			node.children.push(childNode);
		}
	}

	return node;
}

/**
 * Builds an ancestor tree from a starting file.
 *
 * @param file - The root file
 * @param engine - The relationship engine
 * @param graph - The relation graph (for cycle detection)
 * @param options - Build options
 * @returns Root node of the ancestor tree
 *
 * @example
 * // Given: A → B → C → D
 * // buildAncestorTree(A) returns:
 * // {
 * //   file: A,
 * //   depth: 0,
 * //   children: [
 * //     {
 * //       file: B,
 * //       depth: 1,
 * //       children: [
 * //         {
 * //           file: C,
 * //           depth: 2,
 * //           children: [
 * //             { file: D, depth: 3, children: [] }
 * //           ]
 * //         }
 * //       ]
 * //     }
 * //   ]
 * // }
 */
export function buildAncestorTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions = {}
): TreeNode {
	const {
		maxDepth,
		detectCycles = true,
		includeMetadata = true,
		filter,
		metadataProvider
	} = options;

	// Get ancestors organized by generation
	const ancestors = engine.getAncestors(file, maxDepth);

	// Build tree structure
	if (!graph.supportsCycleDetection()) {
	  graph.build(); // Ensure cycleDetector is initialized
	}

	return buildTreeFromGenerations(file, 0, ancestors, engine, graph, {
	  maxDepth,
	  detectCycles,
	  includeMetadata,
	  filter,
	  metadataProvider
	});
}

/**
 * Builds a descendant tree from a starting file.
 *
 * @param file - The root file
 * @param engine - The relationship engine
 * @param graph - The relation graph (for cycle detection)
 * @param options - Build options
 * @returns Root node of the descendant tree
 */
export function buildDescendantTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions = {}
): TreeNode {
	const {
		maxDepth,
		detectCycles = true,
		includeMetadata = true,
		filter,
		metadataProvider
	} = options;

	// Get descendants organized by generation
	const descendants = engine.getDescendants(file, maxDepth);

	// Build tree structure
	return buildTreeFromGenerations(file, 0, descendants, engine, graph, {
		maxDepth,
		detectCycles,
		includeMetadata,
		filter,
		metadataProvider
	});
}

/**
 * Builds a combined tree showing both ancestors and descendants.
 *
 * @param file - The focus file (center of tree)
 * @param engine - The relationship engine
 * @param graph - The relation graph
 * @param options - Build options
 * @returns Root node representing the full lineage
 */
export function buildFullLineageTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions = {}
): TreeNode {
	const {
		maxDepth,
		detectCycles = true,
		includeMetadata = true,
		filter,
		metadataProvider
	} = options;

	// Get both ancestors and descendants
	const ancestors = engine.getAncestors(file, maxDepth);
	const descendants = engine.getDescendants(file, maxDepth);

	// Create the focus node
	const isCycle = detectCycles ? graph.detectCycle(file) !== null : false;
	const node = createTreeNode(file, 0, isCycle, {
		detectCycles,
		includeMetadata,
		filter,
		metadataProvider
	});

	// For full lineage, we show descendants as children
	// Ancestors would typically be shown above in UI, but in tree structure
	// we represent them by inverting the relationship
	if (descendants.length > 0) {
		const nextGeneration = descendants[0];
		const remainingGenerations = descendants.slice(1);

		for (const child of nextGeneration) {
			if (filter && !filter(child)) {
				continue;
			}

			const childNode = buildTreeFromGenerations(
				child,
				1,
				remainingGenerations,
				engine,
				graph,
				{ detectCycles, includeMetadata, filter, metadataProvider }
			);

			node.children.push(childNode);
		}
	}

	return node;
}

/**
 * Builds a sibling tree showing siblings of a file.
 *
 * @param file - The file to get siblings for
 * @param engine - The relationship engine
 * @param graph - The relation graph
 * @param options - Build options
 * @returns Array of tree nodes (one per sibling)
 */
export function buildSiblingTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions = {}
): TreeNode[] {
	const {
		detectCycles = true,
		includeMetadata = true,
		filter,
		metadataProvider
	} = options;

	const siblings = engine.getSiblings(file, false); // Exclude self

	return siblings
		.filter(sibling => !filter || filter(sibling))
		.map(sibling => {
			const isCycle = detectCycles ? graph.detectCycle(sibling) !== null : false;
			return createTreeNode(sibling, 0, isCycle, {
				detectCycles,
				includeMetadata,
				filter,
				metadataProvider
			});
		});
}

/**
 * Builds a cousins tree.
 *
 * @param file - The file to get cousins for
 * @param engine - The relationship engine
 * @param graph - The relation graph
 * @param options - Build options
 * @returns Array of tree nodes (one per cousin)
 */
export function buildCousinsTree(
	file: TFile,
	engine: RelationshipEngine,
	graph: RelationGraph,
	options: TreeBuildOptions = {}
): TreeNode[] {
	const {
		detectCycles = true,
		includeMetadata = true,
		filter,
		metadataProvider
	} = options;

	const cousins = engine.getCousins(file, 1); // First cousins

	return cousins
		.filter(cousin => !filter || filter(cousin))
		.map(cousin => {
			const isCycle = detectCycles ? graph.detectCycle(cousin) !== null : false;
			return createTreeNode(cousin, 0, isCycle, {
				detectCycles,
				includeMetadata,
				filter,
				metadataProvider
			});
		});
}

/**
 * Traverses a tree depth-first, calling visitor for each node.
 *
 * @param node - The root node
 * @param visitor - Function to call for each node
 */
export function traverseTree(
	node: TreeNode,
	visitor: (node: TreeNode) => void
): void {
	visitor(node);
	node.children.forEach(child => traverseTree(child, visitor));
}

/**
 * Traverses a tree breadth-first, calling visitor for each node.
 *
 * @param node - The root node
 * @param visitor - Function to call for each node
 */
export function traverseTreeBFS(
	node: TreeNode,
	visitor: (node: TreeNode) => void
): void {
	const queue: TreeNode[] = [node];

	while (queue.length > 0) {
		const current = queue.shift()!;
		visitor(current);
		queue.push(...current.children);
	}
}

/**
 * Finds a node in the tree by file path.
 *
 * @param node - The root node
 * @param path - The file path to search for
 * @returns The found node, or null
 */
export function findNodeByPath(
	node: TreeNode,
	path: string
): TreeNode | null {
	if (node.file.path === path) {
		return node;
	}

	for (const child of node.children) {
		const found = findNodeByPath(child, path);
		if (found) return found;
	}

	return null;
}

/**
 * Calculates the maximum depth of a tree.
 *
 * @param node - The root node
 * @returns Maximum depth
 */
export function calculateTreeDepth(node: TreeNode): number {
	if (node.children.length === 0) {
		return node.depth;
	}

	return Math.max(...node.children.map(calculateTreeDepth));
}

/**
 * Counts the total number of nodes in a tree.
 *
 * @param node - The root node
 * @returns Total node count
 */
export function countNodes(node: TreeNode): number {
	let count = 1; // Count self

	node.children.forEach(child => {
		count += countNodes(child);
	});

	return count;
}

/**
 * Flattens a tree into an array of nodes.
 *
 * @param node - The root node
 * @returns Flattened array of all nodes
 */
export function flattenTree(node: TreeNode): TreeNode[] {
	const nodes: TreeNode[] = [];
	traverseTree(node, n => nodes.push(n));
	return nodes;
}

/**
 * Filters a tree, keeping only nodes that match the predicate.
 * Creates a new tree with filtered nodes.
 *
 * @param node - The root node
 * @param predicate - Function to test each node
 * @returns New tree with filtered nodes, or null if root doesn't match
 */
export function filterTree(
	node: TreeNode,
	predicate: (node: TreeNode) => boolean
): TreeNode | null {
	if (!predicate(node)) {
		return null;
	}

	const filteredChildren = node.children
		.map(child => filterTree(child, predicate))
		.filter((child): child is TreeNode => child !== null);

	return {
		...node,
		children: filteredChildren
	};
}

/**
 * Maps over a tree, transforming each node.
 * Creates a new tree with transformed nodes.
 *
 * @param node - The root node
 * @param mapper - Function to transform each node
 * @returns New tree with transformed nodes
 */
export function mapTree(
	node: TreeNode,
	mapper: (node: TreeNode) => TreeNode
): TreeNode {
	const mappedNode = mapper(node);

	return {
		...mappedNode,
		children: node.children.map(child => mapTree(child, mapper))
	};
}

/**
 * Clones a tree node and all its children.
 *
 * @param node - The node to clone
 * @returns Deep copy of the node
 */
export function cloneTree(node: TreeNode): TreeNode {
	return {
		file: node.file,
		depth: node.depth,
		isCycle: node.isCycle,
		metadata: { ...node.metadata },
		children: node.children.map(cloneTree)
	};
}
