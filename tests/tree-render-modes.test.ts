import { describe, it, expect, vi } from 'vitest';
import {
	TreeRenderMode,
	RenderModeConfig,
	buildModeTree,
	ModePresets,
	createModeConfig
} from '@/tree-render-modes';
import { RelationshipEngine } from '@/relationship-engine';
import { RelationGraph } from '@/relation-graph';
import { TFile, MetadataCache, CachedMetadata } from 'obsidian';
import { SortPresets } from '@/tree-sorters';

/**
 * Helper to create mock TFile objects for testing
 */
function createMockFile(
	basename: string,
	tags: string[] = [],
	folder: string = ''
): TFile {
	const path = folder ? `${folder}/${basename}.md` : `${basename}.md`;
	return {
		path,
		basename,
		name: basename + '.md',
		extension: 'md',
		vault: {} as any,
		parent: null,
		stat: { ctime: Date.now(), mtime: Date.now(), size: 100 }
	} as TFile;
}

/**
 * Helper to create mock metadata cache
 */
function createMockMetadataCache(fileMetadata: Map<string, CachedMetadata>): MetadataCache {
	return {
		getFileCache: (file: TFile) => fileMetadata.get(file.path) || null,
		on: vi.fn()
	} as any;
}

/**
 * Helper to create mock relationship engine
 */
function createMockEngine(relationships: {
	ancestors: Map<string, TFile[][]>;
	descendants: Map<string, TFile[][]>;
	siblings: Map<string, TFile[]>;
	cousins: Map<string, TFile[]>;
}): RelationshipEngine {
	return {
		getAncestors: (file: TFile, maxDepth?: number) => {
			return relationships.ancestors.get(file.path) || [];
		},
		getDescendants: (file: TFile, maxDepth?: number) => {
			return relationships.descendants.get(file.path) || [];
		},
		getSiblings: (file: TFile, includeSelf: boolean) => {
			return relationships.siblings.get(file.path) || [];
		},
		getCousins: (file: TFile, degree: number) => {
			return relationships.cousins.get(file.path) || [];
		}
	} as any;
}

/**
 * Helper to create mock relation graph
 */
function createMockGraph(): RelationGraph {
	return {
		detectCycle: vi.fn(() => null),
		getParents: vi.fn(() => []),
		getChildren: vi.fn(() => []),
		supportsCycleDetection: vi.fn(() => true)
	} as any;
}

