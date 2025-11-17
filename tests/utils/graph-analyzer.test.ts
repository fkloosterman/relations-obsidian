import { describe, it, expect, beforeEach } from 'vitest';
import { TFile } from 'obsidian';
import {
	findRootNotes,
	findLeafNotes,
	computeGraphStatistics,
	GraphStatistics
} from '../../src/utils/graph-analyzer';
import { RelationGraph } from '../../src/relation-graph';
import { FrontmatterCache } from '../../src/frontmatter-cache';

/**
 * Helper to create mock TFile objects for testing
 */
function createMockFile(basename: string): TFile {
	const file = new TFile();
	file.path = `${basename}.md`;
	file.basename = basename;
	file.name = `${basename}.md`;
	return file;
}

/**
 * Helper to create a mock RelationGraph with specified relationships
 */
function createMockGraph(
	relationships: Array<[string, string]>
): { graph: RelationGraph; files: Map<string, TFile> } {
	const files = new Map<string, TFile>();
	const uniqueNames = new Set<string>();

	// Collect all unique file names
	relationships.forEach(([child, parent]) => {
		uniqueNames.add(child);
		uniqueNames.add(parent);
	});

	// Create TFile objects
	uniqueNames.forEach(name => {
		files.set(name, createMockFile(name));
	});

	// Create mock app and cache
	const mockApp = {
		vault: {
			getMarkdownFiles: () => Array.from(files.values())
		},
		metadataCache: {
			getFileCache: () => null,
			getFirstLinkpathDest: () => null
		}
	} as any;

	const frontmatterCache = new FrontmatterCache(mockApp);
	const graph = new RelationGraph(mockApp, 'parent', 5, frontmatterCache);

	// Manually build graph structure
	const graphData = (graph as any).graph;
	files.forEach(file => {
		graphData.set(file.path, { file, parents: [], children: [] });
	});

	// Add relationships
	relationships.forEach(([childName, parentName]) => {
		const childFile = files.get(childName)!;
		const parentFile = files.get(parentName)!;
		const childNode = graphData.get(childFile.path);
		const parentNode = graphData.get(parentFile.path);

		if (childNode && parentNode) {
			childNode.parents.push(parentFile);
			parentNode.children.push(childFile);
		}
	});

	// Initialize cycle detector
	(graph as any).cycleDetector = {
		detectCycle: () => null,
		getCycleInfo: () => null
	};
	(graph as any).graphValidator = {
		getAllCycles: () => []
	};

	return { graph, files };
}

