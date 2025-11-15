import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, Notice } from 'obsidian';
import { RelationGraph } from './relation-graph';
import { RelationshipEngine } from './relationship-engine';
import { DiagnosticSeverity } from './graph-validator';
import { VIEW_TYPE_RELATION_SIDEBAR, RelationSidebarView } from './sidebar-view';
import { FrontmatterCache } from './frontmatter-cache';
import {
  AncestorQueryResult,
  DescendantQueryResult,
  SiblingQueryResult,
  CousinQueryResult,
  FullLineageResult,
  RelationshipQueryOptions,
  ParentFieldConfig,
  SectionConfig
} from './types';

/**
 * Plugin settings with multi-parent-field support
 */
export interface ParentRelationSettings {
  /** Array of configured parent fields */
  parentFields: ParentFieldConfig[];

  /** Which parent field to show by default when opening sidebar */
  defaultParentField: string;

  /** UI style preference: 'auto', 'segmented', or 'dropdown' */
  uiStyle: 'auto' | 'segmented' | 'dropdown';

  /** Diagnostic mode toggle */
  diagnosticMode: boolean;
}

const DEFAULT_SECTION_CONFIG: SectionConfig = {
  displayName: '',  // Will be set per section type
  visible: true,
  collapsed: false,
  maxDepth: 5,
  initialDepth: 2,
  sortOrder: 'alphabetical',
  includeSelf: false
};

const DEFAULT_PARENT_FIELD_CONFIG: ParentFieldConfig = {
  name: 'parent',
  displayName: 'Parent',
  ancestors: {
    ...DEFAULT_SECTION_CONFIG,
    displayName: 'Ancestors',
    maxDepth: 5,
    initialDepth: 2
  },
  descendants: {
    ...DEFAULT_SECTION_CONFIG,
    displayName: 'Descendants',
    maxDepth: 5,
    initialDepth: 2
  },
  siblings: {
    ...DEFAULT_SECTION_CONFIG,
    displayName: 'Siblings',
    sortOrder: 'alphabetical',
    includeSelf: false
  }
};

const DEFAULT_SETTINGS: ParentRelationSettings = {
  parentFields: [DEFAULT_PARENT_FIELD_CONFIG],
  defaultParentField: 'parent',
  uiStyle: 'auto',
  diagnosticMode: false
};

export default class ParentRelationPlugin extends Plugin {
  settings!: ParentRelationSettings;

  // Multiple graphs (one per parent field)
  relationGraphs!: Map<string, RelationGraph>;

  // Multiple engines (one per graph)
  relationshipEngines!: Map<string, RelationshipEngine>;

  // Shared frontmatter cache
  frontmatterCache!: FrontmatterCache;

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
    this.addRibbonIcon('git-fork', 'Toggle Relation Explorer', async () => {
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
      (leaf.view as RelationSidebarView).refresh();
    });
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

