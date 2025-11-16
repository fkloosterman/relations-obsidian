# Milestone 4.2A: Basic Multi-Parent-Field Support - Implementation Plan

**Status:** Ready for Implementation
**Priority:** High
**Estimated Time:** 3-4 days

---

## Overview

This document provides a comprehensive implementation plan for Milestone 4.2A: Basic Multi-Parent-Field Support, the first part of the redesigned Milestone 4.2 for the Relations Obsidian plugin.

### Decision Summary

- **Approach:** Multiple independent RelationGraph instances (one per parent field)
- **Shared Resource:** Centralized FrontmatterCache to avoid redundant parsing
- **UI Strategy:** Segmented control (≤4 fields) with automatic dropdown fallback (>4 fields)
- **Sections:** Three collapsible sections per parent field (ancestors, descendants, siblings)
- **Settings:** Basic list-based parent field configuration (advanced per-field config deferred to Milestone 4.2B)

---

## Goals

Implement core multi-parent-field functionality that allows users to:
- Define multiple parent fields (e.g., "parent", "project", "category")
- Switch between parent fields using a modern UI selector
- View relationships for each parent field independently
- See three distinct sections: Ancestors, Descendants, and Siblings
- Pin the sidebar to a specific note per parent field
- Experience improved performance through shared metadata caching

---

## Current State Analysis

### Existing Architecture

Currently in [`src/main.ts`](../src/main.ts):
- **Single Parent Field:** Only one `parentField` setting (line 16)
- **Single Graph:** One `RelationGraph` instance (line 29, 35-39)
- **Single Engine:** One `RelationshipEngine` instance (line 30, 53)
- **Simple Settings:** Just `parentField`, `maxDepth`, and `diagnosticMode` (lines 15-19)

Currently in [`src/sidebar-view.ts`](../src/sidebar-view.ts):
- **Single Mode Display:** Uses `SidebarDisplayMode` enum for switching views (lines 14-19)
- **No Field Selector:** No UI for selecting parent fields (line 143: "We'll add mode selector and controls in Milestone 4.2")
- **No Sections:** All relationships shown in a single tree (line 266-285)
- **Single Pin:** One pin state for all modes (lines 28-33)

### Problems to Solve

1. **Limited Flexibility:** Users can only track one type of parent relationship
2. **No Multi-Hierarchy Support:** Cannot manage projects, categories, and parent relationships simultaneously
3. **Inefficient Switching:** Changing parent field requires rebuilding entire graph
4. **Missing UI:** No way to select between parent fields in the interface

---

## Architecture Overview

### Multi-Graph Architecture

```mermaid
graph TD
    A[ParentRelationPlugin] --> B[FrontmatterCache]
    A --> C1[RelationGraph: 'parent']
    A --> C2[RelationGraph: 'project']
    A --> C3[RelationGraph: 'category']
    A --> D[RelationshipEngine Factory]

    B --> C1
    B --> C2
    B --> C3

    C1 --> E1[RelationshipEngine: 'parent']
    C2 --> E2[RelationshipEngine: 'project']
    C3 --> E3[RelationshipEngine: 'category']

    D --> E1
    D --> E2
    D --> E3

    F[RelationSidebarView] --> G[Parent Field Selector]
    F --> H[Ancestor Section]
    F --> I[Descendant Section]
    F --> J[Sibling Section]

    G --> E1
    G --> E2
    G --> E3
```

### Key Architectural Decisions

1. **Multiple Separate Graphs**: One `RelationGraph` instance per parent field
   - Enables independent graph building and updates
   - Allows different configurations per field (future enhancement)
   - Improves isolation and debugging

2. **Shared Frontmatter Cache**: Single metadata parsing layer
   - Avoids redundant file parsing for multiple fields
   - Significant performance improvement (estimated 3× speedup for 3 fields)
   - Centralized cache invalidation

3. **Segmented Control UI**: Modern, compact parent field selector
   - Clean, iOS/macOS-style interface for ≤4 fields
   - Automatic dropdown fallback for >4 fields
   - User can override with manual setting

4. **Three Collapsible Sections**: Ancestors, Descendants, Siblings
   - Each section independently collapsible
   - Clear visual organization
   - Easier to scan and understand relationships

5. **Per-Field Pinning**: Independent pin state per parent field
   - Pin to different notes for different parent fields
   - More flexible workflow support

---

## Data Structures

### New TypeScript Interfaces

**File:** `src/types.ts` (additions)

