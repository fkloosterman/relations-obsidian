# Relation Explorer

An Obsidian plugin for visualizing parent-child relationships between notes based on user-defined frontmatter fields.

## Features

### Core Functionality
- **Multiple Parent Fields**: Track different types of hierarchies simultaneously (e.g., parent, project, category)
- **Interactive Sidebar**: View ancestors, descendants, and siblings for the current note
- **Embedded Relationship Trees**: Embed relationship trees directly in notes using `relation-tree` codeblocks
- **Field Switching**: Easily switch between different parent fields using a modern UI selector
- **Per-Field Pinning**: Pin the sidebar to specific notes independently for each parent field
- **Flexible Relationship Tracking**: Define custom frontmatter fields to establish parent-child relationships
- **Automatic Graph Building**: Automatically builds and maintains relationship graphs as you create and modify notes
- **Cycle Detection**: Detects and reports circular relationships to prevent infinite traversals

### Advanced Per-Field Configuration (Milestone 4.2B)
- **Custom Display Names**: Personalize field and section names (e.g., "Projects" instead of "parent")
- **Section Visibility Control**: Show or hide ancestors, descendants, or siblings sections per field
- **Initial Collapsed State**: Set default expanded/collapsed state for each section
- **Configurable Depth**: Set max depth and initial unfold depth independently per section
- **Siblings Sorting**: Sort siblings alphabetically, by creation date, or by modification date
- **Include Self Option**: Choose whether to include the current file in siblings list
- **Configuration Import/Export**: Backup and share your configurations as JSON
- **Preset Configurations**: Quick setup with 5 built-in presets for common workflows
- **Visual Configuration Editor**: Manage settings through an intuitive collapsible form interface

### Advanced Context Menu (Milestone 4.3B)
- **Relationship Modification**: Add or remove parent-child relationships directly from the tree
  - Set/Remove as Parent (or Ancestor)
  - Set/Remove as Child (or Descendant)
- **Smart Section Logic**: Context menu adapts based on section and current relationships
- **Tree Manipulation**: Expand or collapse entire subtrees with one click
- **Command Palette Integration**: Access actions via keyboard shortcuts
- **Confirmation Dialogs**: Prevent accidental changes with confirmation prompts
- **Undo Support**: All relationship changes support undo/redo (Ctrl/Cmd+Z)
- **Custom Labels**: Uses your display names for parent fields and sections

📖 **[Read the full Advanced Context Menu Guide](docs/ADVANCED-CONTEXT-MENU-GUIDE.md)**

## Installation

### Manual Installation

1. Download the latest release
2. Extract the files to your Obsidian vault's plugins folder: `<vault>/.obsidian/plugins/relations-obsidian/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Usage

### Setting Up Relationships

Add a frontmatter field to your notes to define parent relationships:

```yaml
---
parent: "[[Parent Note]]"
---
```

You can also specify multiple parents:

```yaml
---
parent:
  - "[[Parent Note 1]]"
  - "[[Parent Note 2]]"
---
```

### Multiple Parent Fields

You can track multiple types of hierarchies by using different frontmatter fields:

```yaml
---
parent: "[[Parent Note]]"
project: "[[Project A]]"
category: "[[Category 1]]"
---
```

The plugin will maintain separate relationship graphs for each field, allowing you to view different hierarchies of the same notes.

### Using the Sidebar

1. Open the Relation Explorer sidebar via the ribbon icon or command palette
2. The sidebar shows relationships for the current note
3. If you have multiple parent fields configured, use the field selector to switch between them
4. Click the pin icon to keep the sidebar focused on a specific note
5. Each section (Ancestors, Descendants, Siblings) can be expanded/collapsed independently

### Embedding Relationship Trees in Notes

You can embed relationship trees directly in your notes using `relation-tree` codeblocks. This allows you to visualize hierarchies inline with your content.

#### Basic Usage

Create a codeblock with the `relation-tree` type and specify parameters in YAML-style format:

````markdown
```relation-tree
type: ancestors
```
````

This displays the ancestor tree for the current note.

#### Specifying a Target Note

To show relationships for a different note:

````markdown
```relation-tree
note: [[Project Alpha]]
type: descendants
depth: 3
```
````

#### Available Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `note` | string | current note | Target note (wiki-link or file path) |
| `type` | string | `ancestors` | Relationship type: `ancestors`, `descendants`, `siblings`, `cousins` |
| `depth` | number | from settings | Maximum traversal depth (max: 100) |
| `mode` | string | `tree` | Display mode: `tree`, `list`, `compact` |
| `field` | string | default field | Parent field to use |
| `showCycles` | boolean | `true` | Show cycle indicators |
| `collapsed` | boolean | `false` | Start with tree collapsed |

