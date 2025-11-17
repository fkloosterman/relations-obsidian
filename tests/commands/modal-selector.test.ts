import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App, TFile, TFolder } from 'obsidian';
import { NoteSelectorModal } from '../../src/commands/modal-selector';

// Helper to create Obsidian-compatible HTMLElement
function createObsidianElement(): HTMLElement {
	const el = document.createElement('div');

	// Add Obsidian-specific methods
	(el as any).empty = function() {
		this.innerHTML = '';
		return this;
	};

	(el as any).createEl = function(tag: string, attrs?: any) {
		const child = document.createElement(tag);
		if (attrs?.text) {
			child.textContent = attrs.text;
		}
		if (attrs?.cls) {
			child.className = attrs.cls;
		}
		this.appendChild(child);
		return child;
	};

	(el as any).createDiv = function(cls?: string) {
		const child = document.createElement('div');
		if (cls) {
			child.className = cls;
		}
		this.appendChild(child);

		// Make child elements also have Obsidian methods
		(child as any).createDiv = this.createDiv;
		(child as any).setText = function(text: string) {
			this.textContent = text;
		};
		(child as any).addClass = function(className: string) {
			this.classList.add(className);
		};
		(child as any).removeClass = function(className: string) {
			this.classList.remove(className);
		};

		return child;
	};

	return el;
}