```typescript
/**
 * Configuration for a single section (ancestors, descendants, or siblings)
 */
export interface SectionConfig {
  /** Display name for this section (e.g., "Parent Chain", "Children") */
  displayName: string;

  /** Whether this section is visible in the sidebar */
  visible: boolean;

  /** Whether this section is initially collapsed (only used if visible) */
  collapsed: boolean;

  /** Maximum depth to traverse (ancestors/descendants only) */
  maxDepth?: number;

  /** Initial unfold depth when rendering tree (ancestors/descendants only) */
  initialDepth?: number;

  /** Sort order for items (siblings only) */
  sortOrder?: 'alphabetical' | 'created' | 'modified';

  /** Whether to include the current file in results (siblings only) */
  includeSelf?: boolean;
}

/**
 * Configuration for a single parent field
 */
export interface ParentFieldConfig {
  /** Field name in frontmatter (e.g., "parent", "project") */
  name: string;

  /** Optional friendly display name for UI (e.g., "Project Hierarchy") */
  displayName?: string;

  /** Ancestors section configuration */
  ancestors: SectionConfig;

  /** Descendants section configuration */
  descendants: SectionConfig;

  /** Siblings section configuration */
  siblings: SectionConfig;
}

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

/**
 * Sidebar view state (per sidebar instance, persisted across sessions)
 */
export interface SidebarViewState {
  /** Currently selected parent field name */
  selectedParentField: string;

  /** Pin state per parent field (fieldName -> filePath) */
  pinnedFiles: Record<string, string>;

  /** Collapsed sections per parent field */
  collapsedSections: Record<string, Set<'ancestors' | 'descendants' | 'siblings'>>;
}
```

### Default Configuration

```typescript
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
```

---

## Detailed Design

### 1. Frontmatter Cache Layer

**File:** `src/frontmatter-cache.ts` (new file)

```typescript
import { App, TFile, CachedMetadata } from 'obsidian';

/**
 * Centralized cache for frontmatter metadata.
 *
 * Provides a single source of truth for file metadata, avoiding
 * redundant parsing when multiple graphs query the same files.
 */
export class FrontmatterCache {
  private app: App;
  private cache: Map<string, CachedMetadata | null> = new Map();

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Gets the value of a frontmatter field for a file.
   *
   * @param file - The file to query
   * @param fieldName - The frontmatter field name
   * @returns The field value (string, string[], or null)
   */
  getFieldValue(file: TFile, fieldName: string): string | string[] | null {
    const metadata = this.getMetadata(file);
    if (!metadata?.frontmatter) return null;

    const value = metadata.frontmatter[fieldName];

    // Return null for undefined or null values
    if (value === undefined || value === null) return null;

    return value;
  }

  /**
   * Gets the cached metadata for a file.
   *
   * @param file - The file to query
   * @returns Cached metadata or null
   */
  getMetadata(file: TFile): CachedMetadata | null {
    // Check cache first
    if (this.cache.has(file.path)) {
      return this.cache.get(file.path) ?? null;
    }

    // Fetch from Obsidian's metadata cache
    const metadata = this.app.metadataCache.getFileCache(file);
    this.cache.set(file.path, metadata ?? null);

    return metadata ?? null;
  }

  /**
   * Invalidates cache for a specific file.
   *
   * @param file - The file to invalidate
   */
  invalidate(file: TFile): void {
    this.cache.delete(file.path);
  }

  /**
   * Invalidates cache for a file by path (for renames).
   *
   * @param path - The old file path
   */
  invalidateByPath(path: string): void {
    this.cache.delete(path);
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics.
   *
   * @returns Object with cache stats
   */
  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Can be enhanced with hit/miss tracking
    };
  }
}
```

**Design Rationale:**
- **Map-based cache:** Fast O(1) lookups by file path
- **Lazy population:** Only caches files as they're accessed
- **Manual invalidation:** Explicit cache invalidation on file changes
- **Integration point:** Single point to enhance with LRU eviction, hit tracking, etc.

---

### 2. Plugin Refactoring for Multiple Graphs

**File:** `src/main.ts` (modifications)

#### Changes to ParentRelationPlugin class:

```typescript
export default class ParentRelationPlugin extends Plugin {
  settings!: ParentRelationSettings;

  // NEW: Multiple graphs (one per parent field)
  relationGraphs!: Map<string, RelationGraph>;

  // NEW: Multiple engines (one per graph)
  relationshipEngines!: Map<string, RelationshipEngine>;

  // NEW: Shared frontmatter cache
  frontmatterCache!: FrontmatterCache;

  async onload() {
    await this.loadSettings();

    // NEW: Initialize frontmatter cache
    this.frontmatterCache = new FrontmatterCache(this.app);

    // NEW: Initialize graphs and engines for each parent field
    this.relationGraphs = new Map();
    this.relationshipEngines = new Map();

    this.settings.parentFields.forEach(fieldConfig => {
      const graph = new RelationGraph(
        this.app,
        fieldConfig.name,
        fieldConfig.ancestors.maxDepth ?? 5,
        this.frontmatterCache  // NEW: Pass cache to graph
      );

      const engine = new RelationshipEngine(graph);

      this.relationGraphs.set(fieldConfig.name, graph);
      this.relationshipEngines.set(fieldConfig.name, engine);
    });

    // Wait for metadata cache to be ready before building graphs
    if (this.app.workspace.layoutReady) {
      this.buildAllGraphs();
    } else {
      this.app.workspace.onLayoutReady(() => {
        this.buildAllGraphs();
      });
    }

    // ... rest of onload (sidebar registration, commands, etc.)

    // NEW: Update all graphs on file changes
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
  }

  /**
   * NEW: Builds all graphs.
   */
  private buildAllGraphs(): void {
    this.relationGraphs.forEach(graph => graph.build());
  }

  /**
   * NEW: Gets the graph for a specific parent field.
   *
   * @param fieldName - The parent field name
   * @returns The RelationGraph instance, or undefined if not found
   */
  getGraphForField(fieldName: string): RelationGraph | undefined {
    return this.relationGraphs.get(fieldName);
  }

  /**
   * NEW: Gets the relationship engine for a specific parent field.
   *
   * @param fieldName - The parent field name
   * @returns The RelationshipEngine instance, or undefined if not found
   */
  getEngineForField(fieldName: string): RelationshipEngine | undefined {
    return this.relationshipEngines.get(fieldName);
  }
}
```

