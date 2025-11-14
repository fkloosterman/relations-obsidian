import { App, TFile } from 'obsidian';

export interface NodeInfo {
  file: TFile;
  parents: TFile[];
  children: TFile[];
}

export class RelationGraph {
  private graph = new Map<string, NodeInfo>();
  constructor(private app: App, private parentField: string) {}

  build() {
    const files = this.app.vault.getMarkdownFiles();
    this.graph.clear();

    files.forEach(file => {
      const meta = this.app.metadataCache.getFileCache(file);
      const parentLinks = this.extractParentLinks(meta);
      this.graph.set(file.path, { file, parents: parentLinks, children: [] });
    });

    for (const node of this.graph.values()) {
      node.parents.forEach(parent => {
        this.graph.get(parent.path)?.children.push(node.file);
      });
    }
  }

  extractParentLinks(meta: any): TFile[] {
    const field = meta?.frontmatter?.[this.parentField];
    if (!field) return [];
    const arr = Array.isArray(field) ? field : [field];
    return arr.map(ref => this.resolveLink(ref, meta)).filter(Boolean) as TFile[];
  }

  resolveLink(ref: string, meta: any): TFile | null {
    return this.app.metadataCache.getFirstLinkpathDest(ref, meta?.path) || null;
  }

  getParents(file: TFile): TFile[] {
    return this.graph.get(file.path)?.parents || [];
  }

  getChildren(file: TFile): TFile[] {
    return this.graph.get(file.path)?.children || [];
  }
}