#### Display Modes

**Tree Mode** (default):
- Hierarchical tree with expand/collapse controls
- Proper indentation showing parent-child relationships
- Interactive navigation with clickable links

**List Mode**:
- Flat list of all results
- No tree structure or toggles
- Compact and simple

**Compact Mode**:
- Tree structure with minimal spacing
- Reduced padding for dense layouts
- Useful for overviews

#### Examples

**Show ancestors for a specific project:**
````markdown
```relation-tree
note: [[Project Alpha]]
type: ancestors
mode: tree
```
````

**Show descendants with limited depth:**
````markdown
```relation-tree
type: descendants
depth: 2
mode: compact
```
````

**Show siblings using a specific field:**
````markdown
```relation-tree
type: siblings
field: project
mode: list
```
````

**Show cousins with collapsed tree:**
````markdown
```relation-tree
note: [[Research Note]]
type: cousins
collapsed: true
```
````

**Use different parent field:**
````markdown
```relation-tree
type: ancestors
field: category
depth: 5
```
````

#### Error Handling

If there's an issue with your codeblock parameters, you'll see an inline error message:

- "Note not found" - The specified note doesn't exist
- "Invalid field" - The specified parent field isn't configured
- "Invalid parameter format" - Syntax error in your parameters

All errors display with helpful context to fix the issue quickly.

### Configuration

Access plugin settings via Settings → Relation Explorer.

#### Quick Start with Presets

The plugin includes 5 preset configurations to get you started quickly:

1. **simple-hierarchy** - Single parent field with standard sections (great for basic note hierarchies)
2. **project-management** - Project and category hierarchies for PM workflows
3. **knowledge-base** - Deep hierarchies optimized for knowledge management (Zettelkasten)
4. **compact** - Minimal view with reduced sections for focused work
5. **multi-field-explorer** - Three different hierarchies (parent, project, topic) for comprehensive organization

To load a preset:
1. Go to Settings → Relation Explorer
2. Under "Configuration Presets", select a preset from the dropdown
3. Confirm to load the preset configuration

#### Advanced Per-Field Configuration

Each parent field can be configured independently with:

**Field Settings:**
- **Field Name**: The frontmatter field name (e.g., "parent", "project")
- **Display Name**: Optional friendly name shown in the UI

**Section Settings** (for Ancestors, Descendants, and Siblings):
- **Display Name**: Custom name for the section header
- **Visible**: Show or hide this section in the sidebar
- **Initially Collapsed**: Whether the section starts collapsed
- **Max Depth** (ancestors/descendants only): Maximum traversal depth
- **Initial Unfold Depth** (ancestors/descendants only): How many levels to show expanded
- **Sort Order** (siblings only): Alphabetical, creation date, or modification date
- **Include Self** (siblings only): Whether to show the current file in the siblings list

#### Import/Export Configuration

- **Export**: Save your configuration as JSON to clipboard
- **Import**: Load a configuration from JSON (with validation)

This allows you to:
- Backup your configurations
- Share configurations with others
- Quickly switch between different setups

#### Global Settings

- **Default Parent Field**: Which field to show by default when opening the sidebar
- **UI Style**: How to display the field selector (Auto/Segmented Control/Dropdown)
- **Diagnostic Mode**: Enable verbose logging for debugging

## How It Works

The plugin:
1. Scans all markdown files in your vault
2. Extracts parent relationships from the configured frontmatter field
3. Builds a bidirectional graph of parent-child relationships
4. Detects cycles in the relationship graph
5. Automatically updates the graph when notes are modified or renamed

### Cycle Detection

The plugin includes built-in cycle detection to identify circular parent-child relationships. Cycles occur when a note is its own ancestor through a chain of parent relationships (e.g., Note A → Note B → Note C → Note A).

**API Methods:**

```typescript
// Check if a specific file has a cycle
const cycleInfo = plugin.relationGraph.detectCycle(file);
if (cycleInfo) {
  console.log(cycleInfo.description); // e.g., "Cycle detected: A → B → C → A"
  console.log(cycleInfo.cyclePath);   // Array of files in the cycle
  console.log(cycleInfo.length);      // Number of unique nodes in cycle
}

// Check if the entire graph has any cycles
if (plugin.relationGraph.hasCycles()) {
  console.log('Warning: Graph contains cycles');
}
```

The cycle detector uses a three-color depth-first search algorithm to efficiently detect cycles while preserving the user-defined graph structure.

## Programmatic API

The plugin exposes a comprehensive public API for querying relationship graphs programmatically. This is useful for building custom features, commands, or integrations.

