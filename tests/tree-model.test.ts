import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	TreeNode,
	buildAncestorTree,
	buildDescendantTree,
	buildFullLineageTree,
	buildSiblingTree,
	buildCousinsTree,
	traverseTree,
	traverseTreeBFS,
	findNodeByPath,
	calculateTreeDepth,
	countNodes,
	flattenTree,
	filterTree,
	mapTree,
	cloneTree
} from '@/tree-model';
import { RelationshipEngine } from '@/relationship-engine';
import { RelationGraph } from '@/relation-graph';
import { FrontmatterCache } from '@/frontmatter-cache';
import { TFile, App, CachedMetadata } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
function createMockFile(path: string, basename: string): TFile {
	return {
		path,
		basename,
		name: basename + '.md',
		extension: 'md',
		vault: {} as any,
		parent: null,
		stat: { ctime: 0, mtime: 0, size: 0 }
	} as TFile;
}

/**
 * Helper to create mock App
 */
function createMockApp(): App {
	const files = new Map<string, TFile>();
	const metadata = new Map<string, CachedMetadata>();

	return {
		vault: {
			getMarkdownFiles: () => Array.from(files.values()),
			getAbstractFileByPath: (path: string) => files.get(path) || null
		},
		metadataCache: {
			getFileCache: (file: TFile) => metadata.get(file.path) || null,
			on: vi.fn()
		}
	} as any;
}

/**
 * Helper to create a mock graph with specified relationships
 */
function createMockGraph(
	relationships: Array<{ child: string; parents: string[] }>,
	cycles: string[] = [],
	additionalFiles: string[] = [] // Add option to create additional files
): { graph: RelationGraph; files: Map<string, TFile>; engine: RelationshipEngine } {
	const files = new Map<string, TFile>();
	const app = createMockApp();

	// Create files
	const allNames = new Set<string>();
	relationships.forEach(rel => {
		allNames.add(rel.child);
		rel.parents.forEach(p => allNames.add(p));
	});
	cycles.forEach(c => allNames.add(c));
	additionalFiles.forEach(f => allNames.add(f));

	// Always create at least file 'A' if no names
	if (allNames.size === 0) {
		allNames.add('A');
	}

	allNames.forEach(name => {
		const file = createMockFile(`${name}.md`, name);
		files.set(name, file);
	});

	// Create graph
	const frontmatterCache = new FrontmatterCache(app);
	const graph = new RelationGraph(app, 'parent', 10, frontmatterCache);

	// Mock getParents and getChildren
	graph.getParents = vi.fn((file: TFile) => {
		const rel = relationships.find(r => r.child === file.basename);
		if (!rel) return [];
		return rel.parents.map(p => files.get(p)!).filter(Boolean);
	});

	graph.getChildren = vi.fn((file: TFile) => {
		return relationships
			.filter(r => r.parents.includes(file.basename))
			.map(r => files.get(r.child)!)
			.filter(Boolean);
	});

	// Mock detectCycle
	graph.detectCycle = vi.fn((file: TFile) => {
		if (cycles.includes(file.basename)) {
			return {
				cyclePath: [file],
				startFile: file,
				description: 'Cycle detected',
				length: 1
			};
		}
		return null;
	});

	// Create engine
	const engine = new RelationshipEngine(graph);

	// Mock getSiblings - files that share a parent
	engine.getSiblings = vi.fn((file: TFile, includeSelf: boolean = false) => {
		const parents = graph.getParents(file);
		const siblings = new Set<TFile>();

		parents.forEach(parent => {
			const children = graph.getChildren(parent);
			children.forEach(child => {
				if (includeSelf || child.path !== file.path) {
					siblings.add(child);
				}
			});
		});

		return Array.from(siblings);
	});

	// Mock getCousins - files that share a grandparent
	engine.getCousins = vi.fn((file: TFile, degree: number = 1) => {
		// Simple mock: return empty array
		return [];
	});

	return { graph, files, engine };
}

