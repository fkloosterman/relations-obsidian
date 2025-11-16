import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createTagFilter,
	createFolderFilter,
	createExclusionFilter,
	buildFilterFunction,
	getAllTags,
	countTreeNodes,
	truncateTree,
	FilterFunction
} from '../src/codeblock-filters';
import { TreeNode } from '../src/tree-model';
import { TFile, App, CachedMetadata } from 'obsidian';

// Mock helper to create TFile
function createMockFile(path: string, parentPath?: string): TFile {
	const parent = parentPath ? {
		path: parentPath,
		name: parentPath.split('/').pop() || parentPath
	} : null;

	return {
		path,
		basename: path.split('/').pop()?.replace('.md', '') || path,
		name: path.split('/').pop() || path,
		extension: 'md',
		parent: parent as any,
		vault: {} as any,
		stat: { ctime: 0, mtime: 0, size: 0 }
	} as TFile;
}

// Mock helper to create file cache with tags
function createMockCache(tags: string[] = [], frontmatterTags?: string | string[]): CachedMetadata {
	const cache: any = {
		tags: tags.map(tag => ({ tag, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } })),
		frontmatter: {}
	};

	if (frontmatterTags !== undefined) {
		cache.frontmatter.tags = frontmatterTags;
	}

	return cache;
}

// Mock App with basic metadata cache
function createMockApp(fileMap: Map<string, CachedMetadata>): App {
	return {
		metadataCache: {
			getFileCache: (file: TFile) => fileMap.get(file.path) || null,
			getFirstLinkpathDest: (linkpath: string, _sourcePath: string) => {
				// Simple mock: just look for file with matching basename
				const basename = linkpath.replace('.md', '');
				for (const [path, _] of fileMap) {
					if (path.includes(basename)) {
						return createMockFile(path);
					}
				}
				return null;
			}
		}
	} as any;
}

