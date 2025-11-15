import { describe, it, expect, vi } from 'vitest';
import { FilterConfig, createFilter, FilterPresets } from '@/tree-filters';
import { TFile, MetadataCache, CachedMetadata } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
function createMockFile(
	path: string,
	basename: string,
	ctime: number = Date.now(),
	mtime: number = Date.now(),
	size: number = 100
): TFile {
	return {
		path,
		basename,
		name: basename + '.md',
		extension: 'md',
		vault: {} as any,
		parent: null,
		stat: { ctime, mtime, size }
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

describe('Tree Filters', () => {
	describe('createFilter', () => {
		it('should return filter that includes all files when no config provided', () => {
			const config: FilterConfig = {};
			const metadataCache = createMockMetadataCache(new Map());
			const filter = createFilter(config, metadataCache);

			const file = createMockFile('test.md', 'test');
			expect(filter(file)).toBe(true);
		});

		it('should filter by included tags', () => {
			const fileMetadata = new Map<string, CachedMetadata>();
			fileMetadata.set('tagged.md', {
				tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }],
			} as CachedMetadata);
			fileMetadata.set('untagged.md', {} as CachedMetadata);

			const config: FilterConfig = {
				includeTags: ['#important']
			};

			const metadataCache = createMockMetadataCache(fileMetadata);
			const filter = createFilter(config, metadataCache);

			const taggedFile = createMockFile('tagged.md', 'tagged');
			const untaggedFile = createMockFile('untagged.md', 'untagged');

			expect(filter(taggedFile)).toBe(true);
			expect(filter(untaggedFile)).toBe(false);
		});

		it('should filter by excluded tags', () => {
			const fileMetadata = new Map<string, CachedMetadata>();
			fileMetadata.set('archived.md', {
				tags: [{ tag: '#archived', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }],
			} as CachedMetadata);
			fileMetadata.set('active.md', {} as CachedMetadata);

			const config: FilterConfig = {
				excludeTags: ['#archived']
			};

			const metadataCache = createMockMetadataCache(fileMetadata);
			const filter = createFilter(config, metadataCache);

			const archivedFile = createMockFile('archived.md', 'archived');
			const activeFile = createMockFile('active.md', 'active');

			expect(filter(archivedFile)).toBe(false);
			expect(filter(activeFile)).toBe(true);
		});

		it('should handle tags from frontmatter', () => {
			const fileMetadata = new Map<string, CachedMetadata>();
			fileMetadata.set('frontmatter-tagged.md', {
				frontmatter: { tags: ['important', 'todo'] }
			} as CachedMetadata);

			const config: FilterConfig = {
				includeTags: ['#important']
			};

			const metadataCache = createMockMetadataCache(fileMetadata);
			const filter = createFilter(config, metadataCache);

			const file = createMockFile('frontmatter-tagged.md', 'frontmatter-tagged');
			expect(filter(file)).toBe(true);
		});

		it('should normalize tags with and without # prefix', () => {
			const fileMetadata = new Map<string, CachedMetadata>();
			fileMetadata.set('test.md', {
				tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }],
			} as CachedMetadata);

			const config1: FilterConfig = { includeTags: ['#important'] };
			const config2: FilterConfig = { includeTags: ['important'] };

			const metadataCache = createMockMetadataCache(fileMetadata);
			const filter1 = createFilter(config1, metadataCache);
			const filter2 = createFilter(config2, metadataCache);

			const file = createMockFile('test.md', 'test');
			expect(filter1(file)).toBe(true);
			expect(filter2(file)).toBe(true);
		});

		it('should filter by included folders', () => {
			const config: FilterConfig = {
				includeFolders: ['projects/', 'work/']
			};

			const metadataCache = createMockMetadataCache(new Map());
			const filter = createFilter(config, metadataCache);

			const projectFile = createMockFile('projects/test.md', 'test');
			const workFile = createMockFile('work/report.md', 'report');
			const otherFile = createMockFile('personal/note.md', 'note');

			expect(filter(projectFile)).toBe(true);
			expect(filter(workFile)).toBe(true);
			expect(filter(otherFile)).toBe(false);
		});

		it('should filter by excluded folders', () => {
			const config: FilterConfig = {
				excludeFolders: ['archive/', 'templates/']
			};

			const metadataCache = createMockMetadataCache(new Map());
			const filter = createFilter(config, metadataCache);

			const archivedFile = createMockFile('archive/old.md', 'old');
			const templateFile = createMockFile('templates/template.md', 'template');
			const normalFile = createMockFile('notes/note.md', 'note');

			expect(filter(archivedFile)).toBe(false);
			expect(filter(templateFile)).toBe(false);
			expect(filter(normalFile)).toBe(true);
		});

		it('should use custom predicate', () => {
			const config: FilterConfig = {
				predicate: (file) => file.stat.size > 500
			};

			const metadataCache = createMockMetadataCache(new Map());
			const filter = createFilter(config, metadataCache);

			const largeFile = createMockFile('large.md', 'large', Date.now(), Date.now(), 1000);
			const smallFile = createMockFile('small.md', 'small', Date.now(), Date.now(), 100);

			expect(filter(largeFile)).toBe(true);
			expect(filter(smallFile)).toBe(false);
		});

		it('should combine filters with AND mode', () => {
			const fileMetadata = new Map<string, CachedMetadata>();
			fileMetadata.set('projects/important.md', {
				tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }],
			} as CachedMetadata);
			fileMetadata.set('projects/normal.md', {} as CachedMetadata);
			fileMetadata.set('personal/important.md', {
				tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }],
			} as CachedMetadata);

			const config: FilterConfig = {
				includeTags: ['#important'],
				includeFolders: ['projects/'],
				mode: 'and'
			};

			const metadataCache = createMockMetadataCache(fileMetadata);
			const filter = createFilter(config, metadataCache);

			const projectImportant = createMockFile('projects/important.md', 'important');
			const projectNormal = createMockFile('projects/normal.md', 'normal');
			const personalImportant = createMockFile('personal/important.md', 'important');

			expect(filter(projectImportant)).toBe(true);  // Has both tag AND folder
			expect(filter(projectNormal)).toBe(false);    // Has folder but not tag
			expect(filter(personalImportant)).toBe(false); // Has tag but not folder
		});

		it('should combine filters with OR mode', () => {
			const fileMetadata = new Map<string, CachedMetadata>();
			fileMetadata.set('projects/important.md', {
				tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }],
			} as CachedMetadata);
			fileMetadata.set('projects/normal.md', {} as CachedMetadata);
			fileMetadata.set('personal/important.md', {
				tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 10, offset: 10 } } }],
			} as CachedMetadata);
			fileMetadata.set('personal/normal.md', {} as CachedMetadata);

			const config: FilterConfig = {
				includeTags: ['#important'],
				includeFolders: ['projects/'],
				mode: 'or'
			};

			const metadataCache = createMockMetadataCache(fileMetadata);
			const filter = createFilter(config, metadataCache);

			const projectImportant = createMockFile('projects/important.md', 'important');
			const projectNormal = createMockFile('projects/normal.md', 'normal');
			const personalImportant = createMockFile('personal/important.md', 'important');
			const personalNormal = createMockFile('personal/normal.md', 'normal');

			expect(filter(projectImportant)).toBe(true);   // Has both
			expect(filter(projectNormal)).toBe(true);      // Has folder
			expect(filter(personalImportant)).toBe(true);  // Has tag
			expect(filter(personalNormal)).toBe(false);    // Has neither
		});
	});

	describe('FilterPresets', () => {
		it('should filter markdown only files', () => {
			const mdFile = { extension: 'md' } as TFile;
			const pdfFile = { extension: 'pdf' } as TFile;

			expect(FilterPresets.markdownOnly(mdFile)).toBe(true);
			expect(FilterPresets.markdownOnly(pdfFile)).toBe(false);
		});

		it('should exclude attachments folder', () => {
			const attachmentFile = { path: 'attachments/image.png' } as TFile;
			const normalFile = { path: 'notes/note.md' } as TFile;

			expect(FilterPresets.noAttachments(attachmentFile)).toBe(false);
			expect(FilterPresets.noAttachments(normalFile)).toBe(true);
		});

		it('should exclude templates folder', () => {
			const templateFile = { path: 'templates/template.md' } as TFile;
			const normalFile = { path: 'notes/note.md' } as TFile;

			expect(FilterPresets.noTemplates(templateFile)).toBe(false);
			expect(FilterPresets.noTemplates(normalFile)).toBe(true);
		});

		it('should filter recently modified files', () => {
			const now = Date.now();
			const recentFile = createMockFile('recent.md', 'recent', now, now - 3 * 24 * 60 * 60 * 1000); // 3 days ago
			const oldFile = createMockFile('old.md', 'old', now, now - 10 * 24 * 60 * 60 * 1000); // 10 days ago

			expect(FilterPresets.recentlyModified(recentFile)).toBe(true);
			expect(FilterPresets.recentlyModified(oldFile)).toBe(false);
		});

		it('should filter recently created files', () => {
			const now = Date.now();
			const recentFile = createMockFile('recent.md', 'recent', now - 15 * 24 * 60 * 60 * 1000); // 15 days ago
			const oldFile = createMockFile('old.md', 'old', now - 45 * 24 * 60 * 60 * 1000); // 45 days ago

			expect(FilterPresets.recentlyCreated(recentFile)).toBe(true);
			expect(FilterPresets.recentlyCreated(oldFile)).toBe(false);
		});
	});
});
