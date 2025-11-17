import { TFile } from 'obsidian';
import { RelationGraph } from '../relation-graph';

/**
 * Statistics about the relationship graph.
 */
export interface GraphStatistics {
  /** Total number of notes in graph */
  totalNodes: number;

  /** Total number of parent-child relationships */
  totalEdges: number;

  /** Number of root notes (no parents) */
  rootCount: number;

  /** Number of leaf notes (no children) */
  leafCount: number;

  /** Maximum depth from any root */
  maxDepth: number;

  /** Maximum number of children any note has */
  maxBreadth: number;

  /** Number of cycles detected */
  cycleCount: number;

  /** Average number of children per note */
  averageChildren: number;
}

/**
 * Finds all root notes in the graph.
 *
 * Root notes are the top-level nodes in hierarchies - they have no parents.
 * A note is considered a root if it has no parents AND either:
 * 1. Has at least one child, OR
 * 2. Has an explicit (even if empty) parent field in frontmatter
 *
 * This distinguishes files that are part of the hierarchy (with empty parent field)
 * from files that don't participate in the hierarchy at all (no parent field).
 *
 * @param graph - Relation graph to analyze
 * @returns Array of root notes, sorted alphabetically
 *
 * @example
 * const roots = findRootNotes(graph);
 * console.log(`Found ${roots.length} root notes`);
 */
export function findRootNotes(graph: RelationGraph): TFile[] {
  const allFiles = graph.getAllFiles();
  const roots: TFile[] = [];

  for (const file of allFiles) {
    const parents = graph.getParents(file);
    const children = graph.getChildren(file);
    const hasParentField = graph.hasParentField(file);

    // Root note: no parents AND (has children OR has parent field)
    if (parents.length === 0 && (children.length > 0 || hasParentField)) {
      roots.push(file);
    }
  }

  // Sort alphabetically by basename
  return roots.sort((a, b) =>
    a.basename.localeCompare(b.basename)
  );
}

/**
 * Finds all leaf notes (notes with no children but with parents) in the graph.
 *
 * Leaf notes are the bottom-level nodes in hierarchies - they have parents
 * but no children. Isolated notes (with neither parents nor children) are
 * excluded.
 *
 * @param graph - Relation graph to analyze
 * @returns Array of leaf notes, sorted alphabetically
 *
 * @example
 * const leaves = findLeafNotes(graph);
 * console.log(`Found ${leaves.length} leaf notes`);
 */
export function findLeafNotes(graph: RelationGraph): TFile[] {
  const allFiles = graph.getAllFiles();
  const leaves: TFile[] = [];

  for (const file of allFiles) {
    const parents = graph.getParents(file);
    const children = graph.getChildren(file);

    // Leaf note: no children but has at least one parent
    if (children.length === 0 && parents.length > 0) {
      leaves.push(file);
    }
  }

  // Sort alphabetically by basename
  return leaves.sort((a, b) =>
    a.basename.localeCompare(b.basename)
  );
}

/**
 * Computes graph statistics.
 *
 * @param graph - Relation graph to analyze
 * @returns Object with various graph metrics
 *
 * @example
 * const stats = computeGraphStatistics(graph);
 * console.log(`Graph has ${stats.totalNodes} nodes and ${stats.totalEdges} edges`);
 * console.log(`Max depth: ${stats.maxDepth}, Max breadth: ${stats.maxBreadth}`);
 */
export function computeGraphStatistics(graph: RelationGraph): GraphStatistics {
  const allFiles = graph.getAllFiles();
  const totalNodes = allFiles.length;

  let totalEdges = 0;
  let maxDepth = 0;
  let maxBreadth = 0;
  const roots = findRootNotes(graph);
  const leaves = findLeafNotes(graph);

  // Count edges and find max breadth
  for (const file of allFiles) {
    const children = graph.getChildren(file);
    totalEdges += children.length;
    maxBreadth = Math.max(maxBreadth, children.length);
  }

  // Compute max depth (from roots)
  for (const root of roots) {
    const depth = computeMaxDepthFrom(root, graph);
    maxDepth = Math.max(maxDepth, depth);
  }

  // Detect cycles
  const cycles = graph.getAllCycles();

  return {
    totalNodes,
    totalEdges,
    rootCount: roots.length,
    leafCount: leaves.length,
    maxDepth,
    maxBreadth,
    cycleCount: cycles.length,
    averageChildren: totalNodes > 0 ? totalEdges / totalNodes : 0
  };
}

/**
 * Computes maximum depth from a given starting node.
 *
 * @param start - Starting file
 * @param graph - Relation graph
 * @param visited - Set of already visited paths (for cycle prevention)
 * @returns Maximum depth from this node
 */
function computeMaxDepthFrom(
  start: TFile,
  graph: RelationGraph,
  visited: Set<string> = new Set()
): number {
  // Prevent infinite loops in cyclic graphs
  if (visited.has(start.path)) return 0;

  visited.add(start.path);

  const children = graph.getChildren(start);
  if (children.length === 0) return 0;

  let maxChildDepth = 0;
  for (const child of children) {
    const depth = computeMaxDepthFrom(child, graph, new Set(visited));
    maxChildDepth = Math.max(maxChildDepth, depth);
  }

  return maxChildDepth + 1;
}
