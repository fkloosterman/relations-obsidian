import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipEngine } from '@/relationship-engine';
import { RelationGraph, NodeInfo } from '@/relation-graph';
import { CycleDetector } from '@/cycle-detector';
import { TFile, App } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
function createMockFile(path: string, basename: string): TFile {
  return {
    path,
    basename,
    name: basename + '.md',
    extension: 'md',
    stat: { ctime: 0, mtime: 0, size: 0 },
    vault: {} as any,
    parent: null,
  } as TFile;
}

/**
 * Helper to create a mock RelationGraph with specified edges
 */
function createMockGraph(edges: [string, string][], maxDepth: number = 5): RelationGraph {
  const mockApp = {
    vault: {
      getMarkdownFiles: vi.fn().mockReturnValue([]),
    },
    metadataCache: {
      getFileCache: vi.fn(),
      getFirstLinkpathDest: vi.fn(),
    },
  } as any;

  const graph = new RelationGraph(mockApp, 'parent', maxDepth);

  // Build file map
  const fileMap = new Map<string, TFile>();
  const nodeMap = new Map<string, NodeInfo>();

  // Collect all unique file paths
  const allPaths = new Set<string>();
  edges.forEach(([child, parent]) => {
    allPaths.add(child);
    allPaths.add(parent);
  });

  // Create TFile objects
  allPaths.forEach(path => {
    const file = createMockFile(path, path);
    fileMap.set(path, file);
    nodeMap.set(path, { file, parents: [], children: [] });
  });

  // Build parent-child relationships
  edges.forEach(([childPath, parentPath]) => {
    const childFile = fileMap.get(childPath)!;
    const parentFile = fileMap.get(parentPath)!;

    const childNode = nodeMap.get(childPath)!;
    const parentNode = nodeMap.get(parentPath)!;

    childNode.parents.push(parentFile);
    parentNode.children.push(childFile);
  });

  // Inject the graph structure
  (graph as any).graph = nodeMap;

  // Initialize cycle detector
  (graph as any).cycleDetector = new CycleDetector(graph);

  return graph;
}

/**
 * Helper to create linear chain: A → B → C → D → ...
 */
function createLinearChain(length: number, maxDepth: number = 10): {
  graph: RelationGraph;
  files: Map<string, TFile>;
} {
  const nodes = Array.from({ length }, (_, i) =>
    String.fromCharCode(65 + i) // A, B, C, D, ...
  );

  const edges: [string, string][] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push([nodes[i], nodes[i + 1]]);
  }

  const graph = createMockGraph(edges, maxDepth);

  // Build file map for easy access
  const files = new Map<string, TFile>();
  nodes.forEach(name => {
    const node = (graph as any).graph.get(name);
    if (node) {
      files.set(name, node.file);
    }
  });

  return { graph, files };
}

/**
 * Helper to create diamond structure:
 *     D
 *    / \
 *   B   C
 *    \ /
 *     A
 */
function createDiamondStructure(): {
  graph: RelationGraph;
  files: { A: TFile; B: TFile; C: TFile; D: TFile };
} {
  const edges: [string, string][] = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['C', 'D']
  ];

  const graph = createMockGraph(edges);
  const graphInternal = (graph as any).graph;

  return {
    graph,
    files: {
      A: graphInternal.get('A')!.file,
      B: graphInternal.get('B')!.file,
      C: graphInternal.get('C')!.file,
      D: graphInternal.get('D')!.file
    }
  };
}

describe('RelationshipEngine - getAncestors', () => {
  describe('Linear Chains', () => {
    it('should return ancestors for linear chain: A → B → C → D', () => {
      // Setup: A has parent B, B has parent C, C has parent D
      const { graph, files } = createLinearChain(4);
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.get('A')!, 3);

      // Expect: [[B], [C], [D]]
      expect(ancestors).toHaveLength(3);
      expect(ancestors[0]).toHaveLength(1);
      expect(ancestors[0][0].basename).toBe('B');
      expect(ancestors[1]).toHaveLength(1);
      expect(ancestors[1][0].basename).toBe('C');
      expect(ancestors[2]).toHaveLength(1);
      expect(ancestors[2][0].basename).toBe('D');
    });

    it('should respect depth limit in linear chain', () => {
      // Setup: A → B → C → D → E → F
      const { graph, files } = createLinearChain(6);
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.get('A')!, 2);

      // Expect: [[B], [C]]
      // D, E, F should not be included
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0][0].basename).toBe('B');
      expect(ancestors[1][0].basename).toBe('C');
    });

    it('should return empty array for root node (no parents)', () => {
      // Setup: A has no parents
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const ancestors = engine.getAncestors(fileA);

      // Expect: []
      expect(ancestors).toHaveLength(0);
    });

    it('should handle depth 1 (immediate parents only)', () => {
      // Setup: A → B → C → D
      const { graph, files } = createLinearChain(4);
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.get('A')!, 1);

      // Expect: [[B]]
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0]).toHaveLength(1);
      expect(ancestors[0][0].basename).toBe('B');
    });
  });

  describe('Multiple Parents (Diamond Structures)', () => {
    it('should handle multiple parents: A → B, A → C', () => {
      // Setup: A has parents B and C
      const graph = createMockGraph([
        ['A', 'B'],
        ['A', 'C']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const ancestors = engine.getAncestors(fileA, 1);

      // Expect: [[B, C]] (both in same generation)
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0]).toHaveLength(2);
      const names = ancestors[0].map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C']);
    });

    it('should merge ancestors when paths converge: A → B, A → C; B → D, C → D', () => {
      // Setup:
      //     D
      //    / \
      //   B   C
      //    \ /
      //     A
      const { graph, files } = createDiamondStructure();
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.A, 2);

      // Expect: [[B, C], [D]]
      // D should appear only once even though reachable via two paths
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0]).toHaveLength(2);
      const gen1Names = ancestors[0].map(f => f.basename).sort();
      expect(gen1Names).toEqual(['B', 'C']);
      expect(ancestors[1]).toHaveLength(1);
      expect(ancestors[1][0].basename).toBe('D');
    });

    it('should handle complex multi-parent hierarchy', () => {
      // Setup:
      //       F
      //      / \
      //     D   E
      //    / \ / \
      //   B   C   G
      //    \ /
      //     A
      const graph = createMockGraph([
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'D'],
        ['C', 'D'],
        ['C', 'E'],
        ['G', 'E'],
        ['D', 'F'],
        ['E', 'F']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const ancestors = engine.getAncestors(fileA, 3);

      // Verify all ancestors at correct generation levels
      expect(ancestors).toHaveLength(3);

      // Generation 1: B, C
      expect(ancestors[0]).toHaveLength(2);
      const gen1 = ancestors[0].map(f => f.basename).sort();
      expect(gen1).toEqual(['B', 'C']);

      // Generation 2: D, E
      expect(ancestors[1]).toHaveLength(2);
      const gen2 = ancestors[1].map(f => f.basename).sort();
      expect(gen2).toEqual(['D', 'E']);

      // Generation 3: F
      expect(ancestors[2]).toHaveLength(1);
      expect(ancestors[2][0].basename).toBe('F');
    });
  });

  describe('Cycle Protection', () => {
    it('should stop at cycle without infinite loop: A → B → C → B', () => {
      // Setup: A → B → C → B (cycle between B and C)
      const graph = createMockGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'B']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const ancestors = engine.getAncestors(fileA, 10);

      // Should complete without hanging
      // Should not include B twice
      expect(ancestors).toBeDefined();
      expect(ancestors.length).toBeGreaterThan(0);

      // B should appear in generation 1
      expect(ancestors[0].some(f => f.basename === 'B')).toBe(true);

      // C should appear in generation 2
      expect(ancestors[1].some(f => f.basename === 'C')).toBe(true);

      // No more generations (cycle prevents further traversal)
      expect(ancestors.length).toBe(2);
    });

    it('should handle self-loop: A → B → B', () => {
      // Setup: A has parent B, B has parent B (self-loop)
      const graph = createMockGraph([
        ['A', 'B'],
        ['B', 'B']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const ancestors = engine.getAncestors(fileA);

      // Expect: [[B]]
      // Should not infinitely loop on B
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0]).toHaveLength(1);
      expect(ancestors[0][0].basename).toBe('B');
    });

    it('should handle cycle to starting node: A → B → A', () => {
      // Setup: A has parent B, B has parent A
      const graph = createMockGraph([
        ['A', 'B'],
        ['B', 'A']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const ancestors = engine.getAncestors(fileA);

      // Expect: [[B]]
      // Should not include A again
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0]).toHaveLength(1);
      expect(ancestors[0][0].basename).toBe('B');
    });

    it('should handle long cycle: A → B → C → D → E → C', () => {
      // Setup: Cycle exists at generation 4
      const graph = createMockGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
        ['D', 'E'],
        ['E', 'C']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const ancestors = engine.getAncestors(fileA, 10);

      // Should stop when cycle detected
      // Should include each node only once
      expect(ancestors).toBeDefined();

      // Collect all unique ancestors
      const allAncestors = ancestors.flat();
      const uniqueNames = new Set(allAncestors.map(f => f.basename));

      // Should have B, C, D, E (each once)
      expect(uniqueNames.size).toBe(4);
      expect(uniqueNames.has('B')).toBe(true);
      expect(uniqueNames.has('C')).toBe(true);
      expect(uniqueNames.has('D')).toBe(true);
      expect(uniqueNames.has('E')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      // Setup: Empty graph
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const ancestors = engine.getAncestors(fileA);

      // Expect: []
      expect(ancestors).toHaveLength(0);
    });

    it('should handle single node with no parents', () => {
      // Setup: Isolated node A
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const ancestors = engine.getAncestors(fileA);

      // Expect: []
      expect(ancestors).toHaveLength(0);
    });

    it('should handle maxDepth = 0', () => {
      // Setup: A → B → C
      const { graph, files } = createLinearChain(3);
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.get('A')!, 0);

      // Expect: []
      expect(ancestors).toHaveLength(0);
    });

    it('should handle maxDepth larger than tree height', () => {
      // Setup: A → B → C (height 2)
      const { graph, files } = createLinearChain(3);
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.get('A')!, 100);

      // Expect: [[B], [C]]
      // Should not error or return undefined generations
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0][0].basename).toBe('B');
      expect(ancestors[1][0].basename).toBe('C');
    });

    it('should use default maxDepth from settings when not provided', () => {
      // Setup: Settings has maxDepth = 3, tree has depth 10
      const { graph, files } = createLinearChain(10, 3);
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.get('A')!);

      // Expect: Should only traverse 3 levels
      expect(ancestors).toHaveLength(3);
    });
  });

  describe('Generation Ordering', () => {
    it('should maintain consistent ordering within generation', () => {
      // Setup: A → B, A → C, A → D (multiple parents)
      const graph = createMockGraph([
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      // Test multiple times
      const ancestors1 = engine.getAncestors(fileA, 1);
      const ancestors2 = engine.getAncestors(fileA, 1);
      const ancestors3 = engine.getAncestors(fileA, 1);

      // Same order each time (deterministic)
      const order1 = ancestors1[0].map(f => f.basename).join(',');
      const order2 = ancestors2[0].map(f => f.basename).join(',');
      const order3 = ancestors3[0].map(f => f.basename).join(',');

      expect(order1).toBe(order2);
      expect(order2).toBe(order3);
    });

    it('should not have duplicates within same generation', () => {
      // Setup: Complex graph with multiple paths to same ancestor
      const { graph, files } = createDiamondStructure();
      const engine = new RelationshipEngine(graph);

      const ancestors = engine.getAncestors(files.A);

      // Each ancestor should appear exactly once per generation
      ancestors.forEach((generation, idx) => {
        const names = generation.map(f => f.basename);
        const uniqueNames = new Set(names);
        expect(names.length).toBe(uniqueNames.size);
      });
    });
  });

  describe('Performance', () => {
    it('should process 1000-node lineage in reasonable time', () => {
      // Setup: Linear chain of 1000 nodes
      const { graph, files } = createLinearChain(1000, 1000);
      const engine = new RelationshipEngine(graph);

      const startTime = Date.now();
      const ancestors = engine.getAncestors(files.get('A')!, 1000);
      const endTime = Date.now();

      // Measure: Execution time
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Verify correctness
      expect(ancestors).toHaveLength(999); // A has 999 ancestors
    });

    it('should handle wide tree (many parents per node)', () => {
      // Setup: Node with many parents
      const edges: [string, string][] = [];

      // A has 50 parents (P0, P1, P2, ... P49)
      for (let i = 0; i < 50; i++) {
        edges.push(['A', `P${i}`]);
      }

      // Each parent has 50 parents (GP0, GP1, ... GP49)
      for (let i = 0; i < 50; i++) {
        for (let j = 0; j < 50; j++) {
          edges.push([`P${i}`, `GP${j}`]);
        }
      }

      const graph = createMockGraph(edges, 2);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const startTime = Date.now();
      const ancestors = engine.getAncestors(fileA, 2);
      const endTime = Date.now();

      // Should complete quickly
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Less than 500ms

      // Generation 1: 50 parents
      expect(ancestors[0]).toHaveLength(50);

      // Generation 2: 50 grandparents (merged from all paths)
      expect(ancestors[1]).toHaveLength(50);
    });
  });
});