describe('Tree Rendering Modes', () => {
	describe('TreeRenderMode Enum', () => {
		it('should have all expected modes', () => {
			expect(TreeRenderMode.ANCESTORS).toBe('ancestors');
			expect(TreeRenderMode.DESCENDANTS).toBe('descendants');
			expect(TreeRenderMode.FULL_LINEAGE).toBe('full-lineage');
			expect(TreeRenderMode.SIBLINGS).toBe('siblings');
			expect(TreeRenderMode.COUSINS).toBe('cousins');
		});
	});

	describe('buildModeTree - ANCESTORS Mode', () => {
		it('should build ancestor tree in ANCESTORS mode', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB], [fileC]]]
				]),
				descendants: new Map(),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS,
				maxDepth: 3
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.mode).toBe(TreeRenderMode.ANCESTORS);
			expect(result.roots).toHaveLength(1);
			expect(result.roots[0].file).toBe(fileA);
			expect(result.roots[0].children).toHaveLength(1);
			expect(result.roots[0].children[0].file).toBe(fileB);
		});

		it('should respect maxDepth in ANCESTORS mode', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB], [fileC]]]
				]),
				descendants: new Map(),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS,
				maxDepth: 2
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			// Should only have depth up to 2
			expect(result.maxDepth).toBeLessThanOrEqual(2);
		});
	});

	describe('buildModeTree - DESCENDANTS Mode', () => {
		it('should build descendant tree in DESCENDANTS mode', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map(),
				descendants: new Map([
					['A.md', [[fileB], [fileC]]]
				]),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.DESCENDANTS,
				maxDepth: 3
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.mode).toBe(TreeRenderMode.DESCENDANTS);
			expect(result.roots).toHaveLength(1);
			expect(result.roots[0].file).toBe(fileA);
		});

		it('should add path to root metadata when showPathToRoot is true', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB], [fileC]]]
				]),
				descendants: new Map([
					['A.md', []]
				]),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.DESCENDANTS,
				showPathToRoot: true,
				maxDepth: 3
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.roots[0].metadata.pathToRoot).toBeDefined();
		});
	});

	describe('buildModeTree - FULL_LINEAGE Mode', () => {
		it('should build full lineage tree', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB]]]
				]),
				descendants: new Map([
					['A.md', [[fileC]]]
				]),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.FULL_LINEAGE,
				maxDepth: 3
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.mode).toBe(TreeRenderMode.FULL_LINEAGE);
			expect(result.roots).toHaveLength(1);
			expect(result.roots[0].file).toBe(fileA);
		});
	});

	describe('buildModeTree - SIBLINGS Mode', () => {
		it('should return siblings as separate roots', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map(),
				descendants: new Map(),
				siblings: new Map([
					['A.md', [fileB, fileC]]
				]),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.SIBLINGS
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.mode).toBe(TreeRenderMode.SIBLINGS);
			expect(result.roots).toHaveLength(2);
			expect(result.roots[0].file).toBe(fileB);
			expect(result.roots[1].file).toBe(fileC);
		});

		it('should return empty array when no siblings', () => {
			const fileA = createMockFile('A');

			const engine = createMockEngine({
				ancestors: new Map(),
				descendants: new Map(),
				siblings: new Map([
					['A.md', []]
				]),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.SIBLINGS
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.roots).toHaveLength(0);
		});
	});

	describe('buildModeTree - COUSINS Mode', () => {
		it('should return cousins as separate roots', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map(),
				descendants: new Map(),
				siblings: new Map(),
				cousins: new Map([
					['A.md', [fileB, fileC]]
				])
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.COUSINS
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.mode).toBe(TreeRenderMode.COUSINS);
			expect(result.roots).toHaveLength(2);
		});
	});

	describe('Mode Combination', () => {
		it('should combine multiple modes', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');
			const fileD = createMockFile('D');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB]]]
				]),
				descendants: new Map([
					['A.md', [[fileC]]]
				]),
				siblings: new Map([
					['A.md', [fileD]]
				]),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS,
				additionalModes: [TreeRenderMode.SIBLINGS],
				maxDepth: 2
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			// Should have ancestors and siblings combined
			expect(result.nodeCount).toBeGreaterThan(1);
		});

		it('should deduplicate nodes when combining modes', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB]]]
				]),
				descendants: new Map([
					['A.md', [[fileB]]]
				]),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS,
				additionalModes: [TreeRenderMode.DESCENDANTS],
				maxDepth: 1
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			// fileB should not be duplicated
			const filePaths = result.roots.map(r => r.file.path);
			const uniquePaths = new Set(filePaths);
			expect(filePaths.length).toBe(uniquePaths.size);
		});
	});

	describe('Filtering', () => {
		it('should filter by included tags', () => {
			const fileA = createMockFile('A', ['#important']);
			const fileB = createMockFile('B', ['#important']);
			const fileC = createMockFile('C', []);

			const fileMetadata = new Map<string, CachedMetadata>();
			fileMetadata.set('B.md', {
				tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }]
			} as CachedMetadata);
			fileMetadata.set('C.md', {} as CachedMetadata);

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB, fileC]]]
				]),
				descendants: new Map(),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(fileMetadata);

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS,
				filter: {
					includeTags: ['#important']
				}
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			// Should only include fileB, not fileC
			expect(result.nodeCount).toBe(2); // A and B
		});

		it('should filter by folders', () => {
			const fileA = createMockFile('A', [], 'root');
			const fileB = createMockFile('B', [], 'projects');
			const fileC = createMockFile('C', [], 'archive');

			const engine = createMockEngine({
				ancestors: new Map([
					['root/A.md', [[fileB, fileC]]]
				]),
				descendants: new Map(),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS,
				filter: {
					includeFolders: ['projects/']
				}
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			// Should only include fileB
			expect(result.nodeCount).toBe(2); // A and B
		});
	});

	describe('Sorting', () => {
		it('should sort roots alphabetically', () => {
			const fileA = createMockFile('A');
			const fileC = createMockFile('C');
			const fileB = createMockFile('B');

			const engine = createMockEngine({
				ancestors: new Map(),
				descendants: new Map(),
				siblings: new Map([
					['A.md', [fileC, fileB]]
				]),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.SIBLINGS,
				sort: SortPresets.alphabetical
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.roots[0].file.basename).toBe('B');
			expect(result.roots[1].file.basename).toBe('C');
		});
	});

	describe('Mode Presets', () => {
		it('should create family view preset', () => {
			const file = createMockFile('A');
			const config = ModePresets.family(file);

			expect(config.mode).toBe(TreeRenderMode.FULL_LINEAGE);
			expect(config.additionalModes).toContain(TreeRenderMode.SIBLINGS);
			expect(config.maxDepth).toBe(3);
		});

		it('should create context view preset', () => {
			const file = createMockFile('A');
			const config = ModePresets.context(file);

			expect(config.mode).toBe(TreeRenderMode.DESCENDANTS);
			expect(config.additionalModes).toContain(TreeRenderMode.ANCESTORS);
			expect(config.additionalModes).toContain(TreeRenderMode.SIBLINGS);
			expect(config.maxDepth).toBe(1);
		});

		it('should create ancestry view preset', () => {
			const file = createMockFile('A');
			const config = ModePresets.ancestry(file);

			expect(config.mode).toBe(TreeRenderMode.ANCESTORS);
			expect(config.maxDepth).toBe(10);
			expect(config.showPathToRoot).toBe(true);
		});

		it('should create lineage view preset', () => {
			const file = createMockFile('A');
			const config = ModePresets.lineage(file);

			expect(config.mode).toBe(TreeRenderMode.DESCENDANTS);
			expect(config.maxDepth).toBe(10);
			expect(config.showPathToRoot).toBe(true);
		});

		it('should create network view preset', () => {
			const file = createMockFile('A');
			const config = ModePresets.network(file);

			expect(config.mode).toBe(TreeRenderMode.FULL_LINEAGE);
			expect(config.additionalModes).toContain(TreeRenderMode.SIBLINGS);
			expect(config.additionalModes).toContain(TreeRenderMode.COUSINS);
			expect(config.maxDepth).toBe(2);
		});
	});

	describe('ModeTreeResult Metadata', () => {
		it('should calculate node count correctly', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');
			const fileC = createMockFile('C');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB], [fileC]]]
				]),
				descendants: new Map(),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = createMockGraph();
			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.nodeCount).toBeGreaterThan(0);
		});

		it('should detect cycles when present', () => {
			const fileA = createMockFile('A');
			const fileB = createMockFile('B');

			const engine = createMockEngine({
				ancestors: new Map([
					['A.md', [[fileB]]]
				]),
				descendants: new Map(),
				siblings: new Map(),
				cousins: new Map()
			});

			const graph = {
				detectCycle: vi.fn((file: TFile) => {
					if (file.path === 'B.md') {
						return { cycle: true };
					}
					return null;
				}),
				getParents: vi.fn(() => []),
				getChildren: vi.fn(() => []),
				supportsCycleDetection: vi.fn(() => true)
			} as any;

			const metadataCache = createMockMetadataCache(new Map());

			const config: RenderModeConfig = {
				mode: TreeRenderMode.ANCESTORS,
				detectCycles: true
			};

			const result = buildModeTree(fileA, config, engine, graph, metadataCache);

			expect(result.hasCycles).toBe(true);
		});
	});

	describe('createModeConfig', () => {
		it('should create config with defaults', () => {
			const config = createModeConfig(TreeRenderMode.ANCESTORS);

			expect(config.mode).toBe(TreeRenderMode.ANCESTORS);
			expect(config.maxDepth).toBe(5);
			expect(config.detectCycles).toBe(true);
			expect(config.includeMetadata).toBe(true);
		});

		it('should override defaults with provided options', () => {
			const config = createModeConfig(TreeRenderMode.ANCESTORS, {
				maxDepth: 10,
				detectCycles: false
			});

			expect(config.maxDepth).toBe(10);
			expect(config.detectCycles).toBe(false);
		});
	});
});
