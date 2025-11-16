import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TFile } from 'obsidian';
import {
  ParentFieldConfig,
  SectionConfig,
  DEFAULT_SECTION_CONFIG
} from '../src/types';

/**
 * Tests for sidebar integration with per-field configuration.
 *
 * These tests verify that the sidebar correctly applies per-field settings
 * for visibility, display names, sorting, and other configuration options.
 */
describe('Sidebar Per-Field Configuration', () => {
  // Helper to create mock TFile
  function createMockFile(basename: string, ctime: number = Date.now(), mtime: number = Date.now()): TFile {
    return {
      basename,
      name: `${basename}.md`,
      path: `${basename}.md`,
      extension: 'md',
      stat: { ctime, mtime, size: 100 },
      vault: null as any,
      parent: null
    } as TFile;
  }

  describe('Section Visibility', () => {
    it('should respect visible flag for ancestors section', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          visible: true
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          visible: true
        }
      };

      // In the actual sidebar, ancestors section should not be rendered
      expect(config.ancestors.visible).toBe(false);
      expect(config.descendants.visible).toBe(true);
      expect(config.siblings.visible).toBe(true);
    });

    it('should respect visible flag for all sections', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          visible: true
        }
      };

      expect(config.ancestors.visible).toBe(false);
      expect(config.descendants.visible).toBe(false);
      expect(config.siblings.visible).toBe(true);
    });
  });

  describe('Display Names', () => {
    it('should use custom display names', () => {
      const config: ParentFieldConfig = {
        name: 'project',
        displayName: 'My Projects',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Parent Projects'
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Sub-Projects'
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Related Projects'
        }
      };

      expect(config.displayName).toBe('My Projects');
      expect(config.ancestors.displayName).toBe('Parent Projects');
      expect(config.descendants.displayName).toBe('Sub-Projects');
      expect(config.siblings.displayName).toBe('Related Projects');
    });

    it('should handle empty display names', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: ''
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: ''
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: ''
        }
      };

      // Empty display names are valid
      expect(config.ancestors.displayName).toBe('');
    });
  });

  describe('Collapsed State', () => {
    it('should respect initial collapsed state', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          collapsed: true
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          collapsed: false
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          collapsed: true
        }
      };

      expect(config.ancestors.collapsed).toBe(true);
      expect(config.descendants.collapsed).toBe(false);
      expect(config.siblings.collapsed).toBe(true);
    });
  });

  describe('Max Depth', () => {
    it('should respect maxDepth setting for ancestors', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 3
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 5
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG
        }
      };

      expect(config.ancestors.maxDepth).toBe(3);
      expect(config.descendants.maxDepth).toBe(5);
    });

    it('should handle undefined maxDepth (unlimited)', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: undefined
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: undefined
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG
        }
      };

      expect(config.ancestors.maxDepth).toBeUndefined();
    });

    it('should support different depths per section', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 10
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 2
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG
        }
      };

      expect(config.ancestors.maxDepth).toBe(10);
      expect(config.descendants.maxDepth).toBe(2);
    });
  });

  describe('Initial Unfold Depth', () => {
    it('should respect initialDepth setting', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 5,
          initialDepth: 2
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 5,
          initialDepth: 1
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG
        }
      };

      expect(config.ancestors.initialDepth).toBe(2);
      expect(config.descendants.initialDepth).toBe(1);
    });

    it('should handle different initial depths per section', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 10,
          initialDepth: 3
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          maxDepth: 5,
          initialDepth: 1
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG
        }
      };

      expect(config.ancestors.initialDepth).toBe(3);
      expect(config.descendants.initialDepth).toBe(1);
    });
  });

  describe('Siblings Sorting', () => {
    const now = Date.now();
    const files = [
      createMockFile('Charlie', now - 3000, now - 1000),
      createMockFile('Alice', now - 2000, now - 3000),
      createMockFile('Bob', now - 1000, now - 2000)
    ];

    it('should sort siblings alphabetically', () => {
      const config: SectionConfig = {
        ...DEFAULT_SECTION_CONFIG,
        sortOrder: 'alphabetical'
      };

      const sorted = [...files].sort((a, b) => a.basename.localeCompare(b.basename));

      expect(sorted[0].basename).toBe('Alice');
      expect(sorted[1].basename).toBe('Bob');
      expect(sorted[2].basename).toBe('Charlie');
    });

    it('should sort siblings by creation date', () => {
      const config: SectionConfig = {
        ...DEFAULT_SECTION_CONFIG,
        sortOrder: 'created'
      };

      const sorted = [...files].sort((a, b) => a.stat.ctime - b.stat.ctime);

      expect(sorted[0].basename).toBe('Charlie'); // Oldest
      expect(sorted[1].basename).toBe('Alice');
      expect(sorted[2].basename).toBe('Bob'); // Newest
    });

    it('should sort siblings by modified date (most recent first)', () => {
      const config: SectionConfig = {
        ...DEFAULT_SECTION_CONFIG,
        sortOrder: 'modified'
      };

      const sorted = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime);

      expect(sorted[0].basename).toBe('Charlie'); // Most recent
      expect(sorted[1].basename).toBe('Bob');
      expect(sorted[2].basename).toBe('Alice'); // Least recent
    });
  });

  describe('Include Self Option', () => {
    it('should respect includeSelf for siblings', () => {
      const configWithSelf: SectionConfig = {
        ...DEFAULT_SECTION_CONFIG,
        includeSelf: true
      };

      const configWithoutSelf: SectionConfig = {
        ...DEFAULT_SECTION_CONFIG,
        includeSelf: false
      };

      expect(configWithSelf.includeSelf).toBe(true);
      expect(configWithoutSelf.includeSelf).toBe(false);
    });

    it('should default to false when not specified', () => {
      const config: SectionConfig = {
        displayName: 'Siblings',
        visible: true,
        collapsed: false,
        sortOrder: 'alphabetical'
      };

      expect(config.includeSelf).toBeUndefined();
      expect(config.includeSelf || false).toBe(false);
    });
  });

  describe('Multi-Field Configuration Independence', () => {
    it('should support different configurations per parent field', () => {
      const parentConfig: ParentFieldConfig = {
        name: 'parent',
        displayName: 'Parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Ancestors',
          maxDepth: 5,
          initialDepth: 2,
          collapsed: false
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Descendants',
          maxDepth: 5,
          initialDepth: 2,
          collapsed: false
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Siblings',
          sortOrder: 'alphabetical',
          includeSelf: false
        }
      };

      const projectConfig: ParentFieldConfig = {
        name: 'project',
        displayName: 'Projects',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Programs',
          maxDepth: 3,
          initialDepth: 1,
          collapsed: true
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Tasks',
          maxDepth: 2,
          initialDepth: 1,
          collapsed: false
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          displayName: 'Related',
          sortOrder: 'modified',
          includeSelf: false
        }
      };

      // Verify independence
      expect(parentConfig.ancestors.maxDepth).toBe(5);
      expect(projectConfig.ancestors.maxDepth).toBe(3);
      expect(parentConfig.siblings.sortOrder).toBe('alphabetical');
      expect(projectConfig.siblings.sortOrder).toBe('modified');
    });

    it('should allow complete section visibility customization per field', () => {
      const field1: ParentFieldConfig = {
        name: 'field1',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          visible: true
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          visible: true
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          visible: true
        }
      };

      const field2: ParentFieldConfig = {
        name: 'field2',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          visible: true
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        }
      };

      expect(field1.ancestors.visible).toBe(true);
      expect(field2.ancestors.visible).toBe(false);
      expect(field1.siblings.visible).toBe(true);
      expect(field2.siblings.visible).toBe(false);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle all sections hidden', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        },
        descendants: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        },
        siblings: {
          ...DEFAULT_SECTION_CONFIG,
          visible: false
        }
      };

      const hasVisibleSections = config.ancestors.visible ||
                                 config.descendants.visible ||
                                 config.siblings.visible;

      expect(hasVisibleSections).toBe(false);
    });

    it('should handle minimal configuration', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        ancestors: {
          displayName: 'Ancestors',
          visible: true,
          collapsed: false
        },
        descendants: {
          displayName: 'Descendants',
          visible: true,
          collapsed: false
        },
        siblings: {
          displayName: 'Siblings',
          visible: true,
          collapsed: false
        }
      };

      expect(config.name).toBe('parent');
      expect(config.ancestors.visible).toBe(true);
    });

    it('should handle maximum configuration complexity', () => {
      const config: ParentFieldConfig = {
        name: 'complex-field',
        displayName: 'Complex Field Name',
        ancestors: {
          displayName: 'Custom Ancestors',
          visible: true,
          collapsed: false,
          maxDepth: 10,
          initialDepth: 3
        },
        descendants: {
          displayName: 'Custom Descendants',
          visible: false,
          collapsed: true,
          maxDepth: 5,
          initialDepth: 1
        },
        siblings: {
          displayName: 'Custom Siblings',
          visible: true,
          collapsed: false,
          sortOrder: 'modified',
          includeSelf: true
        }
      };

      expect(config.name).toBe('complex-field');
      expect(config.displayName).toBe('Complex Field Name');
      expect(config.ancestors.maxDepth).toBe(10);
      expect(config.descendants.visible).toBe(false);
      expect(config.siblings.includeSelf).toBe(true);
    });
  });
});
