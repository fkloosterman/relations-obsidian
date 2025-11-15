import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile } from 'obsidian';
import { RelationGraph } from './relation-graph';
import { DiagnosticSeverity } from './graph-validator';

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

  async onload() {
    await this.loadSettings();

    this.relationGraph = new RelationGraph(this.app, this.settings.parentField);
    this.relationGraph.build();

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
          this.plugin.relationGraph = new RelationGraph(this.app, value);
          this.plugin.relationGraph.build();
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