import { TFile, App } from 'obsidian';
import { TreeNode } from './tree-model';

/**
 * Configuration options for tree rendering
 */
export interface TreeRendererOptions {
	/** Show collapse/expand toggles */
	collapsible?: boolean;

	/** Initial collapsed state for all nodes */
	initiallyCollapsed?: boolean;

	/** Show depth indicators */
	showDepth?: boolean;

	/** Custom CSS class prefix */
	cssPrefix?: string;

	/** Enable click navigation to files */
	enableNavigation?: boolean;

	/** Show cycle warnings */
	showCycleIndicators?: boolean;

	/** Maximum depth to render (prevents huge trees) */
	maxRenderDepth?: number;
}

/**
 * State tracking for collapsed/expanded nodes
 */
interface NodeState {
	collapsed: boolean;
	element: HTMLElement;
}

/**
 * Generic tree renderer for converting TreeNode structures to DOM.
 *
 * Supports:
 * - Collapsible/expandable nodes
 * - Click navigation to files
 * - Cycle indicators
 * - Keyboard navigation
 * - Theme-aware styling
 */
export class TreeRenderer {
	private options: Required<TreeRendererOptions>;
	private nodeStates: Map<string, NodeState> = new Map();

	constructor(
		private app: App,
		options: TreeRendererOptions = {}
	) {
		// Set defaults
		this.options = {
			collapsible: options.collapsible ?? true,
			initiallyCollapsed: options.initiallyCollapsed ?? false,
			showDepth: options.showDepth ?? false,
			cssPrefix: options.cssPrefix ?? 'relation-tree',
			enableNavigation: options.enableNavigation ?? true,
			showCycleIndicators: options.showCycleIndicators ?? true,
			maxRenderDepth: options.maxRenderDepth ?? 100,
		};
	}

	/**
	 * Renders a tree into a container element.
	 *
	 * @param tree - Root TreeNode to render
	 * @param container - HTML element to render into
	 */
	render(tree: TreeNode, container: HTMLElement): void {
		// Clear container
		container.innerHTML = '';

		// Add root CSS class
		container.classList.add(`${this.options.cssPrefix}-container`);

		// Reset state
		this.nodeStates.clear();

		// Render root node and its children
		const rootElement = this.renderNode(tree, 0);
		container.appendChild(rootElement);
	}

	/**
	 * Renders a single tree node and its children recursively.
	 *
	 * @param node - TreeNode to render
	 * @param currentDepth - Current depth for depth limiting
	 * @returns HTMLElement representing the node
	 */
	renderNode(node: TreeNode, currentDepth: number): HTMLElement {
		const nodeContainer = document.createElement('div');
		nodeContainer.classList.add(`${this.options.cssPrefix}-node`);

		// Check depth limit
		if (currentDepth >= this.options.maxRenderDepth) {
			const depthLimit = document.createElement('div');
			depthLimit.classList.add(`${this.options.cssPrefix}-depth-limit`);
			depthLimit.textContent = '(depth limit reached)';
			nodeContainer.appendChild(depthLimit);
			return nodeContainer;
		}

		// Create node content wrapper
		const nodeContent = document.createElement('div');
		nodeContent.classList.add(`${this.options.cssPrefix}-node-content`);

		// Set depth for indentation (CSS will handle via custom property)
		nodeContent.style.setProperty('--tree-depth', String(node.depth));

		// Add collapse toggle if node has children
		if (this.options.collapsible && node.children.length > 0) {
			this.addCollapseToggle(nodeContent, node);
		} else if (this.options.collapsible) {
			// Add spacer for alignment when no toggle
			const spacer = document.createElement('span');
			spacer.classList.add(`${this.options.cssPrefix}-toggle-spacer`);
			nodeContent.appendChild(spacer);
		}

		// Add file icon
		const iconEl = document.createElement('span');
		iconEl.classList.add(`${this.options.cssPrefix}-icon`);
		iconEl.innerHTML = this.getFileIcon(node.file);
		nodeContent.appendChild(iconEl);

		// Add file name (clickable if navigation enabled)
		const nameEl = document.createElement('span');
		nameEl.classList.add(`${this.options.cssPrefix}-name`);
		nameEl.textContent = node.file.basename;

		if (this.options.enableNavigation) {
			nameEl.classList.add(`${this.options.cssPrefix}-name-clickable`);
			this.addNavigationHandler(nameEl, node.file);
		}
		nodeContent.appendChild(nameEl);

		// Add cycle indicator if needed
		if (this.options.showCycleIndicators && node.isCycle) {
			this.renderCycleIndicator(nodeContent, node);
		}

		// Add depth indicator if enabled
		if (this.options.showDepth) {
			const depthIndicator = document.createElement('span');
			depthIndicator.classList.add(`${this.options.cssPrefix}-depth-indicator`);
			depthIndicator.textContent = `[${node.depth}]`;
			nodeContent.appendChild(depthIndicator);
		}

		nodeContainer.appendChild(nodeContent);

		// Render children
		if (node.children.length > 0) {
			const childrenContainer = document.createElement('div');
			childrenContainer.classList.add(`${this.options.cssPrefix}-children`);

			// Set initial collapsed state
			const isCollapsed = this.options.initiallyCollapsed;
			if (isCollapsed) {
				childrenContainer.classList.add(`${this.options.cssPrefix}-collapsed`);
			}

			// Store state
			this.nodeStates.set(node.file.path, {
				collapsed: isCollapsed,
				element: childrenContainer,
			});

			// Render each child
			node.children.forEach(child => {
				const childElement = this.renderNode(child, currentDepth + 1);
				childrenContainer.appendChild(childElement);
			});

			nodeContainer.appendChild(childrenContainer);
		}

		return nodeContainer;
	}

