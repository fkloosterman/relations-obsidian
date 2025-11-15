/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TreeRenderer, TreeRendererOptions } from '@/tree-renderer';
import { TreeNode } from '@/tree-model';
import { TFile, App } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
function createMockFile(path: string, basename: string): TFile {
	return {
		path,
		basename,
		name: basename + '.md',
		extension: 'md',
		vault: {} as any,
		parent: null,
		stat: { ctime: 0, mtime: 0, size: 0 }
	} as TFile;
}

/**
 * Helper to create mock App
 */
function createMockApp(): App {
	return {
		workspace: {
			openLinkText: vi.fn().mockResolvedValue(undefined),
			trigger: vi.fn()
		}
	} as any;
}

/**
 * Helper to create a simple TreeNode
 */
function createTreeNode(
	basename: string,
	depth: number = 0,
	children: TreeNode[] = [],
	isCycle: boolean = false
): TreeNode {
	return {
		file: createMockFile(`${basename}.md`, basename),
		children,
		depth,
		isCycle,
		metadata: {}
	};
}

describe('TreeRenderer', () => {
	let mockApp: App;
	let renderer: TreeRenderer;
	let container: HTMLElement;

	beforeEach(() => {
		mockApp = createMockApp();
		renderer = new TreeRenderer(mockApp);

		// Create a real DOM element for testing
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		// Clean up
		document.body.removeChild(container);
	});

	describe('Basic Rendering', () => {
		it('should render a single node', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			expect(container.querySelector('.relation-tree-node')).toBeTruthy();
			expect(container.textContent).toContain('A');
		});

		it('should render nested nodes with proper structure', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeC = createTreeNode('C', 1);
			const nodeA = createTreeNode('A', 0, [nodeB, nodeC]);

			renderer.render(nodeA, container);

			// All nodes present
			expect(container.textContent).toContain('A');
			expect(container.textContent).toContain('B');
			expect(container.textContent).toContain('C');

			// Children container exists
			const childrenContainer = container.querySelector('.relation-tree-children');
			expect(childrenContainer).toBeTruthy();
		});

		it('should apply correct depth indentation', () => {
			const nodeC = createTreeNode('C', 2);
			const nodeB = createTreeNode('B', 1, [nodeC]);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			// Check depth CSS variables
			const contentElements = container.querySelectorAll('.relation-tree-node-content');
			expect(contentElements[0].style.getPropertyValue('--tree-depth')).toBe('0');
			expect(contentElements[1].style.getPropertyValue('--tree-depth')).toBe('1');
			expect(contentElements[2].style.getPropertyValue('--tree-depth')).toBe('2');
		});

		it('should add container CSS class', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			expect(container.classList.contains('relation-tree-container')).toBe(true);
		});

		it('should clear container before rendering', () => {
			// Add some content
			container.innerHTML = '<div>Old content</div>';

			const node = createTreeNode('A', 0);
			renderer.render(node, container);

			// Old content should be gone
			expect(container.textContent).not.toContain('Old content');
			expect(container.textContent).toContain('A');
		});
	});

	describe('Collapse/Expand', () => {
		it('should render collapse toggle for nodes with children', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle');
			expect(toggle).toBeTruthy();
			expect(toggle?.getAttribute('role')).toBe('button');
			expect(toggle?.getAttribute('aria-expanded')).toBe('true');
		});

		it('should not render toggle for leaf nodes', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			const toggle = container.querySelector('.relation-tree-toggle');
			expect(toggle).toBeFalsy();

			// But spacer should exist
			const spacer = container.querySelector('.relation-tree-toggle-spacer');
			expect(spacer).toBeTruthy();
		});

		it('should toggle collapsed state on click', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle') as HTMLElement;
			const childrenContainer = container.querySelector('.relation-tree-children') as HTMLElement;

			// Initially expanded
			expect(childrenContainer.classList.contains('relation-tree-collapsed')).toBe(false);

			// Click to collapse
			toggle.click();

			// Verify collapsed
			expect(childrenContainer.classList.contains('relation-tree-collapsed')).toBe(true);
			expect(toggle.getAttribute('aria-expanded')).toBe('false');

			// Click to expand
			toggle.click();

			// Verify expanded again
			expect(childrenContainer.classList.contains('relation-tree-collapsed')).toBe(false);
			expect(toggle.getAttribute('aria-expanded')).toBe('true');
		});

		it('should respect initiallyCollapsed option', () => {
			const renderer = new TreeRenderer(mockApp, { initiallyCollapsed: true });

			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const childrenContainer = container.querySelector('.relation-tree-children') as HTMLElement;
			expect(childrenContainer.classList.contains('relation-tree-collapsed')).toBe(true);

			const toggle = container.querySelector('.relation-tree-toggle');
			expect(toggle?.getAttribute('aria-expanded')).toBe('false');
		});

		it('should handle keyboard navigation (Enter)', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle') as HTMLElement;
			const childrenContainer = container.querySelector('.relation-tree-children') as HTMLElement;

			// Press Enter
			const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
			toggle.dispatchEvent(enterEvent);

			// Verify toggled
			expect(childrenContainer.classList.contains('relation-tree-collapsed')).toBe(true);
		});

		it('should handle keyboard navigation (Space)', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle') as HTMLElement;
			const childrenContainer = container.querySelector('.relation-tree-children') as HTMLElement;

			// Press Space
			const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
			toggle.dispatchEvent(spaceEvent);

			// Verify toggled
			expect(childrenContainer.classList.contains('relation-tree-collapsed')).toBe(true);
		});

		it('should update toggle icon when collapsed/expanded', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle') as HTMLElement;

			// Initially should have down chevron (expanded)
			expect(toggle.innerHTML).toContain('6 9 12 15 18 9'); // Down chevron points

			// Click to collapse
			toggle.click();

			// Should have right chevron (collapsed)
			expect(toggle.innerHTML).toContain('9 18 15 12 9 6'); // Right chevron points
		});
	});

	describe('Cycle Indicators', () => {
		it('should render cycle indicator for cyclic nodes', () => {
			const node = createTreeNode('A', 0, [], true);

			renderer.render(node, container);

			const indicator = container.querySelector('.relation-tree-cycle-indicator');
			expect(indicator).toBeTruthy();
			expect(indicator?.getAttribute('title')).toContain('Cycle detected');
		});

		it('should not render cycle indicator for normal nodes', () => {
			const node = createTreeNode('A', 0, [], false);

			renderer.render(node, container);

			const indicator = container.querySelector('.relation-tree-cycle-indicator');
			expect(indicator).toBeFalsy();
		});

		it('should respect showCycleIndicators option', () => {
			const renderer = new TreeRenderer(mockApp, { showCycleIndicators: false });

			const node = createTreeNode('A', 0, [], true);

			renderer.render(node, container);

			// No indicator even though node is cyclic
			const indicator = container.querySelector('.relation-tree-cycle-indicator');
			expect(indicator).toBeFalsy();
		});

		it('should render warning icon in cycle indicator', () => {
			const node = createTreeNode('A', 0, [], true);

			renderer.render(node, container);

			const indicator = container.querySelector('.relation-tree-cycle-indicator');
			expect(indicator?.innerHTML).toContain('svg');
			expect(indicator?.innerHTML).toContain('M10.29 3.86'); // Triangle path
		});
	});

	describe('Navigation', () => {
		it('should add clickable class when navigation enabled', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			const nameEl = container.querySelector('.relation-tree-name');
			expect(nameEl?.classList.contains('relation-tree-name-clickable')).toBe(true);
		});

		it('should not add clickable class when navigation disabled', () => {
			const renderer = new TreeRenderer(mockApp, { enableNavigation: false });

			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			const nameEl = container.querySelector('.relation-tree-name');
			expect(nameEl?.classList.contains('relation-tree-name-clickable')).toBe(false);
		});

		it('should call openLinkText when file name clicked', async () => {
			const renderer = new TreeRenderer(mockApp);

			const file = createMockFile('A.md', 'A');
			const node: TreeNode = {
				file,
				children: [],
				depth: 0,
				isCycle: false,
				metadata: {}
			};

			renderer.render(node, container);

			const nameEl = container.querySelector('.relation-tree-name') as HTMLElement;
			nameEl.click();

			// Small delay for async operation
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith(
				file.path,
				'',
				false
			);
		});

		it('should open in split pane when Ctrl+clicked', async () => {
			const renderer = new TreeRenderer(mockApp);

			const file = createMockFile('A.md', 'A');
			const node: TreeNode = {
				file,
				children: [],
				depth: 0,
				isCycle: false,
				metadata: {}
			};

			renderer.render(node, container);

			const nameEl = container.querySelector('.relation-tree-name') as HTMLElement;

			// Create click event with Ctrl key
			const clickEvent = new MouseEvent('click', { ctrlKey: true });
			nameEl.dispatchEvent(clickEvent);

			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockApp.workspace.openLinkText).toHaveBeenCalledWith(
				file.path,
				'',
				'split'
			);
		});

		it('should trigger hover-link event on mouse enter', () => {
			const renderer = new TreeRenderer(mockApp);

			const file = createMockFile('A.md', 'A');
			const node: TreeNode = {
				file,
				children: [],
				depth: 0,
				isCycle: false,
				metadata: {}
			};

			renderer.render(node, container);

			const nameEl = container.querySelector('.relation-tree-name') as HTMLElement;

			const mouseEnterEvent = new MouseEvent('mouseenter');
			nameEl.dispatchEvent(mouseEnterEvent);

			expect(mockApp.workspace.trigger).toHaveBeenCalledWith(
				'hover-link',
				expect.objectContaining({
					source: 'relation-tree',
					linktext: file.path
				})
			);
		});
	});

	describe('Options', () => {
		it('should respect maxRenderDepth option', () => {
			const renderer = new TreeRenderer(mockApp, { maxRenderDepth: 2 });

			// Deep tree (depth 3 will exceed limit)
			const nodeD = createTreeNode('D', 3);
			const nodeC = createTreeNode('C', 2, [nodeD]);
			const nodeB = createTreeNode('B', 1, [nodeC]);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			// Depth limit warning should appear
			const depthLimit = container.querySelector('.relation-tree-depth-limit');
			expect(depthLimit).toBeTruthy();
			expect(depthLimit?.textContent).toContain('depth limit reached');
		});

		it('should show depth indicators when enabled', () => {
			const renderer = new TreeRenderer(mockApp, { showDepth: true });

			const node = createTreeNode('A', 2);

			renderer.render(node, container);

			const depthIndicator = container.querySelector('.relation-tree-depth-indicator');
			expect(depthIndicator).toBeTruthy();
			expect(depthIndicator?.textContent).toContain('[2]');
		});

		it('should not show depth indicators by default', () => {
			const node = createTreeNode('A', 2);

			renderer.render(node, container);

			const depthIndicator = container.querySelector('.relation-tree-depth-indicator');
			expect(depthIndicator).toBeFalsy();
		});

		it('should allow updating options', () => {
			const renderer = new TreeRenderer(mockApp);

			renderer.updateOptions({ showDepth: true });

			const node = createTreeNode('A', 1);

			renderer.render(node, container);

			const depthIndicator = container.querySelector('.relation-tree-depth-indicator');
			expect(depthIndicator).toBeTruthy();
		});

		it('should use custom CSS prefix when provided', () => {
			const renderer = new TreeRenderer(mockApp, { cssPrefix: 'custom-tree' });

			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			expect(container.classList.contains('custom-tree-container')).toBe(true);
			expect(container.querySelector('.custom-tree-node')).toBeTruthy();
		});

		it('should respect collapsible option set to false', () => {
			const renderer = new TreeRenderer(mockApp, { collapsible: false });

			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			// No toggle should exist
			const toggle = container.querySelector('.relation-tree-toggle');
			expect(toggle).toBeFalsy();

			// No spacer either
			const spacer = container.querySelector('.relation-tree-toggle-spacer');
			expect(spacer).toBeFalsy();
		});
	});

	describe('Utility Methods', () => {
		it('should expand all nodes', () => {
			const renderer = new TreeRenderer(mockApp, { initiallyCollapsed: true });

			// Tree with multiple levels
			const nodeC = createTreeNode('C', 2);
			const nodeB = createTreeNode('B', 1, [nodeC]);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			// Verify initially collapsed
			const childrenContainers = container.querySelectorAll('.relation-tree-children');
			childrenContainers.forEach(container => {
				expect(container.classList.contains('relation-tree-collapsed')).toBe(true);
			});

			// Expand all
			renderer.expandAll();

			// Verify all expanded
			childrenContainers.forEach(container => {
				expect(container.classList.contains('relation-tree-collapsed')).toBe(false);
			});
		});

		it('should collapse all nodes', () => {
			const renderer = new TreeRenderer(mockApp, { initiallyCollapsed: false });

			// Tree with multiple levels
			const nodeC = createTreeNode('C', 2);
			const nodeB = createTreeNode('B', 1, [nodeC]);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			// Verify initially expanded
			const childrenContainers = container.querySelectorAll('.relation-tree-children');
			childrenContainers.forEach(container => {
				expect(container.classList.contains('relation-tree-collapsed')).toBe(false);
			});

			// Collapse all
			renderer.collapseAll();

			// Verify all collapsed
			childrenContainers.forEach(container => {
				expect(container.classList.contains('relation-tree-collapsed')).toBe(true);
			});
		});

		it('should handle expandAll with no children', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			// Should not throw
			expect(() => renderer.expandAll()).not.toThrow();
		});

		it('should handle collapseAll with no children', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			// Should not throw
			expect(() => renderer.collapseAll()).not.toThrow();
		});
	});

	describe('Cleanup', () => {
		it('should clear state on destroy', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			// State should exist
			expect((renderer as any).nodeStates.size).toBeGreaterThan(0);

			// Destroy
			renderer.destroy();

			// State should be cleared
			expect((renderer as any).nodeStates.size).toBe(0);
		});

		it('should allow rendering again after destroy', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);
			renderer.destroy();

			// Should not throw
			expect(() => renderer.render(node, container)).not.toThrow();
		});
	});

	describe('Icons', () => {
		it('should render file icon for all nodes', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			const icon = container.querySelector('.relation-tree-icon');
			expect(icon).toBeTruthy();
			expect(icon?.innerHTML).toContain('svg');
		});

		it('should render toggle icons as SVG', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle');
			expect(toggle?.innerHTML).toContain('svg');
		});
	});

	describe('Complex Trees', () => {
		it('should handle wide tree (many children)', () => {
			const children = Array.from({ length: 10 }, (_, i) =>
				createTreeNode(`Child${i}`, 1)
			);
			const node = createTreeNode('Root', 0, children);

			renderer.render(node, container);

			// All children should be rendered
			children.forEach(child => {
				expect(container.textContent).toContain(child.file.basename);
			});
		});

		it('should handle deep tree (many levels)', () => {
			// Create a chain: A -> B -> C -> D -> E
			let current = createTreeNode('E', 4);
			current = createTreeNode('D', 3, [current]);
			current = createTreeNode('C', 2, [current]);
			current = createTreeNode('B', 1, [current]);
			const root = createTreeNode('A', 0, [current]);

			renderer.render(root, container);

			// All nodes should be present
			['A', 'B', 'C', 'D', 'E'].forEach(name => {
				expect(container.textContent).toContain(name);
			});
		});

		it('should handle tree with mixed depths', () => {
			const nodeD = createTreeNode('D', 2);
			const nodeC = createTreeNode('C', 1, [nodeD]);
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB, nodeC]);

			renderer.render(nodeA, container);

			// All nodes present
			expect(container.textContent).toContain('A');
			expect(container.textContent).toContain('B');
			expect(container.textContent).toContain('C');
			expect(container.textContent).toContain('D');

			// B should not have children container (leaf)
			// C should have children container (has D)
			const childrenContainers = container.querySelectorAll('.relation-tree-children');
			expect(childrenContainers.length).toBe(2); // One for A's children, one for C's children
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty tree gracefully', () => {
			// This shouldn't happen in practice, but test defensive coding
			const node = createTreeNode('A', 0);

			expect(() => renderer.render(node, container)).not.toThrow();
		});

		it('should handle multiple renders to same container', () => {
			const node1 = createTreeNode('A', 0);
			const node2 = createTreeNode('B', 0);

			renderer.render(node1, container);
			expect(container.textContent).toContain('A');

			renderer.render(node2, container);
			expect(container.textContent).toContain('B');
			expect(container.textContent).not.toContain('A');
		});

		it('should handle node with empty basename', () => {
			const file = createMockFile('test.md', '');
			const node: TreeNode = {
				file,
				children: [],
				depth: 0,
				isCycle: false,
				metadata: {}
			};

			expect(() => renderer.render(node, container)).not.toThrow();
		});

		it('should handle depth 0 correctly', () => {
			const node = createTreeNode('A', 0);

			renderer.render(node, container);

			const content = container.querySelector('.relation-tree-node-content') as HTMLElement;
			expect(content.style.getPropertyValue('--tree-depth')).toBe('0');
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA attributes on toggles', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle');
			expect(toggle?.getAttribute('role')).toBe('button');
			expect(toggle?.getAttribute('aria-label')).toBe('Toggle children');
			expect(toggle?.getAttribute('aria-expanded')).toBe('true');
			expect(toggle?.getAttribute('tabindex')).toBe('0');
		});

		it('should have proper ARIA attributes on cycle indicators', () => {
			const node = createTreeNode('A', 0, [], true);

			renderer.render(node, container);

			const indicator = container.querySelector('.relation-tree-cycle-indicator');
			expect(indicator?.getAttribute('aria-label')).toBe('This node is part of a cycle');
			expect(indicator?.getAttribute('title')).toContain('Cycle detected');
		});

		it('should be keyboard navigable', () => {
			const nodeB = createTreeNode('B', 1);
			const nodeA = createTreeNode('A', 0, [nodeB]);

			renderer.render(nodeA, container);

			const toggle = container.querySelector('.relation-tree-toggle') as HTMLElement;
			expect(toggle.getAttribute('tabindex')).toBe('0');
		});
	});
});
