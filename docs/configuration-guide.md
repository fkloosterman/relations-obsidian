# Configuration Guide - Relation Explorer

This guide explains how to configure the Relation Explorer plugin to match your workflow and preferences.

## Table of Contents

- [Quick Start with Presets](#quick-start-with-presets)
- [Advanced Per-Field Configuration](#advanced-per-field-configuration)
- [Configuration Examples](#configuration-examples)
- [Import/Export](#importexport)
- [Troubleshooting](#troubleshooting)

---

## Quick Start with Presets

The easiest way to get started is to use one of the built-in presets. These provide ready-made configurations for common use cases.

### Available Presets

#### 1. Simple Hierarchy
**Best for:** Basic note hierarchies, general note-taking

**Configuration:**
- Single `parent` field
- All sections visible (Ancestors, Descendants, Siblings)
- Standard depth limits (5 levels)
- Alphabetical sibling sorting

**Use case:** Perfect for simple parent-child note structures where you want to see the full relationship tree.

#### 2. Project Management
**Best for:** Project planning, task management, portfolio tracking

**Configuration:**
- Two fields: `project` and `category`
- Project field:
  - Ancestors: "Program / Portfolio" (max depth: 3)
  - Descendants: "Sub-Projects" (max depth: 3)
  - Siblings: "Related Projects"
- Category field:
  - Ancestors: "Parent Categories" (collapsed by default)
  - Descendants: "Sub-Categories" (collapsed by default)
  - Siblings: Hidden

**Use case:** Track project hierarchies and categorize notes within a project management workflow.

#### 3. Knowledge Base
**Best for:** Zettelkasten, research notes, deep knowledge hierarchies

**Configuration:**
- Single `parent` field with display name "Parent Topic"
- Deep traversal (max depth: 10 levels)
- Higher initial unfold depth (3 levels)
- Siblings sorted by modification date (most recent first)

**Use case:** Ideal for knowledge management systems with deep topic hierarchies where you want to see more levels at once.

#### 4. Compact
**Best for:** Minimalist workflows, focused work sessions

**Configuration:**
- Single `parent` field
- Ancestors section: "Up" (max depth: 3, initial depth: 1)
- Descendants section: "Down" (collapsed by default, max depth: 2)
- Siblings section: Hidden

**Use case:** Clean, minimal interface showing just the essential parent-child relationships.

#### 5. Multi-Field Explorer
**Best for:** Complex workflows with multiple organizational dimensions

**Configuration:**
- Three fields: `parent`, `project`, and `topic`
- Each field independently configured
- Different depth and visibility settings per field
- Different sibling sorting per field

**Use case:** Comprehensive organization system where notes can be categorized along multiple dimensions simultaneously.

### Loading a Preset

1. Open Obsidian Settings
2. Navigate to **Relation Explorer** settings
3. Scroll to **Configuration Presets** section
4. Select a preset from the dropdown
5. Click to confirm (you'll see a warning about overwriting current config)
6. The preset will load immediately

**Important:** Loading a preset will replace your current configuration. Export your current configuration first if you want to keep it.

---

## Advanced Per-Field Configuration

For complete control, you can configure each parent field independently.

### Adding a New Parent Field

1. Go to Settings → Relation Explorer
2. Scroll to **Parent Fields** section
3. Click **+ Add Parent Field**
4. A new field configuration form will appear (collapsed)
5. Click the header to expand and configure

### Field-Level Settings

#### Field Name
- **What it is:** The frontmatter field name to track
- **Examples:** `parent`, `project`, `category`, `topic`
- **Rules:**
  - Must be unique across all fields
  - Cannot be empty
  - Used in frontmatter of your notes

#### Display Name (Optional)
- **What it is:** Friendly name shown in the UI
- **Examples:** "Parent Topic", "My Projects", "Categories"
- **Default:** If left empty, uses the field name

### Section Configuration

Each parent field has three sections you can configure: **Ancestors**, **Descendants**, and **Siblings**.

#### Common Section Settings

##### Display Name
- **What it is:** The header text shown in the sidebar for this section
- **Examples:** "Parent Chain", "Subtopics", "Related Notes"
- **Default:** "Ancestors", "Descendants", or "Siblings"

##### Visible
- **What it is:** Whether this section appears in the sidebar
- **Options:** Toggle on/off
- **Use case:** Hide sections you don't need (e.g., hide Siblings if you only care about hierarchies)

##### Initially Collapsed
- **What it is:** Whether the section starts collapsed when the sidebar opens
- **Options:** Toggle on/off
- **Use case:** Keep less important sections collapsed by default to reduce clutter

#### Tree Section Settings (Ancestors & Descendants)

##### Max Depth
- **What it is:** Maximum number of levels to traverse in the relationship tree
- **Range:** 1 to unlimited (leave empty for unlimited)
- **Default:** 5
- **Examples:**
  - `3` - Show up to 3 levels (parent, grandparent, great-grandparent)
  - `10` - Show up to 10 levels (for deep hierarchies)
  - Empty - Show all levels (use with caution in large vaults)

##### Initial Unfold Depth
- **What it is:** How many levels to show expanded by default
- **Range:** 1 to max depth
- **Default:** 2
- **Validation:** Cannot exceed Max Depth
- **Examples:**
  - `1` - Only show immediate parents/children, all others collapsed
  - `3` - Show 3 levels expanded, deeper levels collapsed
  - `5` - Show all 5 levels expanded (if max depth is 5)

#### Siblings Section Settings

##### Sort Order
- **What it is:** How to order the siblings list
- **Options:**
  - **Alphabetical** - Sort by note basename (A-Z)
  - **Created** - Sort by creation date (oldest first)
  - **Modified** - Sort by modification date (most recent first)
- **Default:** Alphabetical
- **Use case:**
  - Use "Modified" to see recently updated siblings first
  - Use "Created" to see chronological order
  - Use "Alphabetical" for predictable ordering

##### Include Self
- **What it is:** Whether to include the current note in the siblings list
- **Options:** Toggle on/off
- **Default:** Off (excluded)
- **Use case:** Enable if you want to see the current note's position among its siblings

### Managing Parent Fields

#### Duplicate a Field
- Click **Duplicate Field** button at the bottom of a field configuration
- Creates a copy with "_copy" appended to the name
- Useful for creating variations of existing configurations

#### Remove a Field
- Click **Remove** button in the field header
- Confirmation required if it's the last field (at least one field must exist)
- If you remove the default field, the first remaining field becomes default

#### Collapse/Expand Forms
- Click the field header to toggle collapse state
- Collapsed forms show only the field name
- Useful for managing multiple field configurations

---

## Configuration Examples

### Example 1: Academic Research Notes

**Goal:** Organize research notes by topic with deep hierarchies and recent work visibility.

**Configuration:**
```json
{
  "parentFields": [
    {
      "name": "topic",
      "displayName": "Research Topic",
      "ancestors": {
        "displayName": "Broader Topics",
        "visible": true,
        "collapsed": false,
        "maxDepth": 8,
        "initialDepth": 3
      },
      "descendants": {
        "displayName": "Subtopics & Specifics",
        "visible": true,
        "collapsed": false,
        "maxDepth": 8,
        "initialDepth": 2
      },
      "siblings": {
        "displayName": "Related Research",
        "visible": true,
        "collapsed": false,
        "sortOrder": "modified",
        "includeSelf": false
      }
    }
  ],
  "defaultParentField": "topic",
  "uiStyle": "auto",
  "diagnosticMode": false
}
```

### Example 2: Software Project Documentation

**Goal:** Track software components with modules and features, showing recent changes.

**Configuration:**
```json
{
  "parentFields": [
    {
      "name": "module",
      "displayName": "Module",
      "ancestors": {
        "displayName": "Parent Modules",
        "visible": true,
        "collapsed": false,
        "maxDepth": 4,
        "initialDepth": 2
      },
      "descendants": {
        "displayName": "Submodules & Components",
        "visible": true,
        "collapsed": false,
        "maxDepth": 4,
        "initialDepth": 2
      },
      "siblings": {
        "displayName": "Related Components",
        "visible": true,
        "collapsed": true,
        "sortOrder": "modified",
        "includeSelf": false
      }
    },
    {
      "name": "feature",
      "displayName": "Feature",
      "ancestors": {
        "displayName": "Epic / Initiative",
        "visible": true,
        "collapsed": true,
        "maxDepth": 3,
        "initialDepth": 1
      },
      "descendants": {
        "displayName": "User Stories",
        "visible": true,
        "collapsed": false,
        "maxDepth": 2,
        "initialDepth": 1
      },
      "siblings": {
        "displayName": "Related Features",
        "visible": false,
        "collapsed": true,
        "sortOrder": "alphabetical",
        "includeSelf": false
      }
    }
  ],
  "defaultParentField": "module",
  "uiStyle": "segmented",
  "diagnosticMode": false
}
```

### Example 3: Personal Knowledge Management

**Goal:** Simple parent-child structure for personal notes with minimal UI.

**Configuration:**
```json
{
  "parentFields": [
    {
      "name": "parent",
      "displayName": "Parent",
      "ancestors": {
        "displayName": "↑ Up",
        "visible": true,
        "collapsed": false,
        "maxDepth": 5,
        "initialDepth": 2
      },
      "descendants": {
        "displayName": "↓ Down",
        "visible": true,
        "collapsed": false,
        "maxDepth": 5,
        "initialDepth": 2
      },
      "siblings": {
        "displayName": "→ Related",
        "visible": true,
        "collapsed": true,
        "sortOrder": "alphabetical",
        "includeSelf": false
      }
    }
  ],
  "defaultParentField": "parent",
  "uiStyle": "auto",
  "diagnosticMode": false
}
```

---

## Import/Export

### Exporting Your Configuration

1. Go to Settings → Relation Explorer
2. Scroll to **Configuration Import/Export** section
3. Click **Export** button
4. Configuration is copied to your clipboard as JSON
5. Paste into a text file or note to save

**Use cases:**
- Backup before making changes
- Share configuration with team members
- Switch between different setups
- Version control your plugin configuration

### Importing a Configuration

1. Copy a valid configuration JSON to your clipboard
2. Go to Settings → Relation Explorer
3. Click **Import** button
4. If valid, configuration will be loaded immediately
5. If invalid, you'll see an error message

**Validation:**
- Configuration must be valid JSON
- Must have at least one parent field
- Field names must be unique
- Default field must exist in the parent fields list
- Depth values must be valid (initialDepth ≤ maxDepth)

**Important:** Importing replaces your entire configuration. Export first if you want to keep the current setup.

---

## Troubleshooting

### Common Issues

#### "Cannot remove the last parent field"
- **Cause:** At least one parent field is required
- **Solution:** Add a new field before removing the last one, or keep at least one field

#### "Invalid configuration format" on import
- **Cause:** JSON syntax error or validation failure
- **Solutions:**
  - Verify JSON syntax using a JSON validator
  - Ensure all required fields are present
  - Check that depth values are valid (no negative numbers, initialDepth ≤ maxDepth)
  - Ensure field names are unique

#### Section not showing in sidebar
- **Cause:** Section visibility is set to false
- **Solution:** Go to field configuration, expand the section, toggle "Visible" on

#### Tree not expanding to expected depth
- **Cause:** Initial unfold depth is lower than expected
- **Solution:** Increase "Initial Unfold Depth" in section settings (or manually expand nodes)

#### Siblings appearing in unexpected order
- **Cause:** Wrong sort order selected
- **Solution:** Change "Sort Order" in siblings section settings

### Best Practices

1. **Start with a preset** - Choose the closest preset to your workflow, then customize
2. **Export before experimenting** - Always export your working configuration before making major changes
3. **Use descriptive names** - Give fields and sections clear, meaningful display names
4. **Test with a few notes** - Verify your configuration works with a small set of notes first
5. **Adjust depths gradually** - Start with smaller depths and increase as needed
6. **Hide unused sections** - Reduce clutter by hiding sections you don't use

### Getting Help

If you encounter issues not covered here:
1. Check the main README.md for basic usage
2. Review the implementation plan documents in `/docs`
3. Report issues at: https://github.com/anthropics/claude-code/issues

---

## Advanced Topics

### Configuration Schema

The configuration follows this TypeScript schema:

```typescript
interface ParentRelationSettings {
  parentFields: ParentFieldConfig[];
  defaultParentField: string;
  uiStyle: 'auto' | 'segmented' | 'dropdown';
  diagnosticMode: boolean;
}

interface ParentFieldConfig {
  name: string;
  displayName?: string;
  ancestors: SectionConfig;
  descendants: SectionConfig;
  siblings: SectionConfig;
}

interface SectionConfig {
  displayName: string;
  visible: boolean;
  collapsed: boolean;
  maxDepth?: number;         // ancestors/descendants only
  initialDepth?: number;     // ancestors/descendants only
  sortOrder?: 'alphabetical' | 'created' | 'modified';  // siblings only
  includeSelf?: boolean;     // siblings only
}
```

### Validation Rules

1. **At least one parent field** - Configuration must have at least one field
2. **Unique field names** - No duplicate field names allowed
3. **Valid default field** - Default field must exist in parent fields list
4. **Non-negative depths** - maxDepth and initialDepth must be ≥ 0 (or undefined)
5. **Depth relationship** - initialDepth must be ≤ maxDepth (if both are set)
6. **Valid sort orders** - Must be one of: 'alphabetical', 'created', 'modified'
7. **Valid UI styles** - Must be one of: 'auto', 'segmented', 'dropdown'

---

**Last Updated:** 2025-11-16
**Version:** 4.2B
