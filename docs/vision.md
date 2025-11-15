# Obsidian Parent-Relation Plugin

## Project Vision

The purpose of this project is to create a **standalone, dependency-free Obsidian plugin** that provides a powerful, flexible, and efficient way to navigate a vault’s hierarchical structure using **explicit parent metadata fields**. By interpreting notes as nodes in a semantic tree defined by user-specified parent fields, the plugin reveals rich family-like relationships such as parents, grandparents, siblings, cousins, descendants, and more.

The plugin aims to:

* Use **only Obsidian’s built-in metadata index** (no Dataview/DataCore/Bases).
* Enable **intuitive, visual navigation** of note hierarchies.
* Provide both **sidebar views** and **inline codeblock renderers**.
* Handle **large vaults (5,000–50,000 notes)** efficiently.
* Work entirely offline with **minimal performance overhead**.
* Offer a **modular, extensible architecture** for future features.
* Safely handle **cyclic references** with clear user-facing indicators.

Ultimately, this plugin will serve as a dedicated tool for exploring the lineage and structure of ideas, documents, and conceptual hierarchies as expressed through user-defined metadata.

---

## Core Components

### 1. Settings Module

* **Parent field name selector** (default: `parent`).
* Support for **array-valued** parent fields.
* Toggle for interpreting the parent field as:

  * one or more parents, or
  * one or more children.
* Options for **maximum depth**, **cycle indicators**, and **UI rendering behavior**.

### 2. Metadata Graph Indexer

* Builds an in-memory, directed graph of notes and their parent/child relationships.
* Listens to vault and metadata events:

  * file modifications
  * file renaming
  * metadata caching
* Supports incremental updates for performance.
* Stores normalized parent relationships even when links require resolution.

### 3. Relationship Engine

Responsible for computing:

* Parents and grandparents
* Ancestors (N levels)
* Children and grandchildren
* Descendants (N levels)
* Siblings (notes sharing same parent)
* Cousins (notes sharing a grandparent)
* Mixed relative sets with optional filters

Includes:

* **Cycle detection** (DFS-based)
* **Recursion guards** for rendering
* Optional “diagnostics mode” for surfacing relationship anomalies

### 4. Tree Rendering System

Used in both the sidebar and inline codeblocks.

* Supports **collapsible lists**.
* Allows multiple tree modes: parent tree, child tree, full lineage.
* Provides visual elements (icons, cycle markers, expandable nodes).
* Integrates with Obsidian link navigation.

### 5. Sidebar View

* Dedicated **tree view pane**.
* Auto-updates when the active note changes.
* Can be pinned to specific root notes.
* Supports user-configurable tree modes and filters.

### 6. Codeblock Processor

Enables in-document rendering of relational structures.
Examples:

````
```relation-tree
note: [[Project Overview]]
type: ancestors
depth: 3
```
````

### 7. Commands

* "Show parent tree of current note"
* "Show children tree of current note"
* "Show full lineage"
* "Open parent-relations view"
* Commands for navigating to siblings, cousins, or ancestors

### 8. Future Extension Points

* Visual “drag to set parent” interaction.
* Saved relationship views.
* Exportable tree structures.
* Integration with directory or tag structures.

---

## Implementation Plan

### Phase 1 — Foundation

1. Create plugin scaffolding using the Obsidian sample plugin template.
2. Implement settings UI.
3. Build the graph indexer with live vault event handling.
4. Add cycle detection and data validation utilities.

### Phase 2 — Relationship Engine

1. Implement ancestor/descendant traversal.
2. Add sibling and cousin resolution.
3. Add depth-limited traversal with recursion guards.
4. Design data structures for representing a computed relationship tree.

### Phase 3 — Rendering Layer

1. Create a generic tree renderer capable of nested DOM creation.
2. Implement cycle-safe rendering.
3. Build styling classes for hierarchical UI (indentation, icons, toggles).

### Phase 4 — Views

1. Create the sidebar view extending `ItemView`.
2. Bind renderer to the active note.
3. Provide user-configurable view modes.
4. Add context menus for navigation.

### Phase 5 — Codeblock Renderer

1. Register a `relation-tree` codeblock processor.
2. Parse YAML from the codeblock.
3. Render trees inside notes with the same renderer.

### Phase 6 — Commands and Polishing

1. Add palette commands.
2. Improve performance for large vaults.
3. Add cycle diagnostics.
4. Perform UI/UX polishing.

### Phase 7 — Optional Advanced Features

* Drag-and-drop parent assignment.
* Saved hierarchical views.
* Visual export (PNG/SVG generation).
* Multi-root vault overview.

---

## Summary

This plugin will provide a fast, reliable, and intuitive way to navigate the hierarchical relationships between notes using user-chosen metadata fields. With a strong emphasis on performance, stability, extensibility, and safety (particularly around cycle handling), it will fill a major gap in Obsidian’s native navigation features. It is designed to be both powerful for large, complex vaults and simple enough for everyday note-taking.