describe('Codeblock Filters', () => {
	describe('getAllTags()', () => {
		it('should extract tags from frontmatter tags field (array)', () => {
			const cache = createMockCache([], ['#project', '#active']);
			const tags = getAllTags(cache);

			expect(tags).toContain('#project');
			expect(tags).toContain('#active');
		});

		it('should extract tags from frontmatter tags field (string)', () => {
			const cache = createMockCache([], '#project');
			const tags = getAllTags(cache);

			expect(tags).toContain('#project');
		});

		it('should extract tags from frontmatter tag field', () => {
			const cache: any = {
				frontmatter: { tag: '#work' },
				tags: []
			};
			const tags = getAllTags(cache);

			expect(tags).toContain('#work');
		});

		it('should extract inline tags', () => {
			const cache = createMockCache(['#inline-tag']);
			const tags = getAllTags(cache);

			expect(tags).toContain('#inline-tag');
		});

		it('should combine frontmatter and inline tags', () => {
			const cache = createMockCache(['#inline'], ['#frontmatter']);
			const tags = getAllTags(cache);

			expect(tags).toContain('#inline');
			expect(tags).toContain('#frontmatter');
		});

		it('should return empty array for file with no tags', () => {
			const cache = createMockCache([]);
			const tags = getAllTags(cache);

			expect(tags).toEqual([]);
		});
	});

	describe('createTagFilter()', () => {
		let fileMap: Map<string, CachedMetadata>;
		let app: App;

		beforeEach(() => {
			fileMap = new Map();
			app = createMockApp(fileMap);
		});

		it('should match files with exact tag', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache(['#project']));

			const filter = createTagFilter('#project', app);

			expect(filter(file)).toBe(true);
		});

		it('should match files with nested tags', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache(['#project/active']));

			const filter = createTagFilter('#project', app);

			expect(filter(file)).toBe(true);
		});

		it('should handle tag without # prefix in filter', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache(['#project']));

			const filter = createTagFilter('project', app);

			expect(filter(file)).toBe(true);
		});

		it('should not match files without the tag', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache(['#other']));

			const filter = createTagFilter('#project', app);

			expect(filter(file)).toBe(false);
		});

		it('should check both frontmatter and inline tags', () => {
			const file1 = createMockFile('file1.md');
			const file2 = createMockFile('file2.md');

			fileMap.set(file1.path, createMockCache([], ['#project'])); // Frontmatter
			fileMap.set(file2.path, createMockCache(['#project'])); // Inline

			const filter = createTagFilter('#project', app);

			expect(filter(file1)).toBe(true);
			expect(filter(file2)).toBe(true);
		});

		it('should return false for files with no cache', () => {
			const file = createMockFile('test.md');
			// No cache entry

			const filter = createTagFilter('#project', app);

			expect(filter(file)).toBe(false);
		});

		it('should match deeply nested tags', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache(['#project/active/urgent']));

			const filter = createTagFilter('#project', app);

			expect(filter(file)).toBe(true);
		});

		it('should not match partial tag names', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache(['#project']));

			const filter = createTagFilter('#proj', app);

			expect(filter(file)).toBe(false);
		});
	});

	describe('createFolderFilter()', () => {
		it('should match files in exact folder', () => {
			const file = createMockFile('Projects/file.md', 'Projects');

			const filter = createFolderFilter('Projects/');

			expect(filter(file)).toBe(true);
		});

		it('should match files in subfolders', () => {
			const file = createMockFile('Projects/Active/file.md', 'Projects/Active');

			const filter = createFolderFilter('Projects/');

			expect(filter(file)).toBe(true);
		});

		it('should not match files in different folder', () => {
			const file = createMockFile('Archive/file.md', 'Archive');

			const filter = createFolderFilter('Projects/');

			expect(filter(file)).toBe(false);
		});

		it('should handle folder path without trailing slash', () => {
			const file = createMockFile('Projects/file.md', 'Projects');

			const filter = createFolderFilter('Projects');

			expect(filter(file)).toBe(true);
		});

		it('should handle files at vault root', () => {
			const file = createMockFile('root.md');

			const filter = createFolderFilter('/');

			expect(filter(file)).toBe(true);
		});

		it('should not match vault root files with non-root filter', () => {
			const file = createMockFile('root.md');

			const filter = createFolderFilter('Projects/');

			expect(filter(file)).toBe(false);
		});

		it('should match deeply nested folders', () => {
			const file = createMockFile('A/B/C/D/file.md', 'A/B/C/D');

			const filter = createFolderFilter('A/');

			expect(filter(file)).toBe(true);
		});

		it('should not match folder name as substring', () => {
			const file = createMockFile('ProjectsOld/file.md', 'ProjectsOld');

			const filter = createFolderFilter('Projects/');

			expect(filter(file)).toBe(false);
		});

		it('should handle leading slash in filter path', () => {
			const file = createMockFile('Projects/file.md', 'Projects');

			const filter = createFolderFilter('/Projects/');

			expect(filter(file)).toBe(true);
		});
	});

	describe('createExclusionFilter()', () => {
		let fileMap: Map<string, CachedMetadata>;
		let app: App;

		beforeEach(() => {
			fileMap = new Map();
			app = createMockApp(fileMap);
		});

		it('should exclude specified notes', () => {
			const file = createMockFile('Archive.md');
			fileMap.set(file.path, createMockCache([]));

			const filter = createExclusionFilter('[[Archive]]', app);

			expect(filter(file)).toBe(false);
		});

		it('should parse comma-separated list', () => {
			const file1 = createMockFile('Archive.md');
			const file2 = createMockFile('Template.md');

			fileMap.set(file1.path, createMockCache([]));
			fileMap.set(file2.path, createMockCache([]));

			const filter = createExclusionFilter('[[Archive]], [[Template]]', app);

			expect(filter(file1)).toBe(false);
			expect(filter(file2)).toBe(false);
		});

		it('should handle wiki-link format', () => {
			const file = createMockFile('Note1.md');
			fileMap.set(file.path, createMockCache([]));

			const filter = createExclusionFilter('[[Note1]]', app);

			expect(filter(file)).toBe(false);
		});

		it('should handle aliases', () => {
			const file = createMockFile('Note.md');
			fileMap.set(file.path, createMockCache([]));

			const filter = createExclusionFilter('[[Note|Alias]]', app);

			expect(filter(file)).toBe(false);
		});

		it('should allow non-excluded files', () => {
			const excludedFile = createMockFile('Archive.md');
			const allowedFile = createMockFile('Active.md');

			fileMap.set(excludedFile.path, createMockCache([]));
			fileMap.set(allowedFile.path, createMockCache([]));

			const filter = createExclusionFilter('[[Archive]]', app);

			expect(filter(allowedFile)).toBe(true);
		});

		it('should handle empty exclusion items gracefully', () => {
			const file = createMockFile('test.md');

			const filter = createExclusionFilter('[[Archive]], , [[Template]]', app);

			expect(filter).toBeDefined();
		});

		it('should ignore non-existent files in exclusion list', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache([]));

			// NonExistent not in fileMap
			const filter = createExclusionFilter('[[NonExistent]]', app);

			// Should not crash and should allow other files
			expect(filter(file)).toBe(true);
		});
	});

	describe('buildFilterFunction()', () => {
		let fileMap: Map<string, CachedMetadata>;
		let app: App;

		beforeEach(() => {
			fileMap = new Map();
			app = createMockApp(fileMap);
		});

		it('should combine multiple filters with AND logic', () => {
			const file = createMockFile('Projects/Active/note.md', 'Projects/Active');
			fileMap.set(file.path, createMockCache(['#project']));

			const filter = buildFilterFunction({
				filterTag: '#project',
				filterFolder: 'Projects/'
			}, app);

			expect(filter).not.toBeNull();
			expect(filter!(file)).toBe(true);
		});

		it('should return null when no filters specified', () => {
			const filter = buildFilterFunction({}, app);

			expect(filter).toBeNull();
		});

		it('should handle single filter', () => {
			const file = createMockFile('test.md');
			fileMap.set(file.path, createMockCache(['#project']));

			const filter = buildFilterFunction({
				filterTag: '#project'
			}, app);

			expect(filter).not.toBeNull();
			expect(filter!(file)).toBe(true);
		});

		it('should handle all three filters together', () => {
			const file = createMockFile('Projects/note.md', 'Projects');
			const excludedFile = createMockFile('Projects/Archive.md', 'Projects');

			fileMap.set(file.path, createMockCache(['#active']));
			fileMap.set(excludedFile.path, createMockCache(['#active']));

			const filter = buildFilterFunction({
				filterTag: '#active',
				filterFolder: 'Projects/',
				exclude: '[[Archive]]'
			}, app);

			expect(filter).not.toBeNull();
			expect(filter!(file)).toBe(true);
			expect(filter!(excludedFile)).toBe(false);
		});

		it('should reject files that fail any filter', () => {
			const file = createMockFile('Archive/note.md', 'Archive');
			fileMap.set(file.path, createMockCache(['#project']));

			const filter = buildFilterFunction({
				filterTag: '#project',
				filterFolder: 'Projects/' // Wrong folder
			}, app);

			expect(filter).not.toBeNull();
			expect(filter!(file)).toBe(false);
		});
	});

	describe('countTreeNodes()', () => {
		it('should count nodes in simple tree', () => {
			const tree: TreeNode = {
				file: createMockFile('A.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: [
					{
						file: createMockFile('B.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: [
							{
								file: createMockFile('C.md'),
								depth: 2,
								isCycle: false,
								metadata: {},
								children: []
							}
						]
					}
				]
			};

			expect(countTreeNodes(tree)).toBe(3);
		});

		it('should count nodes in branching tree', () => {
			const tree: TreeNode = {
				file: createMockFile('A.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: [
					{
						file: createMockFile('B.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: []
					},
					{
						file: createMockFile('C.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: []
					}
				]
			};

			expect(countTreeNodes(tree)).toBe(3);
		});

		it('should count nodes in array of trees', () => {
			const trees: TreeNode[] = [
				{
					file: createMockFile('A.md'),
					depth: 0,
					isCycle: false,
					metadata: {},
					children: []
				},
				{
					file: createMockFile('B.md'),
					depth: 0,
					isCycle: false,
					metadata: {},
					children: []
				}
			];

			expect(countTreeNodes(trees)).toBe(2);
		});

		it('should return 0 for null tree', () => {
			expect(countTreeNodes(null)).toBe(0);
		});

		it('should count single node with no children', () => {
			const tree: TreeNode = {
				file: createMockFile('A.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: []
			};

			expect(countTreeNodes(tree)).toBe(1);
		});

		it('should count complex nested tree', () => {
			const tree: TreeNode = {
				file: createMockFile('root.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: [
					{
						file: createMockFile('A.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: [
							{
								file: createMockFile('A1.md'),
								depth: 2,
								isCycle: false,
								metadata: {},
								children: []
							},
							{
								file: createMockFile('A2.md'),
								depth: 2,
								isCycle: false,
								metadata: {},
								children: []
							}
						]
					},
					{
						file: createMockFile('B.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: [
							{
								file: createMockFile('B1.md'),
								depth: 2,
								isCycle: false,
								metadata: {},
								children: []
							}
						]
					}
				]
			};

			// root + A + A1 + A2 + B + B1 = 6
			expect(countTreeNodes(tree)).toBe(6);
		});
	});

	describe('truncateTree()', () => {
		it('should truncate tree to max nodes', () => {
			const tree: TreeNode = {
				file: createMockFile('root.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: [
					{
						file: createMockFile('A.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: []
					},
					{
						file: createMockFile('B.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: []
					},
					{
						file: createMockFile('C.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: []
					}
				]
			};

			const { tree: truncated, truncatedCount } = truncateTree(tree, 2);

			// Should keep root + 1 child
			expect(countTreeNodes(truncated)).toBe(2);
			expect(truncatedCount).toBe(2); // B and C truncated
		});

		it('should return truncated count', () => {
			const tree: TreeNode = {
				file: createMockFile('root.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: Array.from({ length: 10 }, (_, i) => ({
					file: createMockFile(`child${i}.md`),
					depth: 1,
					isCycle: false,
					metadata: {},
					children: []
				}))
			};

			const { truncatedCount } = truncateTree(tree, 5);

			// 1 root + 4 children = 5 kept, 6 truncated
			expect(truncatedCount).toBe(6);
		});

		it('should preserve tree structure up to limit', () => {
			const tree: TreeNode = {
				file: createMockFile('root.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: [
					{
						file: createMockFile('A.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: [
							{
								file: createMockFile('A1.md'),
								depth: 2,
								isCycle: false,
								metadata: {},
								children: []
							}
						]
					}
				]
			};

			const { tree: truncated } = truncateTree(tree, 2);

			// Should keep root and A, but not A1
			expect(countTreeNodes(truncated)).toBe(2);
			expect((truncated as TreeNode).children).toHaveLength(1);
			expect((truncated as TreeNode).children[0].children).toHaveLength(0);
		});

		it('should handle array of trees', () => {
			const trees: TreeNode[] = [
				{
					file: createMockFile('A.md'),
					depth: 0,
					isCycle: false,
					metadata: {},
					children: []
				},
				{
					file: createMockFile('B.md'),
					depth: 0,
					isCycle: false,
					metadata: {},
					children: []
				},
				{
					file: createMockFile('C.md'),
					depth: 0,
					isCycle: false,
					metadata: {},
					children: []
				}
			];

			const { tree: truncated, truncatedCount } = truncateTree(trees, 2);

			expect(Array.isArray(truncated)).toBe(true);
			expect((truncated as TreeNode[]).length).toBe(2);
			expect(truncatedCount).toBe(1);
		});

		it('should not truncate if under limit', () => {
			const tree: TreeNode = {
				file: createMockFile('root.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: [
					{
						file: createMockFile('A.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: []
					}
				]
			};

			const { tree: truncated, truncatedCount } = truncateTree(tree, 100);

			expect(countTreeNodes(truncated)).toBe(2);
			expect(truncatedCount).toBe(0);
		});

		it('should handle null tree', () => {
			const { tree, truncatedCount } = truncateTree(null, 5);

			expect(tree).toBeNull();
			expect(truncatedCount).toBe(0);
		});

		it('should handle max-nodes of 1', () => {
			const tree: TreeNode = {
				file: createMockFile('root.md'),
				depth: 0,
				isCycle: false,
				metadata: {},
				children: [
					{
						file: createMockFile('A.md'),
						depth: 1,
						isCycle: false,
						metadata: {},
						children: []
					}
				]
			};

			const { tree: truncated, truncatedCount } = truncateTree(tree, 1);

			expect(countTreeNodes(truncated)).toBe(1);
			expect(truncatedCount).toBe(1);
			expect((truncated as TreeNode).children).toHaveLength(0);
		});
	});
});