describe('Graph Analysis', () => {
	describe('findRootNotes()', () => {
		it('should find all root notes (notes with no parents)', () => {
			// Setup: Tree structure with two roots
			//   A (root)    D (root)
			//   |           |
			//   B           E
			//   |           |
			//   C           F
			const { graph } = createMockGraph([
				['B', 'A'],
				['C', 'B'],
				['E', 'D'],
				['F', 'E']
			]);

			// Test
			const roots = findRootNotes(graph);

			// Verify
			expect(roots.length).toBe(2);
			expect(roots.map(f => f.basename).sort()).toEqual(['A', 'D']);
		});

		it('should return sorted results alphabetically', () => {
			// Setup: Multiple roots
			const { graph } = createMockGraph([
				['A', 'Z'],
				['B', 'Y'],
				['C', 'X']
			]);

			// Test
			const roots = findRootNotes(graph);

			// Verify - X, Y, Z should be roots, sorted alphabetically
			expect(roots.length).toBe(3);
			expect(roots.map(f => f.basename)).toEqual(['X', 'Y', 'Z']);
		});

		it('should return empty array when all notes have parents', () => {
			// Setup: Circular structure (no true roots)
			const { graph } = createMockGraph([
				['A', 'B'],
				['B', 'C'],
				['C', 'A']
			]);

			// Test
			const roots = findRootNotes(graph);

			// Verify
			expect(roots.length).toBe(0);
		});

		it('should handle single isolated note as root', () => {
			// Setup: Single note with no relationships
			const file = createMockFile('Isolated');
			const mockApp = {
				vault: { getMarkdownFiles: () => [file] },
				metadataCache: { getFileCache: () => null, getFirstLinkpathDest: () => null }
			} as any;

			const frontmatterCache = new FrontmatterCache(mockApp);
			const graph = new RelationGraph(mockApp, 'parent', 5, frontmatterCache);

			const graphData = (graph as any).graph;
			graphData.set(file.path, { file, parents: [], children: [] });

			// Initialize validators
			(graph as any).cycleDetector = { detectCycle: () => null, getCycleInfo: () => null };
			(graph as any).graphValidator = { getAllCycles: () => [] };

			// Test
			const roots = findRootNotes(graph);

			// Verify - isolated notes should NOT be included as roots
			expect(roots.length).toBe(0);
		});
	});

	describe('findLeafNotes()', () => {
		it('should find all leaf notes (notes with no children)', () => {
			// Setup: Tree structure with two leaves
			//   A
			//   |
			//   B
			//  / \
			// C   D (leaves)
			const { graph } = createMockGraph([
				['B', 'A'],
				['C', 'B'],
				['D', 'B']
			]);

			// Test
			const leaves = findLeafNotes(graph);

			// Verify
			expect(leaves.length).toBe(2);
			expect(leaves.map(f => f.basename).sort()).toEqual(['C', 'D']);
		});

		it('should return sorted results alphabetically', () => {
			// Setup: Multiple leaves
			const { graph } = createMockGraph([
				['Z', 'Root'],
				['Y', 'Root'],
				['X', 'Root']
			]);

			// Test
			const leaves = findLeafNotes(graph);

			// Verify - X, Y, Z should be leaves, sorted alphabetically
			expect(leaves.length).toBe(3);
			expect(leaves.map(f => f.basename)).toEqual(['X', 'Y', 'Z']);
		});

		it('should return empty array when all notes have children', () => {
			// Setup: Circular structure (no true leaves)
			const { graph } = createMockGraph([
				['A', 'B'],
				['B', 'C'],
				['C', 'A']
			]);

			// Test
			const leaves = findLeafNotes(graph);

			// Verify
			expect(leaves.length).toBe(0);
		});

		it('should handle single isolated note as leaf', () => {
			// Setup: Single note with no relationships
			const file = createMockFile('Isolated');
			const mockApp = {
				vault: { getMarkdownFiles: () => [file] },
				metadataCache: { getFileCache: () => null, getFirstLinkpathDest: () => null }
			} as any;

			const frontmatterCache = new FrontmatterCache(mockApp);
			const graph = new RelationGraph(mockApp, 'parent', 5, frontmatterCache);

			const graphData = (graph as any).graph;
			graphData.set(file.path, { file, parents: [], children: [] });

			// Initialize validators
			(graph as any).cycleDetector = { detectCycle: () => null, getCycleInfo: () => null };
			(graph as any).graphValidator = { getAllCycles: () => [] };

			// Test
			const leaves = findLeafNotes(graph);

			// Verify - isolated notes should NOT be included as leaves
			expect(leaves.length).toBe(0);
		});
	});

	describe('computeGraphStatistics()', () => {
		it('should compute correct statistics for simple tree', () => {
			// Setup: Simple tree
			//   A (root)
			//   |
			//   B
			//  / \
			// C   D (leaves)
			const { graph } = createMockGraph([
				['B', 'A'],
				['C', 'B'],
				['D', 'B']
			]);

			// Test
			const stats = computeGraphStatistics(graph);

			// Verify
			expect(stats.totalNodes).toBe(4);
			expect(stats.totalEdges).toBe(3); // A→B, B→C, B→D
			expect(stats.rootCount).toBe(1); // A
			expect(stats.leafCount).toBe(2); // C, D
			expect(stats.maxDepth).toBe(2); // A → B → C (or D)
			expect(stats.maxBreadth).toBe(2); // B has 2 children
			expect(stats.cycleCount).toBe(0);
			expect(stats.averageChildren).toBeCloseTo(3 / 4, 2); // 0.75
		});

		it('should handle graph with multiple roots and leaves', () => {
			// Setup: Two separate trees
			//   A       D
			//   |       |
			//   B       E
			//   |       |
			//   C       F
			const { graph } = createMockGraph([
				['B', 'A'],
				['C', 'B'],
				['E', 'D'],
				['F', 'E']
			]);

			// Test
			const stats = computeGraphStatistics(graph);

			// Verify
			expect(stats.totalNodes).toBe(6);
			expect(stats.totalEdges).toBe(4);
			expect(stats.rootCount).toBe(2); // A, D
			expect(stats.leafCount).toBe(2); // C, F
			expect(stats.maxDepth).toBe(2);
			expect(stats.maxBreadth).toBe(1);
		});

		it('should handle graph with cycles', () => {
			// Setup: Graph with cycle
			const { graph } = createMockGraph([
				['A', 'B'],
				['B', 'C'],
				['C', 'A'] // Cycle
			]);

			// Mock cycle detection
			(graph as any).graphValidator = {
				getAllCycles: () => [{ files: [], length: 3 }] // One cycle
			};

			// Test
			const stats = computeGraphStatistics(graph);

			// Verify
			expect(stats.cycleCount).toBe(1);
		});

		it('should compute max breadth correctly', () => {
			// Setup: Star structure (one parent with many children)
			//       A
			//    / | | \
			//   B  C D  E
			const { graph } = createMockGraph([
				['B', 'A'],
				['C', 'A'],
				['D', 'A'],
				['E', 'A']
			]);

			// Test
			const stats = computeGraphStatistics(graph);

			// Verify
			expect(stats.maxBreadth).toBe(4); // A has 4 children
		});

		it('should compute max depth correctly', () => {
			// Setup: Deep linear chain
			//   A → B → C → D → E
			const { graph } = createMockGraph([
				['B', 'A'],
				['C', 'B'],
				['D', 'C'],
				['E', 'D']
			]);

			// Test
			const stats = computeGraphStatistics(graph);

			// Verify
			expect(stats.maxDepth).toBe(4); // 4 edges from A to E
		});

		it('should return zero statistics for empty graph', () => {
			// Setup: Empty graph
			const mockApp = {
				vault: { getMarkdownFiles: () => [] },
				metadataCache: { getFileCache: () => null, getFirstLinkpathDest: () => null }
			} as any;

			const frontmatterCache = new FrontmatterCache(mockApp);
			const graph = new RelationGraph(mockApp, 'parent', 5, frontmatterCache);

			// Initialize validators
			(graph as any).cycleDetector = { detectCycle: () => null, getCycleInfo: () => null };
			(graph as any).graphValidator = { getAllCycles: () => [] };

			// Test
			const stats = computeGraphStatistics(graph);

			// Verify
			expect(stats.totalNodes).toBe(0);
			expect(stats.totalEdges).toBe(0);
			expect(stats.rootCount).toBe(0);
			expect(stats.leafCount).toBe(0);
			expect(stats.maxDepth).toBe(0);
			expect(stats.maxBreadth).toBe(0);
			expect(stats.cycleCount).toBe(0);
			expect(stats.averageChildren).toBe(0);
		});
	});
});
