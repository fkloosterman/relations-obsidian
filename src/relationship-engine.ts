import { TFile } from 'obsidian';
import { RelationGraph } from './relation-graph';

/**
 * Engine for computing extended relationships (ancestors, descendants, siblings, cousins).
 *
 * All traversal methods include cycle protection to prevent infinite loops.
 */
export class RelationshipEngine {
  constructor(private graph: RelationGraph) {}

  /**
   * Gets ancestors of a file, organized by generation.
   *
   * Uses breadth-first search to traverse parent relationships, organizing
   * results by generation level (parents, grandparents, great-grandparents, etc.).
   * Includes cycle protection to prevent infinite loops.
   *
   * @param file - The file to get ancestors for
   * @param maxDepth - Maximum depth to traverse (default: from settings)
   * @returns Array of arrays: [[parents], [grandparents], [great-grandparents], ...]
   *
   * @example
   * // Given: A → B → C → D
   * // getAncestors(A, 3) returns:
   * // [
   * //   [B],           // Generation 1: parents
   * //   [C],           // Generation 2: grandparents
   * //   [D]            // Generation 3: great-grandparents
   * // ]
   *
   * @example
   * // Given: A → B, A → C; B → D, C → D
   * // getAncestors(A, 2) returns:
   * // [
   * //   [B, C],        // Generation 1: parents
   * //   [D]            // Generation 2: grandparents (merged from both paths)
   * // ]
   */
  getAncestors(file: TFile, maxDepth?: number): TFile[][] {
    const depth = maxDepth ?? this.graph.getMaxDepth();
    const result: TFile[][] = [];
    const visited = new Set<string>();

    // Mark starting file as visited to prevent cycles back to self
    visited.add(file.path);

    // BFS: current generation
    let currentGeneration = [file];

    for (let level = 0; level < depth; level++) {
      const nextGeneration: TFile[] = [];
      const seenInGeneration = new Set<string>();

      // Process all files in current generation
      for (const current of currentGeneration) {
        const parents = this.graph.getParents(current);

        for (const parent of parents) {
          // Skip if already visited (cycle protection)
          if (visited.has(parent.path)) continue;

          // Skip if already added to this generation (deduplication)
          if (seenInGeneration.has(parent.path)) continue;

          nextGeneration.push(parent);
          seenInGeneration.add(parent.path);
          visited.add(parent.path);
        }
      }

      // If no more parents, stop traversal
      if (nextGeneration.length === 0) break;

      result.push(nextGeneration);
      currentGeneration = nextGeneration;
    }

    return result;
  }

  /**
   * Gets descendants of a file, organized by generation.
   *
   * Uses breadth-first search to traverse child relationships, organizing
   * results by generation level (children, grandchildren, great-grandchildren, etc.).
   * Includes cycle protection to prevent infinite loops.
   *
   * @param file - The file to get descendants for
   * @param maxDepth - Maximum depth to traverse (default: from settings)
   * @returns Array of arrays: [[children], [grandchildren], [great-grandchildren], ...]
   *
   * @example
   * // Given: D → C → B → A (A is child of B, B is child of C, C is child of D)
   * // getDescendants(D, 3) returns:
   * // [
   * //   [C],           // Generation 1: children
   * //   [B],           // Generation 2: grandchildren
   * //   [A]            // Generation 3: great-grandchildren
   * // ]
   *
   * @example
   * // Given: D → B, D → C; B → A, C → A (A has two parents B and C, both children of D)
   * // getDescendants(D, 2) returns:
   * // [
   * //   [B, C],        // Generation 1: children
   * //   [A]            // Generation 2: grandchildren (merged from both paths)
   * // ]
   */
  getDescendants(file: TFile, maxDepth?: number): TFile[][] {
    const depth = maxDepth ?? this.graph.getMaxDepth();
    const result: TFile[][] = [];
    const visited = new Set<string>();

    // Mark starting file as visited to prevent cycles back to self
    visited.add(file.path);

    // BFS: current generation
    let currentGeneration = [file];

    for (let level = 0; level < depth; level++) {
      const nextGeneration: TFile[] = [];
      const seenInGeneration = new Set<string>();

      // Process all files in current generation
      for (const current of currentGeneration) {
        const children = this.graph.getChildren(current);

        for (const child of children) {
          // Skip if already visited (cycle protection)
          if (visited.has(child.path)) continue;

          // Skip if already added to this generation (deduplication)
          if (seenInGeneration.has(child.path)) continue;

          nextGeneration.push(child);
          seenInGeneration.add(child.path);
          visited.add(child.path);
        }
      }

      // If no more children, stop traversal
      if (nextGeneration.length === 0) break;

      result.push(nextGeneration);
      currentGeneration = nextGeneration;
    }

    return result;
  }

  /**
   * Gets siblings of a file (notes sharing at least one parent).
   *
   * Returns all notes that share at least one parent with the specified file.
   * This includes both full siblings (sharing all parents) and half-siblings
   * (sharing only some parents).
   *
   * @param file - The file to get siblings for
   * @param includeSelf - Whether to include the queried file in results (default: false)
   * @returns Array of sibling files
   *
   * @example
   * // Given: Parent P has children A, B, C
   * // getSiblings(A, false) returns: [B, C]
   * // getSiblings(A, true) returns: [A, B, C]
   *
   * @example
   * // Given: Parent P1 has children A, B; Parent P2 has children A, C
   * // getSiblings(A, false) returns: [B, C]
   * // A has half-sibling B (via P1) and half-sibling C (via P2)
   *
   * @example
   * // Given: A has no parents (root node)
   * // getSiblings(A) returns: []
   * // Root nodes have no siblings
   */
  getSiblings(file: TFile, includeSelf: boolean = false): TFile[] {
    // Get all parents of the file
    const parents = this.graph.getParents(file);

    // Root nodes (no parents) have no siblings
    if (parents.length === 0) {
      return [];
    }

    // Collect all unique children from all parents
    const siblingSet = new Set<string>();

    for (const parent of parents) {
      const children = this.graph.getChildren(parent);

      for (const child of children) {
        siblingSet.add(child.path);
      }
    }

    // Convert set to array of TFile objects
    const siblings: TFile[] = [];

    for (const siblingPath of siblingSet) {
      // Skip self if not including self
      if (!includeSelf && siblingPath === file.path) {
        continue;
      }

      // Get TFile object for sibling
      const siblingFile = this.graph.getFileByPath(siblingPath);
      if (siblingFile) {
        siblings.push(siblingFile);
      }
    }

    return siblings;
  }
}