/**
 * Helper to create linear chain for descendant tests
 * A has child B, B has child C, C has child D, etc.
 * Structure: A → B → C → D → ...
 */
function createDescendantChain(length: number, maxDepth: number = 10): {
  graph: RelationGraph;
  files: Map<string, TFile>;
} {
  const nodes = Array.from({ length }, (_, i) =>
    String.fromCharCode(65 + i) // A, B, C, D, ...
  );

  const edges: [string, string][] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    // Create chain: A → B → C → D (A has child B, B has child C, etc.)
    // Edge format: [child, parent]
    // To make A have child B: B has parent A, so edge [B, A]
    edges.push([nodes[i + 1], nodes[i]]);
  }

  const graph = createMockGraph(edges, maxDepth);

  // Build file map for easy access
  const files = new Map<string, TFile>();
  nodes.forEach(name => {
    const node = (graph as any).graph.get(name);
    if (node) {
      files.set(name, node.file);
    }
  });

  return { graph, files };
}

/**
 * Helper to create inverted diamond structure for descendant tests:
 *     D
 *    / \
 *   B   C
 *    \ /
 *     A
 */
function createDescendantDiamond(): {
  graph: RelationGraph;
  files: { A: TFile; B: TFile; C: TFile; D: TFile };
} {
  const edges: [string, string][] = [
    ['B', 'D'], // B has parent D (D has child B)
    ['C', 'D'], // C has parent D (D has child C)
    ['A', 'B'], // A has parent B (B has child A)
    ['A', 'C']  // A has parent C (C has child A)
  ];

  const graph = createMockGraph(edges);
  const graphInternal = (graph as any).graph;

  return {
    graph,
    files: {
      A: graphInternal.get('A')!.file,
      B: graphInternal.get('B')!.file,
      C: graphInternal.get('C')!.file,
      D: graphInternal.get('D')!.file
    }
  };
}