#### Settings Loading:

```typescript
async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}
```

**Note:** No migration logic needed - this is a breaking change from the previous version.

---

### 3. RelationGraph Integration

**File:** `src/relation-graph.ts` (modifications)

```typescript
export class RelationGraph {
  private app: App;
  private parentField: string;
  private maxDepth: number;
  private frontmatterCache: FrontmatterCache;  // NEW
  private graph = new Map<string, NodeInfo>();
  private cycleDetector!: CycleDetector;

  constructor(
    app: App,
    parentField: string,
    maxDepth: number,
    frontmatterCache: FrontmatterCache  // NEW parameter
  ) {
    this.app = app;
    this.parentField = parentField;
    this.maxDepth = maxDepth;
    this.frontmatterCache = frontmatterCache;  // NEW
  }

  /**
   * Extracts parent links from file metadata.
   *
   * MODIFIED: Now uses FrontmatterCache instead of direct metadata access
   */
  private extractParentLinks(file: TFile): TFile[] {
    // Use cache instead of direct metadata access
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

  // ... rest of RelationGraph methods remain the same
}
```

---

### 4. Parent Field Selector UI Component

**File:** `src/components/parent-field-selector.ts` (new file)

```typescript
import { setIcon } from 'obsidian';

export interface ParentFieldOption {
  name: string;
  displayName: string;
}

export type ParentFieldChangeCallback = (fieldName: string) => void;

/**
 * UI component for selecting parent fields.
 *
 * Renders as segmented control (≤4 fields) or dropdown (>4 fields).
 */
export class ParentFieldSelector {
  private containerEl: HTMLElement;
  private options: ParentFieldOption[];
  private selectedField: string;
  private uiStyle: 'auto' | 'segmented' | 'dropdown';
  private onChange: ParentFieldChangeCallback;

  constructor(
    containerEl: HTMLElement,
    options: ParentFieldOption[],
    selectedField: string,
    uiStyle: 'auto' | 'segmented' | 'dropdown',
    onChange: ParentFieldChangeCallback
  ) {
    this.containerEl = containerEl;
    this.options = options;
    this.selectedField = selectedField;
    this.uiStyle = uiStyle;
    this.onChange = onChange;
  }

  /**
   * Renders the selector.
   */
  render(): void {
    this.containerEl.empty();

    const shouldUseSegmented = this.shouldUseSegmentedControl();

    if (shouldUseSegmented) {
      this.renderSegmentedControl();
    } else {
      this.renderDropdown();
    }
  }

  /**
   * Determines whether to use segmented control or dropdown.
   */
  private shouldUseSegmentedControl(): boolean {
    if (this.uiStyle === 'segmented') return true;
    if (this.uiStyle === 'dropdown') return false;

    // Auto mode: use segmented for ≤4 fields
    return this.options.length <= 4;
  }

  /**
   * Renders segmented control UI.
   */
  private renderSegmentedControl(): void {
    const segmentedControl = this.containerEl.createDiv('parent-field-segmented-control');

    this.options.forEach(option => {
      const segment = segmentedControl.createDiv('parent-field-segment');

      if (option.name === this.selectedField) {
        segment.addClass('is-active');
      }

      segment.setText(option.displayName);
      segment.setAttribute('data-field', option.name);

      segment.addEventListener('click', () => {
        this.setSelectedField(option.name);
      });
    });
  }

  /**
   * Renders dropdown UI.
   */
  private renderDropdown(): void {
    const dropdownContainer = this.containerEl.createDiv('parent-field-dropdown-container');

    const label = dropdownContainer.createSpan('parent-field-dropdown-label');
    label.setText('Parent Field:');

    const select = dropdownContainer.createEl('select', {
      cls: 'dropdown parent-field-dropdown'
    });

    this.options.forEach(option => {
      const optionEl = select.createEl('option', {
        value: option.name,
        text: option.displayName
      });

      if (option.name === this.selectedField) {
        optionEl.selected = true;
      }
    });

    select.addEventListener('change', () => {
      this.setSelectedField(select.value);
    });
  }

  /**
   * Sets the selected field and triggers change callback.
   */
  private setSelectedField(fieldName: string): void {
    if (this.selectedField === fieldName) return;

    this.selectedField = fieldName;
    this.onChange(fieldName);
    this.render();  // Re-render to update active state
  }

  /**
   * Updates the selector with new options.
   */
  updateOptions(options: ParentFieldOption[], selectedField: string): void {
    this.options = options;
    this.selectedField = selectedField;
    this.render();
  }

  /**
   * Destroys the selector.
   */
  destroy(): void {
    this.containerEl.empty();
  }
}
```