	/**
	 * Adds a collapse/expand toggle to a node element.
	 *
	 * @param element - Node content element
	 * @param node - TreeNode data
	 */
	private addCollapseToggle(element: HTMLElement, node: TreeNode): void {
		const toggle = document.createElement('span');
		toggle.classList.add(`${this.options.cssPrefix}-toggle`);
		toggle.setAttribute('role', 'button');
		toggle.setAttribute('aria-label', 'Toggle children');
		toggle.setAttribute('aria-expanded', String(!this.options.initiallyCollapsed));
		toggle.setAttribute('tabindex', '0');

		// Set initial icon
		this.updateToggleIcon(toggle, this.options.initiallyCollapsed);

		// Click handler
		toggle.addEventListener('click', (e) => {
			e.stopPropagation();
			this.toggleNode(node.file.path, toggle);
		});

		// Keyboard handler (Enter/Space)
		toggle.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.stopPropagation();
				this.toggleNode(node.file.path, toggle);
			}
		});

		element.appendChild(toggle);
	}

	/**
	 * Toggles the collapsed state of a node.
	 *
	 * @param filePath - Path of the file node to toggle
	 * @param toggleElement - Toggle button element
	 */
	private toggleNode(filePath: string, toggleElement: HTMLElement): void {
		const state = this.nodeStates.get(filePath);
		if (!state) return;

		// Toggle state
		state.collapsed = !state.collapsed;

		// Update DOM
		if (state.collapsed) {
			state.element.classList.add(`${this.options.cssPrefix}-collapsed`);
		} else {
			state.element.classList.remove(`${this.options.cssPrefix}-collapsed`);
		}

		// Update toggle icon and aria
		this.updateToggleIcon(toggleElement, state.collapsed);
		toggleElement.setAttribute('aria-expanded', String(!state.collapsed));
	}

	/**
	 * Updates the toggle icon based on collapsed state.
	 *
	 * @param toggleElement - Toggle button element
	 * @param collapsed - Whether node is collapsed
	 */
	private updateToggleIcon(toggleElement: HTMLElement, collapsed: boolean): void {
		// Use Lucide icons that Obsidian provides
		toggleElement.innerHTML = collapsed
			? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>'
			: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
	}

	/**
	 * Adds click handler for navigating to a file.
	 *
	 * @param element - Element to make clickable
	 * @param file - File to navigate to
	 */
	private addNavigationHandler(element: HTMLElement, file: TFile): void {
		element.addEventListener('click', async (e) => {
			e.preventDefault();

			// Check for modifier keys for different open modes
			const newLeaf = e.ctrlKey || e.metaKey;

			await this.app.workspace.openLinkText(
				file.path,
				'',
				newLeaf ? 'split' : false
			);
		});

		// Add hover effect
		element.addEventListener('mouseenter', () => {
			this.app.workspace.trigger('hover-link', {
				event: new MouseEvent('mouseenter'),
				source: 'relation-tree',
				hoverParent: element,
				targetEl: element,
				linktext: file.path,
			});
		});
	}

	/**
	 * Renders a cycle indicator for a node.
	 *
	 * @param element - Node content element
	 * @param node - TreeNode data
	 */
	private renderCycleIndicator(element: HTMLElement, node: TreeNode): void {
		const indicator = document.createElement('span');
		indicator.classList.add(`${this.options.cssPrefix}-cycle-indicator`);
		indicator.setAttribute('aria-label', 'This node is part of a cycle');
		indicator.setAttribute('title', 'Cycle detected: This note is an ancestor of itself');

		// Warning icon
		indicator.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

		element.appendChild(indicator);
	}

	/**
	 * Gets the appropriate icon for a file.
	 *
	 * @param file - File to get icon for
	 * @returns SVG icon HTML string
	 */
	private getFileIcon(file: TFile): string {
		// Use Obsidian's file icon
		return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
	}

	/**
	 * Updates renderer options.
	 *
	 * @param options - New options to merge
	 */
	updateOptions(options: Partial<TreeRendererOptions>): void {
		Object.assign(this.options, options);
	}

	/**
	 * Expands all nodes in the tree.
	 */
	expandAll(): void {
		this.nodeStates.forEach((state, path) => {
			if (state.collapsed) {
				// Find toggle element and trigger toggle
				const toggleEl = state.element.parentElement?.querySelector(
					`.${this.options.cssPrefix}-toggle`
				) as HTMLElement;

				if (toggleEl) {
					this.toggleNode(path, toggleEl);
				}
			}
		});
	}

	/**
	 * Collapses all nodes in the tree.
	 */
	collapseAll(): void {
		this.nodeStates.forEach((state, path) => {
			if (!state.collapsed) {
				// Find toggle element and trigger toggle
				const toggleEl = state.element.parentElement?.querySelector(
					`.${this.options.cssPrefix}-toggle`
				) as HTMLElement;

				if (toggleEl) {
					this.toggleNode(path, toggleEl);
				}
			}
		});
	}

	/**
	 * Destroys the renderer and cleans up state.
	 */
	destroy(): void {
		this.nodeStates.clear();
	}
}