describe('RelationshipEngine - getDescendants', () => {
  describe('Linear Chains', () => {
    it('should return descendants for linear chain: A → B → C → D', () => {
      // Setup: A has child B, B has child C, C has child D
      const { graph, files } = createDescendantChain(4);
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.get('A')!, 3);

      // Expect: [[B], [C], [D]]
      expect(descendants).toHaveLength(3);
      expect(descendants[0]).toHaveLength(1);
      expect(descendants[0][0].basename).toBe('B');
      expect(descendants[1]).toHaveLength(1);
      expect(descendants[1][0].basename).toBe('C');
      expect(descendants[2]).toHaveLength(1);
      expect(descendants[2][0].basename).toBe('D');
    });

    it('should respect depth limit in linear chain', () => {
      // Setup: A → B → C → D → E → F
      const { graph, files } = createDescendantChain(6);
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.get('A')!, 2);

      // Expect: [[B], [C]]
      // D, E, F should not be included
      expect(descendants).toHaveLength(2);
      expect(descendants[0][0].basename).toBe('B');
      expect(descendants[1][0].basename).toBe('C');
    });

    it('should return empty array for leaf node (no children)', () => {
      // Setup: A has no children
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const descendants = engine.getDescendants(fileA);

      // Expect: []
      expect(descendants).toHaveLength(0);
    });

    it('should handle depth 1 (immediate children only)', () => {
      // Setup: A → B → C → D
      const { graph, files } = createDescendantChain(4);
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.get('A')!, 1);

      // Expect: [[B]]
      expect(descendants).toHaveLength(1);
      expect(descendants[0]).toHaveLength(1);
      expect(descendants[0][0].basename).toBe('B');
    });
  });

  describe('Multiple Children (Tree Structures)', () => {
    it('should handle multiple children: A → B, A → C', () => {
      // Setup: A has children B and C
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'A']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 1);

      // Expect: [[B, C]] (both in same generation)
      expect(descendants).toHaveLength(1);
      expect(descendants[0]).toHaveLength(2);
      const names = descendants[0].map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C']);
    });

    it('should merge descendants when paths converge: D → B, D → C; B → A, C → A', () => {
      // Setup:
      //     D (root - start here)
      //    / \
      //   B   C (children of D)
      //    \ /
      //     A (grandchild of D via both paths)
      const { graph, files } = createDescendantDiamond();
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.D, 2);

      // Expect: [[B, C], [A]]
      // A should appear only once even though reachable via two paths
      expect(descendants).toHaveLength(2);
      expect(descendants[0]).toHaveLength(2);
      const gen1Names = descendants[0].map(f => f.basename).sort();
      expect(gen1Names).toEqual(['B', 'C']);
      expect(descendants[1]).toHaveLength(1);
      expect(descendants[1][0].basename).toBe('A');
    });

    it('should handle wide tree (many children per node)', () => {
      // Setup: Node with many children
      const edges: [string, string][] = [];

      // A has 50 children (C0, C1, C2, ... C49)
      for (let i = 0; i < 50; i++) {
        edges.push([`C${i}`, 'A']);
      }

      // Each child has 50 children (GC0, GC1, ... GC49)
      for (let i = 0; i < 50; i++) {
        for (let j = 0; j < 50; j++) {
          edges.push([`GC${j}`, `C${i}`]);
        }
      }

      const graph = createMockGraph(edges, 2);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 2);

      // Generation 1: 50 children
      expect(descendants[0]).toHaveLength(50);

      // Generation 2: 50 grandchildren (merged from all paths)
      expect(descendants[1]).toHaveLength(50);
    });

    it('should handle complex multi-child hierarchy', () => {
      // Setup:
      //       A
      //      / \
      //     B   C
      //    / \ / \
      //   D   E   F
      //        \ /
      //         G
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'A'],
        ['D', 'B'],
        ['E', 'B'],
        ['E', 'C'],
        ['F', 'C'],
        ['G', 'E'],
        ['G', 'F']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 3);

      // Verify all descendants at correct generation levels
      expect(descendants).toHaveLength(3);

      // Generation 1: B, C
      expect(descendants[0]).toHaveLength(2);
      const gen1 = descendants[0].map(f => f.basename).sort();
      expect(gen1).toEqual(['B', 'C']);

      // Generation 2: D, E, F
      expect(descendants[1]).toHaveLength(3);
      const gen2 = descendants[1].map(f => f.basename).sort();
      expect(gen2).toEqual(['D', 'E', 'F']);

      // Generation 3: G
      expect(descendants[2]).toHaveLength(1);
      expect(descendants[2][0].basename).toBe('G');
    });
  });

  describe('Cycle Protection', () => {
    it('should stop at cycle without infinite loop: A → B → C → B', () => {
      // Setup: A → B → C → B (cycle between B and C)
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'B'],
        ['B', 'C']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 10);

      // Should complete without hanging
      // Should not include B twice
      expect(descendants).toBeDefined();
      expect(descendants.length).toBeGreaterThan(0);

      // B should appear in generation 1
      expect(descendants[0].some(f => f.basename === 'B')).toBe(true);

      // C should appear in generation 2
      expect(descendants[1].some(f => f.basename === 'C')).toBe(true);

      // No more generations (cycle prevents further traversal)
      expect(descendants.length).toBe(2);
    });

    it('should handle self-loop: A → B → B', () => {
      // Setup: A has child B, B has child B (self-loop)
      const graph = createMockGraph([
        ['B', 'A'],
        ['B', 'B']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA);

      // Expect: [[B]]
      // Should not infinitely loop on B
      expect(descendants).toHaveLength(1);
      expect(descendants[0]).toHaveLength(1);
      expect(descendants[0][0].basename).toBe('B');
    });

    it('should handle cycle to starting node: A → B → A', () => {
      // Setup: A has child B, B has child A
      const graph = createMockGraph([
        ['B', 'A'],
        ['A', 'B']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA);

      // Expect: [[B]]
      // Should not include A again
      expect(descendants).toHaveLength(1);
      expect(descendants[0]).toHaveLength(1);
      expect(descendants[0][0].basename).toBe('B');
    });

    it('should handle long cycle: A → B → C → D → E → C', () => {
      // Setup: Cycle exists at generation 4
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'B'],
        ['D', 'C'],
        ['E', 'D'],
        ['C', 'E']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 10);

      // Should stop when cycle detected
      // Should include each node only once
      expect(descendants).toBeDefined();

      // Collect all unique descendants
      const allDescendants = descendants.flat();
      const uniqueNames = new Set(allDescendants.map(f => f.basename));

      // Should have B, C, D, E (each once)
      expect(uniqueNames.size).toBe(4);
      expect(uniqueNames.has('B')).toBe(true);
      expect(uniqueNames.has('C')).toBe(true);
      expect(uniqueNames.has('D')).toBe(true);
      expect(uniqueNames.has('E')).toBe(true);
    });

    it('should handle cycle in wide tree', () => {
      // Setup: A → B, A → C, A → D; B → E, C → E, D → E; E → B (cycle back)
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'A'],
        ['D', 'A'],
        ['E', 'B'],
        ['E', 'C'],
        ['E', 'D'],
        ['B', 'E']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 5);

      // Should detect cycle and not hang
      expect(descendants).toBeDefined();
      expect(descendants.length).toBeGreaterThan(0);

      // Verify no duplicates
      const allDescendants = descendants.flat();
      const paths = allDescendants.map(f => f.path);
      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      // Setup: Empty graph
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const descendants = engine.getDescendants(fileA);

      // Expect: []
      expect(descendants).toHaveLength(0);
    });

    it('should handle single node with no children', () => {
      // Setup: Isolated node A
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const descendants = engine.getDescendants(fileA);

      // Expect: []
      expect(descendants).toHaveLength(0);
    });

    it('should handle maxDepth = 0', () => {
      // Setup: A → B → C
      const { graph, files } = createDescendantChain(3);
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.get('A')!, 0);

      // Expect: []
      expect(descendants).toHaveLength(0);
    });

    it('should handle maxDepth larger than tree depth', () => {
      // Setup: A → B → C (depth 2)
      const { graph, files } = createDescendantChain(3);
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.get('A')!, 100);

      // Expect: [[B], [C]]
      // Should not error or return undefined generations
      expect(descendants).toHaveLength(2);
      expect(descendants[0][0].basename).toBe('B');
      expect(descendants[1][0].basename).toBe('C');
    });

    it('should use default maxDepth from settings when not provided', () => {
      // Setup: Settings has maxDepth = 3, tree has depth 10
      const { graph, files } = createDescendantChain(10, 3);
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.get('A')!);

      // Expect: Should only traverse 3 levels
      expect(descendants).toHaveLength(3);
    });

    it('should handle node with many children (wide tree)', () => {
      // Setup: A has 100 children
      const edges: [string, string][] = [];
      for (let i = 0; i < 100; i++) {
        edges.push([`C${i}`, 'A']);
      }

      const graph = createMockGraph(edges, 1);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 1);

      // Expect: [[100 children]]
      // Should complete quickly
      expect(descendants).toHaveLength(1);
      expect(descendants[0]).toHaveLength(100);
    });
  });

  describe('Generation Ordering', () => {
    it('should maintain consistent ordering within generation', () => {
      // Setup: A → B, A → C, A → D (multiple children)
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'A'],
        ['D', 'A']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      // Test multiple times
      const descendants1 = engine.getDescendants(fileA, 1);
      const descendants2 = engine.getDescendants(fileA, 1);
      const descendants3 = engine.getDescendants(fileA, 1);

      // Same order each time (deterministic)
      const order1 = descendants1[0].map(f => f.basename).join(',');
      const order2 = descendants2[0].map(f => f.basename).join(',');
      const order3 = descendants3[0].map(f => f.basename).join(',');

      expect(order1).toBe(order2);
      expect(order2).toBe(order3);
    });

    it('should maintain breadth-first order', () => {
      // Setup:
      //     A
      //    /|\
      //   B C D
      //   |   |
      //   E   F
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'A'],
        ['D', 'A'],
        ['E', 'B'],
        ['F', 'D']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const descendants = engine.getDescendants(fileA, 2);

      // Expect: [[B, C, D], [E, F]]
      // E and F should appear in breadth-first order
      expect(descendants).toHaveLength(2);
      expect(descendants[0]).toHaveLength(3);
      expect(descendants[1]).toHaveLength(2);

      const gen2Names = descendants[1].map(f => f.basename).sort();
      expect(gen2Names).toEqual(['E', 'F']);
    });

    it('should not have duplicates within same generation', () => {
      // Setup: Complex graph with multiple paths to same descendant
      const { graph, files } = createDescendantDiamond();
      const engine = new RelationshipEngine(graph);

      const descendants = engine.getDescendants(files.A);

      // Each descendant should appear exactly once per generation
      descendants.forEach((generation, idx) => {
        const names = generation.map(f => f.basename);
        const uniqueNames = new Set(names);
        expect(names.length).toBe(uniqueNames.size);
      });
    });
  });

  describe('Symmetry with getAncestors', () => {
    it('should mirror getAncestors for simple chain', () => {
      // ancestorChain: A → B → C → D (A has parent B, etc.)
      // descendantChain: A → B → C → D (A has child B, etc.)
      const ancestorChain = createLinearChain(4);
      const descendantChain = createDescendantChain(4);

      const ancestorEngine = new RelationshipEngine(ancestorChain.graph);
      const descendantEngine = new RelationshipEngine(descendantChain.graph);

      const fileA_ancestors = ancestorChain.files.get('A')!;
      const fileA_descendants = descendantChain.files.get('A')!;

      // Test:
      //   - getAncestors(A) in ancestor chain returns [[B], [C], [D]]
      const ancestors = ancestorEngine.getAncestors(fileA_ancestors, 3);
      //   - getDescendants(A) in descendant chain returns [[B], [C], [D]]
      const descendants = descendantEngine.getDescendants(fileA_descendants, 3);

      // Verify: Both should return the same structure (parallel, not mirror)
      expect(ancestors).toHaveLength(3);
      expect(descendants).toHaveLength(3);

      expect(ancestors[0][0].basename).toBe('B');
      expect(ancestors[1][0].basename).toBe('C');
      expect(ancestors[2][0].basename).toBe('D');

      expect(descendants[0][0].basename).toBe('B');
      expect(descendants[1][0].basename).toBe('C');
      expect(descendants[2][0].basename).toBe('D');
    });

    it('should have same behavior for cycles', () => {
      // Setup: A → B → C → A (cycle)
      const graph = createMockGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      // Test both getAncestors(A) and getDescendants(A)
      const ancestors = engine.getAncestors(fileA, 10);
      const descendants = engine.getDescendants(fileA, 10);

      // Expect: Both should handle cycle gracefully without hanging
      expect(ancestors).toBeDefined();
      expect(descendants).toBeDefined();

      // Both should complete and find the cycle
      expect(ancestors.length).toBeGreaterThan(0);
      expect(descendants.length).toBeGreaterThan(0);
    });

    it('should respect same maxDepth setting', () => {
      // Setup: Long chain structure
      const { graph, files } = createLinearChain(10, 3);
      const engine = new RelationshipEngine(graph);
      const fileA = files.get('A')!;

      // Test: Both methods with same maxDepth (default from settings = 3)
      const ancestors = engine.getAncestors(fileA);
      const descendants = engine.getDescendants(fileA);

      // Expect: Both respect depth limit equally
      expect(ancestors).toHaveLength(3);
      expect(descendants).toHaveLength(0); // A is at the start, has no descendants in ancestor chain
    });
  });

  describe('Performance', () => {
    it('should process 1000-node lineage in reasonable time', () => {
      // Setup: Linear chain of 1000 nodes
      const { graph, files } = createDescendantChain(1000, 1000);
      const engine = new RelationshipEngine(graph);

      const startTime = Date.now();
      const descendants = engine.getDescendants(files.get('A')!, 1000);
      const endTime = Date.now();

      // Measure: Execution time
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Verify correctness
      expect(descendants).toHaveLength(999); // A has 999 descendants
    });

    it('should handle wide tree (many children per level)', () => {
      // Setup: Node with many children
      const edges: [string, string][] = [];

      // A has 50 children (C0, C1, C2, ... C49)
      for (let i = 0; i < 50; i++) {
        edges.push([`C${i}`, 'A']);
      }

      // Each child has 50 children (GC0, GC1, ... GC49)
      for (let i = 0; i < 50; i++) {
        for (let j = 0; j < 50; j++) {
          edges.push([`GC${j}`, `C${i}`]);
        }
      }

      const graph = createMockGraph(edges, 2);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const startTime = Date.now();
      const descendants = engine.getDescendants(fileA, 2);
      const endTime = Date.now();

      // Should complete quickly
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Less than 500ms

      // Generation 1: 50 children
      expect(descendants[0]).toHaveLength(50);

      // Generation 2: 50 grandchildren (merged from all paths)
      expect(descendants[1]).toHaveLength(50);
    });

    it('should handle deep tree (100 levels)', () => {
      // Setup: Linear chain of 100 nodes
      const { graph, files } = createDescendantChain(100, 100);
      const engine = new RelationshipEngine(graph);

      const startTime = Date.now();
      const descendants = engine.getDescendants(files.get('A')!, 100);
      const endTime = Date.now();

      // Should complete quickly
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Less than 500ms

      // Verify correctness
      expect(descendants).toHaveLength(99);
    });

    it('should perform similarly to getAncestors', () => {
      // Setup: Two graph structures with same size
      const ancestorChain = createLinearChain(500, 500);
      const descendantChain = createDescendantChain(500, 500);

      const ancestorEngine = new RelationshipEngine(ancestorChain.graph);
      const descendantEngine = new RelationshipEngine(descendantChain.graph);

      const fileA_ancestors = ancestorChain.files.get('A')!;
      const fileA_descendants = descendantChain.files.get('A')!;

      // Benchmark getAncestors
      const startAncestors = Date.now();
      const ancestorsResult = ancestorEngine.getAncestors(fileA_ancestors, 500);
      const durationAncestors = Date.now() - startAncestors;

      // Benchmark getDescendants
      const startDescendants = Date.now();
      const descendantsResult = descendantEngine.getDescendants(fileA_descendants, 500);
      const durationDescendants = Date.now() - startDescendants;

      // Verify both methods return results
      expect(ancestorsResult.length).toBeGreaterThan(0);
      expect(descendantsResult.length).toBeGreaterThan(0);

      // Expect: Similar performance characteristics
      // If both durations are 0 (too fast to measure), that's fine
      // Otherwise, allow 2x difference in either direction, with minimum threshold
      if (durationAncestors > 0 && durationDescendants > 0) {
        expect(durationDescendants).toBeLessThan(Math.max(durationAncestors * 2, 100));
        expect(durationAncestors).toBeLessThan(Math.max(durationDescendants * 2, 100));
      }
      // If both complete in <1ms, consider that a pass (both are fast enough)
      expect(durationAncestors + durationDescendants).toBeLessThan(1000); // Total under 1 second
    });
  });
});

