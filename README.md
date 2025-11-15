# Relation Explorer

An Obsidian plugin for visualizing parent-child relationships between notes based on user-defined frontmatter fields.

## Features

- **Flexible Relationship Tracking**: Define custom frontmatter fields to establish parent-child relationships between notes
- **Automatic Graph Building**: Automatically builds and maintains a relationship graph as you create and modify notes
- **Cycle Detection**: Detects and reports circular relationships to prevent infinite traversals
- **Configurable Settings**: Customize the parent field name and maximum traversal depth

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

### Configuration

Access plugin settings via Settings → Relation Explorer:

- **Parent Field**: The frontmatter field name used to identify parent links (default: `parent`)
- **Max Depth**: Maximum depth for relationship tree traversal (default: `5`)

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