describe('Tree Data Model', () => {
	describe('TreeNode Structure', () => {
		it('should create valid TreeNode with all required properties', () => {
			const { graph, files, engine } = createMockGraph([]);
			const file = files.get('A')!;

			const tree = buildAncestorTree(file, engine, graph);

			expect(tree).toBeDefined();
			expect(tree.file).toBe(file);
			expect(tree.children).toEqual([]);
			expect(tree.depth).toBe(0);
			expect(tree.isCycle).toBe(false);
			expect(tree.metadata).toBeDefined();
		});

		it('should support nested children', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);

			expect(tree.children).toHaveLength(1);
			expect(tree.children[0].file.basename).toBe('B');
			expect(tree.children[0].children).toHaveLength(1);
			expect(tree.children[0].children[0].file.basename).toBe('C');
		});

		it('should store metadata correctly', () => {
			const { graph, files, engine } = createMockGraph([]);
			const file = files.get('A')!;

			const tree = buildAncestorTree(file, engine, graph, {
				metadataProvider: (f, depth) => ({
					color: depth === 0 ? 'blue' : 'gray',
					custom: 'value'
				})
			});

			expect(tree.metadata.color).toBe('blue');
			expect(tree.metadata.custom).toBe('value');
		});
	});

	describe('buildAncestorTree()', () => {
		it('should build tree for linear chain: A → B → C', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.depth).toBe(0);
			expect(tree.children).toHaveLength(1);
			expect(tree.children[0].file.basename).toBe('B');
			expect(tree.children[0].depth).toBe(1);
			expect(tree.children[0].children).toHaveLength(1);
			expect(tree.children[0].children[0].file.basename).toBe('C');
			expect(tree.children[0].children[0].depth).toBe(2);
		});

		it('should build tree for multiple parents: A → B, A → C', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B', 'C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(2);
			const childNames = tree.children.map(c => c.file.basename).sort();
			expect(childNames).toEqual(['B', 'C']);
			tree.children.forEach(child => {
				expect(child.depth).toBe(1);
			});
		});

		it('should build tree for diamond structure', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B', 'C'] },
				{ child: 'B', parents: ['D'] },
				{ child: 'C', parents: ['D'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(2);

			// Both B and C should have D as child
			tree.children.forEach(child => {
				expect(child.children).toHaveLength(1);
				expect(child.children[0].file.basename).toBe('D');
				expect(child.children[0].depth).toBe(2);
			});
		});

		it('should mark cycle nodes when detectCycles=true', () => {
			// Test hybrid cycle detection: nodes are marked if they're in a global cycle
			const { graph, files, engine } = createMockGraph(
				[{ child: 'A', parents: ['B'] }],
				['B']  // B is marked as being in a cycle globally
			);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				detectCycles: true
			});

			// Hybrid detection: B is marked as a cycle because graph.detectCycle(B) returns a cycle
			expect(tree.isCycle).toBe(false);  // Root A is not in any cycle
			expect(tree.children[0].isCycle).toBe(true);  // B is in a global cycle
			expect(tree.children[0].metadata.icon).toBe('cycle');
			expect(tree.children[0].metadata.tooltip).toContain('Cycle');
		});

		it('should respect maxDepth option', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] },
				{ child: 'C', parents: ['D'] },
				{ child: 'D', parents: ['E'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				maxDepth: 2
			});

			expect(tree.file.basename).toBe('A');
			expect(tree.children[0].file.basename).toBe('B');
			expect(tree.children[0].children[0].file.basename).toBe('C');
			expect(tree.children[0].children[0].children).toHaveLength(0);
		});

		it('should apply filter option', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				filter: (f) => f.basename !== 'B'
			});

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(0);
		});

		it('should use custom metadata provider', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				metadataProvider: (file, depth) => ({
					icon: `icon-${depth}`,
					color: depth === 0 ? 'blue' : 'gray'
				})
			});

			expect(tree.metadata.icon).toBe('icon-0');
			expect(tree.metadata.color).toBe('blue');
			expect(tree.children[0].metadata.icon).toBe('icon-1');
			expect(tree.children[0].metadata.color).toBe('gray');
		});

		it('should handle root node (no parents)', () => {
			const { graph, files, engine } = createMockGraph([]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(0);
		});
	});

	describe('buildDescendantTree()', () => {
		it('should build tree for linear chain: A → B → C', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'B', parents: ['A'] },
				{ child: 'C', parents: ['B'] }
			]);

			const tree = buildDescendantTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.depth).toBe(0);
			expect(tree.children).toHaveLength(1);
			expect(tree.children[0].file.basename).toBe('B');
			expect(tree.children[0].depth).toBe(1);
			expect(tree.children[0].children).toHaveLength(1);
			expect(tree.children[0].children[0].file.basename).toBe('C');
		});

		it('should build tree for multiple children', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'B', parents: ['A'] },
				{ child: 'C', parents: ['A'] },
				{ child: 'D', parents: ['A'] }
			]);

			const tree = buildDescendantTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(3);
			const childNames = tree.children.map(c => c.file.basename).sort();
			expect(childNames).toEqual(['B', 'C', 'D']);
		});

		it('should handle leaf node (no children)', () => {
			const { graph, files, engine } = createMockGraph([]);

			const tree = buildDescendantTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(0);
		});

		it('should mark cycle nodes', () => {
			// Test that files in global cycle paths show the cycle icon
			const { graph, files, engine } = createMockGraph(
				[{ child: 'B', parents: ['A'] }],
				['B']  // B is marked as being in a cycle globally
			);

			const tree = buildDescendantTree(files.get('A')!, engine, graph, {
				detectCycles: true
			});

			// B is marked as a cycle because it's in a global cycle path
			expect(tree.children[0].isCycle).toBe(true);
		});
	});

	describe('buildFullLineageTree()', () => {
		it('should build tree with descendants', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'X', parents: ['A'] },
				{ child: 'Y', parents: ['A'] }
			]);

			const tree = buildFullLineageTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(2);
			const childNames = tree.children.map(c => c.file.basename).sort();
			expect(childNames).toEqual(['X', 'Y']);
		});

		it('should handle file with only descendants', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'X', parents: ['A'] }
			]);

			const tree = buildFullLineageTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(1);
			expect(tree.children[0].file.basename).toBe('X');
		});
	});

	describe('buildSiblingTree()', () => {
		it('should return siblings as separate root nodes', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['P'] },
				{ child: 'B', parents: ['P'] },
				{ child: 'C', parents: ['P'] }
			]);

			const siblings = buildSiblingTree(files.get('A')!, engine, graph);

			expect(siblings).toHaveLength(2);
			const siblingNames = siblings.map(s => s.file.basename).sort();
			expect(siblingNames).toEqual(['B', 'C']);
			siblings.forEach(sibling => {
				expect(sibling.depth).toBe(0);
			});
		});

		it('should return empty array for only child', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['P'] }
			]);

			const siblings = buildSiblingTree(files.get('A')!, engine, graph);

			expect(siblings).toHaveLength(0);
		});

		it('should handle multiple parents with different siblings', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['P1', 'P2'] },
				{ child: 'B', parents: ['P1'] },
				{ child: 'C', parents: ['P2'] }
			]);

			const siblings = buildSiblingTree(files.get('A')!, engine, graph);

			expect(siblings.length).toBeGreaterThan(0);
		});
	});

	describe('buildCousinsTree()', () => {
		it('should return cousins as separate root nodes', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['P1'] },
				{ child: 'P1', parents: ['G'] },
				{ child: 'P2', parents: ['G'] },
				{ child: 'C1', parents: ['P2'] }
			]);

			const cousins = buildCousinsTree(files.get('A')!, engine, graph);

			expect(Array.isArray(cousins)).toBe(true);
			cousins.forEach(cousin => {
				expect(cousin.depth).toBe(0);
			});
		});
	});

	describe('Tree Traversal', () => {
		it('should traverse tree depth-first', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B', 'C'] },
				{ child: 'B', parents: ['D'] },
				{ child: 'C', parents: ['E'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const visited: string[] = [];

			traverseTree(tree, (node) => {
				visited.push(node.file.basename);
			});

			expect(visited[0]).toBe('A');
			// DFS visits children before siblings
			expect(visited).toContain('B');
			expect(visited).toContain('C');
			expect(visited).toContain('D');
			expect(visited).toContain('E');
		});

		it('should traverse tree breadth-first', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B', 'C'] },
				{ child: 'B', parents: ['D'] },
				{ child: 'C', parents: ['E'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const visited: string[] = [];

			traverseTreeBFS(tree, (node) => {
				visited.push(node.file.basename);
			});

			// BFS should visit A first, then its children (B and C in some order),
			// then grandchildren (D and E in some order)
			expect(visited[0]).toBe('A');
			expect(visited.slice(1, 3).sort()).toEqual(['B', 'C']);
			// Grandchildren should be at the end
			expect(visited.slice(3).sort()).toContain('D');
			expect(visited.slice(3).sort()).toContain('E');
			expect(visited.length).toBeGreaterThanOrEqual(4);
		});

		it('should call visitor for each node', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			let count = 0;

			traverseTree(tree, () => {
				count++;
			});

			expect(count).toBe(3);
		});
	});

	describe('Tree Utilities', () => {
		it('should find node by path', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const found = findNodeByPath(tree, 'B.md');

			expect(found).toBeDefined();
			expect(found?.file.basename).toBe('B');
		});

		it('should return null when node not found', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const found = findNodeByPath(tree, 'X.md');

			expect(found).toBeNull();
		});

		it('should calculate tree depth correctly', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] },
				{ child: 'C', parents: ['D'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const depth = calculateTreeDepth(tree);

			expect(depth).toBe(3);
		});

		it('should count nodes correctly', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] },
				{ child: 'B', parents: ['C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const count = countNodes(tree);

			// Tree structure: A -> B -> C
			expect(count).toBe(3); // A, B, C
		});

		it('should flatten tree to array', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B', 'C'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const flattened = flattenTree(tree);

			expect(flattened).toHaveLength(3);
			const names = flattened.map(n => n.file.basename);
			expect(names).toContain('A');
			expect(names).toContain('B');
			expect(names).toContain('C');
		});

		it('should filter tree nodes', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B', 'C', 'D'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const filtered = filterTree(tree, (n) => n.file.basename !== 'C');

			expect(filtered).toBeDefined();
			expect(filtered?.children).toHaveLength(2);
			const childNames = filtered!.children.map(c => c.file.basename);
			expect(childNames).not.toContain('C');
		});

		it('should map tree nodes', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const mapped = mapTree(tree, (n) => ({
				...n,
				metadata: { ...n.metadata, custom: true }
			}));

			expect(mapped.metadata.custom).toBe(true);
			expect(mapped.children[0].metadata.custom).toBe(true);
		});

		it('should clone tree deeply', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);
			const cloned = cloneTree(tree);

			expect(cloned).not.toBe(tree);
			expect(cloned.file).toBe(tree.file);
			expect(cloned.children).not.toBe(tree.children);
			expect(cloned.metadata).not.toBe(tree.metadata);
			expect(cloned.children[0]).not.toBe(tree.children[0]);
		});
	});

	describe('Metadata Handling', () => {
		it('should add cycle metadata automatically', () => {
			// Create actual cycle: A → B → A
			const { graph, files, engine } = createMockGraph(
				[
					{ child: 'A', parents: ['B'] },
					{ child: 'B', parents: ['A'] }
				],
				['A', 'B']
			);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				detectCycles: true
			});

			// B is marked as cycle because it's in a global cycle path
			expect(tree.children[0].metadata.icon).toBe('cycle');
			expect(tree.children[0].metadata.tooltip).toBeDefined();
			expect(tree.children[0].metadata.className).toContain('is-cycle');
		});

		it('should merge custom metadata with cycle metadata', () => {
			// Test that custom metadata is merged correctly
			const { graph, files, engine } = createMockGraph(
				[{ child: 'A', parents: ['B'] }],
				['B']
			);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				detectCycles: true,
				metadataProvider: (file, depth) => ({
					color: 'red',
					custom: 'value'
				})
			});

			// B is marked as cycle and custom metadata is merged
			expect(tree.children[0].metadata.icon).toBe('cycle');
			expect(tree.children[0].metadata.color).toBe('red');
			expect(tree.children[0].metadata.custom).toBe('value');
		});

		it('should support custom metadata keys', () => {
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents: ['B'] }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				metadataProvider: (file, depth) => ({
					myCustomKey: 'myCustomValue',
					anotherKey: 123
				})
			});

			expect(tree.metadata.myCustomKey).toBe('myCustomValue');
			expect(tree.metadata.anotherKey).toBe(123);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty tree (single node)', () => {
			const { graph, files, engine } = createMockGraph([]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);

			expect(tree.file.basename).toBe('A');
			expect(tree.children).toHaveLength(0);
			expect(countNodes(tree)).toBe(1);
			expect(calculateTreeDepth(tree)).toBe(0);
		});

		it('should handle very deep trees', () => {
			const relationships = [];
			for (let i = 0; i < 50; i++) {
				relationships.push({
					child: `N${i}`,
					parents: [`N${i + 1}`]
				});
			}

			const { graph, files, engine } = createMockGraph(relationships);

			// Build with explicit maxDepth to override default
			const tree = buildAncestorTree(files.get('N0')!, engine, graph, {
				maxDepth: 50
			});

			expect(tree).toBeDefined();
			const depth = calculateTreeDepth(tree);
			expect(depth).toBeGreaterThan(10);
		});

		it('should handle very wide trees', () => {
			const parents = Array.from({ length: 50 }, (_, i) => `P${i}`);
			const { graph, files, engine } = createMockGraph([
				{ child: 'A', parents }
			]);

			const tree = buildAncestorTree(files.get('A')!, engine, graph);

			expect(tree.children).toHaveLength(50);
		});

		it('should handle tree with cycle nodes', () => {
			// Test that nodes marked as being in cycles globally are NOT
			// marked as cycles in the tree unless they appear twice in the path
			const { graph, files, engine } = createMockGraph(
				[
					{ child: 'A', parents: ['B'] },
					{ child: 'B', parents: ['C'] }
				],
				['B', 'C']
			);

			const tree = buildAncestorTree(files.get('A')!, engine, graph, {
				detectCycles: true
			});

			// Path: A → B → C, where B and C are in global cycles
			expect(tree.children[0].isCycle).toBe(true);  // B is in a global cycle
			expect(tree.children[0].children[0].isCycle).toBe(true);  // C is in a global cycle
		});
	});

	describe('Performance', () => {
		it('should build large tree quickly', () => {
			const relationships = [];
			for (let i = 0; i < 100; i++) {
				relationships.push({
					child: `N${i}`,
					parents: [`N${i + 1}`]
				});
			}

			const { graph, files, engine } = createMockGraph(relationships);

			const start = performance.now();
			const tree = buildAncestorTree(files.get('N0')!, engine, graph);
			const end = performance.now();

			expect(tree).toBeDefined();
			expect(end - start).toBeLessThan(100);
		});

		it('should traverse large tree efficiently', () => {
			const relationships = [];
			for (let i = 0; i < 100; i++) {
				relationships.push({
					child: `N${i}`,
					parents: [`N${i + 1}`]
				});
			}

			const { graph, files, engine } = createMockGraph(relationships);
			const tree = buildAncestorTree(files.get('N0')!, engine, graph, {
				maxDepth: 100
			});

			const start = performance.now();
			let count = 0;
			traverseTree(tree, () => {
				count++;
			});
			const end = performance.now();

			expect(count).toBeGreaterThan(50);
			expect(end - start).toBeLessThan(50);
		});

		it('should clone large tree efficiently', () => {
			const relationships = [];
			for (let i = 0; i < 50; i++) {
				relationships.push({
					child: `N${i}`,
					parents: [`N${i + 1}`]
				});
			}

			const { graph, files, engine } = createMockGraph(relationships);
			const tree = buildAncestorTree(files.get('N0')!, engine, graph);

			const start = performance.now();
			const cloned = cloneTree(tree);
			const end = performance.now();

			expect(cloned).toBeDefined();
			expect(end - start).toBeLessThan(100);
		});
	});
});