---

### 5. Sidebar View Updates

**File:** `src/sidebar-view.ts` (modifications)

#### Changes to SidebarViewState:

```typescript
export interface SidebarViewState {
  /** Currently selected parent field name */
  selectedParentField: string;

  /** Pin state per parent field (fieldName -> filePath) */
  pinnedFiles: Record<string, string>;

  /** Collapsed sections per parent field */
  collapsedSections: Record<string, string[]>;  // fieldName -> ['ancestors', 'descendants', 'siblings']
}

const DEFAULT_VIEW_STATE: SidebarViewState = {
  selectedParentField: 'parent',
  pinnedFiles: {},
  collapsedSections: {}
};
```

#### Changes to RelationSidebarView class:

```typescript
export class RelationSidebarView extends ItemView {
  private plugin: ParentRelationPlugin;
  private renderer: TreeRenderer;
  private currentFile: TFile | null = null;
  private viewState: SidebarViewState;
  private contentContainer!: HTMLElement;
  private fieldSelector!: ParentFieldSelector;  // NEW

  constructor(leaf: WorkspaceLeaf, plugin: ParentRelationPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.viewState = { ...DEFAULT_VIEW_STATE };

    // Set default field from settings
    this.viewState.selectedParentField = this.plugin.settings.defaultParentField;

    // Initialize tree renderer
    this.renderer = new TreeRenderer(this.app, {
      collapsible: true,
      initiallyCollapsed: false,
      enableNavigation: true,
      showCycleIndicators: true,
      cssPrefix: 'relation-tree'
    });
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('relation-sidebar-container');

    // Create header with field selector
    this.createHeader(container);

    // Create content container
    this.contentContainer = container.createDiv('relation-sidebar-content');

    // Register event handlers
    this.registerEventHandlers();

    // Initial render
    setTimeout(() => this.updateView(), 100);
  }

  /**
   * Creates the header section with title and parent field selector.
   */
  private createHeader(container: HTMLElement): void {
    const header = container.createDiv('relation-sidebar-header');

    // Title and controls row
    const titleRow = header.createDiv('relation-sidebar-title-row');

    const title = titleRow.createDiv('relation-sidebar-title');
    title.setText('Relation Explorer');

    // Pin button
    const controls = titleRow.createDiv('relation-sidebar-controls');
    const pinButton = controls.createDiv('relation-sidebar-pin-button');
    this.updatePinButton(pinButton);

    pinButton.addEventListener('click', () => {
      this.togglePin();
    });

    // Parent field selector
    const selectorContainer = header.createDiv('parent-field-selector-container');

    const options = this.plugin.settings.parentFields.map(field => ({
      name: field.name,
      displayName: field.displayName || field.name
    }));

    this.fieldSelector = new ParentFieldSelector(
      selectorContainer,
      options,
      this.viewState.selectedParentField,
      this.plugin.settings.uiStyle,
      (fieldName) => this.onFieldChange(fieldName)
    );

    this.fieldSelector.render();
  }

  /**
   * Updates the pin button appearance.
   */
  private updatePinButton(button: HTMLElement): void {
    button.empty();
    const isPinned = this.isPinnedToCurrentField();

    if (isPinned) {
      setIcon(button, 'pin');
      button.addClass('is-active');
      button.setAttribute('aria-label', 'Unpin from this note');
    } else {
      setIcon(button, 'pin');
      button.removeClass('is-active');
      button.setAttribute('aria-label', 'Pin to this note');
    }
  }

  /**
   * Handles parent field change.
   */
  private onFieldChange(fieldName: string): void {
    this.viewState.selectedParentField = fieldName;
    this.updateView();
  }

  /**
   * Renders the tree for the given file.
   */
  private renderTree(file: TFile): void {
    try {
      this.contentContainer.empty();

      // Get the current field config
      const fieldConfig = this.plugin.settings.parentFields.find(
        f => f.name === this.viewState.selectedParentField
      );

      if (!fieldConfig) {
        this.showErrorState(new Error('Parent field not found'));
        return;
      }

      // Render three sections
      this.renderSection('ancestors', file, fieldConfig);
      this.renderSection('descendants', file, fieldConfig);
      this.renderSection('siblings', file, fieldConfig);

    } catch (error) {
      console.error('[Relation Explorer] Error rendering tree:', error);
      this.showErrorState(error);
    }
  }

  /**
   * Renders a single section (ancestors, descendants, or siblings).
   */
  private renderSection(
    sectionType: 'ancestors' | 'descendants' | 'siblings',
    file: TFile,
    fieldConfig: ParentFieldConfig
  ): void {
    const sectionConfig = fieldConfig[sectionType];

    if (!sectionConfig.visible) return;

    // Create section container
    const sectionContainer = this.contentContainer.createDiv('relation-section');
    sectionContainer.setAttribute('data-section', sectionType);

    // Section header
    const header = sectionContainer.createDiv('relation-section-header');

    const toggle = header.createDiv('relation-section-toggle');
    const isCollapsed = this.isSectionCollapsed(sectionType);
    setIcon(toggle, isCollapsed ? 'chevron-right' : 'chevron-down');

    const title = header.createDiv('relation-section-title');
    title.setText(sectionConfig.displayName);

    // Toggle collapse
    header.addEventListener('click', () => {
      this.toggleSectionCollapse(sectionType);
    });

    // Section content
    const content = sectionContainer.createDiv('relation-section-content');

    if (isCollapsed) {
      content.addClass('is-collapsed');
    }

    // Build and render tree for this section
    const tree = this.buildTreeForSection(sectionType, file, sectionConfig);

    if (!tree || (Array.isArray(tree) && tree.length === 0)) {
      const empty = content.createDiv('relation-section-empty');
      empty.setText(`No ${sectionConfig.displayName.toLowerCase()} found`);
    } else if (Array.isArray(tree)) {
      // For siblings/cousins (array of trees)
      tree.forEach(node => {
        this.renderer.render(node, content);
      });
    } else {
      // For ancestors/descendants (single tree)
      this.renderer.render(tree, content);
    }
  }

  /**
   * Builds tree for a specific section.
   */
  private buildTreeForSection(
    sectionType: 'ancestors' | 'descendants' | 'siblings',
    file: TFile,
    sectionConfig: SectionConfig
  ): TreeNode | TreeNode[] | null {
    const engine = this.plugin.getEngineForField(this.viewState.selectedParentField);
    const graph = this.plugin.getGraphForField(this.viewState.selectedParentField);

    if (!engine || !graph) return null;

    switch (sectionType) {
      case 'ancestors':
        return buildAncestorTree(file, engine, graph, {
          maxDepth: sectionConfig.maxDepth,
          detectCycles: true,
          includeMetadata: true
        });

      case 'descendants':
        // Will use buildDescendantTree when implemented
        return buildAncestorTree(file, engine, graph, {
          maxDepth: sectionConfig.maxDepth,
          detectCycles: true,
          includeMetadata: true
        });

      case 'siblings':
        // Will use buildSiblingTree when implemented
        const siblings = engine.getSiblings(file, sectionConfig.includeSelf ?? false);
        return siblings.map(sibling => ({
          file: sibling,
          children: [],
          depth: 0,
          isCycle: false,
          metadata: {}
        }));

      default:
        return null;
    }
  }

  /**
   * Checks if a section is collapsed.
   */
  private isSectionCollapsed(sectionType: string): boolean {
    const fieldSections = this.viewState.collapsedSections[this.viewState.selectedParentField];
    return fieldSections?.includes(sectionType) ?? false;
  }

  /**
   * Toggles section collapse state.
   */
  private toggleSectionCollapse(sectionType: string): void {
    const fieldName = this.viewState.selectedParentField;

    if (!this.viewState.collapsedSections[fieldName]) {
      this.viewState.collapsedSections[fieldName] = [];
    }

    const sections = this.viewState.collapsedSections[fieldName];
    const index = sections.indexOf(sectionType);

    if (index >= 0) {
      sections.splice(index, 1);
    } else {
      sections.push(sectionType);
    }

    this.updateView();
  }

  /**
   * Checks if view is pinned for current field.
   */
  private isPinnedToCurrentField(): boolean {
    return !!this.viewState.pinnedFiles[this.viewState.selectedParentField];
  }

  /**
   * Toggles pin for current field.
   */
  private togglePin(): void {
    const fieldName = this.viewState.selectedParentField;

    if (this.viewState.pinnedFiles[fieldName]) {
      delete this.viewState.pinnedFiles[fieldName];
    } else if (this.currentFile) {
      this.viewState.pinnedFiles[fieldName] = this.currentFile.path;
    }

    this.updateView();
  }

  /**
   * Gets the file to display based on view state.
   */
  private getFileToDisplay(): TFile | null {
    const fieldName = this.viewState.selectedParentField;
    const pinnedPath = this.viewState.pinnedFiles[fieldName];

    // If pinned for this field, use pinned file
    if (pinnedPath) {
      const pinnedFile = this.app.vault.getAbstractFileByPath(pinnedPath);
      if (pinnedFile instanceof TFile) {
        return pinnedFile;
      }
      // Pinned file not found, unpin
      delete this.viewState.pinnedFiles[fieldName];
    }

    // Otherwise, use active file
    return this.app.workspace.getActiveFile();
  }

  // ... rest of methods (updateView, showEmptyState, etc.)
}
```

