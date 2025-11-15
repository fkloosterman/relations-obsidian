import { describe, it, expect } from 'vitest';
import { SortConfig, createComparator, sortTreeNodes, SortPresets } from '@/tree-sorters';
import { TreeNode } from '@/tree-model';
import { TFile } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
function createMockFile(
	basename: string,
	ctime: number = Date.now(),
	mtime: number = Date.now(),
	size: number = 100
): TFile {
	return {
		path: `${basename}.md`,
		basename,
		name: basename + '.md',
		extension: 'md',
		vault: {} as any,
		parent: null,
		stat: { ctime, mtime, size }
	} as TFile;
}

/**
 * Helper to create mock TreeNode
 */
function createMockTreeNode(file: TFile, children: TreeNode[] = []): TreeNode {
	return {
		file,
		children,
		depth: 0,
		isCycle: false,
		metadata: {}
	};
}

describe('Tree Sorters', () => {
	describe('createComparator', () => {
		it('should sort alphabetically ascending', () => {
			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'asc'
			};

			const comparator = createComparator(config);

			const fileA = createMockFile('Alpha');
			const fileB = createMockFile('Beta');
			const fileC = createMockFile('Gamma');

			expect(comparator(fileA, fileB)).toBeLessThan(0);
			expect(comparator(fileB, fileC)).toBeLessThan(0);
			expect(comparator(fileC, fileA)).toBeGreaterThan(0);
		});

		it('should sort alphabetically descending', () => {
			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'desc'
			};

			const comparator = createComparator(config);

			const fileA = createMockFile('Alpha');
			const fileB = createMockFile('Beta');
			const fileC = createMockFile('Gamma');

			expect(comparator(fileA, fileB)).toBeGreaterThan(0);
			expect(comparator(fileB, fileC)).toBeGreaterThan(0);
			expect(comparator(fileC, fileA)).toBeLessThan(0);
		});

		it('should sort by creation date ascending', () => {
			const config: SortConfig = {
				criteria: 'created',
				order: 'asc'
			};

			const comparator = createComparator(config);

			const old = createMockFile('old', 1000);
			const middle = createMockFile('middle', 2000);
			const recent = createMockFile('recent', 3000);

			expect(comparator(old, middle)).toBeLessThan(0);
			expect(comparator(middle, recent)).toBeLessThan(0);
			expect(comparator(recent, old)).toBeGreaterThan(0);
		});

		it('should sort by creation date descending (newest first)', () => {
			const config: SortConfig = {
				criteria: 'created',
				order: 'desc'
			};

			const comparator = createComparator(config);

			const old = createMockFile('old', 1000);
			const recent = createMockFile('recent', 3000);

			expect(comparator(recent, old)).toBeLessThan(0);
			expect(comparator(old, recent)).toBeGreaterThan(0);
		});

		it('should sort by modification date', () => {
			const config: SortConfig = {
				criteria: 'modified',
				order: 'asc'
			};

			const comparator = createComparator(config);

			const old = createMockFile('old', Date.now(), 1000);
			const recent = createMockFile('recent', Date.now(), 3000);

			expect(comparator(old, recent)).toBeLessThan(0);
			expect(comparator(recent, old)).toBeGreaterThan(0);
		});

		it('should sort by file size', () => {
			const config: SortConfig = {
				criteria: 'size',
				order: 'asc'
			};

			const comparator = createComparator(config);

			const small = createMockFile('small', Date.now(), Date.now(), 100);
			const large = createMockFile('large', Date.now(), Date.now(), 1000);

			expect(comparator(small, large)).toBeLessThan(0);
			expect(comparator(large, small)).toBeGreaterThan(0);
		});

		it('should use custom comparator', () => {
			const config: SortConfig = {
				criteria: 'custom',
				comparator: (a, b) => a.basename.length - b.basename.length
			};

			const comparator = createComparator(config);

			const short = createMockFile('ab');
			const long = createMockFile('abcdef');

			expect(comparator(short, long)).toBeLessThan(0);
			expect(comparator(long, short)).toBeGreaterThan(0);
		});

		it('should throw error if custom criteria without comparator', () => {
			const config: SortConfig = {
				criteria: 'custom'
			};

			expect(() => createComparator(config)).toThrow('Custom sort requires a comparator function');
		});

		it('should default to ascending order if not specified', () => {
			const config: SortConfig = {
				criteria: 'alphabetical'
			};

			const comparator = createComparator(config);

			const fileA = createMockFile('Alpha');
			const fileB = createMockFile('Beta');

			expect(comparator(fileA, fileB)).toBeLessThan(0);
		});
	});

	describe('sortTreeNodes', () => {
		it('should sort nodes by file basename', () => {
			const nodes: TreeNode[] = [
				createMockTreeNode(createMockFile('Gamma')),
				createMockTreeNode(createMockFile('Alpha')),
				createMockTreeNode(createMockFile('Beta'))
			];

			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'asc'
			};

			const sorted = sortTreeNodes(nodes, config);

			expect(sorted[0].file.basename).toBe('Alpha');
			expect(sorted[1].file.basename).toBe('Beta');
			expect(sorted[2].file.basename).toBe('Gamma');
		});

		it('should not modify original array when inPlace is false', () => {
			const nodes: TreeNode[] = [
				createMockTreeNode(createMockFile('Gamma')),
				createMockTreeNode(createMockFile('Alpha')),
				createMockTreeNode(createMockFile('Beta'))
			];

			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'asc'
			};

			const sorted = sortTreeNodes(nodes, config, false);

			// Original should be unchanged
			expect(nodes[0].file.basename).toBe('Gamma');
			// Sorted should be different
			expect(sorted[0].file.basename).toBe('Alpha');
			// Should be different arrays
			expect(sorted).not.toBe(nodes);
		});

		it('should modify original array when inPlace is true', () => {
			const nodes: TreeNode[] = [
				createMockTreeNode(createMockFile('Gamma')),
				createMockTreeNode(createMockFile('Alpha')),
				createMockTreeNode(createMockFile('Beta'))
			];

			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'asc'
			};

			const sorted = sortTreeNodes(nodes, config, true);

			// Original should be changed
			expect(nodes[0].file.basename).toBe('Alpha');
			// Should be same array
			expect(sorted).toBe(nodes);
		});

		it('should recursively sort children when recursive is true', () => {
			const nodes: TreeNode[] = [
				createMockTreeNode(createMockFile('Parent'), [
					createMockTreeNode(createMockFile('Child-C')),
					createMockTreeNode(createMockFile('Child-A')),
					createMockTreeNode(createMockFile('Child-B'))
				])
			];

			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'asc',
				recursive: true
			};

			const sorted = sortTreeNodes(nodes, config);

			expect(sorted[0].children[0].file.basename).toBe('Child-A');
			expect(sorted[0].children[1].file.basename).toBe('Child-B');
			expect(sorted[0].children[2].file.basename).toBe('Child-C');
		});

		it('should not sort children when recursive is false', () => {
			const nodes: TreeNode[] = [
				createMockTreeNode(createMockFile('Parent'), [
					createMockTreeNode(createMockFile('Child-C')),
					createMockTreeNode(createMockFile('Child-A')),
					createMockTreeNode(createMockFile('Child-B'))
				])
			];

			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'asc',
				recursive: false
			};

			const sorted = sortTreeNodes(nodes, config);

			// Children should remain unsorted
			expect(sorted[0].children[0].file.basename).toBe('Child-C');
			expect(sorted[0].children[1].file.basename).toBe('Child-A');
			expect(sorted[0].children[2].file.basename).toBe('Child-B');
		});

		it('should sort multi-level tree recursively', () => {
			const nodes: TreeNode[] = [
				createMockTreeNode(createMockFile('Root'), [
					createMockTreeNode(createMockFile('B'), [
						createMockTreeNode(createMockFile('B2')),
						createMockTreeNode(createMockFile('B1'))
					]),
					createMockTreeNode(createMockFile('A'), [
						createMockTreeNode(createMockFile('A2')),
						createMockTreeNode(createMockFile('A1'))
					])
				])
			];

			const config: SortConfig = {
				criteria: 'alphabetical',
				order: 'asc',
				recursive: true
			};

			const sorted = sortTreeNodes(nodes, config);

			// First level children sorted
			expect(sorted[0].children[0].file.basename).toBe('A');
			expect(sorted[0].children[1].file.basename).toBe('B');

			// Second level children sorted
			expect(sorted[0].children[0].children[0].file.basename).toBe('A1');
			expect(sorted[0].children[0].children[1].file.basename).toBe('A2');
			expect(sorted[0].children[1].children[0].file.basename).toBe('B1');
			expect(sorted[0].children[1].children[1].file.basename).toBe('B2');
		});
	});

	describe('SortPresets', () => {
		it('should have alphabetical preset', () => {
			expect(SortPresets.alphabetical).toEqual({
				criteria: 'alphabetical',
				order: 'asc'
			});
		});

		it('should have alphabeticalReverse preset', () => {
			expect(SortPresets.alphabeticalReverse).toEqual({
				criteria: 'alphabetical',
				order: 'desc'
			});
		});

		it('should have newestFirst preset', () => {
			expect(SortPresets.newestFirst).toEqual({
				criteria: 'modified',
				order: 'desc'
			});
		});

		it('should have oldestFirst preset', () => {
			expect(SortPresets.oldestFirst).toEqual({
				criteria: 'modified',
				order: 'asc'
			});
		});

		it('should have recentlyCreated preset', () => {
			expect(SortPresets.recentlyCreated).toEqual({
				criteria: 'created',
				order: 'desc'
			});
		});

		it('should have largestFirst preset', () => {
			expect(SortPresets.largestFirst).toEqual({
				criteria: 'size',
				order: 'desc'
			});
		});

		it('should work with sortTreeNodes function', () => {
			const nodes: TreeNode[] = [
				createMockTreeNode(createMockFile('Gamma')),
				createMockTreeNode(createMockFile('Alpha')),
				createMockTreeNode(createMockFile('Beta'))
			];

			const sorted = sortTreeNodes(nodes, SortPresets.alphabetical);

			expect(sorted[0].file.basename).toBe('Alpha');
			expect(sorted[1].file.basename).toBe('Beta');
			expect(sorted[2].file.basename).toBe('Gamma');
		});
	});
});
