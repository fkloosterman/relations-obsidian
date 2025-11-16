import { vi } from 'vitest';

/**
 * Mock implementation of Obsidian API for testing.
 * This file provides minimal mocks of the Obsidian classes and types
 * needed for unit testing.
 */

// Mock TFile class
export class TFile {
	path: string = '';
	basename: string = '';
	extension: string = 'md';
	name: string = '';
	vault: any = null;
	parent: any = null;
	stat: { ctime: number; mtime: number; size: number } = {
		ctime: 0,
		mtime: 0,
		size: 0
	};

	constructor(path?: string) {
		if (path) {
			this.path = path;
			this.basename = path.replace('.md', '');
			this.name = path;
		}
	}
}

// Mock Menu class
export class Menu {
	private items: any[] = [];
	private separators: number[] = [];

	addItem(callback: (item: any) => void): this {
		const mockItem = {
			setTitle: vi.fn().mockReturnThis(),
			setIcon: vi.fn().mockReturnThis(),
			onClick: vi.fn().mockReturnThis(),
			setSection: vi.fn().mockReturnThis(),
			setDisabled: vi.fn().mockReturnThis(),
			setChecked: vi.fn().mockReturnThis()
		};
		callback(mockItem);
		this.items.push(mockItem);
		return this;
	}

	addSeparator(): this {
		this.separators.push(this.items.length);
		return this;
	}

	showAtMouseEvent = vi.fn();
	showAtPosition = vi.fn();
}

// Mock Notice class
export class Notice {
	constructor(public message: string, public timeout?: number) {}
}

// Mock App class
export class App {
	workspace: any = {
		getLeaf: vi.fn(),
		getActiveFile: vi.fn(),
		getLeavesOfType: vi.fn(() => []),
		getRightLeaf: vi.fn(),
		onLayoutReady: vi.fn()
	};

	vault: any = {
		getAbstractFileByPath: vi.fn(),
		getFiles: vi.fn(() => []),
		on: vi.fn()
	};

	metadataCache: any = {
		getFileCache: vi.fn(),
		getFirstLinkpathDest: vi.fn(),
		on: vi.fn()
	};

	fileManager: any = {
		processFrontMatter: vi.fn()
	};
}

// Mock Plugin class
export class Plugin {
	app!: App;
	manifest: any = {};

	async loadData(): Promise<any> {
		return {};
	}

	async saveData(data: any): Promise<void> {}

	registerEvent(event: any): void {}

	addCommand(command: any): void {}

	addSettingTab(tab: any): void {}

	registerView(type: string, viewCreator: any): void {}
}

// Mock WorkspaceLeaf class
export class WorkspaceLeaf {
	view: any = null;

	async setViewState(state: any): Promise<void> {}

	async openFile(file: TFile): Promise<void> {}
}

// Mock PluginSettingTab class
export class PluginSettingTab {
	constructor(public app: App, public plugin: Plugin) {}

	display(): void {}

	hide(): void {}
}

// Mock Setting class
export class Setting {
	constructor(public containerEl: HTMLElement) {}

	setName(name: string): this {
		return this;
	}

	setDesc(desc: string): this {
		return this;
	}

	addText(callback: (text: any) => void): this {
		const mockText = {
			setValue: vi.fn().mockReturnThis(),
			setPlaceholder: vi.fn().mockReturnThis(),
			onChange: vi.fn().mockReturnThis()
		};
		callback(mockText);
		return this;
	}

	addToggle(callback: (toggle: any) => void): this {
		const mockToggle = {
			setValue: vi.fn().mockReturnThis(),
			onChange: vi.fn().mockReturnThis()
		};
		callback(mockToggle);
		return this;
	}

	addDropdown(callback: (dropdown: any) => void): this {
		const mockDropdown = {
			addOption: vi.fn().mockReturnThis(),
			setValue: vi.fn().mockReturnThis(),
			onChange: vi.fn().mockReturnThis()
		};
		callback(mockDropdown);
		return this;
	}
}

// Mock ItemView class
export class ItemView {
	app!: App;
	containerEl: HTMLElement = document.createElement('div');

	constructor(public leaf: WorkspaceLeaf) {}

	getViewType(): string {
		return 'test-view';
	}

	getDisplayText(): string {
		return 'Test View';
	}

	async onOpen(): Promise<void> {}

	async onClose(): Promise<void> {}
}

// Utility functions
export function setIcon(element: HTMLElement, icon: string): void {}

export function normalizePath(path: string): string {
	return path;
}
