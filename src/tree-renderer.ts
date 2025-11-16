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

		// Create node content wrapper
		const nodeContent = document.createElement('div');
		nodeContent.classList.add(`${this.options.cssPrefix}-node-content`);

		// Store node data on element for context menu access
		nodeContent.setAttribute('data-path', node.file.path);
		nodeContent.setAttribute('data-depth', String(node.depth));

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
			// Check if we have existing state (user manually toggled)
			const existingState = this.nodeStates.get(node.file.path);
			
			// Determine initial collapsed state
			let isCollapsed: boolean;

			if (existingState) {
				// Preserve user's manual toggle state
				isCollapsed = existingState.collapsed;
			} else {
				// Use depth-based logic: collapse when currentDepth + 1 >= initialDepth
				// This means initialDepth = 1 shows only top level nodes (children collapsed)
				isCollapsed = (currentDepth + 1) >= this.options.initialDepth;
			}
			
			// Store state BEFORE calling addCollapseToggle
			// (We'll update the element reference later)
			this.nodeStates.set(node.file.path, {
				collapsed: isCollapsed,
				element: null as any, // Will be set below
			});
		}
	
		// Add collapse toggle if node has children (state is now available)
		if (this.options.collapsible && node.children.length > 0) {
			this.addCollapseToggle(nodeContent, node);
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
			const state = this.nodeStates.get(node.file.path)!;
			
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
	 */
	private addCollapseToggle(element: HTMLElement, node: TreeNode): void {
		const toggle = document.createElement('span');
		toggle.classList.add(`${this.options.cssPrefix}-toggle`);
		toggle.setAttribute('data-file-path', node.file.path);
		toggle.setAttribute('title', `Toggle ${node.file.basename} children`);
		toggle.setAttribute('role', 'button');
		toggle.setAttribute('aria-label', 'Toggle children');
		
		// Get the current state to determine initial icon
		// Note: this is called AFTER the state is stored in nodeStates
		const state = this.nodeStates.get(node.file.path);
		if (!state) {
			console.error(`[TreeRenderer] No state found for ${node.file.path} when adding collapse toggle`);
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
			const filePath = toggleElement.getAttribute('data-file-path');
			if (filePath) {
				this.toggleNode(filePath, toggleElement);
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

			// Track this click for command palette commands (Milestone 4.3B Phase 4)
			if (this.plugin && this.renderContext?.parentField) {
				this.plugin.setLastClickedFile(file, this.renderContext.parentField);
			}

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

			// Track this click for command palette commands (Milestone 4.3B Phase 4)
			if (this.plugin && context.parentField) {
				this.plugin.setLastClickedFile(nodeData.file, context.parentField);
			}

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

				// Track this click for command palette commands (Milestone 4.3B Phase 4)
				if (this.plugin && context.parentField) {
					this.plugin.setLastClickedFile(nodeData.file, context.parentField);
				}

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
	 *
	 * @param filePath - Path of the node to expand all children for
	 */
	expandAllChildren(filePath: string): void {
		console.log('[TreeRenderer] expandAllChildren called for:', filePath);
		console.log('[TreeRenderer] nodeStates size:', this.nodeStates.size);

		const state = this.nodeStates.get(filePath);
		if (!state) {
			console.warn('[TreeRenderer] No state found for:', filePath);
			return;
		}

		// First expand the node itself if it's collapsed
		if (state.collapsed) {
			state.collapsed = false;
			state.element.classList.remove(`${this.options.cssPrefix}-collapsed`);

			// Update toggle icon
			const toggleEl = state.element.parentElement?.querySelector(
				`[data-file-path="${filePath}"]`
			) as HTMLElement;
			if (toggleEl) {
				this.updateToggleIcon(toggleEl, false);
				toggleEl.setAttribute('aria-expanded', 'true');
			}
		}

		// Recursively expand all descendants
		this.expandAllDescendants(filePath);
	}

	/**
	 * Recursively expands all descendants of a node.
	 *
	 * @param filePath - Parent node path
	 */
	private expandAllDescendants(filePath: string): void {
		const parentState = this.nodeStates.get(filePath);
		if (!parentState || !parentState.element) {
			console.warn('[TreeRenderer] Invalid parent state for:', filePath);
			return;
		}

		let expandedCount = 0;
		// Get all node states that are descendants of this path
		for (const [path, state] of this.nodeStates.entries()) {
			if (path === filePath) continue;
			if (!state.element) continue;

			// Check if element is a descendant in the DOM
			if (parentState.element.contains(state.element)) {
				if (state.collapsed) {
					state.collapsed = false;
					state.element.classList.remove(`${this.options.cssPrefix}-collapsed`);

					// Update toggle icon
					const toggleEl = state.element.parentElement?.querySelector(
						`[data-file-path="${path}"]`
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
	 *
	 * @param filePath - Path of the node to collapse all children for
	 */
	collapseAllChildren(filePath: string): void {
		console.log('[TreeRenderer] collapseAllChildren called for:', filePath);
		console.log('[TreeRenderer] nodeStates size:', this.nodeStates.size);

		const state = this.nodeStates.get(filePath);
		if (!state) {
			console.warn('[TreeRenderer] No state found for:', filePath);
			return;
		}

		// First, recursively collapse all descendants (so they're collapsed when re-expanded)
		this.collapseAllDescendants(filePath);

		// Then collapse the node itself (this hides all its children)
		if (!state.collapsed) {
			state.collapsed = true;
			state.element.classList.add(`${this.options.cssPrefix}-collapsed`);

			// Update toggle icon
			const toggleEl = state.element.parentElement?.querySelector(
				`[data-file-path="${filePath}"]`
			) as HTMLElement;
			if (toggleEl) {
				this.updateToggleIcon(toggleEl, true);
				toggleEl.setAttribute('aria-expanded', 'false');
			}
			console.log('[TreeRenderer] Collapsed node itself:', filePath);
		}
	}

	/**
	 * Recursively collapses all descendants of a node.
	 *
	 * @param filePath - Parent node path
	 */
	private collapseAllDescendants(filePath: string): void {
		const parentState = this.nodeStates.get(filePath);
		if (!parentState || !parentState.element) {
			console.warn('[TreeRenderer] Invalid parent state for:', filePath);
			return;
		}

		let collapsedCount = 0;
		// Get all node states that are descendants of this path
		for (const [path, state] of this.nodeStates.entries()) {
			if (path === filePath) continue;
			if (!state.element) continue;

			// Check if element is a descendant in the DOM
			if (parentState.element.contains(state.element)) {
				if (!state.collapsed) {
					state.collapsed = true;
					state.element.classList.add(`${this.options.cssPrefix}-collapsed`);

					// Update toggle icon
					const toggleEl = state.element.parentElement?.querySelector(
						`[data-file-path="${path}"]`
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
	 *
	 * @param filePath - Path of the node to expand to
	 */
	expandToNode(filePath: string): void {
		const targetState = this.nodeStates.get(filePath);
		if (!targetState) return;

		// Find all ancestor paths by traversing up the DOM
		const ancestorPaths: string[] = [];
		let currentElement = targetState.element.parentElement;

		while (currentElement) {
			// Check if this element is a children container
			if (currentElement.classList.contains(`${this.options.cssPrefix}-children`)) {
				// Find the parent node content
				const parentContainer = currentElement.parentElement;
				if (parentContainer) {
					const nodeContent = parentContainer.querySelector(`.${this.options.cssPrefix}-node-content`);
					if (nodeContent) {
						const path = nodeContent.getAttribute('data-path');
						if (path) {
							ancestorPaths.push(path);
						}
					}
				}
			}
			currentElement = currentElement.parentElement;
		}

		// Expand all ancestors
		for (const ancestorPath of ancestorPaths) {
			const state = this.nodeStates.get(ancestorPath);
			if (state && state.collapsed) {
				state.collapsed = false;
				state.element.classList.remove(`${this.options.cssPrefix}-collapsed`);

				// Update toggle icon
				const toggleEl = state.element.parentElement?.querySelector(
					`[data-file-path="${ancestorPath}"]`
				) as HTMLElement;
				if (toggleEl) {
					this.updateToggleIcon(toggleEl, false);
					toggleEl.setAttribute('aria-expanded', 'true');
				}
			}
		}

		// Scroll to the node
		this.scrollToNode(filePath);
	}

	/**
	 * Scrolls to make a node visible with smooth animation.
	 *
	 * @param filePath - Path of the node to scroll to
	 */
	private scrollToNode(filePath: string): void {
		const state = this.nodeStates.get(filePath);
		if (!state || !state.element) return;

		// Find the node content element
		const nodeContent = state.element.parentElement?.querySelector(
			`.${this.options.cssPrefix}-node-content`
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
	 *
	 * @param filePath - Path of the file to find
	 * @returns The DOM element or null if not found
	 */
	findNodeElement(filePath: string): HTMLElement | null {
		const state = this.nodeStates.get(filePath);
		if (!state || !state.element) return null;

		return state.element.parentElement?.querySelector(
			`.${this.options.cssPrefix}-node-content`
		) as HTMLElement | null;
	}

	/**
	 * Destroys the renderer and cleans up state.
	 */
	destroy(): void {
		this.nodeStates.clear();
	}
}
