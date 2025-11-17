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

### Advanced Codeblock Features (Milestone 5.2)
- **Smart Filtering**: Filter displayed notes by tags, folders, or exclude specific notes
- **Customizable Titles**: Show simple or detailed titles with filter information
- **Visual Styles**: Choose between detailed, minimal, or compact presentation styles
- **Node Limiting**: Limit large trees with `maxNodes` and show truncation indicators
- **List Rendering**: Siblings and cousins display as clean, clickable lists
- **Filter Combinations**: Combine multiple filters with AND logic for precise results

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

### Navigation Commands (Milestone 6.1)
- **Quick Navigation**: Navigate to parent or child notes instantly from the command palette
  - Go to parent note - Navigate directly to single parent, or choose from multiple
  - Go to child note - Navigate directly to single child, or choose from multiple
- **Smart Selection**: Modal selector for multiple parents/children
  - Full keyboard navigation (Enter/Space to select, arrows to navigate)
  - Displays note names and folder paths
  - Accessible and intuitive interface
- **Keyboard Shortcuts**: All commands support custom keyboard shortcuts
  - Assign shortcuts via Obsidian Settings → Hotkeys
  - Search for "relation" to find all plugin commands

### Advanced Navigation & Analysis (Milestone 6.2)
- **Relationship Discovery**: Explore extended relationships in your vault
  - Show siblings - Find notes sharing the same parent
  - Show cousins - Find notes at the same hierarchy level in different branches
  - Find shortest path - Discover how any two notes are connected
- **Graph Analysis**: Understand your vault's structure
  - Show root notes - Find top-level notes (no parents, have children)
  - Show leaf notes - Find bottom-level notes (no children, have parents)
  - Show graph statistics - View comprehensive metrics about your hierarchy
- **Validation & Export**: Maintain and share your knowledge graph
  - Validate graph - Check for cycles, broken links, and orphaned references
  - Export ancestor tree - Copy formatted markdown tree to clipboard
- **Interactive Modals**: Filter and navigate results efficiently
  - Real-time search filtering
  - Clickable note lists with full paths
  - Keyboard navigation support
- **Multi-Field Support**: All commands work per parent field
  - Independent analysis of each relationship type
  - Field-specific labels (e.g., "Show siblings [Project]")
  - Switch contexts seamlessly

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

### Using Navigation Commands

The plugin provides six commands for efficient navigation and sidebar control:

#### Quick Navigation Commands

**Go to parent note**
- Opens the parent note of the current file
- If single parent: navigates directly
- If multiple parents: shows a selection modal
- Command is only available when the note has at least one parent

**Go to child note**
- Opens a child note of the current file
- If single child: navigates directly
- If multiple children: shows a selection modal
- Command is only available when the note has at least one child

#### Sidebar Display Commands

**Show parent tree in sidebar**
- Opens the sidebar and shows only the ancestors section
- Automatically pins the sidebar to the current note
- Hides descendants and siblings sections

**Show child tree in sidebar**
- Opens the sidebar and shows only the descendants section
- Automatically pins the sidebar to the current note
- Hides ancestors and siblings sections

**Show full lineage in sidebar**
- Opens the sidebar and shows all sections
- Displays ancestors, descendants, and siblings
- Automatically pins the sidebar to the current note

**Toggle relation sidebar**
- Opens the sidebar if currently closed
- Closes the sidebar if currently open
- Quick way to show/hide the sidebar

#### Setting Up Keyboard Shortcuts

You can assign keyboard shortcuts to any command for faster access:

1. Open Obsidian Settings (Cmd/Ctrl + ,)
2. Navigate to "Hotkeys"
3. Search for "relation" to see all plugin commands
4. Click the (+) icon next to a command
5. Press your desired key combination

**Suggested Shortcuts:**
- `Cmd/Ctrl + Shift + P` - Go to parent note
- `Cmd/Ctrl + Shift + C` - Go to child note
- `Cmd/Ctrl + Shift + R` - Toggle relation sidebar
- `Cmd/Ctrl + Shift + L` - Show full lineage in sidebar

#### Note Selection Modal

When navigating to parents or children and multiple options are available, a selection modal appears:

