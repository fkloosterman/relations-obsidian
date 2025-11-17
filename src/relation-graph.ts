import { App, TFile } from 'obsidian';
import { CycleDetector, CycleInfo } from './cycle-detector';
import { GraphValidator, DiagnosticInfo } from './graph-validator';
import { FrontmatterCache } from './frontmatter-cache';

export interface NodeInfo {
  file: TFile;
  parents: TFile[];
  children: TFile[];
}

export class RelationGraph {
  private graph = new Map<string, NodeInfo>();
  private cycleDetector!: CycleDetector;
  private graphValidator!: GraphValidator;
  private maxDepth: number;
  private frontmatterCache: FrontmatterCache;

  constructor(
    private app: App,
    private parentField: string,
    maxDepth: number = 5,
    frontmatterCache: FrontmatterCache
  ) {
    this.maxDepth = maxDepth;
    this.frontmatterCache = frontmatterCache;
  }

  build() {
    const files = this.app.vault.getMarkdownFiles();
    console.log(`[RelationGraph] Building graph from ${files.length} markdown files`);
    this.graph.clear();

    files.forEach(file => {
      const parentLinks = this.extractParentLinks(file);
      this.graph.set(file.path, { file, parents: parentLinks, children: [] });
    });

    console.log(`[RelationGraph] Graph built with ${this.graph.size} nodes`);

    for (const node of this.graph.values()) {
      node.parents.forEach(parent => {
        this.graph.get(parent.path)?.children.push(node.file);
      });
    }


    // Initialize cycle detector and validator after graph is built
    this.cycleDetector = new CycleDetector(this);
    this.graphValidator = new GraphValidator(this, this.cycleDetector);
  }

  /**
   * Extracts parent links from file metadata using the frontmatter cache.
   *
   * @param file - The file to extract parent links from
   * @returns Array of parent files
   */
  private extractParentLinks(file: TFile): TFile[] {
    // Use frontmatter cache instead of direct metadata access
    const value = this.frontmatterCache.getFieldValue(file, this.parentField);

    if (!value) return [];

    const links = Array.isArray(value) ? value : [value];
    const parentFiles: TFile[] = [];

    for (const link of links) {
      if (typeof link !== 'string') continue;

      // Remove [[]] if present and get the link
      const cleanLink = link.replace(/[\[\]]/g, '');
      const linkedFile = this.app.metadataCache.getFirstLinkpathDest(cleanLink, file.path);

      if (linkedFile) {
        parentFiles.push(linkedFile);
      }
    }

    return parentFiles;
  }

  getParents(file: TFile): TFile[] {
    return this.graph.get(file.path)?.parents || [];
  }

  getChildren(file: TFile): TFile[] {
    return this.graph.get(file.path)?.children || [];
  }

  /**
   * Checks if a file has the parent field in its frontmatter.
   * Returns true even if the field is empty.
   *
   * @param file - The file to check
   * @returns True if the file has the parent field, false otherwise
   */
  hasParentField(file: TFile): boolean {
    return this.frontmatterCache.hasField(file, this.parentField);
  }

  /**
   * Gets a file by its path.
   *
   * @param path - The file path to look up
   * @returns The TFile object if found, null otherwise
   */
  getFileByPath(path: string): TFile | null {
    const node = this.graph.get(path);
    return node?.file ?? null;
  }

  /**
   * Gets all files in the graph.
   *
   * @returns Array of all TFile objects in the graph
   */
  getAllFiles(): TFile[] {
    return Array.from(this.graph.values()).map(node => node.file);
  }

  /**
   * Gets the maximum depth setting for traversals.
   *
   * @returns Maximum depth from plugin settings
   */
  getMaxDepth(): number {
    return this.maxDepth;
  }

  /**
   * Updates the maximum depth setting.
   *
   * @param maxDepth - New maximum depth value
   */
  setMaxDepth(maxDepth: number): void {
    this.maxDepth = maxDepth;
  }

  /**
   * Detects if there is a cycle involving the specified file.
   *
   * @param file - The file to check for cycles
   * @returns CycleInfo if a cycle is found, null otherwise
   */
  detectCycle(file: TFile): CycleInfo | null {
    if (!this.cycleDetector) {
      this.cycleDetector = new CycleDetector(this);
      this.graphValidator = new GraphValidator(this, this.cycleDetector);
    }
    return this.cycleDetector.detectCycle(file);
  }

  /**
   * Gets detailed information about a cycle involving the specified file.
   *
   * @param file - The file to check
   * @returns CycleInfo with cycle path details, or null if no cycle
   */
  getCycleInfo(file: TFile): CycleInfo | null {
    return this.cycleDetector.getCycleInfo(file);
  }

  /**
   * Checks if the graph has cycle detection support initialized.
   *
   * @returns true if cycle detector is available
   */
  supportsCycleDetection(): boolean {
    return !!this.cycleDetector;
  }

  /**
   * Checks if the graph contains any cycles.
   *
   * @returns true if any cycle exists in the graph
   */
  hasCycles(): boolean {
    if (!this.cycleDetector) {
      this.cycleDetector = new CycleDetector(this);
    }
    if (!this.graphValidator) {
      this.graphValidator = new GraphValidator(this, this.cycleDetector);
    }
    return this.getAllCycles().length > 0;
  }

