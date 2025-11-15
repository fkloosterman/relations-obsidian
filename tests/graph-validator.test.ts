import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TFile, App, CachedMetadata } from 'obsidian';
import { RelationGraph } from '../src/relation-graph';
import { GraphValidator, DiagnosticSeverity, DiagnosticType } from '../src/graph-validator';
import { CycleDetector } from '../src/cycle-detector';

// Mock TFile creation helper
function createMockFile(path: string, basename: string): TFile {
  return {
    path,
    basename,
    name: basename + '.md',
    extension: 'md',
    stat: { ctime: 0, mtime: 0, size: 0 },
    vault: {} as any,
    parent: null
  } as TFile;
}

// Mock App with metadata cache
function createMockApp(fileMetadata: Map<string, any>, files: TFile[]): App {
  return {
    vault: {
      getMarkdownFiles: () => files
    },
    metadataCache: {
      getFileCache: (file: TFile) => fileMetadata.get(file.path) || null,
      getFirstLinkpathDest: (linktext: string, sourcePath: string) => {
        // Simple mock resolver - finds file by basename or path
        const cleaned = linktext.replace(/[\[\]]/g, '');
        return files.find(f => f.basename === cleaned || f.path === cleaned) || null;
      }
    }
  } as any;
}

describe('GraphValidator', () => {
  describe('validateGraph()', () => {
    it('should return healthy status for valid graph', () => {
      // Create simple valid graph: A -> B -> C
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'C' } }],
        ['C.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.isHealthy).toBe(true);
      expect(diagnostics.summary.errors).toBe(0);
      expect(diagnostics.totalNodes).toBe(3);
    });

    it('should include graph statistics', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.totalNodes).toBe(2);
      expect(diagnostics.totalEdges).toBe(1);

      const statsIssue = diagnostics.issues.find(i => i.type === DiagnosticType.GRAPH_STATS);
      expect(statsIssue).toBeDefined();
      expect(statsIssue?.severity).toBe(DiagnosticSeverity.INFO);
      expect(statsIssue?.context?.nodes).toBe(2);
      expect(statsIssue?.context?.edges).toBe(1);
    });

    it('should detect multiple issue types in single validation', () => {
      // Create graph with cycle + orphaned node
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C'); // orphaned

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'A' } }], // cycle
        ['C.md', { frontmatter: {} }] // orphaned
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.isHealthy).toBe(false);
      expect(diagnostics.summary.errors).toBeGreaterThan(0);
      expect(diagnostics.summary.warnings).toBeGreaterThan(0);

      const hasCycle = diagnostics.issues.some(i => i.type === DiagnosticType.CYCLE);
      const hasOrphaned = diagnostics.issues.some(i => i.type === DiagnosticType.ORPHANED_NODE);

      expect(hasCycle).toBe(true);
      expect(hasOrphaned).toBe(true);
    });
  });

  describe('getAllCycles()', () => {
    it('should find all cycles in graph', () => {
      // Create graph with 2 separate cycles: A→B→A and C→D→C
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C');
      const fileD = createMockFile('D.md', 'D');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'A' } }],
        ['C.md', { frontmatter: { parent: 'D' } }],
        ['D.md', { frontmatter: { parent: 'C' } }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC, fileD]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const cycles = graph.getAllCycles();

      expect(cycles.length).toBe(2);
    });

    it('should return empty array for acyclic graph', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'C' } }],
        ['C.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const cycles = graph.getAllCycles();

      expect(cycles.length).toBe(0);
    });

    it('should handle self-loop', () => {
      const fileA = createMockFile('A.md', 'A');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'A' } }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const cycles = graph.getAllCycles();

      expect(cycles.length).toBe(1);
      expect(cycles[0].length).toBe(1);
    });
  });

  describe('Orphaned Nodes Detection', () => {
    it('should detect nodes with no parents and no children', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C'); // orphaned

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: {} }],
        ['C.md', { frontmatter: {} }] // orphaned
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      const orphanedIssues = diagnostics.issues.filter(
        i => i.type === DiagnosticType.ORPHANED_NODE
      );

      expect(orphanedIssues.length).toBe(1);
      expect(orphanedIssues[0].severity).toBe(DiagnosticSeverity.WARNING);
      expect(orphanedIssues[0].files[0].basename).toBe('C');
    });

    it('should not report nodes with only parents', () => {
      // Leaf node (has parents, no children)
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      const orphanedIssues = diagnostics.issues.filter(
        i => i.type === DiagnosticType.ORPHANED_NODE
      );

      expect(orphanedIssues.length).toBe(0);
    });

    it('should not report nodes with only children', () => {
      // Root node (no parents, has children)
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      const orphanedIssues = diagnostics.issues.filter(
        i => i.type === DiagnosticType.ORPHANED_NODE
      );

      expect(orphanedIssues.length).toBe(0);
    });

    it('should find multiple orphaned nodes', () => {
      const fileA = createMockFile('A.md', 'A'); // orphaned
      const fileB = createMockFile('B.md', 'B'); // orphaned
      const fileC = createMockFile('C.md', 'C'); // orphaned

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: {} }],
        ['B.md', { frontmatter: {} }],
        ['C.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      const orphanedIssues = diagnostics.issues.filter(
        i => i.type === DiagnosticType.ORPHANED_NODE
      );

      expect(orphanedIssues.length).toBe(3);
    });
  });

  describe('Graph Statistics', () => {
    it('should calculate correct node count', () => {
      const files = Array.from({ length: 10 }, (_, i) =>
        createMockFile(`file${i}.md`, `file${i}`)
      );

      const fileMetadata = new Map<string, any>(
        files.map(f => [f.path, { frontmatter: {} }])
      );

      const mockApp = createMockApp(fileMetadata, files);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.totalNodes).toBe(10);
    });

    it('should calculate correct edge count', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'C' } }],
        ['C.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.totalEdges).toBe(2); // A->B and B->C
    });

    it('should identify root nodes (no parents)', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'C' } }],
        ['B.md', { frontmatter: { parent: 'C' } }],
        ['C.md', { frontmatter: {} }] // root
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();
      const statsIssue = diagnostics.issues.find(i => i.type === DiagnosticType.GRAPH_STATS);

      expect(statsIssue?.context?.roots).toBe(1);
    });

    it('should identify leaf nodes (no children)', () => {
      const fileA = createMockFile('A.md', 'A'); // leaf
      const fileB = createMockFile('B.md', 'B'); // leaf
      const fileC = createMockFile('C.md', 'C');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'C' } }],
        ['B.md', { frontmatter: { parent: 'C' } }],
        ['C.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();
      const statsIssue = diagnostics.issues.find(i => i.type === DiagnosticType.GRAPH_STATS);

      expect(statsIssue?.context?.leaves).toBe(2);
    });
  });

  describe('DiagnosticInfo Structure', () => {
    it('should include timestamp', () => {
      const fileA = createMockFile('A.md', 'A');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const before = Date.now();
      const diagnostics = graph.getDiagnostics();
      const after = Date.now();

      expect(diagnostics.timestamp).toBeGreaterThanOrEqual(before);
      expect(diagnostics.timestamp).toBeLessThanOrEqual(after);
    });

    it('should categorize issues by severity', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'A' } }], // cycle (error)
        ['C.md', { frontmatter: {} }] // orphaned (warning)
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB, fileC]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.summary.errors).toBeGreaterThan(0);
      expect(diagnostics.summary.warnings).toBeGreaterThan(0);
      expect(diagnostics.summary.info).toBeGreaterThan(0);

      const errorCount = diagnostics.issues.filter(
        i => i.severity === DiagnosticSeverity.ERROR
      ).length;
      const warningCount = diagnostics.issues.filter(
        i => i.severity === DiagnosticSeverity.WARNING
      ).length;

      expect(errorCount).toBe(diagnostics.summary.errors);
      expect(warningCount).toBe(diagnostics.summary.warnings);
    });

    it('should set isHealthy based on errors', () => {
      // Graph with only warnings
      const fileA = createMockFile('A.md', 'A'); // orphaned (warning)

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      // Orphaned nodes are warnings, not errors, so graph should still be healthy
      expect(diagnostics.isHealthy).toBe(true);

      // Now test with errors (cycle)
      const fileB = createMockFile('B.md', 'B');
      const fileC = createMockFile('C.md', 'C');

      const fileMetadata2 = new Map<string, any>([
        ['B.md', { frontmatter: { parent: 'C' } }],
        ['C.md', { frontmatter: { parent: 'B' } }] // cycle (error)
      ]);

      const mockApp2 = createMockApp(fileMetadata2, [fileB, fileC]);

      const graph2 = new RelationGraph(mockApp2, 'parent');
      graph2.build();

      const diagnostics2 = graph2.getDiagnostics();

      expect(diagnostics2.isHealthy).toBe(false);
    });

    it('should include file references in issues', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'A' } }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();
      const cycleIssue = diagnostics.issues.find(i => i.type === DiagnosticType.CYCLE);

      expect(cycleIssue).toBeDefined();
      expect(cycleIssue?.files.length).toBeGreaterThan(0);
      expect(cycleIssue?.files.every(f => f instanceof Object)).toBe(true);
    });

    it('should include context in issues', () => {
      const fileA = createMockFile('A.md', 'A');
      const fileB = createMockFile('B.md', 'B');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: { parent: 'B' } }],
        ['B.md', { frontmatter: { parent: 'A' } }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA, fileB]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();
      const cycleIssue = diagnostics.issues.find(i => i.type === DiagnosticType.CYCLE);

      expect(cycleIssue?.context).toBeDefined();
      expect(cycleIssue?.context?.length).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const fileMetadata = new Map<string, any>();
      const mockApp = createMockApp(fileMetadata, []);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.isHealthy).toBe(true);
      expect(diagnostics.totalNodes).toBe(0);
      expect(diagnostics.totalEdges).toBe(0);
    });

    it('should handle single node', () => {
      const fileA = createMockFile('A.md', 'A');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics = graph.getDiagnostics();

      expect(diagnostics.totalNodes).toBe(1);

      // Single isolated node should be flagged as orphaned
      const orphanedIssues = diagnostics.issues.filter(
        i => i.type === DiagnosticType.ORPHANED_NODE
      );
      expect(orphanedIssues.length).toBe(1);
    });
  });

  describe('getDiagnostics()', () => {
    it('should be an alias for validateGraph', () => {
      const fileA = createMockFile('A.md', 'A');

      const fileMetadata = new Map<string, any>([
        ['A.md', { frontmatter: {} }]
      ]);

      const mockApp = createMockApp(fileMetadata, [fileA]);

      const graph = new RelationGraph(mockApp, 'parent');
      graph.build();

      const diagnostics1 = graph.validateGraph();
      const diagnostics2 = graph.getDiagnostics();

      // Both should have same structure
      expect(diagnostics1.totalNodes).toBe(diagnostics2.totalNodes);
      expect(diagnostics1.totalEdges).toBe(diagnostics2.totalEdges);
      expect(diagnostics1.isHealthy).toBe(diagnostics2.isHealthy);
    });
  });
});
