import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveNoteReference, getCurrentNote } from '../src/codeblock-processor';
import { App, TFile } from 'obsidian';

describe('Codeblock Processor', () => {
	describe('resolveNoteReference()', () => {
		let mockApp: any;
		let mockFile: TFile;

		beforeEach(() => {
			mockFile = {
				path: 'test/note.md',
				basename: 'note',
				name: 'note.md'
			} as TFile;

			mockApp = {
				metadataCache: {
					getFirstLinkpathDest: vi.fn().mockReturnValue(mockFile)
				}
			} as any;
		});

		it('should resolve wiki-link format', () => {
			const result = resolveNoteReference('[[My Note]]', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'My Note',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should resolve plain file path', () => {
			const result = resolveNoteReference('path/to/note.md', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'path/to/note.md',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should handle link with alias', () => {
			const result = resolveNoteReference('[[My Note|Alias]]', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'My Note',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should handle link with heading', () => {
			const result = resolveNoteReference('[[My Note#Heading]]', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'My Note',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should handle link with both alias and heading', () => {
			const result = resolveNoteReference('[[My Note#Heading|Alias]]', 'source.md', mockApp);

			// Should strip both alias and heading, leaving just the note name
			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'My Note',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should return null for nonexistent note', () => {
			mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(null);

			const result = resolveNoteReference('[[Does Not Exist]]', 'source.md', mockApp);

			expect(result).toBeNull();
		});

		it('should handle note reference without brackets', () => {
			const result = resolveNoteReference('My Note', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'My Note',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should trim whitespace from note reference', () => {
			const result = resolveNoteReference('  [[My Note]]  ', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'My Note',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should handle empty brackets', () => {
			const result = resolveNoteReference('[[]]', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});

		it('should handle note with special characters', () => {
			const result = resolveNoteReference('[[Note with spaces & special-chars]]', 'source.md', mockApp);

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'Note with spaces & special-chars',
				'source.md'
			);
			expect(result).toBe(mockFile);
		});
	});

	describe('getCurrentNote()', () => {
		it('should return active file', () => {
			const mockFile = {
				path: 'current.md',
				basename: 'current'
			} as TFile;

			const mockApp = {
				workspace: {
					getActiveFile: vi.fn().mockReturnValue(mockFile)
				}
			} as any;

			const result = getCurrentNote(mockApp);

			expect(result).toBe(mockFile);
			expect(mockApp.workspace.getActiveFile).toHaveBeenCalled();
		});

		it('should return null when no active file', () => {
			const mockApp = {
				workspace: {
					getActiveFile: vi.fn().mockReturnValue(null)
				}
			} as any;

			const result = getCurrentNote(mockApp);

			expect(result).toBeNull();
		});
	});

	describe('CodeblockProcessor Integration', () => {
		// Note: Full integration tests would require mocking the entire plugin
		// and Obsidian API. These are more appropriate for manual testing.
		// The unit tests above cover the key utility functions.

		it('should exist as a placeholder for future integration tests', () => {
			// This test serves as a placeholder and documentation that
			// full integration testing should be done manually or with
			// a more complete test harness.
			expect(true).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('should handle undefined note reference gracefully', () => {
			const mockApp = {
				metadataCache: {
					getFirstLinkpathDest: vi.fn().mockReturnValue(null)
				}
			} as any;

			const result = resolveNoteReference('', 'source.md', mockApp);

			expect(result).toBeNull();
		});

		it('should handle malformed wiki-links', () => {
			const mockApp = {
				metadataCache: {
					getFirstLinkpathDest: vi.fn().mockReturnValue(null)
				}
			} as any;

			// Only opening brackets
			const result1 = resolveNoteReference('[[Note', 'source.md', mockApp);
			expect(result1).toBeNull();

			// Only closing brackets
			const result2 = resolveNoteReference('Note]]', 'source.md', mockApp);
			expect(result2).toBeNull();
		});
	});
});
