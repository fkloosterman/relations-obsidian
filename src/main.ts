import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile } from 'obsidian';
import { RelationGraph } from './relation-graph';

interface ParentRelationSettings {
  parentField: string;
  maxDepth: number;
}

const DEFAULT_SETTINGS: ParentRelationSettings = {
  parentField: 'parent',
  maxDepth: 5
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
  }
}