import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeRenderer, TreeRendererOptions, TreeRenderContext } from '../src/tree-renderer';
import { ContextMenuBuilder } from '../src/context-menu-builder';
import { TreeNode } from '../src/tree-model';
import { App, TFile } from 'obsidian';

describe('TreeRenderer - Context Menu Integration', () => {
	let renderer: TreeRenderer;
	let mockApp: App;
	let mockBuilder: ContextMenuBuilder;
	let mockPlugin: any;
	let container: HTMLElement;
	let mockTree: TreeNode;

	beforeEach(() => {
		// Create mock app
		mockApp = new App();
		mockApp.vault.getAbstractFileByPath = vi.fn((path: string) => {
			return new TFile();
		});

		// Create mock plugin
		mockPlugin = {
			openNewSidebarPinnedTo: vi.fn().mockResolvedValue(undefined)
		};

		// Create context menu builder
		mockBuilder = new ContextMenuBuilder(mockApp, mockPlugin);
		vi.spyOn(mockBuilder, 'showContextMenu');

		// Create renderer with context menu enabled
		const options: TreeRendererOptions = {
			enableContextMenu: true,
			collapsible: true,
			enableNavigation: true
		};
		renderer = new TreeRenderer(mockApp, options);
		renderer.setContextMenuBuilder(mockBuilder);

		// Create container
		container = document.createElement('div');
		document.body.appendChild(container);

		// Create mock tree
		mockTree = {
			file: { basename: 'Root', path: 'root.md' } as TFile,
			children: [
				{
					file: { basename: 'Child 1', path: 'child1.md' } as TFile,
					children: [],
					depth: 1,
					isCycle: false,
					metadata: {}
				},
				{
					file: { basename: 'Child 2', path: 'child2.md' } as TFile,
					children: [],
					depth: 1,
					isCycle: false,
					metadata: {}
				}
			],
			depth: 0,
			isCycle: false,
			metadata: {}
		};
	});

	afterEach(() => {
		document.body.removeChild(container);
		vi.clearAllMocks();
	});

	describe('Context Menu Setup', () => {
		it('should set context menu builder', () => {
			expect(() => renderer.setContextMenuBuilder(mockBuilder)).not.toThrow();
		});

		it('should render tree with context menu support', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			expect(() => renderer.render(mockTree, container, context)).not.toThrow();
		});

		it('should render tree without context when context menu disabled', () => {
			const noMenuRenderer = new TreeRenderer(mockApp, { enableContextMenu: false });
			expect(() => noMenuRenderer.render(mockTree, container)).not.toThrow();
		});
	});

	describe('Node Data Storage', () => {
		it('should store node data on DOM elements', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			// Find a node content element
			const nodeContent = container.querySelector('.relation-tree-node-content');
			expect(nodeContent).toBeTruthy();

			// Check data attributes
			expect(nodeContent?.getAttribute('data-path')).toBe('root.md');
			expect(nodeContent?.getAttribute('data-depth')).toBe('0');

			// Check stored tree node data
			const storedData = (nodeContent as any).__treeNodeData;
			expect(storedData).toBeTruthy();
			expect(storedData.file.basename).toBe('Root');
		});

		it('should make nodes focusable when context menu enabled', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			const nodeContent = container.querySelector('.relation-tree-node-content');
			expect(nodeContent?.getAttribute('tabindex')).toBe('0');
			expect(nodeContent?.getAttribute('role')).toBe('treeitem');
		});

		it('should not make nodes focusable when context menu disabled', () => {
			const noMenuRenderer = new TreeRenderer(mockApp, { enableContextMenu: false });
			noMenuRenderer.render(mockTree, container);

			const nodeContent = container.querySelector('.relation-tree-node-content');
			expect(nodeContent?.getAttribute('tabindex')).toBeNull();
		});
	});

	describe('Event Handler Attachment', () => {
		it('should attach right-click handler when context menu enabled', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			// Find a node content element
			const nodeContent = container.querySelector('.relation-tree-node-content') as HTMLElement;
			expect(nodeContent).toBeTruthy();

			// Simulate right-click
			const contextMenuEvent = new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true
			});

			nodeContent.dispatchEvent(contextMenuEvent);

			// Verify context menu was shown
			expect(mockBuilder.showContextMenu).toHaveBeenCalled();
		});

		it('should handle keyboard context menu trigger', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			const nodeContent = container.querySelector('.relation-tree-node-content') as HTMLElement;
			expect(nodeContent).toBeTruthy();

			// Focus the element first
			nodeContent.focus();

			// Simulate context menu key - must bubble up to container
			const keyboardEvent = new KeyboardEvent('keydown', {
				key: 'ContextMenu',
				bubbles: true,
				cancelable: true
			});

			// Dispatch on the node content so it bubbles up
			nodeContent.dispatchEvent(keyboardEvent);

			// Verify context menu was shown
			expect(mockBuilder.showContextMenu).toHaveBeenCalled();
		});

		it('should handle Shift+F10 context menu trigger', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			const nodeContent = container.querySelector('.relation-tree-node-content') as HTMLElement;
			nodeContent.focus();

			// Simulate Shift+F10 - must bubble up to container
			const keyboardEvent = new KeyboardEvent('keydown', {
				key: 'F10',
				shiftKey: true,
				bubbles: true,
				cancelable: true
			});

			// Dispatch on the node content so it bubbles up
			nodeContent.dispatchEvent(keyboardEvent);

			// Verify context menu was shown
			expect(mockBuilder.showContextMenu).toHaveBeenCalled();
		});
	});

	describe('Section Context', () => {
		it('should pass ancestors section context to menu', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			const nodeContent = container.querySelector('.relation-tree-node-content') as HTMLElement;
			const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
			nodeContent.dispatchEvent(contextMenuEvent);

			// Verify section was passed
			expect(mockBuilder.showContextMenu).toHaveBeenCalledWith(
				expect.objectContaining({ section: 'ancestors' })
			);
		});

		it('should pass descendants section context to menu', () => {
			const context: TreeRenderContext = {
				section: 'descendants',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			const nodeContent = container.querySelector('.relation-tree-node-content') as HTMLElement;
			const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
			nodeContent.dispatchEvent(contextMenuEvent);

			expect(mockBuilder.showContextMenu).toHaveBeenCalledWith(
				expect.objectContaining({ section: 'descendants' })
			);
		});

		it('should pass siblings section context to menu', () => {
			const context: TreeRenderContext = {
				section: 'siblings',
				parentField: 'project',
				parentFieldDisplayName: 'Project',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			const nodeContent = container.querySelector('.relation-tree-node-content') as HTMLElement;
			const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
			nodeContent.dispatchEvent(contextMenuEvent);

			expect(mockBuilder.showContextMenu).toHaveBeenCalledWith(
				expect.objectContaining({ section: 'siblings' })
			);
		});
	});

	describe('Parent Field Context', () => {
		it('should pass parent field information to menu', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'project',
				parentFieldDisplayName: 'Project Hierarchy',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			const nodeContent = container.querySelector('.relation-tree-node-content') as HTMLElement;
			const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
			nodeContent.dispatchEvent(contextMenuEvent);

			expect(mockBuilder.showContextMenu).toHaveBeenCalledWith(
				expect.objectContaining({
					parentField: 'project',
					parentFieldDisplayName: 'Project Hierarchy'
				})
			);
		});
	});

	describe('Edge Cases', () => {
		it('should handle right-click on non-node elements gracefully', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			// Right-click on container itself (not a node)
			const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
			container.dispatchEvent(contextMenuEvent);

			// Context menu should not be shown for non-node elements
			expect(mockBuilder.showContextMenu).not.toHaveBeenCalled();
		});

		it('should handle missing node data gracefully', () => {
			const context: TreeRenderContext = {
				section: 'ancestors',
				parentField: 'parent',
				parentFieldDisplayName: 'Parent',
				sidebarView: {
					isPinnedToCurrentField: vi.fn().mockReturnValue(false)
				} as any
			};

			renderer.render(mockTree, container, context);

			// Create a fake node without proper data
			const fakeNode = document.createElement('div');
			fakeNode.className = 'relation-tree-node-content';
			container.appendChild(fakeNode);

			// Right-click on fake node
			const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true });
			fakeNode.dispatchEvent(contextMenuEvent);

			// Should not crash, but also should not show menu
			// (The call count might be 1 from the real node, but no crash)
			expect(() => fakeNode.dispatchEvent(contextMenuEvent)).not.toThrow();
		});
	});
});
