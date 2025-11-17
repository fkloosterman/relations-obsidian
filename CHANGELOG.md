# Changelog

All notable changes to the Relations Obsidian plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Milestone 6.1: Basic Navigation Commands

#### Quick Navigation
- **Go to parent note**: Navigate to parent notes instantly
  - Direct navigation for single parent
  - Smart modal selector for multiple parents
  - Command only available when note has parents
- **Go to child note**: Navigate to child notes instantly
  - Direct navigation for single child
  - Smart modal selector for multiple children
  - Command only available when note has children

#### Sidebar Display Commands
- **Show parent tree in sidebar**: Display only ancestors section
  - Opens and pins sidebar to current note
  - Configures sidebar to show ancestors only
- **Show child tree in sidebar**: Display only descendants section
  - Opens and pins sidebar to current note
  - Configures sidebar to show descendants only
- **Show full lineage in sidebar**: Display all relationship sections
  - Opens and pins sidebar to current note
  - Shows ancestors, descendants, and siblings
- **Toggle relation sidebar**: Quick sidebar visibility control
  - Opens sidebar if closed
  - Closes sidebar if open

#### Note Selection Modal
- Keyboard-accessible modal for selecting from multiple notes
- Full keyboard navigation support:
  - Arrow keys (↑/↓) to navigate options
  - Enter or Space to select
  - Escape to cancel
- Mouse support with hover effects
- Displays note names and folder paths
- Auto-focuses first item for quick selection

#### Keyboard Shortcuts
- All commands support custom keyboard shortcuts
- Assignable via Obsidian Settings → Hotkeys
- Suggested shortcuts:
  - `Cmd/Ctrl + Shift + P` - Go to parent note
  - `Cmd/Ctrl + Shift + C` - Go to child note
  - `Cmd/Ctrl + Shift + R` - Toggle relation sidebar
  - `Cmd/Ctrl + Shift + L` - Show full lineage

#### Technical Implementation
- Created `src/commands/navigation-commands.ts` with 6 commands
- Created `src/commands/modal-selector.ts` for note selection
- Added `setSectionsVisible()` method to `RelationSidebarView`
- Comprehensive test coverage with 55 unit tests
- Full JSDoc documentation
- Accessible UI following ARIA best practices

### Added - Milestone 5.2: Advanced Codeblock Options

#### Title Display
- Added `title` parameter with three modes:
  - `none` (default): No title
  - `simple`: Basic title showing relationship type and target note
  - `detailed`: Title with filter information on separate line
- Titles use configured display names from field settings
- Filter details shown in smaller, muted font below main title

#### Filtering Capabilities
- **Tag Filtering**: Filter results by tag using `filterTag` parameter
  - Supports nested tag matching (e.g., `#project` matches `#project/active`)
  - Works with both frontmatter and inline tags
  - Tag prefix `#` is optional
- **Folder Filtering**: Filter results by folder path using `filterFolder` parameter
  - Includes files in subfolders
  - Trailing slash is optional
- **Exclusion**: Exclude specific notes using `exclude` parameter
  - Comma-separated list of note names
  - Supports wiki-link format: `[[Note1]], [[Note2]]`
- **Filter Combination**: All filters use AND logic
  - Notes must match all specified filters to appear

#### Node Limiting
- Added `maxNodes` parameter to limit displayed nodes
- Shows truncation indicator "(+N more...)" when limit exceeded
- Preserves tree structure up to the limit
- Useful for large trees and overview displays

#### Visual Styles
- Added `style` parameter with three variants:
  - `detailed`: Full padding, enhanced hierarchy
  - `minimal`: Ultra-compact, minimal spacing
  - `compact`: Balanced, general-purpose
- Styles affect spacing, padding, and visual density

#### List Rendering
- Siblings and cousins now render as flat lists (like sidebar)
- Each item shows file icon and clickable name
- Supports click navigation and hover preview
- Cleaner presentation for flat relationships

#### Bug Fixes
- Fixed title not appearing (TreeRenderer was clearing container)
- Fixed siblings/cousins not showing (now use list rendering)
- Fixed filter details display (now on separate line)

#### Technical Improvements
- Created `src/codeblock-filters.ts` module for filter logic
- Implemented efficient filter functions with O(N) complexity
- Added comprehensive test coverage (48 filter tests)
- Extended parameter schema with validation
- Added CSS styling for all new features

## [Previous Releases]

### Milestone 5.1: Basic Codeblock Processor
- Initial codeblock support with `relation-tree` syntax
- Basic parameters: `note`, `type`, `depth`, `mode`, `field`
- Tree, list, and compact display modes
- Cycle detection support

### Milestone 4.3B: Advanced Context Menu
- Context menu for relationship modification
- Add/remove parent-child relationships from tree
- Tree manipulation (expand/collapse subtrees)
- Command palette integration
- Undo/redo support

### Milestone 4.2B: Advanced Per-Field Configuration
- Custom display names for fields and sections
- Section visibility control
- Configurable depth per section
- Siblings sorting options
- Configuration import/export
- Preset configurations

### Earlier Milestones
- Multi-field support
- Interactive sidebar
- Relationship graph building
- Cycle detection
- Field switching UI
- Per-field pinning

---

**Note**: This changelog was created retroactively. For detailed milestone documentation, see the `/docs` directory.