---

### 6. Basic Settings UI

**File:** `src/main.ts` - ParentRelationSettingTab class (modifications)

```typescript
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

    // Parent Fields (simple comma-separated list for Milestone 4.2A)
    new Setting(containerEl)
      .setName('Parent Fields')
      .setDesc('Comma-separated list of frontmatter fields to track (e.g., "parent, project, category")')
      .addText(text => {
        const fieldNames = this.plugin.settings.parentFields.map(f => f.name).join(', ');

        text
          .setPlaceholder('parent, project, category')
          .setValue(fieldNames)
          .onChange(async value => {
            await this.handleParentFieldsChange(value);
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
        .setValue('5')
        .onChange(async value => {
          const num = parseInt(value);
          if (!isNaN(num)) {
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
            // Run validation on all graphs
            this.plugin.relationGraphs.forEach((graph, fieldName) => {
              console.log(`[Relations] Graph for field "${fieldName}":`);
              const diagnostics = graph.getDiagnostics();
              this.plugin.logDiagnostics(diagnostics);
            });
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
          sortOrder: 'alphabetical',
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
```

---

## Test Specification

**File:** `tests/milestone-4.2A.test.ts` (new file)

### Test Cases

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FrontmatterCache } from '@/frontmatter-cache';
import { ParentFieldSelector } from '@/components/parent-field-selector';
import type ParentRelationPlugin from '@/main';

