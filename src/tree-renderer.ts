import { TFile, App } from 'obsidian';
import { TreeNode } from './tree-model';
import { ContextMenuBuilder } from './context-menu-builder';
import type { RelationSidebarView } from './sidebar-view';
import type ParentRelationPlugin from './main';

/**
 * Configuration options for tree rendering
 */
export interface TreeRendererOptions {
	/** Show collapse/expand toggles */
	collapsible?: boolean;

	/**
	 * Initial depth to unfold - nodes at depth <= initialDepth are expanded, beyond are collapsed.
	 * Must be >= 1 (minimum depth). Invalid values (< 1, undefined, null) default to 2.
	 * Example: initialDepth = 1 means only direct children are shown expanded.
	 */
	initialDepth?: number;

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

	/** Enable context menu on tree nodes */
	enableContextMenu?: boolean;
}

/**
 * Context information passed to render() for context menu building
 */
export interface TreeRenderContext {
	/** Which section the tree is in */
	section?: 'ancestors' | 'descendants' | 'siblings';

	/** Currently selected parent field */
	parentField?: string;

	/** Display name of the parent field */
	parentFieldDisplayName?: string;

	/** Display name of the section */
	sectionDisplayName?: string;

	/** Display name of the ancestors section (for siblings menu) */
	ancestorsSectionDisplayName?: string;

	/** Display name of the descendants section (for siblings menu) */
	descendantsSectionDisplayName?: string;

	/** Reference to the sidebar view */
	sidebarView?: RelationSidebarView;
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
	private contextMenuBuilder?: ContextMenuBuilder;
	private renderContext?: TreeRenderContext;
	private plugin?: ParentRelationPlugin;
	private nodeIdCounter: number = 0;

	constructor(
		private app: App,
		options: TreeRendererOptions = {},
		plugin?: ParentRelationPlugin
	) {
		this.plugin = plugin;
		// Set defaults
		this.options = {
			collapsible: options.collapsible ?? true,
			initialDepth: Math.max(1, options.initialDepth ?? 2), // Minimum depth is 1
			showDepth: options.showDepth ?? false,
			cssPrefix: options.cssPrefix ?? 'relation-tree',
			enableNavigation: options.enableNavigation ?? true,
			showCycleIndicators: options.showCycleIndicators ?? true,
			maxRenderDepth: options.maxRenderDepth ?? 100,
			enableContextMenu: options.enableContextMenu ?? false,
		};
	}

	/**
	 * Sets the context menu builder for this renderer.
	 *
	 * @param builder - The context menu builder to use
	 */
	setContextMenuBuilder(builder: ContextMenuBuilder): void {
		this.contextMenuBuilder = builder;
	}

