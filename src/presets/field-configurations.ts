import { ParentFieldConfig } from '../types';

/**
 * Preset configurations for common use cases.
 *
 * These presets provide ready-to-use configurations for typical workflows,
 * making it easy for users to get started with multiple parent fields.
 */
export const PRESET_CONFIGURATIONS: Record<string, ParentFieldConfig[]> = {
  /**
   * Simple parent-child hierarchy - single parent field with standard sections
   */
  'simple-hierarchy': [
    {
      name: 'parent',
      displayName: 'Parent',
      sectionOrder: ['reference', 'roots', 'ancestors', 'descendants', 'siblings'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical'
      },
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
        collapsed: true,
        sortOrder: 'alphabetical',
        includeSelf: false
      }
    }
  ],

  /**
   * Project management - multiple hierarchies for projects and categories
   */
  'project-management': [
    {
      name: 'project',
      displayName: 'Project',
      sectionOrder: ['reference', 'roots', 'ancestors', 'descendants', 'siblings'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical'
      },
      ancestors: {
        displayName: 'Program / Portfolio',
        visible: true,
        collapsed: false,
        maxDepth: 3,
        initialDepth: 2
      },
      descendants: {
        displayName: 'Sub-Projects',
        visible: true,
        collapsed: false,
        maxDepth: 3,
        initialDepth: 1
      },
      siblings: {
        displayName: 'Related Projects',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical',
        includeSelf: false
      }
    },
    {
      name: 'category',
      displayName: 'Category',
      sectionOrder: ['reference', 'ancestors', 'descendants', 'siblings', 'roots'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical'
      },
      ancestors: {
        displayName: 'Parent Categories',
        visible: true,
        collapsed: true,
        maxDepth: 5,
        initialDepth: 1
      },
      descendants: {
        displayName: 'Sub-Categories',
        visible: true,
        collapsed: true,
        maxDepth: 5,
        initialDepth: 1
      },
      siblings: {
        displayName: 'Same Category',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical',
        includeSelf: false
      }
    }
  ],

  /**
   * Knowledge base / Zettelkasten - optimized for deep hierarchies
   */
  'knowledge-base': [
    {
      name: 'parent',
      displayName: 'Parent Topic',
      sectionOrder: ['reference', 'roots', 'ancestors', 'descendants', 'siblings'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical'
      },
      ancestors: {
        displayName: 'Parent Chain',
        visible: true,
        collapsed: false,
        maxDepth: 7,
        initialDepth: 3
      },
      descendants: {
        displayName: 'Subtopics',
        visible: true,
        collapsed: false,
        maxDepth: 7,
        initialDepth: 2
      },
      siblings: {
        displayName: 'Related Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'modified',
        includeSelf: false
      }
    }
  ],

  /**
   * Compact view - minimal sections for a clean interface
   */
  'compact': [
    {
      name: 'parent',
      displayName: 'Parent',
      sectionOrder: ['reference', 'ancestors', 'descendants', 'roots', 'siblings'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical'
      },
      ancestors: {
        displayName: 'Up',
        visible: true,
        collapsed: false,
        maxDepth: 3,
        initialDepth: 1
      },
      descendants: {
        displayName: 'Down',
        visible: true,
        collapsed: false,
        maxDepth: 2,
        initialDepth: 1
      },
      siblings: {
        displayName: 'Siblings',
        visible: false,
        collapsed: true,
        sortOrder: 'alphabetical',
        includeSelf: false
      }
    }
  ],

  /**
   * Multi-field explorer - three different hierarchies for comprehensive organization
   */
  'multi-field-explorer': [
    {
      name: 'parent',
      displayName: 'Parent',
      sectionOrder: ['reference', 'roots', 'ancestors', 'descendants', 'siblings'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: false,
        sortOrder: 'alphabetical'
      },
      ancestors: {
        displayName: 'Ancestors',
        visible: true,
        collapsed: false,
        maxDepth: 5,
        initialDepth: 2
      },
      descendants: {
        displayName: 'Children',
        visible: true,
        collapsed: false,
        maxDepth: 5,
        initialDepth: 1
      },
      siblings: {
        displayName: 'Siblings',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical',
        includeSelf: false
      }
    },
    {
      name: 'project',
      displayName: 'Project',
      sectionOrder: ['reference', 'ancestors', 'descendants', 'siblings', 'roots'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical'
      },
      ancestors: {
        displayName: 'Program',
        visible: true,
        collapsed: false,
        maxDepth: 3,
        initialDepth: 1
      },
      descendants: {
        displayName: 'Tasks',
        visible: true,
        collapsed: false,
        maxDepth: 2,
        initialDepth: 1
      },
      siblings: {
        displayName: 'Related',
        visible: true,
        collapsed: true,
        sortOrder: 'modified',
        includeSelf: false
      }
    },
    {
      name: 'topic',
      displayName: 'Topic',
      sectionOrder: ['reference', 'ancestors', 'descendants', 'siblings', 'roots'],
      roots: {
        displayName: 'Root Notes',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical'
      },
      ancestors: {
        displayName: 'Broader Topics',
        visible: true,
        collapsed: true,
        maxDepth: 4,
        initialDepth: 2
      },
      descendants: {
        displayName: 'Subtopics',
        visible: true,
        collapsed: true,
        maxDepth: 4,
        initialDepth: 2
      },
      siblings: {
        displayName: 'Related Topics',
        visible: true,
        collapsed: true,
        sortOrder: 'alphabetical',
        includeSelf: false
      }
    }
  ]
};