/**
 * Helper to create sibling structure with single parent
 * @param parent - Parent node name
 * @param children - Array of child node names
 */
function createSiblingStructure(
  parent: string,
  children: string[]
): { graph: RelationGraph; files: Map<string, TFile> } {
  const edges: [string, string][] = children.map(child => [child, parent]);
  const graph = createMockGraph(edges);

  // Build file map for easy access
  const files = new Map<string, TFile>();
  const graphInternal = (graph as any).graph;

  [parent, ...children].forEach(name => {
    const node = graphInternal.get(name);
    if (node) {
      files.set(name, node.file);
    }
  });

  return { graph, files };
}

/**
 * Helper to create multi-parent sibling structure
 * @param structure - Map of parent to children
 * @example createMultiParentStructure({ P1: ['A', 'B'], P2: ['A', 'C'] })
 */
function createMultiParentStructure(
  structure: Record<string, string[]>
): { graph: RelationGraph; files: Map<string, TFile> } {
  const edges: [string, string][] = [];

  for (const [parent, children] of Object.entries(structure)) {
    for (const child of children) {
      edges.push([child, parent]);
    }
  }

  const graph = createMockGraph(edges);
  const graphInternal = (graph as any).graph;

  // Build file map with all unique nodes
  const files = new Map<string, TFile>();
  const allNodes = new Set<string>();

  for (const [parent, children] of Object.entries(structure)) {
    allNodes.add(parent);
    children.forEach(child => allNodes.add(child));
  }

  allNodes.forEach(name => {
    const node = graphInternal.get(name);
    if (node) {
      files.set(name, node.file);
    }
  });

  return { graph, files };
}

