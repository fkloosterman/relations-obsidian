import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, Notice, Modal, setIcon, MarkdownRenderer } from 'obsidian';
import { RelationGraph } from './relation-graph';
import { RelationshipEngine } from './relationship-engine';
import { DiagnosticSeverity } from './graph-validator';
import { VIEW_TYPE_RELATION_SIDEBAR, RelationSidebarView } from './sidebar-view';
import { FrontmatterCache } from './frontmatter-cache';
import { CodeblockProcessor, createCodeblockProcessor } from './codeblock-processor';
import {
  AncestorQueryResult,
  DescendantQueryResult,
  SiblingQueryResult,
  CousinQueryResult,
  FullLineageResult,
  RelationshipQueryOptions,
  ParentFieldConfig,
  SectionConfig,
  ParentRelationSettings,
  DEFAULT_SETTINGS,
  DEFAULT_PARENT_FIELD_CONFIG,
  validateSettings
} from './types';
import { ParentFieldConfigForm } from './components/parent-field-config-form';
import {
  getPreset,
  getPresetNames,
  getPresetDescription,
  getPresetMetadata
} from './presets/field-configurations';
import { registerNavigationCommands } from './commands/navigation-commands';
import { registerAdvancedNavigationCommands } from './commands/advanced-navigation';
import { registerGraphAnalysisCommands } from './commands/graph-analysis';
import { registerUtilityCommands } from './commands/utility-commands';

export default class ParentRelationPlugin extends Plugin {
  settings!: ParentRelationSettings;

  // Multiple graphs (one per parent field)
  relationGraphs!: Map<string, RelationGraph>;

  // Multiple engines (one per graph)
  relationshipEngines!: Map<string, RelationshipEngine>;

  // Shared frontmatter cache
  frontmatterCache!: FrontmatterCache;

  // Codeblock processor (Milestone 5.1)
  codeblockProcessor!: CodeblockProcessor;

  async onload() {
    await this.loadSettings();

    // Initialize frontmatter cache
    this.frontmatterCache = new FrontmatterCache(this.app);

    // Initialize graphs and engines for each parent field
    this.relationGraphs = new Map();
    this.relationshipEngines = new Map();

    this.settings.parentFields.forEach(fieldConfig => {
      const graph = new RelationGraph(
        this.app,
        fieldConfig.name,
        fieldConfig.ancestors.maxDepth ?? 5,
        this.frontmatterCache
      );

      const engine = new RelationshipEngine(graph);

      this.relationGraphs.set(fieldConfig.name, graph);
      this.relationshipEngines.set(fieldConfig.name, engine);
    });

    // Wait for metadata cache to be ready before building graphs
    if (this.app.workspace.layoutReady) {
      // If workspace is already ready, build immediately
      this.buildAllGraphs();
    } else {
      // Otherwise, wait for layout-ready event
      this.app.workspace.onLayoutReady(() => {
        this.buildAllGraphs();
      });
    }

    // Register sidebar view
    this.registerView(
      VIEW_TYPE_RELATION_SIDEBAR,
      (leaf) => new RelationSidebarView(leaf, this)
    );

    // Add ribbon icon to toggle sidebar
    this.addRibbonIcon('network', 'Toggle Relation Explorer', async () => {
      await this.toggleSidebar();
    });

    // Add command to open sidebar
    this.addCommand({
      id: 'open-relation-sidebar',
      name: 'Open Relation Explorer',
      callback: async () => {
        await this.activateSidebar();
      }
    });

    // Add command to toggle sidebar
    this.addCommand({
      id: 'toggle-relation-sidebar',
      name: 'Toggle Relation Explorer',
      callback: async () => {
        await this.toggleSidebar();
      }
    });

    // Register navigation commands (Milestone 6.1 Phase 1)
    registerNavigationCommands(this);

    // Register advanced navigation commands (Milestone 6.2 Phase 3)
    registerAdvancedNavigationCommands(this);
    registerGraphAnalysisCommands(this);
    registerUtilityCommands(this);

    // Register codeblock processor (Milestone 5.1)
    this.codeblockProcessor = createCodeblockProcessor(this.app, this);
    this.registerMarkdownCodeBlockProcessor(
      'relation-tree',
      (source, el, ctx) => {
        this.codeblockProcessor.process(source, el, ctx);
      }
    );

    this.addSettingTab(new ParentRelationSettingTab(this.app, this));

    // Use incremental updates for better performance
    // Update all graphs on file changes
    this.registerEvent(
      this.app.metadataCache.on('changed', (file: TFile) => {
        this.frontmatterCache.invalidate(file);
        this.relationGraphs.forEach(graph => graph.updateNode(file));
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          this.frontmatterCache.invalidateByPath(oldPath);
          this.frontmatterCache.invalidate(file);
          this.relationGraphs.forEach(graph => graph.renameNode(file, oldPath));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          this.frontmatterCache.invalidate(file);
          this.relationGraphs.forEach(graph => graph.removeNode(file));
        }
      })
    );

    // Add periodic validation in diagnostic mode
    this.registerInterval(
      window.setInterval(() => {
        if (this.settings.diagnosticMode) {
          this.runDiagnostics();
        }
      }, 60000) // Every 60 seconds
    );