describe('Milestone 4.2A: Basic Multi-Field Support', () => {
  describe('FrontmatterCache', () => {
    it('should cache metadata for files', () => {
      // Test that metadata is cached on first access
      // Verify subsequent access returns cached value
    });

    it('should invalidate cache on file changes', () => {
      // Test cache invalidation
    });

    it('should get field values correctly', () => {
      // Test getFieldValue for different field types
    });
  });

  describe('Multiple Graphs', () => {
    it('should create separate graph for each parent field', () => {
      // Verify one graph per field
    });

    it('should update all graphs on file changes', () => {
      // Test that all graphs receive update events
    });

    it('should return correct graph for field', () => {
      // Test getGraphForField method
    });
  });

  describe('Parent Field Selector', () => {
    it('should render segmented control for ≤4 fields', () => {
      // Test segmented control rendering
    });

    it('should render dropdown for >4 fields', () => {
      // Test dropdown rendering
    });

    it('should respect manual UI style override', () => {
      // Test uiStyle setting
    });

    it('should trigger change callback on selection', () => {
      // Test onChange callback
    });
  });

  describe('Sidebar Sections', () => {
    it('should render three sections per field', () => {
      // Verify ancestors, descendants, siblings sections
    });

    it('should collapse/expand sections independently', () => {
      // Test section collapse functionality
    });

    it('should show "No items found" for empty sections', () => {
      // Test empty state
    });
  });

  describe('Per-Field Pinning', () => {
    it('should pin independently per parent field', () => {
      // Test that each field has independent pin state
    });

    it('should remember pinned file when switching fields', () => {
      // Switch fields and verify pin state preserved
    });
  });

  describe('Performance', () => {
    it('should use cache to avoid redundant parsing', () => {
      // Verify cache hit on multiple field access
    });

    it('should build multiple graphs efficiently', () => {
      // Benchmark graph building with cache
    });
  });
});
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure (Day 1-2)

- [ ] **Create FrontmatterCache**
  - [ ] Create `src/frontmatter-cache.ts`
  - [ ] Implement `getFieldValue()` method
  - [ ] Implement `getMetadata()` with caching
  - [ ] Implement `invalidate()` methods
  - [ ] Implement `clear()` and `getStats()`
  - [ ] Add JSDoc documentation

- [ ] **Update Type Definitions**
  - [ ] Add interfaces to `src/types.ts`:
    - [ ] `SectionConfig`
    - [ ] `ParentFieldConfig`
    - [ ] `ParentRelationSettings` (new version)
    - [ ] `SidebarViewState` (updated)

- [ ] **Refactor Plugin for Multiple Graphs**
  - [ ] Modify `src/main.ts`:
    - [ ] Change `relationGraph` to `relationGraphs: Map<string, RelationGraph>`
    - [ ] Change `relationshipEngine` to `relationshipEngines: Map<string, RelationshipEngine>`
    - [ ] Add `frontmatterCache: FrontmatterCache`
    - [ ] Update `onload()` to initialize all graphs
    - [ ] Add `buildAllGraphs()` method
    - [ ] Add `getGraphForField()` method
    - [ ] Add `getEngineForField()` method
    - [ ] Update event handlers to update all graphs

- [ ] **Update RelationGraph**
  - [ ] Modify `src/relation-graph.ts`:
    - [ ] Add `frontmatterCache` parameter to constructor
    - [ ] Update `extractParentLinks()` to use cache
    - [ ] Test cache integration

### Phase 2: UI Components (Day 2-3)

- [ ] **Create Parent Field Selector**
  - [ ] Create `src/components/parent-field-selector.ts`
  - [ ] Implement `ParentFieldSelector` class
  - [ ] Implement `renderSegmentedControl()`
  - [ ] Implement `renderDropdown()`
  - [ ] Implement `shouldUseSegmentedControl()` logic
  - [ ] Add event handling for selection changes
  - [ ] Add styling in CSS

