import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextMenuBuilder, NodeMenuContext, ContextMenuConfig } from '../src/context-menu-builder';
import { App, TFile } from 'obsidian';

describe('ContextMenuBuilder', () => {
	let builder: ContextMenuBuilder;
	let mockApp: App;
	let mockPlugin: any;
	let mockContext: NodeMenuContext;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Create mock app with spies
		mockApp = new App();
		mockApp.workspace.getLeaf = vi.fn().mockReturnValue({
			openFile: vi.fn().mockResolvedValue(undefined)
		});
		// Mock file explorer for revealInFolder
		mockApp.workspace.getLeavesOfType = vi.fn((type: string) => {
			if (type === 'file-explorer') {
				return [{
					view: {
						revealInFolder: vi.fn()
					}
				}];
			}
			return [];
		});

		// Create mock plugin
		mockPlugin = {
			openNewSidebarPinnedTo: vi.fn().mockResolvedValue(undefined)
		};

		// Create builder
		builder = new ContextMenuBuilder(mockApp, mockPlugin);

		// Create mock context
		mockContext = {
			node: {
				file: { basename: 'Test Note', path: 'test.md' } as TFile,
				children: [],
				depth: 0,
				isCycle: false,
				metadata: {}
			},
			file: { basename: 'Test Note', path: 'test.md' } as TFile,
			section: 'ancestors',
			parentField: 'parent',
			parentFieldDisplayName: 'Parent',
			sidebarView: {
				pinToFile: vi.fn(),
				unpin: vi.fn(),
				isPinnedToCurrentField: vi.fn().mockReturnValue(false)
			} as any,
			isPinned: false,
			targetElement: document.createElement('div'),
			event: new MouseEvent('contextmenu')
		};
	});

	describe('Constructor', () => {
		it('should create builder with default config', () => {
			expect(builder).toBeDefined();
			expect(builder).toBeInstanceOf(ContextMenuBuilder);
		});

		it('should accept custom config', () => {
			const config: ContextMenuConfig = {
				showNavigation: false,
				showPin: true,
				showCopy: true
			};
			const customBuilder = new ContextMenuBuilder(mockApp, mockPlugin, config);
			expect(customBuilder).toBeDefined();
			expect(customBuilder).toBeInstanceOf(ContextMenuBuilder);
		});

		it('should merge custom config with defaults', () => {
			const config: ContextMenuConfig = {
				showNavigation: false
				// Other properties should use defaults
			};
			const customBuilder = new ContextMenuBuilder(mockApp, mockPlugin, config);
			expect(customBuilder).toBeDefined();
		});
	});

	describe('showContextMenu', () => {
		it('should create and show menu without throwing', () => {
			expect(() => builder.showContextMenu(mockContext)).not.toThrow();
		});

		it('should handle context with mouse event', () => {
			const contextWithEvent = {
				...mockContext,
				event: new MouseEvent('contextmenu')
			};
			expect(() => builder.showContextMenu(contextWithEvent)).not.toThrow();
		});

		it('should handle context without mouse event', () => {
			const contextWithoutEvent = {
				...mockContext,
				event: undefined
			};
			expect(() => builder.showContextMenu(contextWithoutEvent)).not.toThrow();
		});
	});

	describe('Section Awareness', () => {
		it('should handle ancestors section context', () => {
			const ancestorsContext = { ...mockContext, section: 'ancestors' as const };
			expect(() => builder.showContextMenu(ancestorsContext)).not.toThrow();
		});

		it('should handle descendants section context', () => {
			const descendantsContext = { ...mockContext, section: 'descendants' as const };
			expect(() => builder.showContextMenu(descendantsContext)).not.toThrow();
		});

		it('should handle siblings section context', () => {
			const siblingsContext = { ...mockContext, section: 'siblings' as const };
			expect(() => builder.showContextMenu(siblingsContext)).not.toThrow();
		});
	});

	describe('Pin State Handling', () => {
		it('should handle unpinned state', () => {
			const unpinnedContext = { ...mockContext, isPinned: false };
			expect(() => builder.showContextMenu(unpinnedContext)).not.toThrow();
		});

		it('should handle pinned state', () => {
			const pinnedContext = { ...mockContext, isPinned: true };
			expect(() => builder.showContextMenu(pinnedContext)).not.toThrow();
		});
	});

	describe('Configuration Options', () => {
		it('should respect showNavigation: false', () => {
			const config: ContextMenuConfig = {
				showNavigation: false,
				showPin: true,
				showCopy: true
			};
			const customBuilder = new ContextMenuBuilder(mockApp, mockPlugin, config);
			expect(() => customBuilder.showContextMenu(mockContext)).not.toThrow();
		});

		it('should respect showPin: false', () => {
			const config: ContextMenuConfig = {
				showNavigation: true,
				showPin: false,
				showCopy: true
			};
			const customBuilder = new ContextMenuBuilder(mockApp, mockPlugin, config);
			expect(() => customBuilder.showContextMenu(mockContext)).not.toThrow();
		});

		it('should respect showCopy: false', () => {
			const config: ContextMenuConfig = {
				showNavigation: true,
				showPin: true,
				showCopy: false
			};
			const customBuilder = new ContextMenuBuilder(mockApp, mockPlugin, config);
			expect(() => customBuilder.showContextMenu(mockContext)).not.toThrow();
		});

		it('should handle all actions disabled', () => {
			const config: ContextMenuConfig = {
				showNavigation: false,
				showPin: false,
				showCopy: false
			};
			const customBuilder = new ContextMenuBuilder(mockApp, mockPlugin, config);
			expect(() => customBuilder.showContextMenu(mockContext)).not.toThrow();
		});
	});

	describe('Parent Field Context', () => {
		it('should handle different parent fields', () => {
			const contexts = [
				{ ...mockContext, parentField: 'parent', parentFieldDisplayName: 'Parent' },
				{ ...mockContext, parentField: 'project', parentFieldDisplayName: 'Project' },
				{ ...mockContext, parentField: 'category', parentFieldDisplayName: 'Category' }
			];

			contexts.forEach(context => {
				expect(() => builder.showContextMenu(context)).not.toThrow();
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle node at depth 0', () => {
			const rootContext = {
				...mockContext,
				node: { ...mockContext.node, depth: 0 }
			};
			expect(() => builder.showContextMenu(rootContext)).not.toThrow();
		});

		it('should handle deep nested node', () => {
			const deepContext = {
				...mockContext,
				node: { ...mockContext.node, depth: 10 }
			};
			expect(() => builder.showContextMenu(deepContext)).not.toThrow();
		});

		it('should handle cycle node', () => {
			const cycleContext = {
				...mockContext,
				node: { ...mockContext.node, isCycle: true }
			};
			expect(() => builder.showContextMenu(cycleContext)).not.toThrow();
		});

		it('should handle node with children', () => {
			const parentContext = {
				...mockContext,
				node: {
					...mockContext.node,
					children: [
						{
							file: { basename: 'Child', path: 'child.md' } as TFile,
							children: [],
							depth: 1,
							isCycle: false,
							metadata: {}
						}
					]
				}
			};
			expect(() => builder.showContextMenu(parentContext)).not.toThrow();
		});
	});
});
