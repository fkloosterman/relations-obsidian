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

  /**
   * Gets cousins of a file at the specified degree.
   *
   * Cousins are notes that share a common ancestor at generation (degree + 1),
   * but do not share parents (i.e., are not siblings). This method excludes
   * both siblings and the queried file itself from results.
   *
   * @param file - The file to get cousins for
   * @param degree - Cousin degree (1 = first cousins, 2 = second cousins, etc.). Default: 1
   * @returns Array of cousin files (may be empty if no cousins exist)
   *
   * @example
   * // Given:
   * //     GP
   * //    /  \
   * //   P1   P2
   * //   |    |
   * //   A    B
   * // getCousins(A, 1) returns: [B]
   * // A and B are first cousins (share grandparent GP)
   *
   * @example
   * // Given:
   * //       GGP
   * //      /   \
   * //    GP1   GP2
   * //     |     |
   * //    P1    P2
   * //     |     |
   * //     A     B
   * // getCousins(A, 2) returns: [B]
   * // A and B are second cousins (share great-grandparent GGP)
   *
   * @example
   * // Given: A has no ancestors at generation 2 (no grandparents)
   * // getCousins(A, 1) returns: []
   * // Cannot have first cousins without grandparents
   *
   * @example
   * // Given:
   * //      GP
   * //     /  \
   * //    P1  P2
   * //   / \   \
   * //  A   B   C
   * // getCousins(A, 1) returns: [C]
   * // B is excluded because B is a sibling (shares parent P1)
   * // C is included because C shares grandparent GP but not parent P1
   */
  getCousins(file: TFile, degree: number = 1): TFile[] {
    // Validate degree (must be at least 1)
    if (degree < 1) {
      return [];
    }

    // Get ancestors at generation (degree + 1)
    // These are the "shared ancestors" for cousins of this degree
    // For first cousins (degree 1), we need grandparents (generation 2)
    // For second cousins (degree 2), we need great-grandparents (generation 3)
    const ancestorGenerations = this.getAncestors(file, degree + 1);

    // If we don't have ancestors at the required generation, no cousins exist
    if (ancestorGenerations.length < degree + 1) {
      return [];
    }

    // Get all ancestors at closer generations (to exclude closer cousins)
    // For second cousins, this would be ancestors at generations 1-2 (parents and grandparents)
    const closerAncestors = new Set<string>();
    for (let i = 0; i < degree; i++) {
      if (ancestorGenerations.length > i) {
        for (const ancestor of ancestorGenerations[i]) {
          closerAncestors.add(ancestor.path);
        }
      }
    }

    // Get the specific generation we need (index is degree because arrays are 0-indexed)
    // For first cousins (degree 1), we need generation 2 (index 1)
    // For second cousins (degree 2), we need generation 3 (index 2)
    const sharedAncestors = ancestorGenerations[degree];

    // Collect all descendants at generation (degree + 1) from each shared ancestor
    const cousinCandidates = new Set<string>();

    for (const ancestor of sharedAncestors) {
      const descendantGenerations = this.getDescendants(ancestor, degree + 1);

      // Get descendants at generation (degree + 1)
      if (descendantGenerations.length >= degree + 1) {
        const descendantsAtLevel = descendantGenerations[degree];

        for (const descendant of descendantsAtLevel) {
          cousinCandidates.add(descendant.path);
        }
      }
    }

    // Get siblings to exclude them
    const siblings = this.getSiblings(file, false); // Don't include self
    const siblingPaths = new Set(siblings.map(s => s.path));

    // Filter out self, siblings, and closer cousins
    const cousins: TFile[] = [];

    for (const candidatePath of cousinCandidates) {
      // Skip self
      if (candidatePath === file.path) continue;

      // Skip siblings
      if (siblingPaths.has(candidatePath)) continue;

      // Skip if this person shares a closer ancestor
      // (i.e., they're a closer degree cousin or closer relative)
      const candidateFile = this.graph.getFileByPath(candidatePath);
      if (!candidateFile) continue;

      // Check if candidate shares any ancestor at closer generations
      const candidateAncestors = this.getAncestors(candidateFile, degree);
      let sharesCloserAncestor = false;

      for (let i = 0; i < candidateAncestors.length; i++) {
        for (const ancestor of candidateAncestors[i]) {
          if (closerAncestors.has(ancestor.path)) {
            sharesCloserAncestor = true;
            break;
          }
        }
        if (sharesCloserAncestor) break;
      }

      // Skip if they share a closer ancestor
      if (sharesCloserAncestor) continue;

      cousins.push(candidateFile);
    }

    return cousins;
  }
}