	/**
	 * Renders a tree into a container element.
	 *
	 * @param tree - Root TreeNode to render
	 * @param container - HTML element to render into
	 * @param context - Optional context for context menu building
	 */
	render(tree: TreeNode, container: HTMLElement, context?: TreeRenderContext): void {
		// Clear container
		container.innerHTML = '';

		// Add root CSS class
		container.classList.add(`${this.options.cssPrefix}-container`);

		// Reset state
		this.nodeStates.clear();
		this.nodeIdCounter = 0;

		// Store context for later use
		this.renderContext = context;

		// Attach context menu handler at container level if enabled
		if (this.options.enableContextMenu && this.contextMenuBuilder && context) {
			this.attachContextMenuHandler(container, context);
		}

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

		// Generate unique ID for this node instance
		const uniqueNodeId = `node-${this.nodeIdCounter++}`;

		// Create node content wrapper
		const nodeContent = document.createElement('div');
		nodeContent.classList.add(`${this.options.cssPrefix}-node-content`);

		// Apply metadata CSS classes if available
		if (node.metadata?.className) {
			const classes = node.metadata.className.split(' ').filter(c => c.trim());
			classes.forEach(cls => nodeContent.classList.add(cls));
		}

		// Store node data on element for context menu access
		nodeContent.setAttribute('data-path', node.file.path);
		nodeContent.setAttribute('data-depth', String(node.depth));
		nodeContent.setAttribute('data-node-id', uniqueNodeId);

		// Store the full TreeNode data
		(nodeContent as any).__treeNodeData = node;

		// Make focusable for keyboard navigation and context menu
		if (this.options.enableContextMenu) {
			nodeContent.setAttribute('tabindex', '0');
			nodeContent.setAttribute('role', 'treeitem');
			nodeContent.setAttribute('aria-label', node.file.basename);
		}
	
		// Set depth for indentation (CSS will handle via custom property)
		nodeContent.style.setProperty('--tree-depth', String(node.depth));

		// Add file icon
		const iconEl = document.createElement('span');
		iconEl.classList.add(`${this.options.cssPrefix}-icon`);
		iconEl.innerHTML = this.getFileIcon(node.file);
		nodeContent.appendChild(iconEl);

		// Add file name (clickable if navigation enabled)
		const nameEl = document.createElement('span');
		nameEl.classList.add(`${this.options.cssPrefix}-name`);
		nameEl.textContent = node.file.basename;
		console.log('[Tree Renderer] Rendering node:', node.file.basename, 'path:', node.file.path);

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

		// Pre-calculate state for children if node has any
		if (node.children.length > 0) {
			// Use depth-based logic: collapse when currentDepth + 1 >= initialDepth
			// This means initialDepth = 1 shows only top level nodes (children collapsed)
			const isCollapsed = (currentDepth + 1) >= this.options.initialDepth;

			// Store state BEFORE calling addCollapseToggle using unique node ID
			// (We'll update the element reference later)
			this.nodeStates.set(uniqueNodeId, {
				collapsed: isCollapsed,
				element: null as any, // Will be set below
			});
		}

		// Add collapse toggle if node has children (state is now available)
		if (this.options.collapsible && node.children.length > 0) {
			this.addCollapseToggle(nodeContent, node, uniqueNodeId);
		} else if (this.options.collapsible) {
			// Add spacer for alignment when no toggle
			const spacer = document.createElement('span');
			spacer.classList.add(`${this.options.cssPrefix}-toggle-spacer`);
			nodeContent.appendChild(spacer);
		}

		// Render children
		if (node.children.length > 0) {
			const childrenContainer = document.createElement('div');
			childrenContainer.classList.add(`${this.options.cssPrefix}-children`);

			// Get the state we stored earlier
			const state = this.nodeStates.get(uniqueNodeId)!;
			
			if (state.collapsed) {
				childrenContainer.classList.add(`${this.options.cssPrefix}-collapsed`);
			}
	
			// Update element reference in state
			state.element = childrenContainer;
	
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
	 * @param uniqueNodeId - Unique ID for this node instance
	 */
	private addCollapseToggle(element: HTMLElement, node: TreeNode, uniqueNodeId: string): void {
		const toggle = document.createElement('span');
		toggle.classList.add(`${this.options.cssPrefix}-toggle`);
		toggle.setAttribute('data-node-id', uniqueNodeId);
		toggle.setAttribute('title', `Toggle ${node.file.basename} children`);
		toggle.setAttribute('role', 'button');
		toggle.setAttribute('aria-label', 'Toggle children');

		// Get the current state to determine initial icon
		// Note: this is called AFTER the state is stored in nodeStates
		const state = this.nodeStates.get(uniqueNodeId);
		if (!state) {
			console.error(`[TreeRenderer] No state found for ${uniqueNodeId} when adding collapse toggle`);
			return;
		}

		const isCollapsed = state.collapsed;

		toggle.setAttribute('aria-expanded', String(!isCollapsed));
		toggle.setAttribute('tabindex', '0');

		// Set initial icon
		this.updateToggleIcon(toggle, isCollapsed);

		// Click handler
		toggle.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			this.toggleNode(uniqueNodeId, toggle);
		});

		// Keyboard handler (Enter/Space)
		toggle.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.stopPropagation();
				this.toggleNode(uniqueNodeId, toggle);
			}
		});

		element.appendChild(toggle);
	}

	/**
	 * Toggles the collapsed state of a node.
	 *
	 * @param nodeId - Unique ID of the node to toggle
	 * @param toggleElement - Toggle button element
	 */
	private toggleNode(nodeId: string, toggleElement: HTMLElement): void {
	  const state = this.nodeStates.get(nodeId);
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
		// Clear existing content
		toggleElement.innerHTML = '';

		// Create SVG element
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '16');
		svg.setAttribute('height', '16');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '2');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');

		// Create polyline
		const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		polyline.setAttribute('points', collapsed ? '9 18 15 12 9 6' : '6 9 12 15 18 9');

		// Add click handler to SVG
		svg.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			const nodeId = toggleElement.getAttribute('data-node-id');
			if (nodeId) {
				this.toggleNode(nodeId, toggleElement);
			}
		});

		// Append polyline to SVG
		svg.appendChild(polyline);

		// Append SVG to toggle
		toggleElement.appendChild(svg);
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
			e.stopPropagation();

			// Check for modifier keys for different open modes
			const newLeaf = e.ctrlKey || e.metaKey;

			if (newLeaf) {
				await this.app.workspace.openLinkText(file.path, '', 'split');
			} else {
				await this.app.workspace.openLinkText(file.path, '', false);
			}
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
	 * Renders a cycle indicator for a node with enhanced tooltip showing full cycle path.
	 *
	 * @param element - Node content element
	 * @param node - TreeNode data
	 */
	private renderCycleIndicator(element: HTMLElement, node: TreeNode): void {
		const indicator = document.createElement('span');
		indicator.classList.add(`${this.options.cssPrefix}-cycle-indicator`);

		// Use enhanced tooltip from metadata if available
		let tooltipText = 'Cycle detected: This note is an ancestor of itself';
		let ariaLabel = 'This node is part of a cycle';

		if (node.metadata?.cycleInfo) {
			// Enhanced tooltip with full cycle path
			const cyclePath = node.metadata.cycleInfo.path.join(' → ');
			tooltipText = `Cycle detected: ${cyclePath}\nLength: ${node.metadata.cycleInfo.length} note${node.metadata.cycleInfo.length === 1 ? '' : 's'}`;
			ariaLabel = `Cycle: ${cyclePath}`;
		} else if (node.metadata?.tooltip) {
			// Use metadata tooltip if available
			tooltipText = node.metadata.tooltip;
		}

		indicator.setAttribute('aria-label', ariaLabel);
		indicator.setAttribute('title', tooltipText);

		// Cycle icon (🔄)
		indicator.textContent = '🔄';
		indicator.style.marginLeft = '0.5em';
		indicator.style.cursor = 'help';
		indicator.style.fontSize = '0.9em';

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
		this.nodeStates.forEach((state, nodeId) => {
			if (state.collapsed) {
				// Find toggle element and trigger toggle
				const toggleEl = state.element.parentElement?.querySelector(
					`.${this.options.cssPrefix}-toggle[data-node-id="${nodeId}"]`
				) as HTMLElement;

				if (toggleEl) {
					this.toggleNode(nodeId, toggleEl);
				}
			}
		});
	}

	/**
	 * Collapses all nodes in the tree.
	 */
	collapseAll(): void {
		this.nodeStates.forEach((state, nodeId) => {
			if (!state.collapsed) {
				// Find toggle element and trigger toggle
				const toggleEl = state.element.parentElement?.querySelector(
					`.${this.options.cssPrefix}-toggle[data-node-id="${nodeId}"]`
				) as HTMLElement;

				if (toggleEl) {
					this.toggleNode(nodeId, toggleEl);
				}
			}
		});
	}

	/**
	 * Attaches context menu event handler to tree container.
	 *
	 * Uses event delegation for efficient handling of right-click events.
	 *
	 * @param container - The tree container element
	 * @param context - The render context information
	 */
	private attachContextMenuHandler(
		container: HTMLElement,
		context: TreeRenderContext
	): void {
		// Right-click handler
		container.addEventListener('contextmenu', (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();

			const target = event.target as HTMLElement;
			const nodeEl = target.closest(`.${this.options.cssPrefix}-node-content`) as HTMLElement;

			if (!nodeEl) return;

			const nodeData = this.getNodeDataFromElement(nodeEl);
			if (!nodeData) return;

			// Build menu context
			const menuContext = {
				node: nodeData.node,
				file: nodeData.file,
				section: context.section || 'ancestors',
				parentField: context.parentField || '',
				parentFieldDisplayName: context.parentFieldDisplayName || '',
				sectionDisplayName: context.sectionDisplayName || '',
				ancestorsSectionDisplayName: context.ancestorsSectionDisplayName,
				descendantsSectionDisplayName: context.descendantsSectionDisplayName,
				sidebarView: context.sidebarView!,
				isPinned: context.sidebarView?.isPinnedToCurrentField() || false,
				targetElement: nodeEl,
				event
			};

			// Show context menu
			this.contextMenuBuilder!.showContextMenu(menuContext);
		});

		// Keyboard context menu key handler
		container.addEventListener('keydown', (event: KeyboardEvent) => {
			// Context menu key or Shift+F10
			if (event.key === 'ContextMenu' ||
				(event.shiftKey && event.key === 'F10')) {
				event.preventDefault();
				event.stopPropagation();

				const target = event.target as HTMLElement;
				const nodeEl = target.closest(`.${this.options.cssPrefix}-node-content`) as HTMLElement;

				if (!nodeEl) return;

				const nodeData = this.getNodeDataFromElement(nodeEl);
				if (!nodeData) return;

				// Build menu context (without mouse event)
				const menuContext = {
					node: nodeData.node,
					file: nodeData.file,
					section: context.section || 'ancestors',
					parentField: context.parentField || '',
					parentFieldDisplayName: context.parentFieldDisplayName || '',
					sectionDisplayName: context.sectionDisplayName || '',
					ancestorsSectionDisplayName: context.ancestorsSectionDisplayName,
					descendantsSectionDisplayName: context.descendantsSectionDisplayName,
					sidebarView: context.sidebarView!,
					isPinned: context.sidebarView?.isPinnedToCurrentField() || false,
					targetElement: nodeEl
				};

				// Show context menu at element position
				this.contextMenuBuilder!.showContextMenu(menuContext);
			}
		});
	}

	/**
	 * Extracts node data from a tree node DOM element.
	 *
	 * @param nodeEl - The node content element
	 * @returns Object with node and file, or null if not found
	 */
	private getNodeDataFromElement(nodeEl: HTMLElement): {
		node: TreeNode;
		file: TFile;
	} | null {
		// Get file path from data attribute
		const filePath = nodeEl.getAttribute('data-path');
		if (!filePath) return null;

		// Get file from vault
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return null;

		// Get tree node from stored data
		const nodeData = (nodeEl as any).__treeNodeData;
		if (!nodeData) return null;

		return {
			node: nodeData,
			file
		};
	}

	/**
	 * Expands all descendants of a node.
	 * Note: If the file appears multiple times (due to cycles), operates on all instances.
	 *
	 * @param filePath - Path of the node to expand all children for
	 */
	expandAllChildren(filePath: string): void {
		console.log('[TreeRenderer] expandAllChildren called for:', filePath);
		console.log('[TreeRenderer] nodeStates size:', this.nodeStates.size);

		// Find all node instances for this file path
		const nodeIds = this.findNodeIdsByFilePath(filePath);
		if (nodeIds.length === 0) {
			console.warn('[TreeRenderer] No nodes found for:', filePath);
			return;
		}

		// Expand all instances
		for (const nodeId of nodeIds) {
			const state = this.nodeStates.get(nodeId);
			if (!state) continue;

			// First expand the node itself if it's collapsed
			if (state.collapsed) {
				state.collapsed = false;
				state.element.classList.remove(`${this.options.cssPrefix}-collapsed`);

				// Update toggle icon
				const toggleEl = state.element.parentElement?.querySelector(
					`[data-node-id="${nodeId}"]`
				) as HTMLElement;
				if (toggleEl) {
					this.updateToggleIcon(toggleEl, false);
					toggleEl.setAttribute('aria-expanded', 'true');
				}
			}

			// Recursively expand all descendants
			this.expandAllDescendants(nodeId);
		}
	}

	/**
	 * Recursively expands all descendants of a node.
	 *
	 * @param nodeId - Parent node ID
	 */
	private expandAllDescendants(nodeId: string): void {
		const parentState = this.nodeStates.get(nodeId);
		if (!parentState || !parentState.element) {
			console.warn('[TreeRenderer] Invalid parent state for:', nodeId);
			return;
		}

		let expandedCount = 0;
		// Get all node states that are descendants of this node
		for (const [childNodeId, state] of this.nodeStates.entries()) {
			if (childNodeId === nodeId) continue;
			if (!state.element) continue;

			// Check if element is a descendant in the DOM
			if (parentState.element.contains(state.element)) {
				if (state.collapsed) {
					state.collapsed = false;
					state.element.classList.remove(`${this.options.cssPrefix}-collapsed`);

					// Update toggle icon
					const toggleEl = state.element.parentElement?.querySelector(
						`[data-node-id="${childNodeId}"]`
					) as HTMLElement;
					if (toggleEl) {
						this.updateToggleIcon(toggleEl, false);
						toggleEl.setAttribute('aria-expanded', 'true');
					}
					expandedCount++;
				}
			}
		}
		console.log('[TreeRenderer] Expanded', expandedCount, 'descendants');
	}

	/**
	 * Collapses all descendants of a node.
	 * Note: If the file appears multiple times (due to cycles), operates on all instances.
	 *
	 * @param filePath - Path of the node to collapse all children for
	 */
	collapseAllChildren(filePath: string): void {
		console.log('[TreeRenderer] collapseAllChildren called for:', filePath);
		console.log('[TreeRenderer] nodeStates size:', this.nodeStates.size);

		// Find all node instances for this file path
		const nodeIds = this.findNodeIdsByFilePath(filePath);
		if (nodeIds.length === 0) {
			console.warn('[TreeRenderer] No nodes found for:', filePath);
			return;
		}

		// Collapse all instances
		for (const nodeId of nodeIds) {
			const state = this.nodeStates.get(nodeId);
			if (!state) continue;

			// First, recursively collapse all descendants (so they're collapsed when re-expanded)
			this.collapseAllDescendants(nodeId);

			// Then collapse the node itself (this hides all its children)
			if (!state.collapsed) {
				state.collapsed = true;
				state.element.classList.add(`${this.options.cssPrefix}-collapsed`);

				// Update toggle icon
				const toggleEl = state.element.parentElement?.querySelector(
					`[data-node-id="${nodeId}"]`
				) as HTMLElement;
				if (toggleEl) {
					this.updateToggleIcon(toggleEl, true);
					toggleEl.setAttribute('aria-expanded', 'false');
				}
				console.log('[TreeRenderer] Collapsed node itself:', nodeId);
			}
		}
	}

	/**
	 * Recursively collapses all descendants of a node.
	 *
	 * @param nodeId - Parent node ID
	 */
	private collapseAllDescendants(nodeId: string): void {
		const parentState = this.nodeStates.get(nodeId);
		if (!parentState || !parentState.element) {
			console.warn('[TreeRenderer] Invalid parent state for:', nodeId);
			return;
		}

		let collapsedCount = 0;
		// Get all node states that are descendants of this node
		for (const [childNodeId, state] of this.nodeStates.entries()) {
			if (childNodeId === nodeId) continue;
			if (!state.element) continue;

			// Check if element is a descendant in the DOM
			if (parentState.element.contains(state.element)) {
				if (!state.collapsed) {
					state.collapsed = true;
					state.element.classList.add(`${this.options.cssPrefix}-collapsed`);

					// Update toggle icon
					const toggleEl = state.element.parentElement?.querySelector(
						`[data-node-id="${childNodeId}"]`
					) as HTMLElement;
					if (toggleEl) {
						this.updateToggleIcon(toggleEl, true);
						toggleEl.setAttribute('aria-expanded', 'false');
					}
					collapsedCount++;
				}
			}
		}
		console.log('[TreeRenderer] Collapsed', collapsedCount, 'descendants');
	}

	/**
	 * Expands all ancestors to make a specific node visible and scrolls to it.
	 * Note: If the file appears multiple times (due to cycles), operates on the first instance.
	 *
	 * @param filePath - Path of the node to expand to
	 */
	expandToNode(filePath: string): void {
		// Find first node instance for this file path
		const nodeIds = this.findNodeIdsByFilePath(filePath);
		if (nodeIds.length === 0) return;

		const nodeId = nodeIds[0]; // Use first instance
		const targetState = this.nodeStates.get(nodeId);
		if (!targetState) return;

		// Find all ancestor node IDs by traversing up the DOM
		const ancestorNodeIds: string[] = [];
		let currentElement = targetState.element.parentElement;

		while (currentElement) {
			// Check if this element is a children container
			if (currentElement.classList.contains(`${this.options.cssPrefix}-children`)) {
				// Find the parent node content
				const parentContainer = currentElement.parentElement;
				if (parentContainer) {
					const nodeContent = parentContainer.querySelector(`.${this.options.cssPrefix}-node-content`);
					if (nodeContent) {
						const ancestorNodeId = nodeContent.getAttribute('data-node-id');
						if (ancestorNodeId) {
							ancestorNodeIds.push(ancestorNodeId);
						}
					}
				}
			}
			currentElement = currentElement.parentElement;
		}

		// Expand all ancestors
		for (const ancestorNodeId of ancestorNodeIds) {
			const state = this.nodeStates.get(ancestorNodeId);
			if (state && state.collapsed) {
				state.collapsed = false;
				state.element.classList.remove(`${this.options.cssPrefix}-collapsed`);

				// Update toggle icon
				const toggleEl = state.element.parentElement?.querySelector(
					`[data-node-id="${ancestorNodeId}"]`
				) as HTMLElement;
				if (toggleEl) {
					this.updateToggleIcon(toggleEl, false);
					toggleEl.setAttribute('aria-expanded', 'true');
				}
			}
		}

		// Scroll to the node
		this.scrollToNode(nodeId);
	}

	/**
	 * Scrolls to make a node visible with smooth animation.
	 *
	 * @param nodeId - Unique ID of the node to scroll to
	 */
	private scrollToNode(nodeId: string): void {
		const state = this.nodeStates.get(nodeId);
		if (!state || !state.element) return;

		// Find the node content element
		const nodeContent = state.element.parentElement?.querySelector(
			`.${this.options.cssPrefix}-node-content[data-node-id="${nodeId}"]`
		) as HTMLElement;

		if (nodeContent) {
			// Scroll with smooth behavior
			nodeContent.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'nearest'
			});

			// Add a highlight effect
			nodeContent.classList.add(`${this.options.cssPrefix}-highlight`);
			setTimeout(() => {
				nodeContent.classList.remove(`${this.options.cssPrefix}-highlight`);
			}, 2000);
		}
	}

	/**
	 * Finds the DOM element for a given file path.
	 * Note: If the file appears multiple times (due to cycles), returns the first instance.
	 *
	 * @param filePath - Path of the file to find
	 * @returns The DOM element or null if not found
	 */
	findNodeElement(filePath: string): HTMLElement | null {
		// Find first node instance for this file path
		const nodeIds = this.findNodeIdsByFilePath(filePath);
		if (nodeIds.length === 0) return null;

		const nodeId = nodeIds[0]; // Use first instance
		const state = this.nodeStates.get(nodeId);
		if (!state || !state.element) return null;

		return state.element.parentElement?.querySelector(
			`.${this.options.cssPrefix}-node-content[data-node-id="${nodeId}"]`
		) as HTMLElement | null;
	}

	/**
	 * Finds all node IDs for a given file path.
	 * Returns all node instances that match the file path (useful when same file appears multiple times due to cycles).
	 *
	 * @param filePath - Path of the file to find
	 * @returns Array of node IDs matching the file path
	 */
	private findNodeIdsByFilePath(filePath: string): string[] {
		const nodeIds: string[] = [];

		// Search through all states to find matching nodes
		this.nodeStates.forEach((state, nodeId) => {
			if (!state.element) return;

			// Find the node content element
			const nodeContent = state.element.parentElement?.querySelector(
				`.${this.options.cssPrefix}-node-content[data-path="${filePath}"]`
			);

			if (nodeContent && nodeContent.getAttribute('data-node-id') === nodeId) {
				nodeIds.push(nodeId);
			}
		});

		return nodeIds;
	}

	/**
	 * Destroys the renderer and cleans up state.
	 */
	destroy(): void {
		this.nodeStates.clear();
	}
}
