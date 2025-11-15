import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationGraph } from '../src/relation-graph';
import { TFile, App, CachedMetadata } from 'obsidian';

// Mock TFile factory
function createMockFile(basename: string): TFile {
  const path = basename.toLowerCase() + '.md';
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

// Mock App with metadata cache
function createMockApp(): App {
  const files = new Map<string, TFile>();
  const metadata = new Map<string, CachedMetadata>();

  const mockApp = {
    vault: {
      getMarkdownFiles: () => Array.from(files.values()),
    },
    metadataCache: {
      getFileCache: (file: TFile) => metadata.get(file.path) || null,
      getFirstLinkpathDest: (linktext: string, sourcePath: string) => {
        // Simple link resolution - strip brackets, lowercase, and add .md
        const cleaned = linktext.replace(/\[\[|\]\]/g, '');
        const targetPath = cleaned.toLowerCase().endsWith('.md')
          ? cleaned.toLowerCase()
          : `${cleaned.toLowerCase()}.md`;
        return files.get(targetPath) || null;
      },
    },
    __files: files,
    __metadata: metadata,
  } as any;

  return mockApp;
}

// Helper to set file metadata
function setMetadata(app: App, file: TFile, frontmatter: any) {
  const cache: CachedMetadata = {
    frontmatter: frontmatter || {},
  };
  (app as any).__metadata.set(file.path, cache);
}

// Helper to add file to vault
function addFileToVault(app: App, file: TFile) {
  (app as any).__files.set(file.path, file);
}

describe('Incremental Graph Updates', () => {
  let app: App;
  let graph: RelationGraph;

  beforeEach(() => {
    app = createMockApp();
    graph = new RelationGraph(app, 'parent');
  });

  describe('updateNode()', () => {
    it('should add new file to graph', () => {
      // Setup: Create files
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);

      // Build initial graph with just A
      setMetadata(app, fileA, {});
      graph.build();

      // Add B with A as parent
      setMetadata(app, fileB, { parent: '[[A]]' });
      graph.updateNode(fileB);

      // Verify B is in graph
      expect(graph.getParents(fileB)).toHaveLength(1);
      expect(graph.getParents(fileB)[0].path).toBe('a.md');

      // Verify B is in A's children
      expect(graph.getChildren(fileA)).toHaveLength(1);
      expect(graph.getChildren(fileA)[0].path).toBe('b.md');
    });

    it('should update existing file with new parents', () => {
      // Setup: A -> B, then change to A -> C
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);

      setMetadata(app, fileA, { parent: '[[B]]' });
      setMetadata(app, fileB, {});
      setMetadata(app, fileC, {});
      graph.build();

      // Verify initial state
      expect(graph.getParents(fileA)[0].path).toBe('b.md');
      expect(graph.getChildren(fileB)).toHaveLength(1);
      expect(graph.getChildren(fileC)).toHaveLength(0);

      // Change A's parent to C
      setMetadata(app, fileA, { parent: '[[C]]' });
      graph.updateNode(fileA);

      // Verify A's parent changed
      expect(graph.getParents(fileA)[0].path).toBe('c.md');

      // Verify A removed from B's children
      expect(graph.getChildren(fileB)).toHaveLength(0);

      // Verify A added to C's children
      expect(graph.getChildren(fileC)).toHaveLength(1);
      expect(graph.getChildren(fileC)[0].path).toBe('a.md');
    });

    it('should handle adding multiple parents', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);

      setMetadata(app, fileA, { parent: '[[B]]' });
      setMetadata(app, fileB, {});
      setMetadata(app, fileC, {});
      graph.build();

      // Add second parent
      setMetadata(app, fileA, { parent: ['[[B]]', '[[C]]'] });
      graph.updateNode(fileA);

      // Verify A has both parents
      expect(graph.getParents(fileA)).toHaveLength(2);
      expect(graph.getParents(fileA).map(p => p.path).sort()).toEqual(['b.md', 'c.md']);

      // Verify A is in both parents' children
      expect(graph.getChildren(fileB)).toHaveLength(1);
      expect(graph.getChildren(fileC)).toHaveLength(1);
    });

    it('should handle removing all parents', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);

      setMetadata(app, fileA, { parent: '[[B]]' });
      setMetadata(app, fileB, {});
      graph.build();

      // Remove parent
      setMetadata(app, fileA, {});
      graph.updateNode(fileA);

      // Verify A has no parents
      expect(graph.getParents(fileA)).toHaveLength(0);

      // Verify A removed from B's children
      expect(graph.getChildren(fileB)).toHaveLength(0);
    });

    it('should preserve children when updating parents', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');
      const fileX = createMockFile('X');
      const fileY = createMockFile('Y');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);
      addFileToVault(app, fileX);
      addFileToVault(app, fileY);

      setMetadata(app, fileA, { parent: '[[B]]' });
      setMetadata(app, fileB, {});
      setMetadata(app, fileC, {});
      setMetadata(app, fileX, { parent: '[[A]]' });
      setMetadata(app, fileY, { parent: '[[A]]' });
      graph.build();

      // Verify initial children
      expect(graph.getChildren(fileA)).toHaveLength(2);

      // Change A's parent
      setMetadata(app, fileA, { parent: '[[C]]' });
      graph.updateNode(fileA);

      // Verify children still intact
      expect(graph.getChildren(fileA)).toHaveLength(2);
      expect(graph.getChildren(fileA).map(c => c.path).sort()).toEqual(['x.md', 'y.md']);
    });
  });

  describe('removeNode()', () => {
    it('should remove file from graph', () => {
      const fileA = createMockFile('A');

      addFileToVault(app, fileA);
      setMetadata(app, fileA, {});
      graph.build();

      // Verify file exists
      expect(graph.getAllFiles()).toHaveLength(1);

      // Remove file
      graph.removeNode(fileA);

      // Verify file removed
      expect(graph.getAllFiles()).toHaveLength(0);
    });

    it('should remove from parents children lists', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);

      setMetadata(app, fileA, { parent: ['[[B]]', '[[C]]'] });
      setMetadata(app, fileB, {});
      setMetadata(app, fileC, {});
      graph.build();

      // Verify initial state
      expect(graph.getChildren(fileB)).toHaveLength(1);
      expect(graph.getChildren(fileC)).toHaveLength(1);

      // Remove A
      graph.removeNode(fileA);

      // Verify A removed from parents' children
      expect(graph.getChildren(fileB)).toHaveLength(0);
      expect(graph.getChildren(fileC)).toHaveLength(0);
    });

    it('should remove from children parents lists', () => {
      const fileA = createMockFile('A');
      const fileX = createMockFile('X');
      const fileY = createMockFile('Y');

      addFileToVault(app, fileA);
      addFileToVault(app, fileX);
      addFileToVault(app, fileY);

      setMetadata(app, fileA, {});
      setMetadata(app, fileX, { parent: '[[A]]' });
      setMetadata(app, fileY, { parent: '[[A]]' });
      graph.build();

      // Verify initial state
      expect(graph.getParents(fileX)).toHaveLength(1);
      expect(graph.getParents(fileY)).toHaveLength(1);

      // Remove A
      graph.removeNode(fileA);

      // Verify A removed from children's parents
      expect(graph.getParents(fileX)).toHaveLength(0);
      expect(graph.getParents(fileY)).toHaveLength(0);
    });

    it('should handle removing file with no relations', () => {
      const fileA = createMockFile('A');

      addFileToVault(app, fileA);
      setMetadata(app, fileA, {});
      graph.build();

      // Should not throw
      expect(() => graph.removeNode(fileA)).not.toThrow();

      // Verify removed
      expect(graph.getAllFiles()).toHaveLength(0);
    });

    it('should handle removing non-existent file', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');

      addFileToVault(app, fileA);
      setMetadata(app, fileA, {});
      graph.build();

      // Try to remove file that doesn't exist
      expect(() => graph.removeNode(fileB)).not.toThrow();

      // Verify A still exists
      expect(graph.getAllFiles()).toHaveLength(1);
    });
  });

  describe('renameNode()', () => {
    it('should update file path in graph', () => {
      const fileOld = createMockFile('Old');

      addFileToVault(app, fileOld);
      setMetadata(app, fileOld, {});
      graph.build();

      // Verify file exists initially
      expect(graph.getAllFiles()).toHaveLength(1);

      // Rename file
      const fileNew = createMockFile('New');
      graph.renameNode(fileNew, 'old.md');

      // Verify old path removed, new path exists
      expect(graph.getAllFiles()).toHaveLength(1);
      expect(graph.getAllFiles()[0].path).toBe('new.md');
    });

    it('should update references in children', () => {
      const fileA = createMockFile('A');
      const fileX = createMockFile('X');
      const fileY = createMockFile('Y');

      addFileToVault(app, fileA);
      addFileToVault(app, fileX);
      addFileToVault(app, fileY);

      setMetadata(app, fileA, {});
      setMetadata(app, fileX, { parent: '[[A]]' });
      setMetadata(app, fileY, { parent: '[[A]]' });
      graph.build();

      // Rename A
      const fileARenamed = createMockFile('A-Renamed');
      graph.renameNode(fileARenamed, 'a.md');

      // Verify X and Y have updated parent reference
      expect(graph.getParents(fileX)[0].path).toBe('a-renamed.md');
      expect(graph.getParents(fileY)[0].path).toBe('a-renamed.md');
    });

    it('should update references in parents', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);

      setMetadata(app, fileA, { parent: ['[[B]]', '[[C]]'] });
      setMetadata(app, fileB, {});
      setMetadata(app, fileC, {});
      graph.build();

      // Rename A
      const fileARenamed = createMockFile('A-Renamed');
      graph.renameNode(fileARenamed, 'a.md');

      // Verify B and C have updated child reference
      expect(graph.getChildren(fileB)[0].path).toBe('a-renamed.md');
      expect(graph.getChildren(fileC)[0].path).toBe('a-renamed.md');
    });

    it('should preserve all relationships after rename', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');
      const fileX = createMockFile('X');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);
      addFileToVault(app, fileX);

      setMetadata(app, fileA, { parent: ['[[B]]', '[[C]]'] });
      setMetadata(app, fileB, {});
      setMetadata(app, fileC, {});
      setMetadata(app, fileX, { parent: '[[A]]' });
      graph.build();

      // Verify initial state
      expect(graph.getParents(fileA)).toHaveLength(2);
      expect(graph.getChildren(fileA)).toHaveLength(1);

      // Rename A
      const fileARenamed = createMockFile('A-Renamed');
      graph.renameNode(fileARenamed, 'a.md');

      // Verify all relationships intact
      expect(graph.getParents(fileARenamed)).toHaveLength(2);
      expect(graph.getChildren(fileARenamed)).toHaveLength(1);
      expect(graph.getParents(fileX)[0].path).toBe('a-renamed.md');
      expect(graph.getChildren(fileB)[0].path).toBe('a-renamed.md');
      expect(graph.getChildren(fileC)[0].path).toBe('a-renamed.md');
    });

    it('should handle renaming non-existent file', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');

      addFileToVault(app, fileA);
      setMetadata(app, fileA, {});
      graph.build();

      // Try to rename file that doesn't exist
      expect(() => graph.renameNode(fileB, 'nonexistent.md')).not.toThrow();

      // Verify A unchanged
      expect(graph.getAllFiles()).toHaveLength(1);
      expect(graph.getAllFiles()[0].path).toBe('a.md');
    });
  });

  describe('Graph Consistency', () => {
    it('should maintain bidirectional consistency after updates', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);

      setMetadata(app, fileA, {});
      setMetadata(app, fileB, { parent: '[[A]]' });
      setMetadata(app, fileC, {});
      graph.build();

      // Series of updates
      setMetadata(app, fileB, { parent: '[[C]]' });
      graph.updateNode(fileB);

      setMetadata(app, fileC, { parent: '[[A]]' });
      graph.updateNode(fileC);

      // Verify bidirectional consistency
      // If A is parent of C, C should be child of A
      const childrenOfA = graph.getChildren(fileA);
      const parentsOfC = graph.getParents(fileC);
      expect(parentsOfC.some(p => p.path === 'a.md')).toBe(true);
      expect(childrenOfA.some(c => c.path === 'c.md')).toBe(true);

      // If C is parent of B, B should be child of C
      const childrenOfC = graph.getChildren(fileC);
      const parentsOfB = graph.getParents(fileB);
      expect(parentsOfB.some(p => p.path === 'c.md')).toBe(true);
      expect(childrenOfC.some(c => c.path === 'b.md')).toBe(true);
    });

    it('should maintain cycle detector consistency', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);

      setMetadata(app, fileA, { parent: '[[B]]' });
      setMetadata(app, fileB, {});
      graph.build();

      // No cycle initially
      expect(graph.detectCycle(fileA)).toBeNull();

      // Create cycle by updating B
      setMetadata(app, fileB, { parent: '[[A]]' });
      graph.updateNode(fileB);

      // Cycle should be detected
      const cycle = graph.detectCycle(fileA);
      expect(cycle).not.toBeNull();
      expect(cycle?.length).toBe(2);
    });

    it('should handle rapid consecutive updates', () => {
      const fileA = createMockFile('A');
      const fileB = createMockFile('B');
      const fileC = createMockFile('C');

      addFileToVault(app, fileA);
      addFileToVault(app, fileB);
      addFileToVault(app, fileC);

      setMetadata(app, fileA, {});
      setMetadata(app, fileB, {});
      setMetadata(app, fileC, {});
      graph.build();

      // Rapid updates
      setMetadata(app, fileA, { parent: '[[B]]' });
      graph.updateNode(fileA);

      setMetadata(app, fileB, { parent: '[[C]]' });
      graph.updateNode(fileB);

      setMetadata(app, fileC, { parent: '[[A]]' });
      graph.updateNode(fileC);

      // Graph should remain consistent
      expect(graph.getAllFiles()).toHaveLength(3);

      // Should detect cycle
      expect(graph.hasCycles()).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle large graph update efficiently', () => {
      // Create a graph with many nodes
      const files: TFile[] = [];
      for (let i = 0; i < 100; i++) {
        const file = createMockFile(`file${i}.md`, `File${i}`);
        files.push(file);
        addFileToVault(app, file);
        setMetadata(app, file, {});
      }

      graph.build();

      // Time an update
      const start = performance.now();
      setMetadata(app, files[0], { parent: '[[File1]]' });
      graph.updateNode(files[0]);
      const duration = performance.now() - start;

      // Should be very fast (under 10ms for 100 nodes)
      expect(duration).toBeLessThan(10);
    });

    it('should be faster than full rebuild for larger graphs', () => {
      // Create a larger graph where incremental updates show clear benefit
      const files: TFile[] = [];
      for (let i = 0; i < 200; i++) {
        const file = createMockFile(`File${i}`);
        files.push(file);
        addFileToVault(app, file);
        setMetadata(app, file, i > 0 ? { parent: `[[File${i-1}]]` } : {});
      }

      // Do initial build
      graph.build();

      // Warm up - run once to eliminate any first-run overhead
      setMetadata(app, files[100], { parent: '[[File0]]' });
      graph.updateNode(files[100]);

      // Time full rebuild (average of 3 runs for stability)
      let totalRebuildTime = 0;
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        graph.build();
        totalRebuildTime += performance.now() - start;
      }
      const avgRebuildDuration = totalRebuildTime / 3;

      // Time incremental update (average of 3 runs for stability)
      let totalUpdateTime = 0;
      for (let i = 0; i < 3; i++) {
        setMetadata(app, files[150], { parent: `[[File${i}]]` });
        const start = performance.now();
        graph.updateNode(files[150]);
        totalUpdateTime += performance.now() - start;
      }
      const avgUpdateDuration = totalUpdateTime / 3;

      // Incremental should be faster (with a more lenient threshold)
      // For small graphs, the difference may be minimal, but for larger graphs
      // incremental updates should be noticeably faster
      expect(avgUpdateDuration).toBeLessThan(avgRebuildDuration);
    });
  });
});