- **Mouse Navigation**: Click on any note to navigate to it
- **Keyboard Navigation**:
  - `↑` / `↓` - Navigate between notes
  - `Enter` or `Space` - Select the focused note
  - `Escape` - Close the modal without selecting

The modal displays:
- Note name (prominently)
- Folder path (in smaller text, if not in root folder)

### Advanced Navigation Commands (Milestone 6.2)

The plugin provides powerful advanced navigation and analysis commands. **All commands support multiple parent fields** - they are registered per-field with field-specific labels (e.g., "Show siblings [Parent]", "Show siblings [Project]").

#### Advanced Navigation

**Show siblings [FieldName]**
- Displays all notes that share the same parent(s) as the current note
- Opens a filterable results modal with clickable note list
- Shows count of siblings found
- Click any note to open it
- Only available when note has siblings

**Show cousins [FieldName]**
- Displays first cousins (notes sharing the same grandparent)
- Opens a filterable results modal
- Cousins are notes at the same "family level" but different branches
- Only available when note has cousins

**Find shortest path [FieldName]**
- Find the shortest path between the current note and any other note
- Opens a note selection modal to choose target note
- Uses breadth-first search to find optimal path
- Displays path in a Notice with length and direction (up/down/mixed)
- Shows path as: `Note A → Note B → Note C → Target`
- Path remains visible for 10 seconds

#### Graph Analysis

**Show root notes [FieldName]**
- Displays all notes with no parents but at least one child
- These are top-level notes in your hierarchy
- Opens filterable results modal with count
- Useful for finding entry points to your knowledge graph
- Excludes isolated notes (notes with neither parents nor children)

**Show leaf notes [FieldName]**
- Displays all notes with no children but at least one parent
- These are bottom-level notes in your hierarchy
- Opens filterable results modal with count
- Useful for finding notes that need expansion
- Excludes isolated notes

**Show graph statistics [FieldName]**
- Displays comprehensive graph metrics in a Notice
- Statistics include:
  - Total nodes (notes)
  - Total edges (parent-child relationships)
  - Number of root notes
  - Number of leaf notes
  - Maximum depth from any root
  - Maximum breadth (most children any note has)
  - Number of cycles detected
  - Average children per note
- Useful for understanding your vault structure

#### Utility Commands

**Validate graph [FieldName]**
- Runs comprehensive graph validation
- Checks for cycles, orphaned references, and broken links
- Displays results in console with severity levels:
  - Errors (red): Critical issues requiring attention
  - Warnings (yellow): Potential problems
  - Info (blue): Informational messages
- Shows summary Notice with total errors and warnings
- Console output includes context for each issue

**Export ancestor tree [FieldName]**
- Exports the current note's ancestor tree as markdown
- Copies formatted tree to clipboard
- Uses wiki-links for note references
- Includes cycle indicators (🔄) if cycles detected
- Tree format preserves hierarchy with indentation:
  ```markdown
  # Ancestors of Current Note [Parent]

  - [[Current Note]]
    - [[Parent Note]]
      - [[Grandparent Note]]
  ```
- Maximum depth: 10 levels
- Ready to paste into any note

#### Results Modal Features

When commands display multiple results (siblings, cousins, roots, leaves), they use an interactive modal:

**Features:**
- **Filter Input**: Type to filter results in real-time
- **Note Count**: Shows total results matching filter
- **Clickable List**: Click any note to open it
- **Full Paths**: Hover to see complete file path
- **Keyboard Navigation**:
  - Type to filter
  - Click to select
  - `Escape` to close
- **Responsive**: Updates instantly as you type

**Example Usage:**
1. Run "Show leaf notes [Parent]"
2. See "Leaf Notes (42)" with search box
3. Type "project" to filter to project-related leaves
4. Click any note to navigate to it

#### Multi-Field Support

All advanced commands are registered **per parent field**. If you have multiple parent fields configured (e.g., "parent", "project", "category"), you'll see separate commands for each:

- Show siblings [Parent]
- Show siblings [Project]
- Show siblings [Category]
- Find shortest path [Parent]
- Find shortest path [Project]
- ... and so on

This allows you to analyze different relationship graphs independently.

#### Practical Examples

**Finding Related Work:**
1. Open a note in your "Projects" hierarchy
2. Run "Show cousins [Project]"
3. See related projects at the same level
4. Navigate to explore parallel work