### Accessing the API

```typescript
// Get the plugin instance
const plugin = this.app.plugins.getPlugin('relations-obsidian');

// Get the current active file
const currentFile = this.app.workspace.getActiveFile();

// Access graphs and engines for specific parent fields
const projectGraph = plugin.getGraphForField('project');
const categoryEngine = plugin.getEngineForField('category');
```

### Multi-Field API

The plugin supports querying different parent fields independently:

```typescript
// Get ancestors in the 'project' hierarchy
const projectGraph = plugin.getGraphForField('project');
const projectAncestors = projectGraph.getAncestors(currentFile);

// Get descendants in the 'category' hierarchy
const categoryGraph = plugin.getGraphForField('category');
const categoryDescendants = categoryGraph.getDescendants(currentFile);
```

For backward compatibility, the default API methods use the configured default parent field:

```typescript
// Uses the default parent field
const ancestors = plugin.getAncestors(currentFile);
const descendants = plugin.getDescendants(currentFile);
```

### Quick Reference

**Ancestor Queries:**
- `getAncestors(file, options?)` - Get ancestors with metadata (organized by generation)
- `getParents(file)` - Get immediate parents only
- `getAllAncestors(file, options?)` - Get all ancestors as flat array

**Descendant Queries:**
- `getDescendants(file, options?)` - Get descendants with metadata (organized by generation)
- `getChildren(file)` - Get immediate children only
- `getAllDescendants(file, options?)` - Get all descendants as flat array

**Sibling Queries:**
- `getSiblings(file, options?)` - Get siblings with metadata

**Cousin Queries:**
- `getCousins(file, options?)` - Get cousins at specified degree

**Combined Queries:**
- `getFullLineage(file, options?)` - Get ancestors + descendants + siblings

**Cycle Detection:**
- `detectCycle(file)` - Check if file is in a cycle
- `hasCycles()` - Check if graph has any cycles

### Usage Examples

**Example 1: Get Ancestors**
```typescript
const result = plugin.getAncestors(currentFile);

console.log(`Found ${result.totalCount} ancestors in ${result.depth} generations`);

result.generations.forEach((generation, index) => {
  console.log(`Generation ${index + 1}:`, generation.map(f => f.basename));
});
```

**Example 2: Get Full Lineage**
```typescript
const lineage = plugin.getFullLineage(currentFile);

console.log('Ancestors:', lineage.stats.totalAncestors);
console.log('Descendants:', lineage.stats.totalDescendants);
console.log('Siblings:', lineage.stats.totalSiblings);
```

**Example 3: Find Siblings**
```typescript
const result = plugin.getSiblings(currentFile);
console.log(`Found ${result.totalCount} siblings`);

result.siblings.forEach(sibling => {
  console.log('- ' + sibling.basename);
});
```

**Example 4: Get Cousins**
```typescript
// First cousins
const firstCousins = plugin.getCousins(currentFile, { degree: 1 });
console.log(`Found ${firstCousins.totalCount} first cousins`);

// Second cousins
const secondCousins = plugin.getCousins(currentFile, { degree: 2 });
console.log(`Found ${secondCousins.totalCount} second cousins`);
```

**Example 5: Detect Cycles**
```typescript
const cycleInfo = plugin.detectCycle(currentFile);

if (cycleInfo) {
  console.warn('⚠️ Cycle detected!');
  console.warn('Path:', cycleInfo.cyclePath.map(f => f.basename).join(' → '));
} else {
  console.log('✅ No cycles detected');
}
```

### Complete Documentation

For complete API documentation including all methods, parameters, return types, and advanced examples, see:

📖 **[API Reference Documentation](docs/api-reference.md)**

The API reference includes:
- Detailed method descriptions
- TypeScript type definitions
- Advanced usage examples
- Error handling guidelines
- Performance considerations

## Development

### Building the Plugin

```bash
# Install dependencies
npm install

# Build once
npm run build

# Build and watch for changes
npm run dev
```

### Project Structure

- `src/main.ts` - Main plugin entry point and settings
- `src/relation-graph.ts` - Core relationship graph logic
- `src/cycle-detector.ts` - Cycle detection implementation
- `tests/` - Test suite (Vitest)
- `docs/` - Implementation plans and documentation
- `manifest.json` - Plugin manifest
- `rollup.config.mjs` - Build configuration

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Author

Fabian Kloosterman
- GitHub: [@fkloosterman](https://github.com/fkloosterman)

## Support

If you encounter any issues or have feature requests, please open an issue on the [GitHub repository](https://github.com/fkloosterman/relations-obsidian).