    console.log('Parent Relation Explorer loaded');
  }

  /**
   * Builds all graphs.
   */
  buildAllGraphs(): void {
    this.relationGraphs.forEach(graph => graph.build());
  }

  /**
   * Gets the graph for a specific parent field.
   *
   * @param fieldName - The parent field name
   * @returns The RelationGraph instance, or undefined if not found
   */
  getGraphForField(fieldName: string): RelationGraph | undefined {
    return this.relationGraphs.get(fieldName);
  }

  /**
   * Gets the relationship engine for a specific parent field.
   *
   * @param fieldName - The parent field name
   * @returns The RelationshipEngine instance, or undefined if not found
   */
  getEngineForField(fieldName: string): RelationshipEngine | undefined {
    return this.relationshipEngines.get(fieldName);
  }

  onunload() {
    // Detach sidebar views
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_RELATION_SIDEBAR);

    console.log('Parent Relation Explorer unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Migration: Add roots section to existing parent fields that don't have it
    this.settings.parentFields.forEach(fieldConfig => {
      if (!fieldConfig.roots) {
        fieldConfig.roots = {
          displayName: 'Root Notes',
          visible: true,
          collapsed: false,
          sortOrder: 'alphabetical'
        };
      }

      // Migration: Add sectionOrder to existing parent fields that don't have it
      if (!fieldConfig.sectionOrder) {
        fieldConfig.sectionOrder = ['reference', 'roots', 'ancestors', 'descendants', 'siblings'];
      }
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Update maxDepth in all graphs when settings change
    this.settings.parentFields.forEach(fieldConfig => {
      const graph = this.relationGraphs.get(fieldConfig.name);
      if (graph) {
        graph.setMaxDepth(fieldConfig.ancestors.maxDepth ?? 5);
      }
    });
  }

  /**
   * Refreshes all open sidebar views.
   */
  refreshSidebarViews(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_RELATION_SIDEBAR).forEach(leaf => {
      const view = leaf.view;
      if (view && typeof (view as any).refresh === 'function') {
        (view as RelationSidebarView).refresh();
      }
    });
  }

  /**
   * Opens a new sidebar instance pinned to a specific file.
   *
   * @param file - The file to pin to
   * @param parentField - The parent field to show
   */
  async openNewSidebarPinnedTo(
    file: TFile,
    parentField: string
  ): Promise<void> {
    // Get or create a new leaf in the right sidebar
    const leaf = this.app.workspace.getRightLeaf(false);

    if (!leaf) {
      new Notice('Could not create new sidebar');
      return;
    }

    // Open the relation sidebar view
    await leaf.setViewState({
      type: VIEW_TYPE_RELATION_SIDEBAR,
      active: true
    });

    // Get the view and configure it
    const view = leaf.view as RelationSidebarView;
    if (view && view instanceof RelationSidebarView) {
      // Set the parent field
      view.setSelectedParentField(parentField);

      // Pin to the file
      view.pinToFile(file);
    }
  }

  /**
   * Runs graph diagnostics and logs results for all graphs.
   */
  runDiagnostics(): void {
    this.relationGraphs.forEach((graph, fieldName) => {
      console.log(`[Relations] Diagnostics for field "${fieldName}":`);
      const diagnostics = graph.getDiagnostics();
      this.logDiagnostics(diagnostics);
    });
  }

  /**
   * Logs diagnostic information to console.
   *
   * @param diagnostics - Diagnostic report to log
   */
  logDiagnostics(diagnostics: any): void {
    if (!this.settings.diagnosticMode) return;

    const { summary, isHealthy } = diagnostics;

    // Log summary
    console.log(
      `[Relations] Graph Health: ${isHealthy ? '✅ HEALTHY' : '❌ ISSUES FOUND'} ` +
      `(${summary.errors} errors, ${summary.warnings} warnings)`
    );

    // Log errors
    const errors = diagnostics.issues.filter((i: any) => i.severity === DiagnosticSeverity.ERROR);
    if (errors.length > 0) {
      console.group('[Relations] Errors:');
      errors.forEach((issue: any) => {
        console.error(`${issue.type}: ${issue.message}`);
        if (issue.files.length > 0) {
          console.log('  Files:', issue.files.map((f: TFile) => f.basename).join(', '));
        }
      });
      console.groupEnd();
    }

    // Log warnings
    const warnings = diagnostics.issues.filter((i: any) => i.severity === DiagnosticSeverity.WARNING);
    if (warnings.length > 0) {
      console.group('[Relations] Warnings:');
      warnings.forEach((issue: any) => {
        console.warn(`${issue.type}: ${issue.message}`);
      });
      console.groupEnd();
    }

    // Log info (only in diagnostic mode, collapsed)
    const info = diagnostics.issues.filter((i: any) => i.severity === DiagnosticSeverity.INFO);
    if (info.length > 0) {
      console.groupCollapsed('[Relations] Graph Statistics:');
      info.forEach((issue: any) => {
        console.info(issue.message);
        if (issue.context) {
          console.table(issue.context);
        }
      });
      console.groupEnd();
    }
  }

  // ========================================
  // PUBLIC API: Ancestor Queries
  // ========================================

  /**
   * Gets ancestors of a file with detailed metadata.
   *
   * @param file - The file to query
   * @param options - Query options
   * @returns Detailed ancestor query result
   *
   * @example
   * const result = plugin.getAncestors(currentFile);
   * console.log(`Found ${result.totalCount} ancestors in ${result.depth} generations`);
   * result.generations.forEach((gen, i) => {
   *   console.log(`Generation ${i + 1}:`, gen.map(f => f.basename));
   * });
   */
  getAncestors(
    file: TFile,
    options: RelationshipQueryOptions = {}
  ): AncestorQueryResult {
    // Use default field's engine for backward compatibility
    const defaultEngine = this.relationshipEngines.get(this.settings.defaultParentField);
    const defaultField = this.settings.parentFields.find(f => f.name === this.settings.defaultParentField);

    if (!defaultEngine || !defaultField) {
      throw new Error('No default parent field configured');
    }

    const maxDepth = options.maxDepth ?? defaultField.ancestors.maxDepth ?? 5;
    const generations = defaultEngine.getAncestors(file, maxDepth);

    const totalCount = generations.reduce((sum, gen) => sum + gen.length, 0);
    const depth = generations.length;

    // Check if truncated by getting one more generation
    const oneLevelDeeper = defaultEngine.getAncestors(file, maxDepth + 1);
    const wasTruncated = oneLevelDeeper.length > generations.length;

    return {
      file,
      generations,
      totalCount,
      depth,
      wasTruncated
    };
  }

  /**
   * Gets immediate parents of a file.
   *
   * @param file - The file to query
   * @returns Array of parent files
   *
   * @example
   * const parents = plugin.getParents(currentFile);
   * console.log('Parents:', parents.map(f => f.basename));
   */
  getParents(file: TFile): TFile[] {
    // Use default field's graph for backward compatibility
    const defaultGraph = this.relationGraphs.get(this.settings.defaultParentField);
    if (!defaultGraph) {
      throw new Error('No default parent field configured');
    }
    return defaultGraph.getParents(file);
  }

  /**
   * Gets all ancestors as a flat array (all generations combined).
   *
   * @param file - The file to query
   * @param options - Query options
   * @returns Flat array of all ancestor files
   *
   * @example
   * const allAncestors = plugin.getAllAncestors(currentFile);
   * console.log(`Total ancestors: ${allAncestors.length}`);
   */
  getAllAncestors(
    file: TFile,
    options: RelationshipQueryOptions = {}
  ): TFile[] {
    const result = this.getAncestors(file, options);
    return result.generations.flat();
  }

  // ========================================
  // PUBLIC API: Descendant Queries
  // ========================================

  /**
   * Gets descendants of a file with detailed metadata.
   *
   * @param file - The file to query
   * @param options - Query options
   * @returns Detailed descendant query result
   *
   * @example
   * const result = plugin.getDescendants(currentFile);
   * console.log(`Found ${result.totalCount} descendants in ${result.depth} generations`);
   */
  getDescendants(
    file: TFile,
    options: RelationshipQueryOptions = {}
  ): DescendantQueryResult {
    // Use default field's engine for backward compatibility
    const defaultEngine = this.relationshipEngines.get(this.settings.defaultParentField);
    const defaultField = this.settings.parentFields.find(f => f.name === this.settings.defaultParentField);

    if (!defaultEngine || !defaultField) {
      throw new Error('No default parent field configured');
    }

    const maxDepth = options.maxDepth ?? defaultField.descendants.maxDepth ?? 5;
    const generations = defaultEngine.getDescendants(file, maxDepth);

    const totalCount = generations.reduce((sum, gen) => sum + gen.length, 0);
    const depth = generations.length;

    // Check if truncated
    const oneLevelDeeper = defaultEngine.getDescendants(file, maxDepth + 1);
    const wasTruncated = oneLevelDeeper.length > generations.length;

    return {
      file,
      generations,
      totalCount,
      depth,
      wasTruncated
    };
  }

  /**
   * Gets immediate children of a file.
   *
   * @param file - The file to query
   * @returns Array of child files
   *
   * @example
   * const children = plugin.getChildren(currentFile);
   * console.log('Children:', children.map(f => f.basename));
   */
  getChildren(file: TFile): TFile[] {
    // Use default field's graph for backward compatibility
    const defaultGraph = this.relationGraphs.get(this.settings.defaultParentField);
    if (!defaultGraph) {
      throw new Error('No default parent field configured');
    }
    return defaultGraph.getChildren(file);
  }

  /**
   * Gets all descendants as a flat array (all generations combined).
   *
   * @param file - The file to query
   * @param options - Query options
   * @returns Flat array of all descendant files
   *
   * @example
   * const allDescendants = plugin.getAllDescendants(currentFile);
   * console.log(`Total descendants: ${allDescendants.length}`);
   */
  getAllDescendants(
    file: TFile,
    options: RelationshipQueryOptions = {}
  ): TFile[] {
    const result = this.getDescendants(file, options);
    return result.generations.flat();
  }

  // ========================================
  // PUBLIC API: Sibling Queries
  // ========================================

  /**
   * Gets siblings of a file with detailed metadata.
   *
   * @param file - The file to query
   * @param options - Query options
   * @returns Detailed sibling query result
   *
   * @example
   * const result = plugin.getSiblings(currentFile);
   * console.log(`Found ${result.totalCount} siblings`);
   */
  getSiblings(
    file: TFile,
    options: RelationshipQueryOptions = {}
  ): SiblingQueryResult {
    // Use default field's engine for backward compatibility
    const defaultEngine = this.relationshipEngines.get(this.settings.defaultParentField);
    if (!defaultEngine) {
      throw new Error('No default parent field configured');
    }

    const includeSelf = options.includeSelf ?? false;
    const siblings = defaultEngine.getSiblings(file, includeSelf);

    return {
      file,
      siblings,
      totalCount: siblings.length,
      includesSelf: includeSelf
    };
  }

  // ========================================
  // PUBLIC API: Cousin Queries
  // ========================================

  /**
   * Gets cousins of a file with detailed metadata.
   *
   * @param file - The file to query
   * @param options - Query options (includes degree)
   * @returns Detailed cousin query result
   *
   * @example
   * const result = plugin.getCousins(currentFile, { degree: 1 });
   * console.log(`Found ${result.totalCount} first cousins`);
   */
  getCousins(
    file: TFile,
    options: RelationshipQueryOptions = {}
  ): CousinQueryResult {
    // Use default field's engine for backward compatibility
    const defaultEngine = this.relationshipEngines.get(this.settings.defaultParentField);
    if (!defaultEngine) {
      throw new Error('No default parent field configured');
    }

    const degree = options.degree ?? 1;
    const cousins = defaultEngine.getCousins(file, degree);

    return {
      file,
      cousins,
      totalCount: cousins.length,
      degree
    };
  }

  // ========================================
  // PUBLIC API: Combined Queries
  // ========================================

  /**
   * Gets full lineage (ancestors + descendants + siblings) for a file.
   *
   * @param file - The file to query
   * @param options - Query options
   * @returns Complete lineage information
   *
   * @example
   * const lineage = plugin.getFullLineage(currentFile);
   * console.log('Ancestors:', lineage.stats.totalAncestors);
   * console.log('Descendants:', lineage.stats.totalDescendants);
   * console.log('Siblings:', lineage.stats.totalSiblings);
   */
  getFullLineage(
    file: TFile,
    options: RelationshipQueryOptions = {}
  ): FullLineageResult {
    const ancestorResult = this.getAncestors(file, options);
    const descendantResult = this.getDescendants(file, options);
    const siblingResult = this.getSiblings(file, options);

    return {
      file,
      ancestors: ancestorResult.generations,
      descendants: descendantResult.generations,
      siblings: siblingResult.siblings,
      stats: {
        totalAncestors: ancestorResult.totalCount,
        totalDescendants: descendantResult.totalCount,
        totalSiblings: siblingResult.totalCount,
        ancestorDepth: ancestorResult.depth,
        descendantDepth: descendantResult.depth
      }
    };
  }

  // ========================================
  // PUBLIC API: Cycle Detection
  // ========================================

  /**
   * Checks if a file is part of a cycle.
   *
   * @param file - The file to check
   * @returns Cycle information if cycle exists, null otherwise
   *
   * @example
   * const cycleInfo = plugin.detectCycle(currentFile);
   * if (cycleInfo) {
   *   console.warn('Cycle detected:', cycleInfo.description);
   * }
   */
  detectCycle(file: TFile) {
    // Use default field's graph for backward compatibility
    const defaultGraph = this.relationGraphs.get(this.settings.defaultParentField);
    if (!defaultGraph) {
      throw new Error('No default parent field configured');
    }
    return defaultGraph.detectCycle(file);
  }

  /**
   * Checks if the entire graph contains any cycles.
   *
   * @returns true if any cycle exists
   *
   * @example
   * if (plugin.hasCycles()) {
   *   console.warn('Graph contains cycles');
   * }
   */
  supportsCycleDetection(): boolean {
    // Use default field's graph for backward compatibility
    const defaultGraph = this.relationGraphs.get(this.settings.defaultParentField);
    if (!defaultGraph) {
      return false;
    }
    return defaultGraph.supportsCycleDetection();
  }

  // ========================================
  // Sidebar View Management
  // ========================================

  /**
   * Activates the sidebar view (opens if not already open).
   */
  async activateSidebar(): Promise<void> {
    const { workspace } = this.app;

    // Check if view is already open
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_RELATION_SIDEBAR)[0];

    if (!leaf) {
      // Create new leaf in right sidebar
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_RELATION_SIDEBAR,
          active: true
        });
        leaf = rightLeaf;
      }
    }

    // Reveal the leaf
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * Toggles the sidebar view (open/close).
   */
  async toggleSidebar(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_RELATION_SIDEBAR);

    if (leaves.length > 0) {
      // Close all sidebar views
      leaves.forEach(leaf => leaf.detach());
    } else {
      // Open sidebar
      await this.activateSidebar();
    }
  }
}