describe('NoteSelectorModal', () => {
	let app: App;
	let mockNotes: TFile[];
	let onSelectCallback: (note: TFile) => void;

	beforeEach(() => {
		// Create mock app
		app = {} as App;

		// Create mock notes with proper structure
		const createMockFile = (basename: string, path: string, parentPath: string): TFile => {
			const parent = parentPath === '/' ? null : {
				path: parentPath,
				name: parentPath.split('/').pop() || ''
			} as TFolder;

			return {
				basename,
				path,
				parent,
				extension: 'md',
				name: `${basename}.md`,
				vault: {} as any,
				stat: { ctime: 0, mtime: 0, size: 0 }
			} as TFile;
		};

		mockNotes = [
			createMockFile('Note 1', 'folder1/Note 1.md', 'folder1'),
			createMockFile('Note 2', 'folder2/Note 2.md', 'folder2'),
			createMockFile('Note 3', 'Note 3.md', '/')
		];

		onSelectCallback = vi.fn();
	});

	describe('Constructor', () => {
		it('should create modal with provided parameters', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			expect(modal).toBeDefined();
			expect(modal instanceof NoteSelectorModal).toBe(true);
		});

		it('should store notes array', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			// Access private property for testing
			expect((modal as any).notes).toBe(mockNotes);
		});

		it('should store title', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Custom Title',
				onSelectCallback
			);

			expect((modal as any).title).toBe('Custom Title');
		});

		it('should store callback function', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			expect((modal as any).onSelect).toBe(onSelectCallback);
		});
	});

	describe('Modal Rendering', () => {
		it('should render title element', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Select a Note',
				onSelectCallback
			);

			// Mock contentEl
			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const titleEl = mockContentEl.querySelector('h2');
			expect(titleEl).toBeDefined();
			expect(titleEl?.textContent).toBe('Select a Note');
		});

		it('should render list container', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const listEl = mockContentEl.querySelector('.relation-note-selector-list');
			expect(listEl).toBeDefined();
		});

		it('should render all note items', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			expect(items.length).toBe(mockNotes.length);
		});

		it('should render note basenames', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const nameEls = mockContentEl.querySelectorAll('.relation-note-selector-name');
			expect(nameEls[0]?.textContent).toBe('Note 1');
			expect(nameEls[1]?.textContent).toBe('Note 2');
			expect(nameEls[2]?.textContent).toBe('Note 3');
		});

		it('should render note paths for non-root files', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const pathEls = mockContentEl.querySelectorAll('.relation-note-selector-path');
			// Should have paths for folder1 and folder2, but not root
			expect(pathEls.length).toBe(2);
			expect(pathEls[0]?.textContent).toBe('folder1');
			expect(pathEls[1]?.textContent).toBe('folder2');
		});

		it('should not render path for root files', () => {
			const rootNote = {
				basename: 'Root Note',
				path: 'Root Note.md',
				parent: { path: '/' } as TFolder
			} as TFile;

			const modal = new NoteSelectorModal(
				app,
				[rootNote],
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			const pathEls = items[0]?.querySelectorAll('.relation-note-selector-path');
			expect(pathEls?.length).toBe(0);
		});

		it('should clear content before rendering', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			mockContentEl.innerHTML = '<div>Old content</div>';
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			expect(mockContentEl.innerHTML).not.toContain('Old content');
		});
	});

	describe('Selection Behavior', () => {
		it('should call onSelect callback when item is clicked', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;
			modal.close = vi.fn();

			modal.onOpen();

			const firstItem = mockContentEl.querySelector('.relation-note-selector-item') as HTMLElement;
			firstItem?.click();

			expect(onSelectCallback).toHaveBeenCalledWith(mockNotes[0]);
		});

		it('should close modal after selection', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;
			modal.close = vi.fn();

			modal.onOpen();

			const firstItem = mockContentEl.querySelector('.relation-note-selector-item') as HTMLElement;
			firstItem?.click();

			expect(modal.close).toHaveBeenCalled();
		});

		it('should pass correct note to callback', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;
			modal.close = vi.fn();

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			(items[1] as HTMLElement)?.click();

			expect(onSelectCallback).toHaveBeenCalledWith(mockNotes[1]);
		});
	});

	describe('Keyboard Navigation', () => {
		it('should make items focusable', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			items.forEach(item => {
				expect((item as HTMLElement).tabIndex).toBe(0);
			});
		});

		it('should select note on Enter key', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;
			modal.close = vi.fn();

			modal.onOpen();

			const firstItem = mockContentEl.querySelector('.relation-note-selector-item') as HTMLElement;
			const event = new KeyboardEvent('keydown', { key: 'Enter' });
			firstItem?.dispatchEvent(event);

			expect(onSelectCallback).toHaveBeenCalledWith(mockNotes[0]);
			expect(modal.close).toHaveBeenCalled();
		});

		it('should select note on Space key', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;
			modal.close = vi.fn();

			modal.onOpen();

			const firstItem = mockContentEl.querySelector('.relation-note-selector-item') as HTMLElement;
			const event = new KeyboardEvent('keydown', { key: ' ' });
			firstItem?.dispatchEvent(event);

			expect(onSelectCallback).toHaveBeenCalledWith(mockNotes[0]);
			expect(modal.close).toHaveBeenCalled();
		});

		it('should focus first item on open', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			document.body.appendChild(mockContentEl);
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const firstItem = mockContentEl.querySelector('.relation-note-selector-item') as HTMLElement;
			expect(document.activeElement).toBe(firstItem);

			document.body.removeChild(mockContentEl);
		});

		it('should navigate to next item on ArrowDown', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			document.body.appendChild(mockContentEl);
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item') as NodeListOf<HTMLElement>;
			const firstItem = items[0];
			firstItem.focus();

			const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
			Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
			firstItem.dispatchEvent(event);

			// Should focus second item
			expect(document.activeElement).toBe(items[1]);

			document.body.removeChild(mockContentEl);
		});

		it('should navigate to previous item on ArrowUp', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			document.body.appendChild(mockContentEl);
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item') as NodeListOf<HTMLElement>;
			const secondItem = items[1];
			secondItem.focus();

			const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
			Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
			secondItem.dispatchEvent(event);

			// Should focus first item
			expect(document.activeElement).toBe(items[0]);

			document.body.removeChild(mockContentEl);
		});

		it('should not navigate beyond last item on ArrowDown', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			document.body.appendChild(mockContentEl);
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item') as NodeListOf<HTMLElement>;
			const lastItem = items[items.length - 1];
			lastItem.focus();

			const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
			lastItem.dispatchEvent(event);

			// Should still be on last item
			expect(document.activeElement).toBe(lastItem);

			document.body.removeChild(mockContentEl);
		});

		it('should not navigate beyond first item on ArrowUp', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			document.body.appendChild(mockContentEl);
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item') as NodeListOf<HTMLElement>;
			const firstItem = items[0];
			firstItem.focus();

			const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
			firstItem.dispatchEvent(event);

			// Should still be on first item
			expect(document.activeElement).toBe(firstItem);

			document.body.removeChild(mockContentEl);
		});
	});

	describe('Hover Effects', () => {
		it('should add hover class on mouse enter', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const firstItem = mockContentEl.querySelector('.relation-note-selector-item') as HTMLElement;
			firstItem?.dispatchEvent(new MouseEvent('mouseenter'));

			expect(firstItem?.classList.contains('is-hovered')).toBe(true);
		});

		it('should remove hover class on mouse leave', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const firstItem = mockContentEl.querySelector('.relation-note-selector-item') as HTMLElement;
			firstItem?.dispatchEvent(new MouseEvent('mouseenter'));
			firstItem?.dispatchEvent(new MouseEvent('mouseleave'));

			expect(firstItem?.classList.contains('is-hovered')).toBe(false);
		});
	});

	describe('Modal Cleanup', () => {
		it('should clear content on close', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();
			expect(mockContentEl.children.length).toBeGreaterThan(0);

			modal.onClose();
			expect(mockContentEl.children.length).toBe(0);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty note list', () => {
			const modal = new NoteSelectorModal(
				app,
				[],
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			expect(items.length).toBe(0);
		});

		it('should handle single note', () => {
			const modal = new NoteSelectorModal(
				app,
				[mockNotes[0]],
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			expect(items.length).toBe(1);
		});

		it('should handle large note list', () => {
			const manyNotes = Array.from({ length: 100 }, (_, i) => ({
				basename: `Note ${i}`,
				path: `Note ${i}.md`,
				parent: { path: 'folder' } as TFolder
			} as TFile));

			const modal = new NoteSelectorModal(
				app,
				manyNotes,
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			expect(items.length).toBe(100);
		});

		it('should handle notes without parent', () => {
			const noteWithoutParent = {
				basename: 'Orphan Note',
				path: 'Orphan Note.md',
				parent: null
			} as TFile;

			const modal = new NoteSelectorModal(
				app,
				[noteWithoutParent],
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const items = mockContentEl.querySelectorAll('.relation-note-selector-item');
			expect(items.length).toBe(1);
		});

		it('should handle special characters in note names', () => {
			const specialNote = {
				basename: 'Note with "quotes" & special <chars>',
				path: 'Note with "quotes" & special <chars>.md',
				parent: { path: 'folder' } as TFolder
			} as TFile;

			const modal = new NoteSelectorModal(
				app,
				[specialNote],
				'Test Title',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const nameEl = mockContentEl.querySelector('.relation-note-selector-name');
			expect(nameEl?.textContent).toBe('Note with "quotes" & special <chars>');
		});
	});

	describe('Multiple Modals', () => {
		it('should support multiple independent modals', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			const modal1 = new NoteSelectorModal(app, [mockNotes[0]], 'Modal 1', callback1);
			const modal2 = new NoteSelectorModal(app, [mockNotes[1]], 'Modal 2', callback2);

			expect(modal1).not.toBe(modal2);
			expect((modal1 as any).onSelect).toBe(callback1);
			expect((modal2 as any).onSelect).toBe(callback2);
		});
	});

	describe('Title Variations', () => {
		it('should handle empty title', () => {
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				'',
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const titleEl = mockContentEl.querySelector('h2');
			expect(titleEl?.textContent).toBe('');
		});

		it('should handle long title', () => {
			const longTitle = 'This is a very long title that might wrap to multiple lines in the modal header';
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				longTitle,
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const titleEl = mockContentEl.querySelector('h2');
			expect(titleEl?.textContent).toBe(longTitle);
		});

		it('should handle title with special characters', () => {
			const specialTitle = 'Select a note: "Parent" or <Child>';
			const modal = new NoteSelectorModal(
				app,
				mockNotes,
				specialTitle,
				onSelectCallback
			);

			const mockContentEl = createObsidianElement();
			(modal as any).contentEl = mockContentEl;

			modal.onOpen();

			const titleEl = mockContentEl.querySelector('h2');
			expect(titleEl?.textContent).toBe(specialTitle);
		});
	});
});
