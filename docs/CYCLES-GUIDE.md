# Understanding Cycles in Relation Explorer

This guide explains what cycles are, how to identify them, and how to resolve them in your Obsidian vault.

## What is a Cycle?

A **cycle** (also called a circular reference or loop) occurs when a note is its own ancestor through a chain of parent relationships.

### Simple Example

```
Note A → Note B → Note A
```

In this case:
- Note A has Note B as a parent
- Note B has Note A as a parent
- This creates a cycle: A → B → A

### Complex Example

```
Note A → Note B → Note C → Note D → Note B
```

Here:
- Note A has parent B
- Note B has parent C
- Note C has parent D
- Note D has parent B (creates the cycle)
- The cycle is: B → C → D → B

## Why Cycles are Problematic

### 1. Infinite Traversals

When computing ancestors or descendants, a cycle can cause infinite loops:

```typescript
// Without cycle protection:
getAncestors(NoteA)
  → finds NoteB
    → finds NoteC
      → finds NoteA (cycle!)
        → finds NoteB (again!)
          → infinite loop...
```

### 2. Ambiguous Hierarchies

Cycles make the hierarchy ambiguous:
- Is Note A above Note B, or is Note B above Note A?
- What is the "root" of the hierarchy?

### 3. Unexpected Behavior

- Tree visualizations may show duplicate nodes
- Navigation commands may behave unpredictably
- Export functions may produce invalid output

## How Relation Explorer Handles Cycles

### Built-in Protection

The plugin includes **automatic cycle protection**:

1. **Detection**: Uses a three-color depth-first search algorithm to detect cycles
2. **Prevention**: Stops traversal when a cycle is encountered
3. **Visual Indication**: Marks cyclic nodes with 🔄 icon and special styling
4. **Warnings**: Displays warnings in codeblocks when cycles are present

### Visual Indicators

**In Trees:**
- Cyclic nodes have a 🔄 icon
- Hover tooltip shows the full cycle path
- Background color highlights cyclic nodes

**In Codeblocks:**
- Warning notice at bottom when cycle detected
- Link to this guide for help

**In Commands:**
- "Show all cycles" command lists all cycles (coming soon)
- Each cycle shows the full path
- Click any note to navigate and fix

## Identifying Cycles

### Method 1: Visual Indicators

Look for the 🔄 icon in:
- Sidebar tree view
- Codeblock trees
- Any tree visualization

### Method 2: Hover Tooltips

Hover over a node with the 🔄 icon to see:
- Full cycle path (e.g., "A → B → C → A")
- Cycle length
- Which note to fix

### Method 3: Codeblock Warnings

When you embed a tree with cycles, you'll see:
```
⚠️ Cycle detected in this tree
1 note in this tree is part of a cycle. Cyclic relationships may cause infinite traversals. Learn about cycles →
```

### Method 4: Browser Console

Enable diagnostic mode in settings and check the browser console:
```
Press Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac)
Look for warnings about cycles
```

## Resolving Cycles

### Step 1: Identify the Cycle Path

Hover over the 🔄 icon or check the codeblock warning to see:
```
Cycle detected: Note A → Note B → Note C → Note A
Length: 3 notes
```

### Step 2: Choose Where to Break

Pick **one note** in the cycle to remove its parent link.

**Recommendation**: Remove the parent that makes the least semantic sense.

Example:
```
Cycle: Project → Task → Subtask → Project

Break at: Subtask → Project (this doesn't make sense)
Result: Project → Task → Subtask (linear hierarchy)
```

### Step 3: Edit Frontmatter

1. Navigate to the note in the cycle
2. Open the note's frontmatter
3. Remove or change the `parent` field

**Before:**
```yaml
---
parent: [[Project]]
---
```

**After (remove):**
```yaml
---
# parent: [[Project]]  (commented out)
---
```

Or **After (change):**
```yaml
---
parent: [[Correct Parent]]
---
```

### Step 4: Verify Fix

1. Check if the 🔄 icon is gone
2. Verify the tree view looks correct
3. Confirm the hierarchy makes sense

## Best Practices

### 1. Plan Your Hierarchy

Before creating parent links, sketch out your hierarchy:

```
Good:
Grandparent
  ├── Parent 1
  │   ├── Child 1a
  │   └── Child 1b
  └── Parent 2
      └── Child 2a

Bad:
Parent ← → Child (cycle!)
```