  constructor(app: App, plugin: ParentRelationPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Parent Relation Explorer Settings' });

    // Parent Fields (comma-separated list)
    let parentFieldsValue = this.plugin.settings.parentFields.map(f => f.name).join(', ');

    new Setting(containerEl)
      .setName('Parent Fields')
      .setDesc('Comma-separated list of frontmatter fields to track (e.g., "parent, project, category"). Click "Apply" to save changes.')
      .addText(text => {
        text
          .setPlaceholder('parent, project, category')
          .setValue(parentFieldsValue)
          .onChange(value => {
            // Just store the value, don't trigger rebuild yet
            parentFieldsValue = value;
          });
      })
      .addButton(button => {
        button
          .setButtonText('Apply')
          .setCta()
          .onClick(async () => {
            await this.handleParentFieldsChange(parentFieldsValue);
          });
      });

    // Default Parent Field
    new Setting(containerEl)
      .setName('Default Parent Field')
      .setDesc('Which parent field to show by default when opening the sidebar')
      .addDropdown(dropdown => {
        this.plugin.settings.parentFields.forEach(field => {
          dropdown.addOption(field.name, field.displayName || field.name);
        });

        dropdown
          .setValue(this.plugin.settings.defaultParentField)
          .onChange(async value => {
            this.plugin.settings.defaultParentField = value;
            await this.plugin.saveSettings();
          });
      });

    // UI Style
    new Setting(containerEl)
      .setName('UI Style')
      .setDesc('How to display parent field selector (Auto = segmented control for ≤4 fields, dropdown for >4)')
      .addDropdown(dropdown => {
        dropdown
          .addOption('auto', 'Auto')
          .addOption('segmented', 'Segmented Control')
          .addOption('dropdown', 'Dropdown')
          .setValue(this.plugin.settings.uiStyle)
          .onChange(async value => {
            this.plugin.settings.uiStyle = value as 'auto' | 'segmented' | 'dropdown';
            await this.plugin.saveSettings();
            this.plugin.refreshSidebarViews();
          });
      });

    // Max Depth (global for now, per-field in Milestone 4.2B)
    new Setting(containerEl)
      .setName('Max Depth')
      .setDesc('Maximum depth for tree traversal (applies to all parent fields)')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(this.plugin.settings.parentFields[0]?.ancestors.maxDepth?.toString() || '5')
        .onChange(async value => {
          const num = parseInt(value);
          if (!isNaN(num) && num > 0) {
            // Update all field configs
            this.plugin.settings.parentFields.forEach(field => {
              field.ancestors.maxDepth = num;
              field.descendants.maxDepth = num;
            });
            await this.plugin.saveSettings();
            this.plugin.refreshSidebarViews();
          }
        })
      );

    // Diagnostic Mode
    new Setting(containerEl)
      .setName('Diagnostic Mode')
      .setDesc('Enable verbose logging for graph validation and diagnostics')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.diagnosticMode)
        .onChange(async (value) => {
          this.plugin.settings.diagnosticMode = value;
          await this.plugin.saveSettings();

          if (value) {
            console.log('[Relations] Diagnostic mode enabled');
            this.plugin.runDiagnostics();
          } else {
            console.log('[Relations] Diagnostic mode disabled');
          }
        })
      );
  }

  /**
   * Handles changes to parent fields list.
   */
  private async handleParentFieldsChange(value: string): Promise<void> {
    const fieldNames = value.split(',').map(s => s.trim()).filter(s => s.length > 0);

    if (fieldNames.length === 0) {
      // Require at least one field
      new Notice('At least one parent field is required');
      return;
    }

    // Check if field names actually changed
    const currentFieldNames = this.plugin.settings.parentFields.map(f => f.name).sort();
    const newFieldNames = [...fieldNames].sort();

    if (currentFieldNames.length === newFieldNames.length &&
        currentFieldNames.every((name, i) => name === newFieldNames[i])) {
      // No change, skip expensive rebuild
      return;
    }

    // Create new field configs
    const newFields: ParentFieldConfig[] = fieldNames.map(name => {
      // Try to preserve existing config if field already exists
      const existingField = this.plugin.settings.parentFields.find(f => f.name === name);

      if (existingField) {
        return existingField;
      }

      // Create new field with defaults
      return {
        name,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        ancestors: {
          displayName: 'Ancestors',
          visible: true,
          collapsed: false,
          maxDepth: 5,
          initialDepth: 2
        },
        descendants: {
          displayName: 'Descendants',
          visible: true,
          collapsed: false,
          maxDepth: 5,
          initialDepth: 2
        },
        siblings: {
          displayName: 'Siblings',
          visible: true,
          collapsed: false,
          sortOrder: 'alphabetical' as const,
          includeSelf: false
        }
      };
    });

    this.plugin.settings.parentFields = newFields;

    // Ensure default field is valid
    if (!fieldNames.includes(this.plugin.settings.defaultParentField)) {
      this.plugin.settings.defaultParentField = fieldNames[0];
    }

    await this.plugin.saveSettings();

    // Rebuild graphs and engines
    this.plugin.relationGraphs.clear();
    this.plugin.relationshipEngines.clear();

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

    // Re-render settings to update dropdown
    this.display();
  }
}