- [ ] **Update Sidebar View**
  - [ ] Modify `src/sidebar-view.ts`:
    - [ ] Update `SidebarViewState` interface
    - [ ] Add `fieldSelector` property
    - [ ] Update `createHeader()` to include selector
    - [ ] Add `onFieldChange()` method
    - [ ] Implement `renderSection()` method
    - [ ] Implement `buildTreeForSection()` method
    - [ ] Add section collapse/expand logic
    - [ ] Update pin functionality for per-field pins
    - [ ] Update `getFileToDisplay()` for per-field pins

### Phase 3: Settings UI (Day 3)

- [ ] **Update Settings Tab**
  - [ ] Modify `ParentRelationSettingTab` in `src/main.ts`:
    - [ ] Add "Parent Fields" comma-separated input
    - [ ] Add "Default Parent Field" dropdown
    - [ ] Add "UI Style" dropdown
    - [ ] Update "Max Depth" to apply globally
    - [ ] Keep "Diagnostic Mode" toggle
    - [ ] Implement `handleParentFieldsChange()` method
    - [ ] Add field config preservation logic

### Phase 4: Testing & Polish (Day 4)

- [x] **Create Tests**
  - [x] Create `tests/milestone-4.2A.test.ts`
  - [x] Write FrontmatterCache tests (10 tests covering cache behavior)
  - [x] Write multiple graphs tests (integration placeholder)
  - [x] Write sidebar sections tests (view state tests)
  - [x] Write per-field pinning tests (view state tests)
  - [x] Write performance tests (cache efficiency test)
  - [x] All 14 tests passing

- [x] **Manual Testing**
  - [x] Test with 1 parent field
  - [x] Test with 2-4 parent fields (segmented control)
  - [x] Test with >4 parent fields (dropdown)
  - [x] Test field switching updates all sections
  - [x] Test per-field pinning
  - [x] Test section collapse/expand
  - [x] Test performance with cache
  - [x] **Bug Fix:** Fixed issue where changes to parent fields in non-displayed notes didn't update the graph and sidebar views

- [x] **Documentation**
  - [x] Add JSDoc comments to all new code
  - [x] Update README with multi-field feature
  - [x] Add usage examples

---

## Acceptance Criteria

From specification:

- ✅ Multiple parent fields can be defined (simple list format)
- ✅ Segmented control shows for ≤4 fields, dropdown for >4
- ✅ UI style can be overridden in settings
- ✅ Sidebar displays selected parent field's relationships
- ✅ Three sections (ancestors/descendants/siblings) render correctly
- ✅ Sections show "No items found" when empty
- ✅ Pin works per parent field
- ✅ Switching parent fields updates all sections
- ✅ State persists across sessions
- ✅ Frontmatter cache improves performance
- ✅ All graphs update on file changes (including changes to non-displayed notes)

---

## Performance Considerations

### Expected Improvements

**Without Cache (current):**
- Parse frontmatter N×F times (N notes, F fields)
- Example: 1,000 notes, 3 fields = 3,000 parse operations

**With Cache:**
- Parse frontmatter N times
- Cache hits for subsequent fields
- Example: 1,000 notes, 3 fields = 1,000 parse operations
- **Expected speedup: 3× for 3 fields**

### Benchmarks (Target)

- 1,000 notes, 3 fields: ~300ms total (100ms per graph)
- Graph building should be <2s for typical vaults
- Field switching: <50ms (no rebuild needed)

### Optimization Strategy

- Lazy graph building (build on first access)
- Debounce metadata change events
- Incremental updates per graph (already implemented in earlier milestones)

---

## Edge Cases & Considerations

### 1. No Parent Fields Configured

**Scenario:** User deletes all parent fields
**Handling:** Require at least one field in settings validation
**UI:** Show error message

### 2. Invalid Field Names

**Scenario:** User enters invalid frontmatter field name
**Handling:** Allow any string (let Obsidian handle invalid fields)
**Result:** Will show "No items found" for that field

### 3. Duplicate Field Names

**Scenario:** User enters same field name twice
**Handling:** Deduplicate in `handleParentFieldsChange()`
**Result:** Only one instance per unique name

### 4. Default Field Deleted

**Scenario:** Default field removed from list
**Handling:** Auto-select first available field
**Action:** Update `defaultParentField` setting

### 5. Pinned File Deleted

**Scenario:** File pinned to a parent field is deleted
**Handling:** Already handled in sidebar (unpins automatically)
**Result:** Falls back to active file

### 6. Renaming Parent Field

**Scenario:** User renames a field (e.g., "parent" → "parents")
**Handling:** Treated as new field, old graphs/pins discarded
**Enhancement:** Could add field renaming UI in Milestone 4.2B

---

## Success Metrics

- ✅ All acceptance criteria met
- ✅ All tests passing (new + existing)
- ✅ Performance improvement measurable (3× for 3 fields)
- ✅ No regressions in existing functionality
- ✅ UI is intuitive and responsive

---

## Dependencies

### External Dependencies
- `obsidian` - API for Obsidian plugin development (already installed)
- `vitest` - Testing framework (already installed ✅)

### Internal Dependencies
- Milestone 1.2 (Incremental Updates) - ✅ Completed
- Milestone 2.1 (Ancestor Traversal) - ✅ Completed
- Milestone 2.2 (Descendant Traversal) - ✅ Completed
- Milestone 3.1 (Tree Data Model) - ✅ Completed
- Milestone 3.2 (DOM Tree Renderer) - ✅ Completed