**Understanding Connections:**
1. Wonder how two notes are related?
2. Run "Find shortest path [Parent]"
3. Select target note from list
4. See exact connection path displayed

**Graph Health Check:**
1. Run "Validate graph [Parent]"
2. Check console for any warnings
3. Fix cycles or broken links
4. Re-run to confirm fixes

**Exporting Knowledge:**
1. Navigate to a deep note
2. Run "Export ancestor tree [Parent]"
3. Paste into documentation note
4. Share lineage with others

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
| `title` | string | `none` | Title mode: `none`, `simple`, `detailed` |
| `filterTag` | string | - | Filter by tag (e.g., `#project` or `project`) |
| `filterFolder` | string | - | Filter by folder path (e.g., `Projects/`) |
| `exclude` | string | - | Exclude notes (comma-separated wiki-links) |
| `maxNodes` | number | - | Maximum nodes to display (shows "more..." if exceeded) |
| `style` | string | - | Visual style: `compact`, `detailed`, `minimal` |

#### Title Modes

Control whether and how to display a title above the relationship tree:

**None** (default):
- No title displayed
- Tree starts immediately

**Simple**:
- Shows basic title: "Descendants of Note Name"
- Uses configured display names from settings

**Detailed**:
- Shows title with filter information
- Main title on first line
- Filter details on second line in smaller font
- Example: "Descendants of Project Alpha" with "tag: #active, folder: Projects/" below

#### Filtering Options

Filter which notes appear in the relationship tree:

**Tag Filtering** (`filterTag`):
- Show only notes with a specific tag
- Supports nested tags (e.g., `#project` matches `#project/active`)
- Tag can be specified with or without `#` prefix
- Checks both frontmatter and inline tags

**Folder Filtering** (`filterFolder`):
- Show only notes in a specific folder
- Includes notes in subfolders
- Path can be specified with or without trailing slash
- Example: `Projects/` matches `Projects/Active/note.md`

**Exclusion** (`exclude`):
- Exclude specific notes from results
- Comma-separated list of note names
- Supports wiki-link format: `[[Note1]], [[Note2]]`
- Unknown notes in exclusion list are silently ignored

**Filter Combination**:
- Multiple filters use AND logic
- Note must match ALL specified filters to appear
- Example: `filterTag: #active` + `filterFolder: Work/` shows only notes that are tagged AND in the folder

#### Node Limiting

**Max Nodes** (`maxNodes`):
- Limit the total number of nodes displayed
- When exceeded, shows truncation indicator: "(+N more...)"
- Preserves tree structure up to the limit
- Useful for large trees or overview displays

#### Visual Styles

Choose different visual presentations for your trees:

**Detailed**:
- Full padding and spacing
- Enhanced visual hierarchy
- Best for focused reading

**Minimal**:
- Ultra-compact layout
- Minimal padding and spacing
- Best for dense overviews

**Compact**:
- Balanced between detailed and minimal
- Standard spacing with reduced padding
- General-purpose style

#### Display Modes

**Tree Mode** (default):
- Hierarchical tree with expand/collapse controls
- Proper indentation showing parent-child relationships
- Interactive navigation with clickable links

**List Mode**:
- Flat list of all results for siblings/cousins
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

**Filter by tag:**
````markdown
```relation-tree
type: descendants
filterTag: #project
title: simple
```
````

**Filter by folder:**
````markdown
```relation-tree
type: ancestors
filterFolder: Work/Projects/
title: simple
```
````

**Exclude specific notes:**
````markdown
```relation-tree
type: siblings
exclude: [[Template]], [[Archive]]
```
````

**Combine multiple filters:**
````markdown
```relation-tree
type: descendants
filterTag: #active
filterFolder: Projects/
exclude: [[Old Project]]
title: detailed
```
````

**Limit large trees:**
````markdown
```relation-tree
type: descendants
depth: 10
maxNodes: 20
title: simple
```
````

**Use visual styles:**
````markdown
```relation-tree
type: ancestors
style: detailed
title: simple
```
````

**Kitchen sink - all options:**
````markdown
```relation-tree
note: [[My Project]]
type: descendants
field: project
depth: 5
filterTag: #active
filterFolder: Work/
exclude: [[Template]]
maxNodes: 30
style: detailed
title: detailed
collapsed: false
showCycles: true
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