class ParentRelationSettingTab extends PluginSettingTab {
  plugin: ParentRelationPlugin;
  private configForms: ParentFieldConfigForm[] = [];
  private fieldCollapsedStates: Map<string, boolean> = new Map();

  constructor(app: App, plugin: ParentRelationPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Clear any existing forms
    this.configForms.forEach(form => form.destroy());
    this.configForms = [];

    containerEl.createEl('h2', { text: 'Parent Relation Explorer Settings' });

    // What's new section
    this.renderWhatsNew(containerEl);

    // Documentation and support
    this.renderDocumentationAndSupport(containerEl);

    // Presets section
    this.renderPresets(containerEl);

    // Parent fields configuration
    this.renderParentFieldsConfig(containerEl);

    // Import/Export section
    this.renderImportExport(containerEl);

    // Global settings
    this.renderGlobalSettings(containerEl);
  }

  /**
   * Adds Ko-fi logo SVG to button element
   */
  private addKofiLogo(buttonEl: HTMLElement): void {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('viewBox', '0 0 241 194');
    svg.setAttribute('fill', 'none');
    svg.style.cssText = 'flex-shrink: 0;';

    // Ko-fi logo - all paths with original colors from the SVG
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const paths = [
      // Background layer 1 (white)
      { d: 'M96.1344 193.911C61.1312 193.911 32.6597 178.256 15.9721 149.829C1.19788 124.912 -0.00585938 97.9229 -0.00585938 67.7662C-0.00585938 49.8876 5.37293 34.3215 15.5413 22.7466C24.8861 12.1157 38.1271 5.22907 52.8317 3.35378C70.2858 1.14271 91.9848 0.958984 114.545 0.958984C151.259 0.958984 161.63 1.4088 176.075 2.85328C195.29 4.76026 211.458 11.932 222.824 23.5955C234.368 35.4428 240.469 51.2624 240.469 69.3627V72.9994C240.469 103.885 219.821 129.733 191.046 136.759C188.898 141.827 186.237 146.871 183.089 151.837L183.006 151.964C172.869 167.632 149.042 193.918 103.401 193.918H96.1281L96.1344 193.911Z', fill: 'white' },
      // Background layer 2 (white)
      { d: 'M174.568 17.9772C160.927 16.6151 151.38 16.1589 114.552 16.1589C90.908 16.1589 70.9008 16.387 54.7644 18.4334C33.3949 21.164 15.2058 37.5285 15.2058 67.7674C15.2058 98.0066 16.796 121.422 29.0741 142.107C42.9425 165.751 66.1302 178.707 96.1412 178.707H103.414C140.242 178.707 160.25 159.156 170.253 143.698C174.574 136.874 177.754 130.058 179.801 123.234C205.947 120.96 225.27 99.3624 225.27 72.9941V69.3577C225.27 40.9432 206.631 21.164 174.574 17.9772H174.568Z', fill: 'white' },
      // Cup outline (dark)
      { d: 'M15.1975 67.7674C15.1975 37.5285 33.3866 21.164 54.7559 18.4334C70.8987 16.387 90.906 16.1589 114.544 16.1589C151.372 16.1589 160.919 16.6151 174.559 17.9772C206.617 21.1576 225.255 40.937 225.255 69.3577V72.9941C225.255 99.3687 205.932 120.966 179.786 123.234C177.74 130.058 174.559 136.874 170.238 143.698C160.235 159.156 140.228 178.707 103.4 178.707H96.1264C66.1155 178.707 42.9277 165.751 29.0595 142.107C16.7814 121.422 15.1912 98.4563 15.1912 67.7674', fill: '#202020' },
      // Cup inner (white)
      { d: 'M32.2469 67.9899C32.2469 97.3168 34.0654 116.184 43.6127 133.689C54.5225 153.924 74.3018 161.653 96.8117 161.653H103.857C133.411 161.653 147.736 147.329 155.693 134.829C159.558 128.462 162.966 121.417 164.784 112.547L166.147 106.864H174.332C192.521 106.864 208.208 92.09 208.208 73.2166V69.8082C208.208 48.6669 195.024 37.5228 172.058 34.7987C159.102 33.6646 151.372 33.2084 114.538 33.2084C89.7602 33.2084 72.0272 33.4364 58.6152 35.4828C39.7483 38.2134 32.2407 48.8951 32.2407 67.9899', fill: 'white' },
      // Cup handle detail (dark)
      { d: 'M166.158 83.6801C166.158 86.4107 168.204 88.4572 171.841 88.4572C183.435 88.4572 189.802 81.8619 189.802 70.9523C189.802 60.0427 183.435 53.2195 171.841 53.2195C168.204 53.2195 166.158 55.2657 166.158 57.9963V83.6866V83.6801Z', fill: '#202020' },
      // Heart (Ko-fi orange)
      { d: 'M54.5321 82.3198C54.5321 95.732 62.0332 107.326 71.5807 116.424C77.9478 122.562 87.9515 128.93 94.7685 133.022C96.8147 134.157 98.8611 134.841 101.136 134.841C103.866 134.841 106.134 134.157 107.959 133.022C114.782 128.93 124.779 122.562 130.919 116.424C140.694 107.332 148.195 95.7383 148.195 82.3198C148.195 67.7673 137.286 54.8115 121.599 54.8115C112.28 54.8115 105.912 59.5882 101.136 66.1772C96.8147 59.582 90.2259 54.8115 80.9001 54.8115C64.9855 54.8115 54.5256 67.7673 54.5256 82.3198', fill: '#FF5A16' }
    ];

    paths.forEach(pathData => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData.d);
      path.setAttribute('fill', pathData.fill);
      g.appendChild(path);
    });

    svg.appendChild(g);
    buttonEl.prepend(svg);
  }

  /**
   * Renders what's new section with changelog.
   */
  private renderWhatsNew(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(`What's new in Relation Explorer v${this.plugin.manifest.version}`)
      .setDesc('See the latest features and improvements')
      .addButton(button => {
        button
          .setButtonText('View changelog')
          .onClick(async () => {
            const modal = new ChangelogModal(this.app);
            modal.open();
          });
      });

    new Setting(containerEl)
      .setName('Documentation')
      .setDesc('Learn more about using Relation Explorer')
      .addButton(button => {
        button
          .setButtonText('View documentation')
          .onClick(() => {
            window.open('https://fkloosterman.github.io/relations-obsidian/', '_blank');
          });
      });
  }

  /**
   * Renders support development section.
   */
  private renderDocumentationAndSupport(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Support development')
      .setDesc('If you find Relation Explorer helpful, please consider supporting its development.')
      .addButton(button => {
        const btn = button.buttonEl;
        setIcon(btn, 'heart');
        btn.createSpan({ text: ' Sponsor' });
        btn.addClass('sponsor-button');
        button.onClick(() => {
          window.open('https://github.com/sponsors/fkloosterman', '_blank');
        });
      })
      .addButton(button => {
        const btn = button.buttonEl;
        this.addKofiLogo(btn);
        btn.createSpan({ text: ' Buy me a coffee' });
        btn.addClass('kofi-button');
        button.onClick(() => {
          window.open('https://ko-fi.com/fabiankloosterman', '_blank');
        });
      });
  }

  /**
   * Renders import/export section.
   */
  private renderImportExport(containerEl: HTMLElement): void {
    // Section heading using Obsidian's pattern
    new Setting(containerEl)
      .setName('Configuration')
      .setHeading();

    new Setting(containerEl)
      .setName('Export configuration')
      .setDesc('Save or copy configuration as JSON')
      .addButton(button => {
        button
          .setButtonText('Copy to clipboard')
          .setCta()
          .onClick(async () => {
            const json = JSON.stringify(this.plugin.settings, null, 2);
            await navigator.clipboard.writeText(json);
            new Notice('Configuration copied to clipboard');
          });
      })
      .addButton(button => {
        button
          .setButtonText('Save to file')
          .onClick(async () => {
            try {
              const json = JSON.stringify(this.plugin.settings, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'relation-explorer-config.json';
              a.click();
              URL.revokeObjectURL(url);
              // Note: Browser will show download UI, so we don't need a notice
            } catch (e) {
              new Notice('Failed to save file: ' + (e as Error).message, 5000);
            }
          });
      });

    new Setting(containerEl)
      .setName('Import configuration')
      .setDesc('Load configuration from clipboard or file')
      .addButton(button => {
        button
          .setButtonText('Paste from clipboard')
          .setCta()
          .onClick(async () => {
            try {
              const json = await navigator.clipboard.readText();
              const imported = JSON.parse(json);

              if (validateSettings(imported)) {
                this.plugin.settings = imported;
                await this.plugin.saveSettings();
                await this.rebuildGraphsAndEngines();
                this.display(); // Refresh UI
                new Notice('Configuration imported successfully');
              } else {
                new Notice('Invalid configuration format', 5000);
              }
            } catch (e) {
              new Notice('Failed to parse JSON: ' + (e as Error).message, 5000);
            }
          });
      })
      .addButton(button => {
        button
          .setButtonText('Load from file')
          .onClick(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e: Event) => {
              try {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                const text = await file.text();
                const imported = JSON.parse(text);

                if (validateSettings(imported)) {
                  this.plugin.settings = imported;
                  await this.plugin.saveSettings();
                  await this.rebuildGraphsAndEngines();
                  this.display(); // Refresh UI
                  new Notice('Configuration imported from file');
                } else {
                  new Notice('Invalid configuration format', 5000);
                }
              } catch (e) {
                new Notice('Failed to load file: ' + (e as Error).message, 5000);
              }
            };
            input.click();
          });
      });
  }

  /**
   * Renders preset configurations section.
   */
  private renderPresets(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Presets')
      .setHeading();

    const presetMetadata = getPresetMetadata();

    new Setting(containerEl)
      .setName('Add preset')
      .setDesc('Add parent fields from a predefined configuration template')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'Select a preset...');
        presetMetadata.forEach(({ name, description }) => {
          dropdown.addOption(name, `${name}: ${description}`);
        });
        dropdown.onChange(async (value) => {
          if (!value) return;

          const preset = getPreset(value);
          if (preset) {
            // Add each config from preset, making names unique if needed
            const existingNames = new Set(this.plugin.settings.parentFields.map(f => f.name));
            let addedCount = 0;

            preset.forEach(config => {
              const newConfig = JSON.parse(JSON.stringify(config)) as ParentFieldConfig;

              // Make name unique if it conflicts
              let uniqueName = newConfig.name;
              let counter = 1;
              while (existingNames.has(uniqueName)) {
                uniqueName = `${newConfig.name}-${counter}`;
                counter++;
              }

              if (uniqueName !== newConfig.name) {
                newConfig.name = uniqueName;
                newConfig.displayName = `${config.displayName || config.name} ${counter - 1}`;
              }

              existingNames.add(uniqueName);
              this.plugin.settings.parentFields.push(newConfig);
              addedCount++;
            });

            await this.plugin.saveSettings();
            await this.rebuildGraphsAndEngines();
            this.display();
            new Notice(`Added ${addedCount} parent field${addedCount > 1 ? 's' : ''} from preset: ${value}`);

            // Reset dropdown to placeholder
            dropdown.setValue('');
          }
        });
      });
  }

  /**
   * Renders parent fields configuration section.
   */
  private renderParentFieldsConfig(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Parent fields')
      .setHeading();

    // Add field button
    new Setting(containerEl)
      .setName('Add parent field')
      .setDesc('Configure parent fields with custom display names, visibility, and behavior')
      .addButton(button => {
        const btn = button.buttonEl;
        setIcon(btn, 'plus');
        btn.createSpan({ text: ' Add field' });
        button.setCta();
        button.onClick(() => {
          this.addParentField();
        });
      });

    // Render each field configuration
    const fieldsContainer = containerEl.createDiv('parent-fields-container');

    this.plugin.settings.parentFields.forEach((config, index) => {
      const formContainer = fieldsContainer.createDiv();
      const initialCollapsed = this.fieldCollapsedStates.get(config.name) ?? true;
      const isDefault = this.plugin.settings.defaultParentField === config.name;
      const form = new ParentFieldConfigForm(
        formContainer,
        config,
        (updated) => this.updateFieldConfig(index, updated),
        () => this.removeFieldConfig(index),
        () => this.duplicateFieldConfig(index),
        isDefault,
        () => this.setDefaultField(config.name),
        initialCollapsed,
        (collapsed) => this.fieldCollapsedStates.set(config.name, collapsed)
      );
      form.render();
      this.configForms.push(form);
    });
  }

  /**
   * Renders global settings section.
   */
  private renderGlobalSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('General')
      .setHeading();

    new Setting(containerEl)
      .setName('Diagnostic mode')
      .setDesc('Show diagnostic information in console')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.diagnosticMode);
        toggle.onChange(async (value) => {
          this.plugin.settings.diagnosticMode = value;
          await this.plugin.saveSettings();

          if (value) {
            console.log('[Relations] Diagnostic mode enabled');
            this.plugin.runDiagnostics();
          } else {
            console.log('[Relations] Diagnostic mode disabled');
          }
        });
      });
  }

  /**
   * Adds a new parent field configuration.
   */
  private async addParentField(): Promise<void> {
    const newConfig: ParentFieldConfig = {
      ...DEFAULT_PARENT_FIELD_CONFIG,
      name: `field${this.plugin.settings.parentFields.length + 1}`,
      displayName: `Field ${this.plugin.settings.parentFields.length + 1}`
    };

    this.plugin.settings.parentFields.push(newConfig);
    await this.plugin.saveSettings();
    await this.rebuildGraphsAndEngines();
    this.display(); // Refresh UI
  }

  /**
   * Updates a field configuration.
   */
  private async updateFieldConfig(index: number, config: ParentFieldConfig): Promise<void> {
    this.plugin.settings.parentFields[index] = config;
    await this.plugin.saveSettings();
    await this.rebuildGraphsAndEngines();
  }

  /**
   * Removes a field configuration.
   */
  private async removeFieldConfig(index: number): Promise<void> {
    if (this.plugin.settings.parentFields.length <= 1) {
      new Notice('Cannot remove the last parent field');
      return;
    }

    const fieldName = this.plugin.settings.parentFields[index].name;
    this.plugin.settings.parentFields.splice(index, 1);

    // Remove the collapsed state for this field
    this.fieldCollapsedStates.delete(fieldName);

    // If we removed the default field, reset to first field
    if (this.plugin.settings.defaultParentField === fieldName) {
      this.plugin.settings.defaultParentField = this.plugin.settings.parentFields[0].name;
    }

    await this.plugin.saveSettings();
    await this.rebuildGraphsAndEngines();
    this.display(); // Refresh UI
  }

  /**
   * Duplicates a field configuration.
   */
  private async duplicateFieldConfig(index: number): Promise<void> {
    const original = this.plugin.settings.parentFields[index];
    const duplicate: ParentFieldConfig = JSON.parse(JSON.stringify(original));

    // Make the name unique
    duplicate.name = `${original.name}_copy`;
    duplicate.displayName = `${original.displayName || original.name} (Copy)`;

    // Copy the collapsed state from the original field
    const originalCollapsedState = this.fieldCollapsedStates.get(original.name);
    if (originalCollapsedState !== undefined) {
      this.fieldCollapsedStates.set(duplicate.name, originalCollapsedState);
    }

    this.plugin.settings.parentFields.push(duplicate);
    await this.plugin.saveSettings();
    await this.rebuildGraphsAndEngines();
    this.display(); // Refresh UI
  }

  /**
   * Sets a field as the default parent field.
   */
  private async setDefaultField(fieldName: string): Promise<void> {
    this.plugin.settings.defaultParentField = fieldName;
    await this.plugin.saveSettings();
    this.display(); // Refresh UI to update star icons
  }

  /**
   * Rebuilds all graphs and engines after configuration changes.
   */
  private async rebuildGraphsAndEngines(): Promise<void> {
    // Clear existing graphs and engines
    this.plugin.relationGraphs.clear();
    this.plugin.relationshipEngines.clear();

    // Rebuild for each field
    this.plugin.settings.parentFields.forEach(fieldConfig => {
      const graph = new RelationGraph(
        this.app,
        fieldConfig.name,
        fieldConfig.ancestors.maxDepth ?? 5,
        this.plugin.frontmatterCache
      );

      const engine = new RelationshipEngine(graph);

      this.plugin.relationGraphs.set(fieldConfig.name, graph);
      this.plugin.relationshipEngines.set(fieldConfig.name, engine);

      graph.build();
    });

    // Refresh sidebar
    this.plugin.refreshSidebarViews();
  }
}

