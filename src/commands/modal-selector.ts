import { App, Modal, TFile } from 'obsidian';

/**
 * Modal for selecting a note from a list.
 *
 * This modal presents a list of notes for the user to choose from,
 * typically used when navigating to parents or children when multiple
 * options are available.
 */
export class NoteSelectorModal extends Modal {
	private notes: TFile[];
	private title: string;
	private onSelect: (note: TFile) => void;

	/**
	 * Creates a new note selector modal.
	 *
	 * @param app - Obsidian app instance
	 * @param notes - Array of notes to choose from
	 * @param title - Title to display in the modal
	 * @param onSelect - Callback function called when a note is selected
	 */
	constructor(
		app: App,
		notes: TFile[],
		title: string,
		onSelect: (note: TFile) => void
	) {
		super(app);
		this.notes = notes;
		this.title = title;
		this.onSelect = onSelect;
	}

	/**
	 * Called when the modal is opened.
	 *
	 * Renders the modal content with the title and list of selectable notes.
	 */
	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Add title
		contentEl.createEl('h2', { text: this.title });

		// Create list of notes
		const listEl = contentEl.createDiv('relation-note-selector-list');

		this.notes.forEach((note, index) => {
			const itemEl = listEl.createDiv('relation-note-selector-item');

			// Note name
			const nameEl = itemEl.createDiv('relation-note-selector-name');
			nameEl.setText(note.basename);

			// Note path (if not in root)
			if (note.parent && note.parent.path !== '/') {
				const pathEl = itemEl.createDiv('relation-note-selector-path');
				pathEl.setText(note.parent.path);
			}

			// Click handler
			itemEl.addEventListener('click', () => {
				this.onSelect(note);
				this.close();
			});

			// Keyboard navigation
			itemEl.tabIndex = 0;
			itemEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.onSelect(note);
					this.close();
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					const nextItem = itemEl.nextElementSibling as HTMLElement;
					if (nextItem) {
						nextItem.focus();
					}
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					const prevItem = itemEl.previousElementSibling as HTMLElement;
					if (prevItem) {
						prevItem.focus();
					}
				}
			});

			// Hover effect
			itemEl.addEventListener('mouseenter', () => {
				itemEl.addClass('is-hovered');
			});

			itemEl.addEventListener('mouseleave', () => {
				itemEl.removeClass('is-hovered');
			});
		});

		// Focus first item
		const firstItem = listEl.querySelector('.relation-note-selector-item') as HTMLElement;
		if (firstItem) {
			firstItem.focus();
		}
	}

	/**
	 * Called when the modal is closed.
	 *
	 * Cleans up the modal content.
	 */
	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
