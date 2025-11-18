import { App } from 'obsidian';
import type { ParentFieldConfig } from './types';

/**
 * UI style for the parent field selector (kept for backward compatibility)
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

	/** UI style preference (deprecated, always uses dropdown now) */
	uiStyle?: SelectorUIStyle;

	/** Callback when selection changes */
	onChange: (fieldName: string) => void;
}

/**
 * Component for selecting between multiple parent fields.
 *
 * Displays a dropdown selector for switching between parent fields.
 * Simplified to use only dropdown for consistency with Obsidian's native UI.
 */
export class ParentFieldSelector {
	private app: App;
	private options: ParentFieldSelectorOptions;
	private containerEl: HTMLElement;

	constructor(app: App, containerEl: HTMLElement, options: ParentFieldSelectorOptions) {
		this.app = app;
		this.containerEl = containerEl;
		this.options = options;

		this.render();
	}

	/**
	 * Renders the selector UI.
	 */
	private render(): void {
		this.containerEl.empty();

		// Don't show selector if only one field
		if (this.options.fields.length <= 1) {
			return;
		}

		this.renderDropdown();
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
		this.render();
	}

	/**
	 * Destroys the selector and cleans up.
	 */
	destroy(): void {
		this.containerEl.empty();
	}
}
