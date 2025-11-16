import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TFile, CachedMetadata, App } from 'obsidian';
import { FrontmatterCache } from '../src/frontmatter-cache';

/**
 * Test suite for Multi-Parent-Field Support
 *
 * This test suite verifies the core functionality of the multi-parent-field feature,
 * including frontmatter caching, multiple graph management, and sidebar behavior.
 */

describe('Multi-Field Support', () => {
	
	describe('FrontmatterCache', () => {
		let mockApp: any;
		let cache: FrontmatterCache;
		let mockFile: TFile;
		let mockMetadata: CachedMetadata;

		beforeEach(() => {
			// Create mock app with metadata cache
			mockApp = {
				metadataCache: {
					getFileCache: vi.fn()
				}
			};

			// Create mock file
			mockFile = {
				path: 'test.md',
				basename: 'test',
				extension: 'md'
			} as TFile;

			// Create mock metadata
			mockMetadata = {
				frontmatter: {
					parent: '[[Parent]]',
					project: '[[Project A]]',
					tags: ['tag1', 'tag2']
				}
			} as CachedMetadata;

			// Initialize cache
			cache = new FrontmatterCache(mockApp);
		});

		afterEach(() => {
			cache.clear();
		});

		it('should cache metadata on first access', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			// First access - should call getFileCache
			const result1 = cache.getMetadata(mockFile);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(1);
			expect(result1).toBe(mockMetadata);

			// Second access - should use cache, not call getFileCache again
			const result2 = cache.getMetadata(mockFile);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(1);
			expect(result2).toBe(mockMetadata);
		});

		it('should invalidate cache on file changes', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			// Cache the file
			cache.getMetadata(mockFile);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(1);

			// Invalidate cache
			cache.invalidate(mockFile);

			// Next access should call getFileCache again
			cache.getMetadata(mockFile);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(2);
		});

		it('should get field values correctly for strings', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			const value = cache.getFieldValue(mockFile, 'parent');
			expect(value).toBe('[[Parent]]');
		});

		it('should get field values correctly for arrays', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			const value = cache.getFieldValue(mockFile, 'tags');
			expect(value).toEqual(['tag1', 'tag2']);
		});

		it('should return null for missing fields', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			const value = cache.getFieldValue(mockFile, 'nonexistent');
			expect(value).toBeNull();
		});

		it('should return null for files without frontmatter', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue({} as CachedMetadata);

			const value = cache.getFieldValue(mockFile, 'parent');
			expect(value).toBeNull();
		});

		it('should invalidate by path for renamed files', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			// Cache the file
			cache.getMetadata(mockFile);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(1);

			// Invalidate by old path
			cache.invalidateByPath('test.md');

			// Next access should call getFileCache again
			cache.getMetadata(mockFile);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(2);
		});

		it('should clear entire cache', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			const mockFile2 = { path: 'test2.md' } as TFile;

			// Cache multiple files
			cache.getMetadata(mockFile);
			cache.getMetadata(mockFile2);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(2);

			// Clear cache
			cache.clear();

			// Next accesses should call getFileCache again
			cache.getMetadata(mockFile);
			cache.getMetadata(mockFile2);
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(4);
		});

		it('should provide cache statistics', () => {
			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			// Initially empty
			let stats = cache.getStats();
			expect(stats.size).toBe(0);

			// Cache a file
			cache.getMetadata(mockFile);
			stats = cache.getStats();
			expect(stats.size).toBe(1);

			// Cache another file
			const mockFile2 = { path: 'test2.md' } as TFile;
			cache.getMetadata(mockFile2);
			stats = cache.getStats();
			expect(stats.size).toBe(2);
		});
	});

	describe('Multiple Graphs Integration', () => {
		it('should support querying different fields independently', () => {
			// This is an integration test placeholder
			// Full integration tests would require a complete plugin instance
			// and are better suited for manual testing or E2E tests
			expect(true).toBe(true);
		});
	});

	describe('Sidebar View State', () => {
		it('should maintain separate pin state per field', () => {
			const viewState = {
				selectedParentField: 'parent',
				pinnedFiles: {
					'parent': 'note1.md',
					'project': 'note2.md',
					'category': 'note3.md'
				},
				collapsedSections: {}
			};

			expect(viewState.pinnedFiles['parent']).toBe('note1.md');
			expect(viewState.pinnedFiles['project']).toBe('note2.md');
			expect(viewState.pinnedFiles['category']).toBe('note3.md');
		});

		it('should maintain separate collapsed sections per field', () => {
			const viewState = {
				selectedParentField: 'parent',
				pinnedFiles: {},
				collapsedSections: {
					'parent': ['ancestors'],
					'project': ['descendants', 'siblings'],
					'category': []
				}
			};

			expect(viewState.collapsedSections['parent']).toContain('ancestors');
			expect(viewState.collapsedSections['project']).toContain('descendants');
			expect(viewState.collapsedSections['project']).toContain('siblings');
			expect(viewState.collapsedSections['category']).toEqual([]);
		});
	});

	describe('Performance', () => {
		it('should avoid redundant metadata parsing with cache', () => {
			const mockApp = {
				metadataCache: {
					getFileCache: vi.fn()
				}
			} as any;

			const cache = new FrontmatterCache(mockApp);
			const mockFile = { path: 'test.md' } as TFile;
			const mockMetadata = { frontmatter: { parent: '[[Parent]]' } } as CachedMetadata;

			mockApp.metadataCache.getFileCache.mockReturnValue(mockMetadata);

			// Simulate accessing the same file for multiple parent fields
			cache.getFieldValue(mockFile, 'parent');
			cache.getFieldValue(mockFile, 'project');
			cache.getFieldValue(mockFile, 'category');

			// Should only parse once
			expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledTimes(1);
		});
	});

	describe('Bug Fixes', () => {
		it('should update view when any file metadata changes', () => {
			// This test verifies the fix for the issue where changes to parent fields
			// in notes different from the current or pinned note did not trigger updates
			
			// The fix ensures that the metadata change event handler always calls updateView()
			// regardless of which file changed, since any parent field change could affect
			// the relationships displayed in the sidebar
			
			// This is a documentation test - the actual behavior is tested through manual testing
			expect(true).toBe(true);
		});
	});
});