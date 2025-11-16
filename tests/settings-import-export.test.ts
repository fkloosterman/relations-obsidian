import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ParentFieldConfig,
  SectionConfig,
  ParentRelationSettings,
  DEFAULT_PARENT_FIELD_CONFIG,
  DEFAULT_SETTINGS,
  validateSettings
} from '../src/types';
import {
  getPreset,
  getPresetNames
} from '../src/presets/field-configurations';

describe('Settings Import/Export', () => {
  describe('JSON Serialization', () => {
    it('should serialize settings to valid JSON', () => {
      const settings: ParentRelationSettings = { ...DEFAULT_SETTINGS };
      const json = JSON.stringify(settings, null, 2);

      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should deserialize JSON back to settings', () => {
      const originalSettings: ParentRelationSettings = {
        parentFields: [
          {
            name: 'parent',
            displayName: 'Parent',
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
        defaultParentField: 'parent',
        uiStyle: 'auto',
        diagnosticMode: false
      };

      const json = JSON.stringify(originalSettings);
      const parsedSettings = JSON.parse(json);

      expect(parsedSettings).toEqual(originalSettings);
      expect(validateSettings(parsedSettings)).toBe(true);
    });

    it('should handle complex multi-field configuration', () => {
      const settings: ParentRelationSettings = {
        parentFields: [
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'parent' },
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'project' },
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'category' }
        ],
        defaultParentField: 'parent',
        uiStyle: 'segmented',
        diagnosticMode: true
      };

      const json = JSON.stringify(settings);
      const parsed = JSON.parse(json);

      expect(parsed.parentFields).toHaveLength(3);
      expect(validateSettings(parsed)).toBe(true);
    });

    it('should preserve custom display names and visibility settings', () => {
      const settings: ParentRelationSettings = {
        parentFields: [
          {
            name: 'parent',
            displayName: 'Custom Parent',
            ancestors: {
              displayName: 'Custom Ancestors',
              visible: false,
              collapsed: true,
              maxDepth: 10,
              initialDepth: 3
            },
            descendants: {
              displayName: 'Custom Descendants',
              visible: true,
              collapsed: false,
              maxDepth: 3,
              initialDepth: 1
            },
            siblings: {
              displayName: 'Custom Siblings',
              visible: false,
              collapsed: true,
              sortOrder: 'modified',
              includeSelf: true
            }
          }
        ],
        defaultParentField: 'parent',
        uiStyle: 'dropdown',
        diagnosticMode: false
      };

      const json = JSON.stringify(settings);
      const parsed = JSON.parse(json);

      expect(parsed.parentFields[0].displayName).toBe('Custom Parent');
      expect(parsed.parentFields[0].ancestors.displayName).toBe('Custom Ancestors');
      expect(parsed.parentFields[0].ancestors.visible).toBe(false);
      expect(parsed.parentFields[0].siblings.sortOrder).toBe('modified');
      expect(parsed.parentFields[0].siblings.includeSelf).toBe(true);
    });
  });

  describe('Import Validation', () => {
    it('should reject invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should reject settings without parent fields', () => {
      const invalid = {
        parentFields: [],
        defaultParentField: 'parent',
        uiStyle: 'auto',
        diagnosticMode: false
      };

      expect(validateSettings(invalid)).toBe(false);
    });

    it('should reject settings with invalid field names', () => {
      const invalid = {
        parentFields: [
          {
            name: '',  // Invalid empty name
            ancestors: DEFAULT_PARENT_FIELD_CONFIG.ancestors,
            descendants: DEFAULT_PARENT_FIELD_CONFIG.descendants,
            siblings: DEFAULT_PARENT_FIELD_CONFIG.siblings
          }
        ],
        defaultParentField: 'parent',
        uiStyle: 'auto',
        diagnosticMode: false
      };

      expect(validateSettings(invalid)).toBe(false);
    });

    it('should reject settings with duplicate field names', () => {
      const invalid = {
        parentFields: [
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'parent' },
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'parent' }  // Duplicate
        ],
        defaultParentField: 'parent',
        uiStyle: 'auto',
        diagnosticMode: false
      };

      expect(validateSettings(invalid)).toBe(false);
    });

    it('should reject settings with non-existent default field', () => {
      const invalid = {
        parentFields: [
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'parent' }
        ],
        defaultParentField: 'nonexistent',
        uiStyle: 'auto',
        diagnosticMode: false
      };

      expect(validateSettings(invalid)).toBe(false);
    });

    it('should reject settings with invalid depth values', () => {
      const invalid = {
        parentFields: [
          {
            name: 'parent',
            ancestors: {
              displayName: 'Ancestors',
              visible: true,
              collapsed: false,
              maxDepth: 2,
              initialDepth: 5  // Invalid: > maxDepth
            },
            descendants: DEFAULT_PARENT_FIELD_CONFIG.descendants,
            siblings: DEFAULT_PARENT_FIELD_CONFIG.siblings
          }
        ],
        defaultParentField: 'parent',
        uiStyle: 'auto',
        diagnosticMode: false
      };

      expect(validateSettings(invalid)).toBe(false);
    });
  });

  describe('Preset Loading', () => {
    it('should load simple-hierarchy preset correctly', () => {
      const preset = getPreset('simple-hierarchy');

      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(1);
        expect(preset[0].name).toBe('parent');
        expect(validateSettings({
          parentFields: preset,
          defaultParentField: preset[0].name,
          uiStyle: 'auto',
          diagnosticMode: false
        })).toBe(true);
      }
    });

    it('should load project-management preset correctly', () => {
      const preset = getPreset('project-management');

      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(2);
        expect(preset[0].name).toBe('project');
        expect(preset[1].name).toBe('category');
      }
    });

    it('should load knowledge-base preset correctly', () => {
      const preset = getPreset('knowledge-base');

      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(1);
        expect(preset[0].name).toBe('parent');
        expect(preset[0].displayName).toBe('Parent Topic');
        expect(preset[0].ancestors.maxDepth).toBe(10);
        expect(preset[0].ancestors.initialDepth).toBe(3);
      }
    });

    it('should load compact preset correctly', () => {
      const preset = getPreset('compact');

      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(1);
        expect(preset[0].siblings.visible).toBe(false);
        expect(preset[0].descendants.collapsed).toBe(true);
      }
    });

    it('should load multi-field-explorer preset correctly', () => {
      const preset = getPreset('multi-field-explorer');

      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(3);
        expect(preset[0].name).toBe('parent');
        expect(preset[1].name).toBe('project');
        expect(preset[2].name).toBe('topic');
      }
    });

    it('should validate all presets', () => {
      const presetNames = getPresetNames();

      presetNames.forEach(name => {
        const preset = getPreset(name);
        expect(preset).not.toBeNull();

        if (preset) {
          const settings: ParentRelationSettings = {
            parentFields: preset,
            defaultParentField: preset[0].name,
            uiStyle: 'auto',
            diagnosticMode: false
          };

          expect(validateSettings(settings)).toBe(true);
        }
      });
    });
  });

  describe('Export Format Compatibility', () => {
    it('should export in a format compatible with import', () => {
      const originalSettings = { ...DEFAULT_SETTINGS };

      // Simulate export
      const exportedJson = JSON.stringify(originalSettings, null, 2);

      // Simulate import
      const importedSettings = JSON.parse(exportedJson);

      expect(validateSettings(importedSettings)).toBe(true);
      expect(importedSettings).toEqual(originalSettings);
    });

    it('should handle roundtrip with custom configuration', () => {
      const customSettings: ParentRelationSettings = {
        parentFields: [
          {
            name: 'project',
            displayName: 'My Projects',
            ancestors: {
              displayName: 'Parent Projects',
              visible: true,
              collapsed: false,
              maxDepth: 3,
              initialDepth: 1
            },
            descendants: {
              displayName: 'Sub-Projects',
              visible: true,
              collapsed: true,
              maxDepth: 2,
              initialDepth: 1
            },
            siblings: {
              displayName: 'Related',
              visible: true,
              collapsed: false,
              sortOrder: 'modified',
              includeSelf: false
            }
          }
        ],
        defaultParentField: 'project',
        uiStyle: 'dropdown',
        diagnosticMode: true
      };

      // Export
      const json = JSON.stringify(customSettings);

      // Import
      const imported = JSON.parse(json);

      expect(imported).toEqual(customSettings);
      expect(validateSettings(imported)).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle missing optional fields with defaults', () => {
      const minimalConfig = {
        parentFields: [
          {
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
          }
        ],
        defaultParentField: 'parent',
        uiStyle: 'auto',
        diagnosticMode: false
      };

      expect(validateSettings(minimalConfig)).toBe(true);
    });
  });
});