### 2. Use Consistent Direction

Always link in one direction:
- ✅ Child → Parent (recommended)
- ❌ Mix of Child → Parent and Parent → Child

### 3. Avoid Bidirectional Links

Never create parent links in both directions:
```yaml
# Note A
parent: [[Note B]]

# Note B
parent: [[Note A]]  # ❌ Creates cycle!
```

### 4. Regular Validation

Check for cycles periodically:
```
Recommended: Once per week for active vaults
```

Run "Validate graph" command (when available) to check for issues.

### 5. Use Multiple Parent Fields

If you need bidirectional relationships, use different fields:

```yaml
---
parent: [[Topic]]      # Topical hierarchy
project: [[Project]]   # Project hierarchy
---
```

Each field maintains its own independent graph.

## Common Cycle Patterns

### Pattern 1: Bidirectional References

**Cause**: Two notes reference each other
```
Note A → Note B
Note B → Note A
```

**Fix**: Remove one link
```
Note A → Note B (keep)
Note B (remove parent link)
```

### Pattern 2: Triangle Cycles

**Cause**: Three notes form a loop
```
A → B → C → A
```

**Fix**: Break at least one link
```
A → B → C (break A's parent)
A (remove parent link)
```

### Pattern 3: Deep Cycles

**Cause**: Long chain loops back
```
A → B → C → D → E → B
```

**Fix**: Break the loop link
```
A → B → C → D → E (break B's parent D)
B → C → D → E
```

### Pattern 4: Multiple Parents Creating Cycle

**Cause**: Multiple paths converge in a cycle
```
A → B → D
A → C → D
D → A (creates cycle)
```

**Fix**: Remove the closing link
```
A → B → D
A → C → D
(remove D → A)
```

## Advanced Topics

### Intentional Cycles?

Some users ask: "What if I want a cycle?"

**Short answer**: Don't use parent links for cyclic relationships.

**Alternatives**:
1. **Use tags** for non-hierarchical relationships
2. **Use links** in note content for bidirectional references
3. **Use multiple fields** for different relationship types
4. **Use Dataview** for complex queries

### Performance Impact

**Small cycles** (2-3 notes): Minimal impact
- Detection is fast
- Protection works well

**Large cycles** (10+ notes): May slow down:
- Graph building
- Relationship queries
- Tree rendering

**Recommendation**: Keep hierarchies acyclic for best performance.

### Cycle Detection Algorithm

The plugin uses a **three-color DFS** algorithm:

1. **WHITE**: Unvisited node
2. **GRAY**: Currently visiting (in path)
3. **BLACK**: Fully explored

When a GRAY node is encountered again, a cycle is detected.

This algorithm:
- Runs in O(V + E) time
- Detects all cycles
- Provides cycle path information

## FAQ

### Q: Why does the plugin allow cycles?

A: The plugin allows you to create any structure in your frontmatter. It detects cycles but doesn't prevent them, giving you freedom while providing safety.

### Q: Can I disable cycle detection?

A: No. Cycle detection is essential for preventing infinite loops during traversal.

### Q: Do cycles affect all parent fields?

A: No. Each parent field has an independent graph. A cycle in one field doesn't affect others.

### Q: What if I can't find the cycle?

A: Hover over any node with the 🔄 icon to see the full cycle path in the tooltip.

### Q: Can the plugin fix cycles automatically?

A: No. The plugin can't determine which link to remove without understanding your intent. You must manually resolve cycles.

### Q: Will cycles corrupt my vault?

A: No. Cycles only affect relationship computations. Your notes remain intact.

### Q: I see a cycle warning but can't find the 🔄 icon

A: The cycle might be in a collapsed part of the tree. Expand all nodes to find it, or check the codeblock warning message.

## Need Help?

If you're still having trouble with cycles:

1. **Check this guide** for your specific pattern
2. **Look for the 🔄 icon** and hover to see cycle path
3. **Open an issue** on GitHub with cycle details
4. **Ask in Discussions** for community help

## Related Documentation

- [Configuration Guide](configuration-guide.md) - Settings and options
- [API Reference](api-reference.md) - Programmatic cycle detection
- [Implementation Plan](implementation-plan.md) - Technical details
- [CONTRIBUTING](../CONTRIBUTING.md) - Developer guide

---

*Last updated: 2025-01-17*
