import { App, FuzzySuggestModal, TFile } from 'obsidian';

/**
 * Modal for selecting a note with fuzzy search.
 *
 * This modal provides an intuitive way to select a note from a list
 * using Obsidian's built-in fuzzy search functionality. It's useful
 * for commands that need to select a target note (e.g., finding a path).
 *
 * @example
 * const modal = new NoteSelectionModal(
 *   app,
 *   allNotes,
 *   'Select target note',
 *   (note) => {
 *     if (note) {
 *       console.log(`Selected: ${note.basename}`);
 *     }
 *   }
 * );
 * modal.open();
 */
export class NoteSelectionModal extends FuzzySuggestModal<TFile> {
	private notes: TFile[];
	private onSelect: (note: TFile) => void;

	/**
	 * Creates a new note selection modal.
	 *
	 * @param app - Obsidian app instance
	 * @param notes - Array of notes to choose from
	 * @param placeholder - Placeholder text for search input
	 * @param onSelect - Callback function called when a note is selected
	 */
	constructor(
		app: App,
		notes: TFile[],
		placeholder: string,
		onSelect: (note: TFile) => void
	) {
		super(app);
		this.notes = notes;
		this.onSelect = onSelect;

		this.setPlaceholder(placeholder);
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to select' },
			{ command: 'esc', purpose: 'to dismiss' }
		]);
	}

	/**
	 * Returns the list of items to search through.
	 *
	 * @returns Array of TFile objects
	 */
	getItems(): TFile[] {
		return this.notes;
	}

	/**
	 * Returns the text to display for each item.
	 *
	 * @param note - The note to get text for
	 * @returns The note's basename
	 */
	getItemText(note: TFile): string {
		return note.basename;
	}

	/**
	 * Called when a note is selected.
	 *
	 * @param note - The selected note
	 * @param evt - The mouse or keyboard event
	 */
	onChooseItem(note: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(note);
	}
}

/**
 * Opens a note selection modal and returns a promise.
 *
 * This is a convenience function that wraps the NoteSelectionModal
 * in a Promise-based API for easier async/await usage.
 *
 * @param app - Obsidian app instance
 * @param notes - Notes to choose from
 * @param placeholder - Placeholder text
 * @returns Promise that resolves with selected note or null if cancelled
 *
 * @example
 * const note = await selectNote(app, allNotes, 'Select a note...');
 * if (note) {
 *   console.log(`User selected: ${note.basename}`);
 * } else {
 *   console.log('User cancelled');
 * }
 */
export function selectNote(
	app: App,
	notes: TFile[],
	placeholder: string = 'Select a note...'
): Promise<TFile | null> {
	console.log('[selectNote] Creating promise, notes count:', notes.length);

	return new Promise((resolve) => {
		const modal = new NoteSelectionModal(
			app,
			notes,
			placeholder,
			(note) => {
				// Note was selected
				console.log('[selectNote] onSelect callback called with note:', note.basename);
				resolve(note);
			}
		);

		// Override onClose to handle cancellation
		const originalOnClose = modal.onClose;
		let hasResolved = false;

		modal.onClose = function() {
			console.log('[selectNote] onClose called, hasResolved:', hasResolved);

			// Call original cleanup
			if (originalOnClose) {
				originalOnClose.call(this);
			}

			// Delay checking hasResolved to let onChooseItem run first
			// (Obsidian calls onClose before onChooseItem when selecting)
			setTimeout(() => {
				if (!hasResolved) {
					hasResolved = true;
					console.log('[selectNote] Resolving with null (cancelled)');
					resolve(null);
				} else {
					console.log('[selectNote] Already resolved, not cancelling');
				}
			}, 10);
		};

		// When selection happens, mark as resolved
		const originalOnChooseItem = modal.onChooseItem;
		modal.onChooseItem = function(note: TFile, evt: MouseEvent | KeyboardEvent) {
			console.log('[selectNote] onChooseItem called with note:', note.basename);
			hasResolved = true;
			originalOnChooseItem.call(this, note, evt);
		};

		console.log('[selectNote] Opening modal...');
		modal.open();
	});
}
