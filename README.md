# Relation Explorer

An Obsidian plugin for visualizing parent-child relationships between notes based on user-defined frontmatter fields.

## Features

- **Flexible Relationship Tracking**: Define custom frontmatter fields to establish parent-child relationships between notes
- **Automatic Graph Building**: Automatically builds and maintains a relationship graph as you create and modify notes
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
4. Automatically updates the graph when notes are modified or renamed

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
- `manifest.json` - Plugin manifest
- `rollup.config.mjs` - Build configuration

## License

MIT License - see [LICENSE](LICENSE) file for details

## Author

Fabian Kloosterman
- GitHub: [@fkloosterman](https://github.com/fkloosterman)

## Support

If you encounter any issues or have feature requests, please open an issue on the [GitHub repository](https://github.com/fkloosterman/relations-obsidian).