  /**
   * Updates a single node and its immediate relations.
   * More efficient than full rebuild for single file changes.
   *
   * @param file - The file to update
   */
  updateNode(file: TFile): void {
    const newParents = this.extractParentLinks(file);

    const existingNode = this.graph.get(file.path);

    if (!existingNode) {
      // New file - add it to graph
      this.graph.set(file.path, { file, parents: newParents, children: [] });

      // Add to new parents' children
      newParents.forEach(parent => {
        const parentNode = this.graph.get(parent.path);
        if (parentNode) {
          parentNode.children.push(file);
        }
      });
    } else {
      // Existing file - update parents
      const oldParents = existingNode.parents;

      // Remove from old parents' children
      oldParents.forEach(oldParent => {
        const parentNode = this.graph.get(oldParent.path);
        if (parentNode) {
          parentNode.children = parentNode.children.filter(
            child => child.path !== file.path
          );
        }
      });

      // Update node's parents
      existingNode.parents = newParents;

      // Add to new parents' children
      newParents.forEach(newParent => {
        const parentNode = this.graph.get(newParent.path);
        if (parentNode && !parentNode.children.some(c => c.path === file.path)) {
          parentNode.children.push(file);
        }
      });
    }

    // Rebuild cycle detector and validator (fast operation)
    this.cycleDetector = new CycleDetector(this);
    this.graphValidator = new GraphValidator(this, this.cycleDetector);
  }

  /**
   * Removes a node from the graph.
   * Called when a file is deleted from the vault.
   *
   * @param file - The file to remove
   */
  removeNode(file: TFile): void {
    const node = this.graph.get(file.path);
    if (!node) return;

    // Remove from all parents' children
    node.parents.forEach(parent => {
      const parentNode = this.graph.get(parent.path);
      if (parentNode) {
        parentNode.children = parentNode.children.filter(
          child => child.path !== file.path
        );
      }
    });

    // Remove from all children's parents
    node.children.forEach(child => {
      const childNode = this.graph.get(child.path);
      if (childNode) {
        childNode.parents = childNode.parents.filter(
          parent => parent.path !== file.path
        );
      }
    });

    // Remove from graph
    this.graph.delete(file.path);

    // Rebuild cycle detector and validator
    this.cycleDetector = new CycleDetector(this);
    this.graphValidator = new GraphValidator(this, this.cycleDetector);
  }

  /**
   * Updates references after a file rename.
   * Maintains all relationships while updating the file path.
   *
   * @param file - The renamed file (with new path)
   * @param oldPath - The old file path
   */
  renameNode(file: TFile, oldPath: string): void {
  	console.log('[Relation Graph] renameNode called:', oldPath, '->', file.path, 'basename:', file.basename);
  	const node = this.graph.get(oldPath);
  	if (!node) {
  		console.log('[Relation Graph] No node found for oldPath:', oldPath);
  		return;
  	}
 
  	// Update node's file reference
  	node.file = file;
 
  	// Move to new key in map
  	this.graph.delete(oldPath);
  	this.graph.set(file.path, node);
 
  	// Update parent references in children
  	node.children.forEach(child => {
  		const childNode = this.graph.get(child.path);
  		if (childNode) {
  			const parentIndex = childNode.parents.findIndex(p => p.path === oldPath);
  			if (parentIndex >= 0) {
  				childNode.parents[parentIndex] = file;
  			}
  		}
  	});
 
  	// Update child references in parents
  	node.parents.forEach(parent => {
  		const parentNode = this.graph.get(parent.path);
  		if (parentNode) {
  			const childIndex = parentNode.children.findIndex(c => c.path === oldPath);
  			if (childIndex >= 0) {
  				parentNode.children[childIndex] = file;
  			}
  		}
  	});
 
  	// Rebuild cycle detector and validator
  	this.cycleDetector = new CycleDetector(this);
  	this.graphValidator = new GraphValidator(this, this.cycleDetector);
  }

  /**
   * Validates the graph and returns diagnostic information.
   *
   * @returns Complete diagnostic report
   */
  validateGraph(): DiagnosticInfo {
    return this.graphValidator.validateGraph();
  }

  /**
   * Gets diagnostic information about graph health.
   *
   * @returns Diagnostic report
   */
  getDiagnostics(): DiagnosticInfo {
    return this.graphValidator.getDiagnostics();
  }

  /**
   * Finds all cycles in the graph.
   *
   * @returns Array of all detected cycles
   */
  getAllCycles(): CycleInfo[] {
    return this.graphValidator.getAllCycles();
  }

  /**
   * Extracts raw parent link strings from frontmatter (for validation).
   * Returns unresolved link text as it appears in frontmatter.
   *
   * @param file - The file to extract from
   * @returns Array of parent link strings (unresolved)
   */
  extractParentLinksRaw(file: TFile): string[] {
    const meta = this.app.metadataCache.getFileCache(file);
    if (!meta?.frontmatter) return [];

    const parentValue = meta.frontmatter[this.parentField];

    if (!parentValue) return [];

    // Handle array
    if (Array.isArray(parentValue)) {
      return parentValue.map(v => String(v).replace(/[\[\]]/g, ''));
    }

    // Handle single value
    return [String(parentValue).replace(/[\[\]]/g, '')];
  }
}