---

## Risk Assessment

### Potential Issues

1. **Risk:** Cache not invalidated correctly, stale data shown
   - **Mitigation:** Comprehensive cache invalidation on all file events
   - **Testing:** Test file changes, renames, deletions
   - **Fallback:** Add manual cache clear command

2. **Risk:** Multiple graphs increase memory usage
   - **Mitigation:** Shared cache reduces duplication
   - **Monitoring:** Track memory in diagnostic mode
   - **Limit:** Document recommended max fields (e.g., 5-10)

3. **Risk:** UI performance degrades with many fields
   - **Mitigation:** Dropdown for >4 fields
   - **Testing:** Test with 10+ fields
   - **Optimization:** Virtual rendering if needed

---

## Future Enhancements (Out of Scope for 4.2A)

Deferred to **Milestone 4.2B**:
- [ ] Advanced per-field configuration UI
- [ ] Custom display names per field
- [ ] Per-section visibility toggles
- [ ] Per-section max depth settings
- [ ] Initial unfold depth configuration
- [ ] Siblings sort order configuration
- [ ] Configuration import/export
- [ ] Configuration presets

**Later Milestones:**
- [ ] Field-specific icons and colors
- [ ] Combined view (all fields at once)
- [ ] Cross-field relationship queries
- [ ] Auto-detect parent fields from vault
- [ ] Field grouping and organization

---

## Next Steps After Completion

1. ✅ Complete Milestone 4.2A implementation
2. Verify all acceptance criteria met
3. Run comprehensive testing
4. Update documentation
5. Create demo/tutorial
6. Gather user feedback
7. Proceed to **Milestone 4.2B** (Advanced Per-Field Configuration)

---

## Appendix A: Example Usage

### Single Field

```typescript
// Settings
{
  "parentFields": [
    {
      "name": "parent",
      "displayName": "Parent"
      // ... section configs
    }
  ],
  "defaultParentField": "parent"
}

// Behavior: Single parent field with three sections
```

### Multiple Fields

```typescript
// Settings
{
  "parentFields": [
    {
      "name": "parent",
      "displayName": "Parent"
    },
    {
      "name": "project",
      "displayName": "Project"
    },
    {
      "name": "category",
      "displayName": "Category"
    }
  ],
  "defaultParentField": "project"
}

// UI: Segmented control with three segments
// User can click to switch between parent/project/category
// Each field shows its own ancestors/descendants/siblings
```

### Programmatic Access

```typescript
// Get graph for specific field
const projectGraph = plugin.getGraphForField('project');
const ancestors = projectGraph.getAncestors(currentFile);

// Get engine for specific field
const categoryEngine = plugin.getEngineForField('category');
const descendants = categoryEngine.getDescendants(currentFile, 3);
```

---

## Appendix B: UI Mockups

### Segmented Control (≤4 fields)

```
┌─────────────────────────────────────┐
│ Relation Explorer            [📌]   │
├─────────────────────────────────────┤
│                                      │
│  [ Parent | Project | Category ]    │  ← Segmented Control
│                                      │
├─────────────────────────────────────┤
│ ▼ Ancestors                          │
│   └─ Parent Note 1                   │
│       └─ Grandparent Note            │
├─────────────────────────────────────┤
│ ▼ Descendants                        │
│   └─ Child Note 1                    │
│   └─ Child Note 2                    │
├─────────────────────────────────────┤
│ ▶ Siblings                           │
│                                      │
└─────────────────────────────────────┘
```

### Dropdown (>4 fields)

```
┌─────────────────────────────────────┐
│ Relation Explorer            [📌]   │
├─────────────────────────────────────┤
│                                      │
│  Parent Field: [Project       ▼]    │  ← Dropdown
│                                      │
├─────────────────────────────────────┤
│ ▼ Ancestors                          │
│   └─ Main Project                    │
│       └─ Program                     │
├─────────────────────────────────────┤
│ ▼ Descendants                        │
│   └─ Sub-Project 1                   │
│   └─ Sub-Project 2                   │
├─────────────────────────────────────┤
│ ▼ Siblings                           │
│   └─ Other Project A                 │
│   └─ Other Project B                 │
│                                      │
└─────────────────────────────────────┘
```

### Settings UI

```
┌─────────────────────────────────────────────────────────┐
│ Parent Relation Explorer Settings                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Parent Fields                                            │
│ Comma-separated list of frontmatter fields to track     │
│ [parent, project, category                      ]       │
│                                                          │
│ Default Parent Field                                     │
│ Which parent field to show by default                   │
│ [project                             ▼]                 │
│                                                          │
│ UI Style                                                 │
│ How to display parent field selector                    │
│ [Auto                                ▼]                 │
│                                                          │
│ Max Depth                                                │
│ Maximum depth for tree traversal                        │
│ [5                                   ]                   │
│                                                          │
│ ☑ Diagnostic Mode                                       │
│   Enable verbose logging for graph validation           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Status:** Ready for Implementation
