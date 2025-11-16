import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, Notice, Modal } from 'obsidian';
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

  // Command infrastructure (Milestone 4.3B Phase 4)
  private lastClickedFile: TFile | null = null;
  private lastClickedParentField: string | null = null;

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

    // Register advanced commands (Milestone 4.3B Phase 4)
    this.registerCommands();

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

  //
  // Command Infrastructure (Milestone 4.3B Phase 4)
  //

  /**
   * Sets the last clicked file (called by tree renderer on node clicks).
   *
   * @param file - The file that was clicked
   * @param parentField - The parent field context
   */
  setLastClickedFile(file: TFile, parentField: string): void {
    this.lastClickedFile = file;
    this.lastClickedParentField = parentField;
  }

  /**
   * Gets the last clicked file in the tree.
   *
   * @returns The last clicked file, or null if none
   */
  getLastClickedFile(): TFile | null {
    return this.lastClickedFile;
  }

  /**
   * Gets the parent field context for the last clicked file.
   *
   * @returns The parent field name, or null if none
   */
  getCurrentParentField(): string | null {
    return this.lastClickedParentField;
  }

  /**
   * Gets the currently active sidebar view.
   *
   * @returns The active RelationSidebarView, or null if none
   */
  getActiveSidebarView(): RelationSidebarView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_RELATION_SIDEBAR);
    if (leaves.length === 0) return null;

    // Return the most recently active sidebar view
    // For now, return the first one (could be enhanced to track active view)
    return leaves[0].view as RelationSidebarView;
  }

  /**
   * Registers command palette commands for advanced features (Milestone 4.3B).
   */
  private registerCommands(): void {
    // Pin clicked note
    this.addCommand({
      id: 'pin-clicked-note',
      name: 'Pin clicked note in sidebar',
      checkCallback: (checking: boolean) => {
        const file = this.getLastClickedFile();
        if (!file) return false;

        if (!checking) {
          const view = this.getActiveSidebarView();
          if (view) {
            view.pinToFile(file);
            new Notice(`Pinned to ${file.basename}`);
          }
        }
        return true;
      }
    });

    // Copy link to clicked note
    this.addCommand({
      id: 'copy-link-to-clicked-note',
      name: 'Copy link to clicked note',
      checkCallback: (checking: boolean) => {
        const file = this.getLastClickedFile();
        if (!file) return false;

        if (!checking) {
          const link = `[[${file.basename}]]`;
          navigator.clipboard.writeText(link);
          new Notice('Link copied to clipboard');
        }
        return true;
      }
    });

    // Expand all children of clicked note
    this.addCommand({
      id: 'expand-all-children-of-clicked-note',
      name: 'Expand all children of clicked note',
      checkCallback: (checking: boolean) => {
        const file = this.getLastClickedFile();
        const view = this.getActiveSidebarView();
        if (!file || !view) return false;

        if (!checking) {
          const renderer = (view as any).renderer;
          if (renderer) {
            renderer.expandAllChildren(file.path);
          }
        }
        return true;
      }
    });

    // Collapse all children of clicked note
    this.addCommand({
      id: 'collapse-all-children-of-clicked-note',
      name: 'Collapse all children of clicked note',
      checkCallback: (checking: boolean) => {
        const file = this.getLastClickedFile();
        const view = this.getActiveSidebarView();
        if (!file || !view) return false;

        if (!checking) {
          const renderer = (view as any).renderer;
          if (renderer) {
            renderer.collapseAllChildren(file.path);
          }
        }
        return true;
      }
    });
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

    // Import/Export section
    this.renderImportExport(containerEl);

    // Presets section
    this.renderPresets(containerEl);

    // Parent fields configuration
    this.renderParentFieldsConfig(containerEl);

    // Global settings
    this.renderGlobalSettings(containerEl);
  }

  /**
   * Renders import/export section.
   */
  private renderImportExport(containerEl: HTMLElement): void {
    const section = containerEl.createDiv('settings-section');
    section.createEl('h3', { text: 'Configuration Import/Export' });

    new Setting(section)
      .setName('Export Configuration')
      .setDesc('Copy configuration to clipboard as JSON')
      .addButton(button => {
        button
          .setButtonText('Export')
          .setCta()
          .onClick(async () => {
            const json = JSON.stringify(this.plugin.settings, null, 2);
            await navigator.clipboard.writeText(json);
            new Notice('Configuration exported to clipboard');
          });
      });

    new Setting(section)
      .setName('Import Configuration')
      .setDesc('Paste and import a JSON configuration')
      .addButton(button => {
        button
          .setButtonText('Import')
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
      });
  }

  /**
   * Renders preset configurations section.
   */
  private renderPresets(containerEl: HTMLElement): void {
    const section = containerEl.createDiv('settings-section');
    section.createEl('h3', { text: 'Configuration Presets' });

    const presetMetadata = getPresetMetadata();

    new Setting(section)
      .setName('Load Preset')
      .setDesc('Load a predefined configuration template')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'Select a preset...');
        presetMetadata.forEach(({ name, description }) => {
          dropdown.addOption(name, `${name}: ${description}`);
        });
        dropdown.onChange(async (value) => {
          if (!value) return;

          const preset = getPreset(value);
          if (preset) {
            const confirmed = await this.confirmLoadPreset(value);
            if (confirmed) {
              this.plugin.settings.parentFields = preset;
              this.plugin.settings.defaultParentField = preset[0].name;
              await this.plugin.saveSettings();
              await this.rebuildGraphsAndEngines();
              this.display();
              new Notice(`Loaded preset: ${value}`);
            }
            // Reset dropdown to placeholder
            dropdown.setValue('');
          }
        });
      });
  }

  /**
   * Confirms loading a preset (warns about overwriting).
   */
  private async confirmLoadPreset(presetName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);
      modal.titleEl.setText('Load Preset Configuration?');
      modal.contentEl.createEl('p', {
        text: `This will replace your current configuration with the "${presetName}" preset. This action cannot be undone unless you have exported your current configuration.`
      });

      const buttonContainer = modal.contentEl.createDiv('modal-button-container');

      const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
      cancelBtn.onclick = () => {
        modal.close();
        resolve(false);
      };

      const confirmBtn = buttonContainer.createEl('button', {
        text: 'Load Preset',
        cls: 'mod-cta'
      });
      confirmBtn.onclick = () => {
        modal.close();
        resolve(true);
      };

      modal.open();
    });
  }

  /**
   * Renders parent fields configuration section.
   */
  private renderParentFieldsConfig(containerEl: HTMLElement): void {
    const section = containerEl.createDiv('settings-section');
    section.createEl('h3', { text: 'Parent Fields' });

    // Add field button
    new Setting(section)
      .setDesc('Configure parent fields with custom display names, visibility, and behavior')
      .addButton(button => {
        button
          .setButtonText('+ Add Parent Field')
          .setCta()
          .onClick(() => {
            this.addParentField();
          });
      });

    // Render each field configuration
    const fieldsContainer = section.createDiv('parent-fields-container');

    this.plugin.settings.parentFields.forEach((config, index) => {
      const formContainer = fieldsContainer.createDiv();
      const initialCollapsed = this.fieldCollapsedStates.get(config.name) ?? true;
      const form = new ParentFieldConfigForm(
        formContainer,
        config,
        (updated) => this.updateFieldConfig(index, updated),
        () => this.removeFieldConfig(index),
        () => this.duplicateFieldConfig(index),
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
    const section = containerEl.createDiv('settings-section');
    section.createEl('h3', { text: 'Global Settings' });

    new Setting(section)
      .setName('Default Parent Field')
      .setDesc('Which field to show by default when opening sidebar')
      .addDropdown(dropdown => {
        this.plugin.settings.parentFields.forEach(field => {
          dropdown.addOption(field.name, field.displayName || field.name);
        });
        dropdown.setValue(this.plugin.settings.defaultParentField);
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultParentField = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(section)
      .setName('UI Style')
      .setDesc('Parent field selector style (auto adapts based on count)')
      .addDropdown(dropdown => {
        dropdown.addOption('auto', 'Auto (≤4: segmented, >4: dropdown)');
        dropdown.addOption('segmented', 'Always Segmented Control');
        dropdown.addOption('dropdown', 'Always Dropdown');
        dropdown.setValue(this.plugin.settings.uiStyle);
        dropdown.onChange(async (value) => {
          this.plugin.settings.uiStyle = value as 'auto' | 'segmented' | 'dropdown';
          await this.plugin.saveSettings();
          this.plugin.refreshSidebarViews();
        });
      });

    new Setting(section)
      .setName('Diagnostic Mode')
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