# Relations Obsidian Plugin - API Reference

**Version:** 1.0.0
**Last Updated:** 2025-11-15

---

## Overview

The Relations Obsidian Plugin exposes a comprehensive public API for querying relationship graphs in your vault. All methods are available through the plugin instance and provide type-safe, well-documented interfaces for accessing parent-child relationships, siblings, cousins, and more.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Ancestor Queries](#ancestor-queries)
3. [Descendant Queries](#descendant-queries)
4. [Sibling Queries](#sibling-queries)
5. [Cousin Queries](#cousin-queries)
6. [Combined Queries](#combined-queries)
7. [Cycle Detection](#cycle-detection)
8. [Type Definitions](#type-definitions)
9. [Usage Examples](#usage-examples)
10. [Error Handling](#error-handling)

---

## Getting Started

### Accessing the Plugin API

To use the API, first get the plugin instance from your Obsidian app:

```typescript
// Get the plugin instance
const plugin = this.app.plugins.getPlugin('relations-obsidian');

// Get the current active file
const currentFile = this.app.workspace.getActiveFile();

// Now you can use any API method
const ancestors = plugin.getAncestors(currentFile);
```

### Type Safety

All API methods are fully typed with TypeScript interfaces. Import types as needed:

```typescript
import {
  AncestorQueryResult,
  DescendantQueryResult,
  RelationshipQueryOptions
} from 'obsidian-relations-plugin';
```

---

## Ancestor Queries

Methods for querying ancestors (parents, grandparents, etc.).

### `getAncestors(file, options?)`

Gets ancestors of a file with detailed metadata, organized by generation.

**Parameters:**
- `file: TFile` - The file to query
- `options?: RelationshipQueryOptions` - Optional query options

**Returns:** `AncestorQueryResult`

**Example:**
```typescript
const result = plugin.getAncestors(currentFile);

console.log(`Found ${result.totalCount} ancestors in ${result.depth} generations`);

result.generations.forEach((generation, index) => {
  console.log(`Generation ${index + 1}:`, generation.map(f => f.basename));
});

if (result.wasTruncated) {
  console.log('More ancestors exist beyond max depth');
}
```

**With Options:**
```typescript
// Limit to 3 generations
const result = plugin.getAncestors(currentFile, { maxDepth: 3 });
```

---

### `getParents(file)`

Gets immediate parents of a file (generation 1 only).

**Parameters:**
- `file: TFile` - The file to query

**Returns:** `TFile[]` - Array of parent files

**Example:**
```typescript
const parents = plugin.getParents(currentFile);
console.log('Parents:', parents.map(f => f.basename));
```

---

### `getAllAncestors(file, options?)`

Gets all ancestors as a flat array (all generations combined).

**Parameters:**
- `file: TFile` - The file to query
- `options?: RelationshipQueryOptions` - Optional query options

**Returns:** `TFile[]` - Flat array of all ancestor files

**Example:**
```typescript
const allAncestors = plugin.getAllAncestors(currentFile);
console.log(`Total ancestors: ${allAncestors.length}`);

// List all ancestor names
allAncestors.forEach(ancestor => {
  console.log('- ' + ancestor.basename);
});
```

---

## Descendant Queries

Methods for querying descendants (children, grandchildren, etc.).

### `getDescendants(file, options?)`

Gets descendants of a file with detailed metadata, organized by generation.

**Parameters:**
- `file: TFile` - The file to query
- `options?: RelationshipQueryOptions` - Optional query options

**Returns:** `DescendantQueryResult`

**Example:**
```typescript
const result = plugin.getDescendants(currentFile);

console.log(`Found ${result.totalCount} descendants in ${result.depth} generations`);

result.generations.forEach((generation, index) => {
  console.log(`Generation ${index + 1}:`, generation.map(f => f.basename));
});
```

---

### `getChildren(file)`

Gets immediate children of a file (generation 1 only).

**Parameters:**
- `file: TFile` - The file to query

**Returns:** `TFile[]` - Array of child files

**Example:**
```typescript
const children = plugin.getChildren(currentFile);
console.log('Children:', children.map(f => f.basename));
```

---

### `getAllDescendants(file, options?)`

Gets all descendants as a flat array (all generations combined).

**Parameters:**
- `file: TFile` - The file to query
- `options?: RelationshipQueryOptions` - Optional query options

**Returns:** `TFile[]` - Flat array of all descendant files

**Example:**
```typescript
const allDescendants = plugin.getAllDescendants(currentFile);
console.log(`Total descendants: ${allDescendants.length}`);
```

---

## Sibling Queries

Methods for querying siblings (notes sharing the same parent).

### `getSiblings(file, options?)`

Gets siblings of a file with detailed metadata.

**Parameters:**
- `file: TFile` - The file to query
- `options?: RelationshipQueryOptions` - Optional query options

**Returns:** `SiblingQueryResult`

**Example:**
```typescript
const result = plugin.getSiblings(currentFile);
console.log(`Found ${result.totalCount} siblings`);

result.siblings.forEach(sibling => {
  console.log('- ' + sibling.basename);
});
```

**Include Self:**
```typescript
// Include the queried file in results
const result = plugin.getSiblings(currentFile, { includeSelf: true });
```

---

## Cousin Queries

Methods for querying cousins (notes sharing the same grandparent or higher).

### `getCousins(file, options?)`

Gets cousins of a file with detailed metadata.

**Parameters:**
- `file: TFile` - The file to query
- `options?: RelationshipQueryOptions` - Optional query options (includes `degree`)

**Returns:** `CousinQueryResult`

**Example:**
```typescript
// Get first cousins (degree 1)
const firstCousins = plugin.getCousins(currentFile, { degree: 1 });
console.log(`Found ${firstCousins.totalCount} first cousins`);

// Get second cousins (degree 2)
const secondCousins = plugin.getCousins(currentFile, { degree: 2 });
console.log(`Found ${secondCousins.totalCount} second cousins`);
```

**Default Behavior:**
```typescript
// Defaults to first cousins (degree 1)
const cousins = plugin.getCousins(currentFile);
```

---

## Combined Queries

Methods for querying multiple relationship types at once.

### `getFullLineage(file, options?)`

Gets complete lineage (ancestors + descendants + siblings) for a file.

**Parameters:**
- `file: TFile` - The file to query
- `options?: RelationshipQueryOptions` - Optional query options

**Returns:** `FullLineageResult`

**Example:**
```typescript
const lineage = plugin.getFullLineage(currentFile);

console.log('=== Full Lineage ===');
console.log(`Ancestors: ${lineage.stats.totalAncestors} (${lineage.stats.ancestorDepth} generations)`);
console.log(`Descendants: ${lineage.stats.totalDescendants} (${lineage.stats.descendantDepth} generations)`);
console.log(`Siblings: ${lineage.stats.totalSiblings}`);

// Display ancestors
lineage.ancestors.forEach((gen, i) => {
  console.log(`  Gen -${i + 1}:`, gen.map(f => f.basename).join(', '));
});

// Display siblings
if (lineage.siblings.length > 0) {
  console.log('  Siblings:', lineage.siblings.map(f => f.basename).join(', '));
}

// Display descendants
lineage.descendants.forEach((gen, i) => {
  console.log(`  Gen +${i + 1}:`, gen.map(f => f.basename).join(', '));
});
```

---

## Cycle Detection

Methods for detecting cycles in the relationship graph.

### `detectCycle(file)`

Checks if a specific file is part of a cycle.

**Parameters:**
- `file: TFile` - The file to check

**Returns:** `CycleInfo | null` - Cycle information if cycle exists, null otherwise

**Example:**
```typescript
const cycleInfo = plugin.detectCycle(currentFile);

if (cycleInfo) {
  console.warn('⚠️ Cycle detected!');
  console.warn('Cycle path:', cycleInfo.cyclePath.map(f => f.basename).join(' → '));
  console.warn('Description:', cycleInfo.description);
} else {
  console.log('✅ No cycles detected');
}
```

---

### `hasCycles()`

Checks if the entire graph contains any cycles.

**Parameters:** None

**Returns:** `boolean` - True if any cycle exists in the graph

**Example:**
```typescript
if (plugin.hasCycles()) {
  console.warn('⚠️ Graph contains cycles');
} else {
  console.log('✅ Graph is acyclic');
}
```

---

## Type Definitions

### `AncestorQueryResult`

```typescript
interface AncestorQueryResult {
  file: TFile;              // The queried file
  generations: TFile[][];   // Ancestors by generation
  totalCount: number;       // Total number of ancestors
  depth: number;            // Number of generations
  wasTruncated: boolean;    // Whether limited by maxDepth
}
```

### `DescendantQueryResult`

```typescript
interface DescendantQueryResult {
  file: TFile;              // The queried file
  generations: TFile[][];   // Descendants by generation
  totalCount: number;       // Total number of descendants
  depth: number;            // Number of generations
  wasTruncated: boolean;    // Whether limited by maxDepth
}
```

### `SiblingQueryResult`

```typescript
interface SiblingQueryResult {
  file: TFile;              // The queried file
  siblings: TFile[];        // Sibling files
  totalCount: number;       // Total number of siblings
  includesSelf: boolean;    // Whether self was included
}
```

### `CousinQueryResult`

```typescript
interface CousinQueryResult {
  file: TFile;              // The queried file
  cousins: TFile[];         // Cousin files
  totalCount: number;       // Total number of cousins
  degree: number;           // Degree of cousinship
}
```

### `FullLineageResult`

```typescript
interface FullLineageResult {
  file: TFile;              // The queried file
  ancestors: TFile[][];     // Ancestors by generation
  descendants: TFile[][];   // Descendants by generation
  siblings: TFile[];        // Sibling files
  stats: {
    totalAncestors: number;
    totalDescendants: number;
    totalSiblings: number;
    ancestorDepth: number;
    descendantDepth: number;
  };
}
```

### `RelationshipQueryOptions`

```typescript
interface RelationshipQueryOptions {
  maxDepth?: number;        // Maximum depth to traverse
  includeSelf?: boolean;    // Include queried file in results
  degree?: number;          // Cousin degree (1 = first, 2 = second, etc.)
  detectCycles?: boolean;   // Include cycle information
}
```

---

## Usage Examples

### Example 1: Building a Family Tree Display

```typescript
function displayFamilyTree(file: TFile) {
  const plugin = this.app.plugins.getPlugin('relations-obsidian');
  const lineage = plugin.getFullLineage(file);

  const lines: string[] = [];

  // Ancestors (top of tree)
  for (let i = lineage.ancestors.length - 1; i >= 0; i--) {
    const gen = lineage.ancestors[i];
    const indent = '  '.repeat(lineage.ancestors.length - i - 1);
    lines.push(`${indent}Gen -${i + 1}: ${gen.map(f => f.basename).join(', ')}`);
  }

  // Current file
  lines.push(`>>> ${file.basename} <<<`);

  // Siblings
  if (lineage.siblings.length > 0) {
    lines.push(`  Siblings: ${lineage.siblings.map(f => f.basename).join(', ')}`);
  }

  // Descendants
  lineage.descendants.forEach((gen, i) => {
    const indent = '  '.repeat(i + 1);
    lines.push(`${indent}Gen +${i + 1}: ${gen.map(f => f.basename).join(', ')}`);
  });

  return lines.join('\n');
}
```

### Example 2: Finding Related Notes

```typescript
function findRelatedNotes(file: TFile) {
  const plugin = this.app.plugins.getPlugin('relations-obsidian');

  // Get all directly related notes
  const parents = plugin.getParents(file);
  const children = plugin.getChildren(file);
  const siblings = plugin.getSiblings(file).siblings;

  // Combine into single list
  const related = new Set<TFile>();
  parents.forEach(f => related.add(f));
  children.forEach(f => related.add(f));
  siblings.forEach(f => related.add(f));

  return Array.from(related);
}
```

### Example 3: Analyzing Vault Structure

```typescript
function analyzeVaultStructure() {
  const plugin = this.app.plugins.getPlugin('relations-obsidian');
  const files = this.app.vault.getMarkdownFiles();

  let totalAncestors = 0;
  let totalDescendants = 0;
  let filesWithCycles = 0;

  files.forEach(file => {
    const ancestors = plugin.getAncestors(file);
    const descendants = plugin.getDescendants(file);

    totalAncestors += ancestors.totalCount;
    totalDescendants += descendants.totalCount;

    if (plugin.detectCycle(file)) {
      filesWithCycles++;
    }
  });

  console.log('=== Vault Structure Analysis ===');
  console.log(`Total files: ${files.length}`);
  console.log(`Average ancestors per file: ${(totalAncestors / files.length).toFixed(2)}`);
  console.log(`Average descendants per file: ${(totalDescendants / files.length).toFixed(2)}`);
  console.log(`Files in cycles: ${filesWithCycles}`);
}
```

### Example 4: Smart Note Suggestions

```typescript
function suggestRelatedNotes(file: TFile): TFile[] {
  const plugin = this.app.plugins.getPlugin('relations-obsidian');

  // Get various relationship types
  const siblings = plugin.getSiblings(file).siblings;
  const cousins = plugin.getCousins(file, { degree: 1 }).cousins;

  // Combine and prioritize
  const suggestions = new Set<TFile>();

  // Siblings are most relevant
  siblings.forEach(s => suggestions.add(s));

  // Then cousins
  cousins.forEach(c => suggestions.add(c));

  return Array.from(suggestions).slice(0, 10); // Top 10
}
```

---

## Error Handling

All API methods handle errors gracefully:

- **Missing files:** Methods return empty arrays/results
- **Invalid options:** Methods use default values
- **Cycles:** Detected and handled without infinite loops
- **Null files:** Methods check for null/undefined and return safe defaults

**Example:**
```typescript
const file = this.app.workspace.getActiveFile();

if (!file) {
  console.warn('No active file');
  return;
}

const result = plugin.getAncestors(file);

if (result.totalCount === 0) {
  console.log('No ancestors found');
} else {
  // Process ancestors
}
```

---

## Best Practices

1. **Always check for null files** before querying
2. **Use options to limit depth** for large graphs
3. **Cache results** if querying the same file repeatedly
4. **Check for cycles** before deep traversals
5. **Use appropriate query method** for your use case:
   - Simple arrays: `getParents()`, `getChildren()`
   - Detailed metadata: `getAncestors()`, `getDescendants()`
   - Combined data: `getFullLineage()`

---

## Performance Considerations

- **Immediate relations** (parents, children): O(1) - Very fast
- **Traversals** (ancestors, descendants): O(V + E) - Bounded by depth
- **Siblings**: O(P * C) - Fast for typical graphs
- **Cousins**: O(V + E) - May be slower for deep graphs
- **Full lineage**: 3x traversal cost - Use sparingly

**Tips:**
- Limit `maxDepth` for better performance
- Cache results when querying same file multiple times
- Use simple methods (`getParents`) when metadata not needed

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: [relations-obsidian/issues](https://github.com/fkloosterman/relations-obsidian/issues)
- Documentation: [relations-obsidian/docs](https://github.com/fkloosterman/relations-obsidian/docs)

---

**Last Updated:** 2025-11-15
**Plugin Version:** 1.0.0