/**
 * Get a preset configuration by name.
 *
 * @param name - The preset name
 * @returns The preset configuration, or null if not found
 *
 * @example
 * const preset = getPreset('project-management');
 * if (preset) {
 *   plugin.settings.parentFields = preset;
 *   await plugin.saveSettings();
 * }
 */
export function getPreset(name: string): ParentFieldConfig[] | null {
  return PRESET_CONFIGURATIONS[name] || null;
}

/**
 * Get a list of all available preset names.
 *
 * @returns Array of preset names
 *
 * @example
 * const presets = getPresetNames();
 * presets.forEach(name => {
 *   console.log(name, getPresetDescription(name));
 * });
 */
export function getPresetNames(): string[] {
  return Object.keys(PRESET_CONFIGURATIONS);
}

/**
 * Get a human-readable description for a preset.
 *
 * @param name - The preset name
 * @returns Description text, or empty string if preset not found
 *
 * @example
 * const description = getPresetDescription('knowledge-base');
 * console.log(description); // "Deep hierarchies optimized for knowledge management"
 */
export function getPresetDescription(name: string): string {
  const descriptions: Record<string, string> = {
    'simple-hierarchy': 'Single parent field with standard sections - great for basic note hierarchies',
    'project-management': 'Project and category hierarchies for PM workflows - track programs, projects, and tasks',
    'knowledge-base': 'Deep hierarchies optimized for knowledge management - perfect for Zettelkasten',
    'compact': 'Minimal view with reduced sections - clean interface for focused work',
    'multi-field-explorer': 'Three different hierarchies for comprehensive organization - parent, project, and topic fields'
  };
  return descriptions[name] || '';
}

/**
 * Check if a preset name is valid.
 *
 * @param name - The preset name to check
 * @returns True if the preset exists, false otherwise
 *
 * @example
 * if (isValidPreset('project-management')) {
 *   // Load the preset
 * }
 */
export function isValidPreset(name: string): boolean {
  return name in PRESET_CONFIGURATIONS;
}

/**
 * Get preset metadata (name and description).
 *
 * @returns Array of preset metadata objects
 *
 * @example
 * const presets = getPresetMetadata();
 * presets.forEach(({ name, description }) => {
 *   dropdown.addOption(name, description);
 * });
 */
export function getPresetMetadata(): Array<{ name: string; description: string }> {
  return getPresetNames().map(name => ({
    name,
    description: getPresetDescription(name)
  }));
}
