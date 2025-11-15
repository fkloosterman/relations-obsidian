import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile } from 'obsidian';
import { RelationGraph } from './relation-graph';
import { RelationshipEngine } from './relationship-engine';
import { DiagnosticSeverity } from './graph-validator';
import {
  AncestorQueryResult,
  DescendantQueryResult,
  SiblingQueryResult,
  CousinQueryResult,
  FullLineageResult,
  RelationshipQueryOptions
} from './types';

interface ParentRelationSettings {
  parentField: string;
  maxDepth: number;
  diagnosticMode: boolean;
}

const DEFAULT_SETTINGS: ParentRelationSettings = {
  parentField: 'parent',
  maxDepth: 5,
  diagnosticMode: false
};

export default class ParentRelationPlugin extends Plugin {
  settings!: ParentRelationSettings;
  relationGraph!: RelationGraph;
  relationshipEngine!: RelationshipEngine;

  async onload() {
    await this.loadSettings();

    this.relationGraph = new RelationGraph(
      this.app,
      this.settings.parentField,
      this.settings.maxDepth
    );
    this.relationGraph.build();

    // Initialize relationship engine
    this.relationshipEngine = new RelationshipEngine(this.relationGraph);

    this.addSettingTab(new ParentRelationSettingTab(this.app, this));

    // Use incremental updates for better performance
    this.registerEvent(
      this.app.metadataCache.on('changed', (file: TFile) => {
        this.relationGraph.updateNode(file);
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          this.relationGraph.renameNode(file, oldPath);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          this.relationGraph.removeNode(file);
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

  onunload() {
    console.log('Parent Relation Explorer unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Update maxDepth in graph when settings change
    this.relationGraph.setMaxDepth(this.settings.maxDepth);
  }

  /**
   * Runs graph diagnostics and logs results.
   */
  runDiagnostics(): void {
    const diagnostics = this.relationGraph.getDiagnostics();
    this.logDiagnostics(diagnostics);
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
    const maxDepth = options.maxDepth ?? this.settings.maxDepth;
    const generations = this.relationshipEngine.getAncestors(file, maxDepth);

    const totalCount = generations.reduce((sum, gen) => sum + gen.length, 0);
    const depth = generations.length;

    // Check if truncated by getting one more generation
    const oneLevelDeeper = this.relationshipEngine.getAncestors(file, maxDepth + 1);
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
    return this.relationGraph.getParents(file);
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
    const maxDepth = options.maxDepth ?? this.settings.maxDepth;
    const generations = this.relationshipEngine.getDescendants(file, maxDepth);

    const totalCount = generations.reduce((sum, gen) => sum + gen.length, 0);
    const depth = generations.length;

    // Check if truncated
    const oneLevelDeeper = this.relationshipEngine.getDescendants(file, maxDepth + 1);
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
    return this.relationGraph.getChildren(file);
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
    const includeSelf = options.includeSelf ?? false;
    const siblings = this.relationshipEngine.getSiblings(file, includeSelf);

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
    const degree = options.degree ?? 1;
    const cousins = this.relationshipEngine.getCousins(file, degree);

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
    return this.relationGraph.detectCycle(file);
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
  hasCycles(): boolean {
    return this.relationGraph.hasCycles();
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

    new Setting(containerEl)
      .setName('Parent Field')
      .setDesc('Frontmatter field name for parent links')
      .addText(text => text
        .setPlaceholder('parent')
        .setValue(this.plugin.settings.parentField)
        .onChange(async value => {
          this.plugin.settings.parentField = value;
          await this.plugin.saveSettings();
          // Recreate graph with new parent field
          this.plugin.relationGraph = new RelationGraph(
            this.app,
            value,
            this.plugin.settings.maxDepth
          );
          this.plugin.relationGraph.build();
          // Reinitialize relationship engine
          this.plugin.relationshipEngine = new RelationshipEngine(this.plugin.relationGraph);
        })
      );

    new Setting(containerEl)
      .setName('Max Depth')
      .setDesc('Maximum depth for tree traversal')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(this.plugin.settings.maxDepth.toString())
        .onChange(async value => {
          const num = parseInt(value);
          if (!isNaN(num)) {
            this.plugin.settings.maxDepth = num;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName('Diagnostic Mode')
      .setDesc('Enable verbose logging for graph validation and diagnostics. Useful for troubleshooting.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.diagnosticMode)
        .onChange(async (value) => {
          this.plugin.settings.diagnosticMode = value;
          await this.plugin.saveSettings();

          // Log status change
          if (value) {
            console.log('[Relations] Diagnostic mode enabled');
            // Run initial validation
            const diagnostics = this.plugin.relationGraph.getDiagnostics();
            this.plugin.logDiagnostics(diagnostics);
          } else {
            console.log('[Relations] Diagnostic mode disabled');
          }
        })
      );
  }
}