describe('RelationshipEngine - getSiblings', () => {
  describe('Single Parent Scenarios', () => {
    it('should return siblings with single parent: P → A, B, C', () => {
      // Setup: Parent P has children A, B, C
      const { graph, files } = createSiblingStructure('P', ['A', 'B', 'C']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B, C]
      // A's siblings are B and C (excluding self)
      expect(siblings).toHaveLength(2);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C']);
    });

    it('should include self when requested: P → A, B, C', () => {
      // Setup: Parent P has children A, B, C
      const { graph, files } = createSiblingStructure('P', ['A', 'B', 'C']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, true);

      // Expect: [A, B, C]
      // Including self in results
      expect(siblings).toHaveLength(3);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['A', 'B', 'C']);
    });

    it('should return empty array for only child: P → A', () => {
      // Setup: Parent P has only one child A
      const { graph, files } = createSiblingStructure('P', ['A']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: []
      // A has no siblings (only child)
      expect(siblings).toHaveLength(0);
    });

    it('should return self for only child when including self: P → A', () => {
      // Setup: Parent P has only one child A
      const { graph, files } = createSiblingStructure('P', ['A']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, true);

      // Expect: [A]
      // Only child with includeSelf=true returns self
      expect(siblings).toHaveLength(1);
      expect(siblings[0].basename).toBe('A');
    });

    it('should handle many siblings: P → A, B, C, D, E, F', () => {
      // Setup: Parent P has 6 children
      const { graph, files } = createSiblingStructure('P', ['A', 'B', 'C', 'D', 'E', 'F']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B, C, D, E, F]
      // All other children are siblings
      expect(siblings).toHaveLength(5);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C', 'D', 'E', 'F']);
    });
  });

  describe('Multiple Parent Scenarios', () => {
    it('should return union of siblings: P1 → A, B; P2 → A, C', () => {
      // Setup:
      //   P1 has children A, B
      //   P2 has children A, C
      //   A has two parents (P1 and P2)
      const { graph, files } = createMultiParentStructure({
        P1: ['A', 'B'],
        P2: ['A', 'C']
      });
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B, C]
      // B is half-sibling via P1, C is half-sibling via P2
      expect(siblings).toHaveLength(2);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C']);
    });

    it('should deduplicate siblings from multiple parents: P1 → A, B; P2 → A, B', () => {
      // Setup:
      //   P1 has children A, B
      //   P2 has children A, B
      //   A and B are full siblings (share both parents)
      const { graph, files } = createMultiParentStructure({
        P1: ['A', 'B'],
        P2: ['A', 'B']
      });
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B]
      // B appears only once even though reachable via two parents
      expect(siblings).toHaveLength(1);
      expect(siblings[0].basename).toBe('B');
    });

    it('should handle complex multi-parent structure', () => {
      // Setup:
      //   P1 → A, B, C
      //   P2 → A, D, E
      //   P3 → A, F
      //   A has three parents
      const { graph, files } = createMultiParentStructure({
        P1: ['A', 'B', 'C'],
        P2: ['A', 'D', 'E'],
        P3: ['A', 'F']
      });
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B, C, D, E, F]
      // Union of all sibling sets
      expect(siblings).toHaveLength(5);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C', 'D', 'E', 'F']);
    });

    it('should handle overlapping sibling sets', () => {
      // Setup:
      //   P1 → A, B, C
      //   P2 → A, C, D
      //   C appears as sibling via both parents
      const { graph, files } = createMultiParentStructure({
        P1: ['A', 'B', 'C'],
        P2: ['A', 'C', 'D']
      });
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B, C, D]
      // C appears only once despite being in both sets
      expect(siblings).toHaveLength(3);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C', 'D']);
    });
  });

  describe('Root Nodes (No Parents)', () => {
    it('should return empty array for root node', () => {
      // Setup: A has no parents
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const siblings = engine.getSiblings(fileA, false);

      // Expect: []
      // Root nodes have no siblings
      expect(siblings).toHaveLength(0);
    });

    it('should return empty array for root node even with includeSelf', () => {
      // Setup: A has no parents
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const siblings = engine.getSiblings(fileA, true);

      // Expect: []
      // Root nodes have no siblings, includeSelf doesn't apply
      expect(siblings).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle parent with no other children', () => {
      // Setup: P → A (only child)
      const { graph, files } = createSiblingStructure('P', ['A']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: []
      expect(siblings).toHaveLength(0);
    });

    it('should handle cyclical parent-child relationships', () => {
      // Setup: A → B → C → B (cycle in graph)
      // Edges: B has parent A, C has parent B, B has parent C
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'B'],
        ['B', 'C']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileC = (graph as any).graph.get('C')!.file;

      // Test: getSiblings(C)
      const siblings = engine.getSiblings(fileC);

      // Expect: Should handle gracefully
      // C's parent is B. B's children are [C] (C has B as parent).
      // B itself has parents A and C, but that doesn't make B a child of B.
      // So C has no siblings (it's the only child of B).
      expect(siblings).toBeDefined();
      expect(siblings).toHaveLength(0);
    });

    it('should maintain consistent ordering across calls', () => {
      // Setup: P → A, B, C, D
      const { graph, files } = createSiblingStructure('P', ['A', 'B', 'C', 'D']);
      const engine = new RelationshipEngine(graph);

      // Test: getSiblings(A) multiple times
      const siblings1 = engine.getSiblings(files.get('A')!, false);
      const siblings2 = engine.getSiblings(files.get('A')!, false);
      const siblings3 = engine.getSiblings(files.get('A')!, false);

      // Expect: Same order each time (deterministic)
      const order1 = siblings1.map(f => f.basename).join(',');
      const order2 = siblings2.map(f => f.basename).join(',');
      const order3 = siblings3.map(f => f.basename).join(',');

      expect(order1).toBe(order2);
      expect(order2).toBe(order3);
    });
  });

  describe('Self-inclusion Toggle', () => {
    it('should exclude self by default', () => {
      // Setup: P → A, B
      const { graph, files } = createSiblingStructure('P', ['A', 'B']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!);

      // Expect: [B]
      // Default includeSelf=false
      expect(siblings).toHaveLength(1);
      expect(siblings[0].basename).toBe('B');
    });

    it('should include self when explicitly true', () => {
      // Setup: P → A, B
      const { graph, files } = createSiblingStructure('P', ['A', 'B']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, true);

      // Expect: [A, B]
      // Explicit includeSelf=true
      expect(siblings).toHaveLength(2);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['A', 'B']);
    });

    it('should exclude self when explicitly false', () => {
      // Setup: P → A, B
      const { graph, files } = createSiblingStructure('P', ['A', 'B']);
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B]
      // Explicit includeSelf=false
      expect(siblings).toHaveLength(1);
      expect(siblings[0].basename).toBe('B');
    });
  });

  describe('Deduplication', () => {
    it('should not return duplicates', () => {
      // Setup: Complex graph with multiple paths
      const { graph, files } = createMultiParentStructure({
        P1: ['A', 'B', 'C'],
        P2: ['A', 'B', 'D'],
        P3: ['A', 'C', 'D']
      });
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!);

      // Expect: Each sibling appears exactly once
      const paths = siblings.map(f => f.path);
      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);

      // Expect: [B, C, D]
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C', 'D']);
    });

    it('should deduplicate when siblings share multiple parents', () => {
      // Setup:
      //   P1 → A, B, C
      //   P2 → A, B, D
      //   B is sibling via both P1 and P2
      const { graph, files } = createMultiParentStructure({
        P1: ['A', 'B', 'C'],
        P2: ['A', 'B', 'D']
      });
      const engine = new RelationshipEngine(graph);

      const siblings = engine.getSiblings(files.get('A')!, false);

      // Expect: [B, C, D]
      // B appears only once
      expect(siblings).toHaveLength(3);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C', 'D']);
    });
  });

  describe('Integration with Existing Methods', () => {
    it('should work with files that also have ancestors', () => {
      // Setup: GP → P → A, B, C
      const graph = createMockGraph([
        ['P', 'GP'],
        ['A', 'P'],
        ['B', 'P'],
        ['C', 'P']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const siblings = engine.getSiblings(fileA);

      // Expect: [B, C]
      // Sibling computation independent of ancestors
      expect(siblings).toHaveLength(2);
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C']);

      // Verify ancestors still work
      const ancestors = engine.getAncestors(fileA);
      expect(ancestors).toHaveLength(2); // [[P], [GP]]
    });

    it('should work with files that also have descendants', () => {
      // Setup: P → A, B; A → X, Y, Z
      const graph = createMockGraph([
        ['A', 'P'],
        ['B', 'P'],
        ['X', 'A'],
        ['Y', 'A'],
        ['Z', 'A']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const siblings = engine.getSiblings(fileA);

      // Expect: [B]
      // Sibling computation independent of descendants
      expect(siblings).toHaveLength(1);
      expect(siblings[0].basename).toBe('B');

      // Verify descendants still work
      const descendants = engine.getDescendants(fileA);
      expect(descendants).toHaveLength(1); // [[X, Y, Z]]
      expect(descendants[0]).toHaveLength(3);
    });

    it('should work in graph with cycles', () => {
      // Setup: Complex graph with cycles
      const graph = createMockGraph([
        ['A', 'P'],
        ['B', 'P'],
        ['C', 'P'],
        ['P', 'B'] // Cycle: B has parent P, P has parent B
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const siblings = engine.getSiblings(fileA);

      // Expect: Correct siblings without infinite loops
      // Sibling method doesn't traverse, so cycles don't affect it
      expect(siblings).toBeDefined();
      const names = siblings.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C']);
    });
  });

  describe('Symmetry Tests', () => {
    it('should be symmetric: if A is sibling of B, B is sibling of A', () => {
      // Setup: P → A, B, C
      const { graph, files } = createSiblingStructure('P', ['A', 'B', 'C']);
      const engine = new RelationshipEngine(graph);

      const siblingsOfA = engine.getSiblings(files.get('A')!, false);
      const siblingsOfB = engine.getSiblings(files.get('B')!, false);

      // A's siblings should include B
      expect(siblingsOfA.some(f => f.basename === 'B')).toBe(true);

      // B's siblings should include A
      expect(siblingsOfB.some(f => f.basename === 'A')).toBe(true);
    });

    it('should have consistent sibling sets', () => {
      // Setup: P → A, B, C, D
      const { graph, files } = createSiblingStructure('P', ['A', 'B', 'C', 'D']);
      const engine = new RelationshipEngine(graph);

      // Get siblings for each child
      const siblingsOfA = engine.getSiblings(files.get('A')!, false);
      const siblingsOfB = engine.getSiblings(files.get('B')!, false);
      const siblingsOfC = engine.getSiblings(files.get('C')!, false);
      const siblingsOfD = engine.getSiblings(files.get('D')!, false);

      // All should have same count (3 siblings each)
      expect(siblingsOfA).toHaveLength(3);
      expect(siblingsOfB).toHaveLength(3);
      expect(siblingsOfC).toHaveLength(3);
      expect(siblingsOfD).toHaveLength(3);

      // Each sibling set should contain the others
      const namesA = siblingsOfA.map(f => f.basename).sort();
      const namesB = siblingsOfB.map(f => f.basename).sort();
      const namesC = siblingsOfC.map(f => f.basename).sort();
      const namesD = siblingsOfD.map(f => f.basename).sort();

      expect(namesA).toEqual(['B', 'C', 'D']);
      expect(namesB).toEqual(['A', 'C', 'D']);
      expect(namesC).toEqual(['A', 'B', 'D']);
      expect(namesD).toEqual(['A', 'B', 'C']);
    });
  });

  describe('Performance', () => {
    it('should handle single parent with many children', () => {
      // Setup: Parent with 100 children
      const children = Array.from({ length: 100 }, (_, i) => `C${i}`);
      const { graph, files } = createSiblingStructure('P', children);
      const engine = new RelationshipEngine(graph);

      const startTime = Date.now();
      const siblings = engine.getSiblings(files.get('C0')!, false);
      const endTime = Date.now();

      // Should complete quickly
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Less than 100ms

      // Expect: 99 siblings (all except C0 itself)
      expect(siblings).toHaveLength(99);
    });

    it('should handle many parents with many children', () => {
      // Setup: A has 10 parents, each with 10 children
      const structure: Record<string, string[]> = {};
      const allChildren = new Set<string>();
      allChildren.add('A');

      for (let i = 0; i < 10; i++) {
        const parent = `P${i}`;
        const children = ['A'];

        for (let j = 0; j < 9; j++) {
          const child = `C${i}_${j}`;
          children.push(child);
          allChildren.add(child);
        }

        structure[parent] = children;
      }

      const { graph, files } = createMultiParentStructure(structure);
      const engine = new RelationshipEngine(graph);

      const startTime = Date.now();
      const siblings = engine.getSiblings(files.get('A')!, false);
      const endTime = Date.now();

      // Should complete quickly
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Less than 100ms

      // Expect: 90 unique siblings (10 parents × 9 children each)
      expect(siblings).toHaveLength(90);

      // Verify no duplicates
      const paths = siblings.map(f => f.path);
      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);
    });
  });
});

/**
 * Helper to create first cousin structure:
 *      GP
 *     /  \
 *    P1   P2
 *    |    |
 *    A    B
 */
function createFirstCousinStructure(): {
  graph: RelationGraph;
  files: { GP: TFile; P1: TFile; P2: TFile; A: TFile; B: TFile };
} {
  const edges: [string, string][] = [
    ['A', 'P1'],
    ['B', 'P2'],
    ['P1', 'GP'],
    ['P2', 'GP']
  ];

  const graph = createMockGraph(edges);
  const graphInternal = (graph as any).graph;

  return {
    graph,
    files: {
      GP: graphInternal.get('GP')!.file,
      P1: graphInternal.get('P1')!.file,
      P2: graphInternal.get('P2')!.file,
      A: graphInternal.get('A')!.file,
      B: graphInternal.get('B')!.file
    }
  };
}

/**
 * Helper to create second cousin structure:
 *         GGP
 *        /   \
 *      GP1   GP2
 *       |     |
 *      P1    P2
 *       |     |
 *       A     B
 */
function createSecondCousinStructure(): {
  graph: RelationGraph;
  files: { GGP: TFile; GP1: TFile; GP2: TFile; P1: TFile; P2: TFile; A: TFile; B: TFile };
} {
  const edges: [string, string][] = [
    ['A', 'P1'],
    ['P1', 'GP1'],
    ['GP1', 'GGP'],
    ['B', 'P2'],
    ['P2', 'GP2'],
    ['GP2', 'GGP']
  ];

  const graph = createMockGraph(edges);
  const graphInternal = (graph as any).graph;

  return {
    graph,
    files: {
      GGP: graphInternal.get('GGP')!.file,
      GP1: graphInternal.get('GP1')!.file,
      GP2: graphInternal.get('GP2')!.file,
      P1: graphInternal.get('P1')!.file,
      P2: graphInternal.get('P2')!.file,
      A: graphInternal.get('A')!.file,
      B: graphInternal.get('B')!.file
    }
  };
}

/**
 * Helper to create complex family tree with siblings and cousins:
 *       GP
 *      /  \
 *     P1  P2
 *    / \   \
 *   A   B   C
 */
function createFamilyWithSiblingsAndCousins(): {
  graph: RelationGraph;
  files: { GP: TFile; P1: TFile; P2: TFile; A: TFile; B: TFile; C: TFile };
} {
  const edges: [string, string][] = [
    ['A', 'P1'],
    ['B', 'P1'],
    ['C', 'P2'],
    ['P1', 'GP'],
    ['P2', 'GP']
  ];

  const graph = createMockGraph(edges);
  const graphInternal = (graph as any).graph;

  return {
    graph,
    files: {
      GP: graphInternal.get('GP')!.file,
      P1: graphInternal.get('P1')!.file,
      P2: graphInternal.get('P2')!.file,
      A: graphInternal.get('A')!.file,
      B: graphInternal.get('B')!.file,
      C: graphInternal.get('C')!.file
    }
  };
}

describe('RelationshipEngine - getCousins', () => {
  describe('First Cousins (degree 1)', () => {
    it('should return first cousins sharing one grandparent', () => {
      // Setup:
      //      GP
      //     /  \
      //    P1   P2
      //    |    |
      //    A    B
      const { graph, files } = createFirstCousinStructure();
      const engine = new RelationshipEngine(graph);

      const cousins = engine.getCousins(files.A, 1);

      // Expect: [B]
      // A and B are first cousins (share grandparent GP)
      expect(cousins).toHaveLength(1);
      expect(cousins[0].basename).toBe('B');
    });

    it('should be symmetric: if A is cousin of B, B is cousin of A', () => {
      // Setup: First cousin structure
      const { graph, files } = createFirstCousinStructure();
      const engine = new RelationshipEngine(graph);

      const cousinsOfA = engine.getCousins(files.A, 1);
      const cousinsOfB = engine.getCousins(files.B, 1);

      // A's cousins should include B
      expect(cousinsOfA.some(f => f.basename === 'B')).toBe(true);

      // B's cousins should include A
      expect(cousinsOfB.some(f => f.basename === 'A')).toBe(true);
    });

    it('should handle multiple cousins from one grandparent', () => {
      // Setup:
      //         GP
      //      / / \ \
      //     P1 P2 P3 P4
      //     |  |  |  |
      //     A  B  C  D
      const graph = createMockGraph([
        ['A', 'P1'],
        ['B', 'P2'],
        ['C', 'P3'],
        ['D', 'P4'],
        ['P1', 'GP'],
        ['P2', 'GP'],
        ['P3', 'GP'],
        ['P4', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: [B, C, D]
      // All share GP but have different parents
      expect(cousins).toHaveLength(3);
      const names = cousins.map(f => f.basename).sort();
      expect(names).toEqual(['B', 'C', 'D']);
    });

    it('should exclude siblings from cousin results', () => {
      // Setup:
      //        GP
      //       /  \
      //      P1   P2
      //     / \   |
      //    A   B  C
      const { graph, files } = createFamilyWithSiblingsAndCousins();
      const engine = new RelationshipEngine(graph);

      const cousins = engine.getCousins(files.A, 1);

      // Expect: [C]
      // B is excluded (sibling, shares parent P1)
      // C is included (cousin, shares GP but not P1)
      expect(cousins).toHaveLength(1);
      expect(cousins[0].basename).toBe('C');
    });

    it('should exclude self from cousin results', () => {
      // Setup: First cousin structure
      const { graph, files } = createFirstCousinStructure();
      const engine = new RelationshipEngine(graph);

      const cousins = engine.getCousins(files.A, 1);

      // Expect: [B]
      // A is not in results (self-exclusion)
      expect(cousins.some(f => f.basename === 'A')).toBe(false);
    });

    it('should return empty array when no grandparents exist', () => {
      // Setup: A → P (only one generation)
      const graph = createMockGraph([['A', 'P']]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: []
      // Cannot have cousins without grandparents
      expect(cousins).toHaveLength(0);
    });

    it('should return empty array when grandparents have no other grandchildren', () => {
      // Setup:
      //      GP
      //      |
      //      P
      //      |
      //      A
      const graph = createMockGraph([
        ['A', 'P'],
        ['P', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: []
      // A is the only grandchild
      expect(cousins).toHaveLength(0);
    });

    it('should use default degree 1 when degree not specified', () => {
      // Setup: First cousin structure
      const { graph, files } = createFirstCousinStructure();
      const engine = new RelationshipEngine(graph);

      const cousins = engine.getCousins(files.A); // No degree specified

      // Expect: [B] (first cousins by default)
      expect(cousins).toHaveLength(1);
      expect(cousins[0].basename).toBe('B');
    });
  });

  describe('Second Cousins (degree 2)', () => {
    it('should return second cousins sharing great-grandparent', () => {
      // Setup:
      //         GGP
      //        /   \
      //      GP1   GP2
      //       |     |
      //      P1    P2
      //       |     |
      //       A     B
      const { graph, files } = createSecondCousinStructure();
      const engine = new RelationshipEngine(graph);

      const cousins = engine.getCousins(files.A, 2);

      // Expect: [B]
      // A and B are second cousins
      expect(cousins).toHaveLength(1);
      expect(cousins[0].basename).toBe('B');
    });

    it('should not include first cousins in second cousin results', () => {
      // Setup:
      //           GGP
      //          /   \
      //        GP1   GP2
      //       / \     |
      //      P1  P2  P3
      //      |   |   |
      //      A   B   C
      const graph = createMockGraph([
        ['A', 'P1'],
        ['B', 'P2'],
        ['C', 'P3'],
        ['P1', 'GP1'],
        ['P2', 'GP1'],
        ['P3', 'GP2'],
        ['GP1', 'GGP'],
        ['GP2', 'GGP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const secondCousins = engine.getCousins(fileA, 2);
      const firstCousins = engine.getCousins(fileA, 1);

      // Expect first cousins: [B] (shares GP1)
      expect(firstCousins).toHaveLength(1);
      expect(firstCousins[0].basename).toBe('B');

      // Expect second cousins: [C] (shares GGP but not GP1)
      expect(secondCousins).toHaveLength(1);
      expect(secondCousins[0].basename).toBe('C');

      // B should not be in second cousins
      expect(secondCousins.some(f => f.basename === 'B')).toBe(false);
    });

    it('should return empty array when no great-grandparents exist', () => {
      // Setup: A → P → GP (only two generations)
      const graph = createMockGraph([
        ['A', 'P'],
        ['P', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 2);

      // Expect: []
      // Cannot have second cousins without great-grandparents
      expect(cousins).toHaveLength(0);
    });
  });

  describe('Higher Degree Cousins', () => {
    it('should support third cousins (degree 3)', () => {
      // Setup: Deep family tree with great-great-grandparents
      //           GGGP
      //          /    \
      //       GGP1    GGP2
      //        |        |
      //       GP1      GP2
      //        |        |
      //       P1       P2
      //        |        |
      //        A        B
      const graph = createMockGraph([
        ['A', 'P1'],
        ['P1', 'GP1'],
        ['GP1', 'GGP1'],
        ['GGP1', 'GGGP'],
        ['B', 'P2'],
        ['P2', 'GP2'],
        ['GP2', 'GGP2'],
        ['GGP2', 'GGGP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 3);

      // Expect: [B] (third cousins via GGGP)
      expect(cousins).toHaveLength(1);
      expect(cousins[0].basename).toBe('B');
    });

    it('should return empty array for degree larger than tree depth', () => {
      // Setup: A → P → GP (only 2 generations)
      const graph = createMockGraph([
        ['A', 'P'],
        ['P', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 5);

      // Expect: []
      // No 5th cousins possible with only 2 ancestor generations
      expect(cousins).toHaveLength(0);
    });
  });

  describe('Complex Family Structures', () => {
    it('should handle diamond structures in ancestry', () => {
      // Setup:
      //        GGP
      //       /   \
      //     GP1   GP2
      //       \   /
      //         P
      //         |
      //         A
      // Also add cousin path
      const graph = createMockGraph([
        ['A', 'P'],
        ['P', 'GP1'],
        ['P', 'GP2'],
        ['GP1', 'GGP'],
        ['GP2', 'GGP'],
        ['B', 'P2'],
        ['P2', 'GP3'],
        ['GP3', 'GGP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 2);

      // Verify correct handling of converging lineages
      expect(cousins).toBeDefined();
      // B should be second cousin via GGP
      expect(cousins.some(f => f.basename === 'B')).toBe(true);
    });

    it('should not have duplicates when cousin reachable via multiple ancestors', () => {
      // Setup: Complex graph where cousin appears in multiple paths
      const graph = createMockGraph([
        ['A', 'P1'],
        ['A', 'P2'], // A has two parents
        ['P1', 'GP1'],
        ['P2', 'GP2'],
        ['GP1', 'GGP'],
        ['GP2', 'GGP'],
        ['B', 'P3'],
        ['P3', 'GP3'],
        ['GP3', 'GGP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 2);

      // Each cousin should appear only once
      const paths = cousins.map(f => f.path);
      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);
    });

    it('should handle nodes with multiple parents at each level', () => {
      // Setup:
      //      GP1    GP2
      //       |      |
      //      P1     P2
      //       \    /
      //         A      (A has two parents)
      // Also:
      //      GP1    GP3
      //       |      |
      //      P3     P4
      //       \    /
      //         B      (B has two parents, shares GP1 with A)
      const graph = createMockGraph([
        ['A', 'P1'],
        ['A', 'P2'],
        ['P1', 'GP1'],
        ['P2', 'GP2'],
        ['B', 'P3'],
        ['B', 'P4'],
        ['P3', 'GP1'], // Shares GP1 with A's lineage
        ['P4', 'GP3']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Cousins from both lineages
      expect(cousins).toBeDefined();
      // B should be a cousin via shared GP1
      expect(cousins.some(f => f.basename === 'B')).toBe(true);
    });
  });

  describe('Cycle Protection', () => {
    it('should handle cycles in ancestry without infinite loop', () => {
      // Setup: A → P → GP → P (cycle back to parent)
      const graph = createMockGraph([
        ['A', 'P'],
        ['P', 'GP'],
        ['GP', 'P'], // Cycle
        ['B', 'P2'],
        ['P2', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: Completes without hanging
      expect(cousins).toBeDefined();
      // B should be cousin via shared GP
      expect(cousins.some(f => f.basename === 'B')).toBe(true);
    });

    it('should handle cycles in descendant paths', () => {
      // Setup: Cycle exists in descendant traversal from grandparent
      const graph = createMockGraph([
        ['A', 'P1'],
        ['P1', 'GP'],
        ['B', 'P2'],
        ['P2', 'GP'],
        ['C', 'B'], // C is child of B
        ['B', 'C']  // Cycle: B is also child of C
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: Cycle handled gracefully
      expect(cousins).toBeDefined();
      // B should still be identified as cousin
      expect(cousins.some(f => f.basename === 'B')).toBe(true);
      // C should not be cousin (different generation)
      expect(cousins.every(f => f.basename !== 'C')).toBe(true);
    });

    it('should handle self-loops in family tree', () => {
      // Setup: Node that references itself
      const graph = createMockGraph([
        ['A', 'P1'],
        ['P1', 'GP'],
        ['GP', 'GP'], // Self-loop
        ['B', 'P2'],
        ['P2', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: No errors, sensible results
      expect(cousins).toBeDefined();
      expect(cousins.some(f => f.basename === 'B')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array for degree = 0', () => {
      // Test: getCousins(A, 0)
      const { graph, files } = createFirstCousinStructure();
      const engine = new RelationshipEngine(graph);

      const cousins = engine.getCousins(files.A, 0);

      // Expect: [] (degree must be >= 1)
      expect(cousins).toHaveLength(0);
    });

    it('should return empty array for negative degree', () => {
      // Test: getCousins(A, -1)
      const { graph, files } = createFirstCousinStructure();
      const engine = new RelationshipEngine(graph);

      const cousins = engine.getCousins(files.A, -1);

      // Expect: [] (invalid degree)
      expect(cousins).toHaveLength(0);
    });

    it('should handle very large degree (100)', () => {
      // Setup: Tree with depth 3
      const graph = createMockGraph([
        ['A', 'P'],
        ['P', 'GP'],
        ['GP', 'GGP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 100);

      // Expect: [] (no ancestors at generation 101)
      expect(cousins).toHaveLength(0);
    });

    it('should handle empty graph', () => {
      // Setup: Empty graph
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const cousins = engine.getCousins(fileA, 1);

      // Expect: [] or graceful handling
      expect(cousins).toHaveLength(0);
    });

    it('should handle isolated node (no relations)', () => {
      // Setup: Node A with no parents or children
      const graph = createMockGraph([]);
      const engine = new RelationshipEngine(graph);
      const fileA = createMockFile('A', 'A');

      const cousins = engine.getCousins(fileA, 1);

      // Expect: []
      expect(cousins).toHaveLength(0);
    });

    it('should handle root node (no parents)', () => {
      // Setup: Node A with children but no parents
      const graph = createMockGraph([
        ['B', 'A'],
        ['C', 'A']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: []
      expect(cousins).toHaveLength(0);
    });
  });

  describe('Sibling Exclusion', () => {
    it('should exclude full siblings (share all parents)', () => {
      // Setup: A and B both have parents P1 and P2
      const graph = createMockGraph([
        ['A', 'P1'],
        ['A', 'P2'],
        ['B', 'P1'],
        ['B', 'P2'],
        ['C', 'P3'],
        ['P1', 'GP'],
        ['P2', 'GP'],
        ['P3', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: B not in results (full sibling, not cousin)
      // C should be in results (cousin)
      expect(cousins.some(f => f.basename === 'B')).toBe(false);
      expect(cousins.some(f => f.basename === 'C')).toBe(true);
    });

    it('should exclude half-siblings (share some parents)', () => {
      // Setup: A has parents P1 and P2, B has parent P1
      const graph = createMockGraph([
        ['A', 'P1'],
        ['A', 'P2'],
        ['B', 'P1'],
        ['C', 'P3'],
        ['P1', 'GP'],
        ['P2', 'GP'],
        ['P3', 'GP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 1);

      // Expect: B not in results (half-sibling via P1)
      // C should be in results (cousin)
      expect(cousins.some(f => f.basename === 'B')).toBe(false);
      expect(cousins.some(f => f.basename === 'C')).toBe(true);
    });
  });

  describe('Consistency & Deduplication', () => {
    it('should not include duplicates in result', () => {
      // Setup: Complex graph with multiple paths to same cousin
      const graph = createMockGraph([
        ['A', 'P1'],
        ['A', 'P2'], // A has two parents
        ['P1', 'GP1'],
        ['P2', 'GP2'],
        ['GP1', 'GGP'],
        ['GP2', 'GGP'],
        ['B', 'P3'],
        ['P3', 'GP3'],
        ['P3', 'GP4'], // P3 has two parents
        ['GP3', 'GGP'],
        ['GP4', 'GGP']
      ]);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const cousins = engine.getCousins(fileA, 2);

      // Each cousin should appear exactly once
      const paths = cousins.map(f => f.path);
      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);
    });

    it('should return consistent results across multiple calls', () => {
      // Test: getCousins(A, 1) called multiple times
      const { graph, files } = createFamilyWithSiblingsAndCousins();
      const engine = new RelationshipEngine(graph);

      const cousins1 = engine.getCousins(files.A, 1);
      const cousins2 = engine.getCousins(files.A, 1);
      const cousins3 = engine.getCousins(files.A, 1);

      // Same results each time (deterministic)
      const order1 = cousins1.map(f => f.basename).join(',');
      const order2 = cousins2.map(f => f.basename).join(',');
      const order3 = cousins3.map(f => f.basename).join(',');

      expect(order1).toBe(order2);
      expect(order2).toBe(order3);
    });
  });

  describe('Performance', () => {
    it('should compute cousins for complex graph in reasonable time', () => {
      // Setup: Graph with many nodes, multiple generations
      const edges: [string, string][] = [];

      // Create 10 grandparents
      for (let i = 0; i < 10; i++) {
        edges.push([`GP${i}`, 'GGP']);
      }

      // Each grandparent has 5 parents
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          edges.push([`P${i}_${j}`, `GP${i}`]);
        }
      }

      // Each parent has 3 children
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          for (let k = 0; k < 3; k++) {
            edges.push([`C${i}_${j}_${k}`, `P${i}_${j}`]);
          }
        }
      }

      const graph = createMockGraph(edges, 3);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('C0_0_0')!.file;

      const startTime = Date.now();
      const cousins = engine.getCousins(fileA, 1);
      const endTime = Date.now();

      // Measure: Execution time
      const duration = endTime - startTime;

      // Expect: <100ms
      expect(duration).toBeLessThan(100);

      // Verify some cousins were found
      expect(cousins.length).toBeGreaterThan(0);
    });

    it('should handle large sibling sets efficiently', () => {
      // Setup: Node with many siblings
      const edges: [string, string][] = [];

      // P1 has 50 children including A
      edges.push(['A', 'P1']);
      for (let i = 0; i < 49; i++) {
        edges.push([`S${i}`, 'P1']);
      }

      // P2 has 50 children (potential cousins)
      for (let i = 0; i < 50; i++) {
        edges.push([`C${i}`, 'P2']);
      }

      // Both parents share GP
      edges.push(['P1', 'GP']);
      edges.push(['P2', 'GP']);

      const graph = createMockGraph(edges, 2);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const startTime = Date.now();
      const cousins = engine.getCousins(fileA, 1);
      const endTime = Date.now();

      // Should complete quickly
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);

      // All 49 siblings should be excluded
      // All 50 from P2 should be cousins
      expect(cousins).toHaveLength(50);
    });

    it('should handle wide family tree (many branches)', () => {
      // Setup: Grandparent with 20 children, each with 10 children
      const edges: [string, string][] = [];

      edges.push(['A', 'P0']); // A is child of P0

      for (let i = 0; i < 20; i++) {
        edges.push([`P${i}`, 'GP']);

        for (let j = 0; j < 10; j++) {
          // Don't create A again
          if (i === 0 && j === 0) continue;
          edges.push([`C${i}_${j}`, `P${i}`]);
        }
      }

      const graph = createMockGraph(edges, 2);
      const engine = new RelationshipEngine(graph);
      const fileA = (graph as any).graph.get('A')!.file;

      const startTime = Date.now();
      const cousins = engine.getCousins(fileA, 1);
      const endTime = Date.now();

      // Should complete efficiently
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200);

      // Should find cousins from other branches
      expect(cousins.length).toBeGreaterThan(0);
    });
  });
});
