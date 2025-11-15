import { App, setIcon } from 'obsidian';
import type { ParentFieldConfig } from './types';

/**
 * UI style for the parent field selector
 */
export type SelectorUIStyle = 'auto' | 'segmented' | 'dropdown';

/**
 * Options for ParentFieldSelector
 */
export interface ParentFieldSelectorOptions {
	/** Available parent fields */
	fields: ParentFieldConfig[];

	/** Currently selected field name */
	selectedField: string;

	/** UI style preference */
	uiStyle: SelectorUIStyle;

	/** Callback when selection changes */
	onChange: (fieldName: string) => void;
}

/**
 * Component for selecting between multiple parent fields.
 *
 * Displays either a segmented control (2-4 fields) or dropdown (>4 fields).
 * In 'auto' mode, automatically chooses the appropriate UI based on field count.
 */
export class ParentFieldSelector {
	private app: App;
	private options: ParentFieldSelectorOptions;
	private containerEl: HTMLElement;
	private currentStyle: 'segmented' | 'dropdown';

	constructor(app: App, containerEl: HTMLElement, options: ParentFieldSelectorOptions) {
		this.app = app;
		this.containerEl = containerEl;
		this.options = options;

		// Determine actual UI style to use
		this.currentStyle = this.determineUIStyle();

		this.render();
	}

	/**
	 * Determines which UI style to use based on settings and field count.
	 */
	private determineUIStyle(): 'segmented' | 'dropdown' {
		if (this.options.uiStyle === 'segmented') {
			return 'segmented';
		}
		if (this.options.uiStyle === 'dropdown') {
			return 'dropdown';
		}

		// Auto mode: use segmented for 2-4 fields, dropdown for >4
		const fieldCount = this.options.fields.length;
		return fieldCount <= 4 ? 'segmented' : 'dropdown';
	}

	/**
	 * Renders the selector UI.
	 */
	private render(): void {
		this.containerEl.empty();
		this.containerEl.addClass('parent-field-selector');

		// Don't show selector if only one field
		if (this.options.fields.length <= 1) {
			return;
		}

		if (this.currentStyle === 'segmented') {
			this.renderSegmentedControl();
		} else {
			this.renderDropdown();
		}
	}

	/**
	 * Renders a segmented control (button group).
	 */
	private renderSegmentedControl(): void {
		const segmentedControl = this.containerEl.createDiv('parent-field-segmented');

		this.options.fields.forEach(field => {
			const button = segmentedControl.createEl('button', {
				cls: 'parent-field-segment',
				text: field.displayName || field.name
			});

			if (field.name === this.options.selectedField) {
				button.addClass('is-active');
			}

			button.addEventListener('click', () => {
				this.selectField(field.name);
			});
		});
	}

	/**
	 * Renders a dropdown select menu.
	 */
	private renderDropdown(): void {
		const dropdown = this.containerEl.createEl('select', {
			cls: 'parent-field-dropdown dropdown'
		});

		this.options.fields.forEach(field => {
			const option = dropdown.createEl('option', {
				text: field.displayName || field.name,
				value: field.name
			});

			if (field.name === this.options.selectedField) {
				option.selected = true;
			}
		});

		dropdown.addEventListener('change', () => {
			this.selectField(dropdown.value);
		});
	}

	/**
	 * Handles field selection change.
	 */
	private selectField(fieldName: string): void {
		if (fieldName === this.options.selectedField) {
			return; // No change
		}

		this.options.selectedField = fieldName;
		this.options.onChange(fieldName);

		// Re-render to update active state
		this.render();
	}

	/**
	 * Updates the selector with new options.
	 */
	update(options: Partial<ParentFieldSelectorOptions>): void {
		this.options = { ...this.options, ...options };

		// Recalculate style if it changed
		const newStyle = this.determineUIStyle();
		if (newStyle !== this.currentStyle) {
			this.currentStyle = newStyle;
		}

		this.render();
	}

	/**
	 * Destroys the selector and cleans up.
	 */
	destroy(): void {
		this.containerEl.empty();
	}
}