/**
 * Modal for displaying changelog content.
 */
class ChangelogModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  /**
   * Adds Ko-fi logo SVG to button element
   */
  private addKofiLogo(buttonEl: HTMLElement): void {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('viewBox', '0 0 241 194');
    svg.setAttribute('fill', 'none');
    svg.style.cssText = 'flex-shrink: 0;';

    // Ko-fi logo - all paths with original colors from the SVG
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const paths = [
      // Background layer 1 (white)
      { d: 'M96.1344 193.911C61.1312 193.911 32.6597 178.256 15.9721 149.829C1.19788 124.912 -0.00585938 97.9229 -0.00585938 67.7662C-0.00585938 49.8876 5.37293 34.3215 15.5413 22.7466C24.8861 12.1157 38.1271 5.22907 52.8317 3.35378C70.2858 1.14271 91.9848 0.958984 114.545 0.958984C151.259 0.958984 161.63 1.4088 176.075 2.85328C195.29 4.76026 211.458 11.932 222.824 23.5955C234.368 35.4428 240.469 51.2624 240.469 69.3627V72.9994C240.469 103.885 219.821 129.733 191.046 136.759C188.898 141.827 186.237 146.871 183.089 151.837L183.006 151.964C172.869 167.632 149.042 193.918 103.401 193.918H96.1281L96.1344 193.911Z', fill: 'white' },
      // Background layer 2 (white)
      { d: 'M174.568 17.9772C160.927 16.6151 151.38 16.1589 114.552 16.1589C90.908 16.1589 70.9008 16.387 54.7644 18.4334C33.3949 21.164 15.2058 37.5285 15.2058 67.7674C15.2058 98.0066 16.796 121.422 29.0741 142.107C42.9425 165.751 66.1302 178.707 96.1412 178.707H103.414C140.242 178.707 160.25 159.156 170.253 143.698C174.574 136.874 177.754 130.058 179.801 123.234C205.947 120.96 225.27 99.3624 225.27 72.9941V69.3577C225.27 40.9432 206.631 21.164 174.574 17.9772H174.568Z', fill: 'white' },
      // Cup outline (dark)
      { d: 'M15.1975 67.7674C15.1975 37.5285 33.3866 21.164 54.7559 18.4334C70.8987 16.387 90.906 16.1589 114.544 16.1589C151.372 16.1589 160.919 16.6151 174.559 17.9772C206.617 21.1576 225.255 40.937 225.255 69.3577V72.9941C225.255 99.3687 205.932 120.966 179.786 123.234C177.74 130.058 174.559 136.874 170.238 143.698C160.235 159.156 140.228 178.707 103.4 178.707H96.1264C66.1155 178.707 42.9277 165.751 29.0595 142.107C16.7814 121.422 15.1912 98.4563 15.1912 67.7674', fill: '#202020' },
      // Cup inner (white)
      { d: 'M32.2469 67.9899C32.2469 97.3168 34.0654 116.184 43.6127 133.689C54.5225 153.924 74.3018 161.653 96.8117 161.653H103.857C133.411 161.653 147.736 147.329 155.693 134.829C159.558 128.462 162.966 121.417 164.784 112.547L166.147 106.864H174.332C192.521 106.864 208.208 92.09 208.208 73.2166V69.8082C208.208 48.6669 195.024 37.5228 172.058 34.7987C159.102 33.6646 151.372 33.2084 114.538 33.2084C89.7602 33.2084 72.0272 33.4364 58.6152 35.4828C39.7483 38.2134 32.2407 48.8951 32.2407 67.9899', fill: 'white' },
      // Cup handle detail (dark)
      { d: 'M166.158 83.6801C166.158 86.4107 168.204 88.4572 171.841 88.4572C183.435 88.4572 189.802 81.8619 189.802 70.9523C189.802 60.0427 183.435 53.2195 171.841 53.2195C168.204 53.2195 166.158 55.2657 166.158 57.9963V83.6866V83.6801Z', fill: '#202020' },
      // Heart (Ko-fi orange)
      { d: 'M54.5321 82.3198C54.5321 95.732 62.0332 107.326 71.5807 116.424C77.9478 122.562 87.9515 128.93 94.7685 133.022C96.8147 134.157 98.8611 134.841 101.136 134.841C103.866 134.841 106.134 134.157 107.959 133.022C114.782 128.93 124.779 122.562 130.919 116.424C140.694 107.332 148.195 95.7383 148.195 82.3198C148.195 67.7673 137.286 54.8115 121.599 54.8115C112.28 54.8115 105.912 59.5882 101.136 66.1772C96.8147 59.582 90.2259 54.8115 80.9001 54.8115C64.9855 54.8115 54.5256 67.7673 54.5256 82.3198', fill: '#FF5A16' }
    ];

    paths.forEach(pathData => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData.d);
      path.setAttribute('fill', pathData.fill);
      g.appendChild(path);
    });

    svg.appendChild(g);
    buttonEl.prepend(svg);
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;

    titleEl.setText('What\'s New in Relation Explorer');

    // Load and display changelog
    this.loadChangelog();

    // Footer with support links
    const footer = contentEl.createDiv('changelog-footer');

    footer.createEl('p', {
      text: 'If you find Relation Explorer helpful, please consider supporting its development.'
    });

    const buttonContainer = footer.createDiv('changelog-footer-buttons');

    const kofiBtn = buttonContainer.createEl('button', {
      cls: 'kofi-button'
    });
    this.addKofiLogo(kofiBtn);
    kofiBtn.createSpan({ text: ' Buy me a coffee' });
    kofiBtn.onclick = () => {
      window.open('https://ko-fi.com/fabiankloosterman', '_blank');
    };

    const thanksBtn = buttonContainer.createEl('button', {
      text: 'Thanks!'
    });
    thanksBtn.onclick = () => {
      this.close();
    };
  }

  private async loadChangelog(): Promise<void> {
    const { contentEl } = this;

    // Create changelog container - styled via CSS
    const changelogDiv = contentEl.createDiv('changelog-content');

    try {
      // Try to load CHANGELOG.md from plugin directory
      let changelogContent: string;

      try {
        // Use vault adapter to read the file
        const adapter = this.app.vault.adapter;
        const manifestDir = (this.app.vault as any).configDir;
        const pluginId = 'relations-obsidian';
        const changelogPath = `${manifestDir}/plugins/${pluginId}/CHANGELOG.md`;

        console.log('Attempting to load CHANGELOG from:', changelogPath);

        if (adapter && typeof (adapter as any).read === 'function') {
          changelogContent = await (adapter as any).read(changelogPath);
          console.log('Successfully loaded CHANGELOG, length:', changelogContent.length);
        } else {
          console.log('Adapter read not available, using fallback');
          changelogContent = this.getFallbackChangelog();
        }
      } catch (e) {
        console.log('Could not load CHANGELOG.md, using fallback', e);
        changelogContent = this.getFallbackChangelog();
      }

      // Render the markdown content
      await this.renderMarkdown(changelogContent, changelogDiv);

    } catch (e) {
      console.error('Failed to render changelog:', e);
      changelogDiv.empty();
      changelogDiv.createEl('p', {
        text: 'Unable to load changelog. Please visit the GitHub repository for the latest updates.',
        cls: 'setting-item-description'
      });
    }
  }

  private async renderMarkdown(markdown: string, container: HTMLElement): Promise<void> {
    try {
      console.log('Rendering markdown, length:', markdown.length);

      // Use Obsidian's markdown renderer - use type assertion for modal context
      await MarkdownRenderer.renderMarkdown(
        markdown,
        container,
        '', // sourcePath
        this as any // Modal works as Component context
      );

      console.log('Markdown rendered successfully');
    } catch (e) {
      console.error('Error rendering markdown:', e);
      // Fallback: display as preformatted text
      const pre = container.createEl('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordWrap = 'break-word';
      pre.setText(markdown);
    }
  }

  private getFallbackChangelog(): string {
    return `# Recent Updates

## UI and Styling Modernization
- Complete migration to Obsidian's design system
- Enhanced Settings tab with native patterns
- Collapsible subsections in parent field configuration
- Replaced text arrows with proper Obsidian icons

## Navigation Commands
- Added basic and advanced navigation commands
- Interactive modals for note selection
- Multi-field support for all commands

## Codeblock Features
- Advanced filtering and display options
- Title display with multiple modes
- List rendering for siblings and cousins

For the complete changelog, visit: https://github.com/fkloosterman/relations-obsidian/blob/main/CHANGELOG.md
`;
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}