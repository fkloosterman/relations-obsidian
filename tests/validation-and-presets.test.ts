import { describe, it, expect } from 'vitest';
import {
  validateSectionConfig,
  validateParentFieldConfig,
  validateSettings,
  SectionConfig,
  ParentFieldConfig,
  ParentRelationSettings,
  DEFAULT_SECTION_CONFIG,
  DEFAULT_PARENT_FIELD_CONFIG,
  DEFAULT_SETTINGS
} from '../src/types';
import {
  getPreset,
  getPresetNames,
  getPresetDescription,
  isValidPreset,
  getPresetMetadata
} from '../src/presets/field-configurations';

describe('Validation Functions', () => {
  describe('validateSectionConfig', () => {
    it('should validate a valid section config', () => {
      const config: SectionConfig = {
        displayName: 'Test Section',
        visible: true,
        collapsed: false,
        maxDepth: 5,
        initialDepth: 2,
        sortOrder: 'alphabetical',
        includeSelf: false
      };
      expect(validateSectionConfig(config)).toBe(true);
    });

    it('should reject negative maxDepth', () => {
      const config: Partial<SectionConfig> = {
        maxDepth: -1
      };
      expect(validateSectionConfig(config)).toBe(false);
    });

    it('should reject negative initialDepth', () => {
      const config: Partial<SectionConfig> = {
        initialDepth: -1
      };
      expect(validateSectionConfig(config)).toBe(false);
    });

    it('should reject initialDepth > maxDepth', () => {
      const config: Partial<SectionConfig> = {
        maxDepth: 2,
        initialDepth: 5
      };
      expect(validateSectionConfig(config)).toBe(false);
    });

    it('should accept initialDepth <= maxDepth', () => {
      const config: Partial<SectionConfig> = {
        maxDepth: 5,
        initialDepth: 3
      };
      expect(validateSectionConfig(config)).toBe(true);
    });

    it('should accept initialDepth = maxDepth', () => {
      const config: Partial<SectionConfig> = {
        maxDepth: 5,
        initialDepth: 5
      };
      expect(validateSectionConfig(config)).toBe(true);
    });

    it('should reject invalid sortOrder', () => {
      const config: any = {
        sortOrder: 'invalid'
      };
      expect(validateSectionConfig(config)).toBe(false);
    });

    it('should accept valid sortOrder values', () => {
      expect(validateSectionConfig({ sortOrder: 'alphabetical' })).toBe(true);
      expect(validateSectionConfig({ sortOrder: 'created' })).toBe(true);
      expect(validateSectionConfig({ sortOrder: 'modified' })).toBe(true);
    });

    it('should validate default section config', () => {
      expect(validateSectionConfig(DEFAULT_SECTION_CONFIG)).toBe(true);
    });
  });

  describe('validateParentFieldConfig', () => {
    it('should validate a valid parent field config', () => {
      const config: ParentFieldConfig = {
        name: 'parent',
        displayName: 'Parent',
        ancestors: DEFAULT_SECTION_CONFIG,
        descendants: DEFAULT_SECTION_CONFIG,
        siblings: DEFAULT_SECTION_CONFIG
      };
      expect(validateParentFieldConfig(config)).toBe(true);
    });

    it('should reject empty field name', () => {
      const config: Partial<ParentFieldConfig> = {
        name: ''
      };
      expect(validateParentFieldConfig(config)).toBe(false);
    });

    it('should reject whitespace-only field name', () => {
      const config: Partial<ParentFieldConfig> = {
        name: '   '
      };
      expect(validateParentFieldConfig(config)).toBe(false);
    });

    it('should reject missing field name', () => {
      const config: Partial<ParentFieldConfig> = {
        displayName: 'Test'
      };
      expect(validateParentFieldConfig(config)).toBe(false);
    });

    it('should reject invalid ancestors config', () => {
      const config: Partial<ParentFieldConfig> = {
        name: 'parent',
        ancestors: {
          displayName: 'Ancestors',
          visible: true,
          collapsed: false,
          maxDepth: 2,
          initialDepth: 5  // Invalid: greater than maxDepth
        }
      };
      expect(validateParentFieldConfig(config)).toBe(false);
    });

    it('should reject invalid descendants config', () => {
      const config: Partial<ParentFieldConfig> = {
        name: 'parent',
        descendants: {
          displayName: 'Descendants',
          visible: true,
          collapsed: false,
          maxDepth: -1  // Invalid: negative
        }
      };
      expect(validateParentFieldConfig(config)).toBe(false);
    });

    it('should reject invalid siblings config', () => {
      const config: any = {
        name: 'parent',
        siblings: {
          displayName: 'Siblings',
          visible: true,
          collapsed: false,
          sortOrder: 'invalid'  // Invalid sort order
        }
      };
      expect(validateParentFieldConfig(config)).toBe(false);
    });

    it('should validate default parent field config', () => {
      expect(validateParentFieldConfig(DEFAULT_PARENT_FIELD_CONFIG)).toBe(true);
    });
  });

  describe('validateSettings', () => {
    it('should validate valid settings', () => {
      const settings: ParentRelationSettings = {
        parentFields: [DEFAULT_PARENT_FIELD_CONFIG],
        defaultParentField: 'parent',
        uiStyle: 'auto',
        diagnosticMode: false
      };
      expect(validateSettings(settings)).toBe(true);
    });

    it('should reject settings with no parent fields', () => {
      const settings: Partial<ParentRelationSettings> = {
        parentFields: [],
        defaultParentField: 'parent',
        uiStyle: 'auto'
      };
      expect(validateSettings(settings)).toBe(false);
    });

    it('should reject settings with invalid parent field', () => {
      const settings: Partial<ParentRelationSettings> = {
        parentFields: [
          {
            name: '',  // Invalid
            ancestors: DEFAULT_SECTION_CONFIG,
            descendants: DEFAULT_SECTION_CONFIG,
            siblings: DEFAULT_SECTION_CONFIG
          }
        ]
      };
      expect(validateSettings(settings)).toBe(false);
    });

    it('should reject settings with duplicate field names', () => {
      const field1: ParentFieldConfig = {
        name: 'parent',
        ancestors: DEFAULT_SECTION_CONFIG,
        descendants: DEFAULT_SECTION_CONFIG,
        siblings: DEFAULT_SECTION_CONFIG
      };
      const field2: ParentFieldConfig = {
        name: 'parent',  // Duplicate
        ancestors: DEFAULT_SECTION_CONFIG,
        descendants: DEFAULT_SECTION_CONFIG,
        siblings: DEFAULT_SECTION_CONFIG
      };
      const settings: Partial<ParentRelationSettings> = {
        parentFields: [field1, field2]
      };
      expect(validateSettings(settings)).toBe(false);
    });

    it('should reject settings where default field does not exist', () => {
      const settings: Partial<ParentRelationSettings> = {
        parentFields: [DEFAULT_PARENT_FIELD_CONFIG],
        defaultParentField: 'nonexistent'
      };
      expect(validateSettings(settings)).toBe(false);
    });

    it('should accept settings where default field exists', () => {
      const settings: Partial<ParentRelationSettings> = {
        parentFields: [
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'parent' },
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'project' }
        ],
        defaultParentField: 'project'
      };
      expect(validateSettings(settings)).toBe(true);
    });

    it('should reject invalid UI style', () => {
      const settings: any = {
        parentFields: [DEFAULT_PARENT_FIELD_CONFIG],
        uiStyle: 'invalid'
      };
      expect(validateSettings(settings)).toBe(false);
    });

    it('should accept valid UI style values', () => {
      const baseSettings = {
        parentFields: [DEFAULT_PARENT_FIELD_CONFIG],
        defaultParentField: 'parent'
      };
      expect(validateSettings({ ...baseSettings, uiStyle: 'auto' })).toBe(true);
      expect(validateSettings({ ...baseSettings, uiStyle: 'segmented' })).toBe(true);
      expect(validateSettings({ ...baseSettings, uiStyle: 'dropdown' })).toBe(true);
    });

    it('should validate default settings', () => {
      expect(validateSettings(DEFAULT_SETTINGS)).toBe(true);
    });

    it('should accept multiple valid parent fields', () => {
      const settings: Partial<ParentRelationSettings> = {
        parentFields: [
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'parent' },
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'project' },
          { ...DEFAULT_PARENT_FIELD_CONFIG, name: 'category' }
        ],
        defaultParentField: 'parent'
      };
      expect(validateSettings(settings)).toBe(true);
    });
  });
});

describe('Configuration Presets', () => {
  describe('getPresetNames', () => {
    it('should return array of preset names', () => {
      const names = getPresetNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it('should include expected preset names', () => {
      const names = getPresetNames();
      expect(names).toContain('simple-hierarchy');
      expect(names).toContain('project-management');
      expect(names).toContain('knowledge-base');
      expect(names).toContain('compact');
    });
  });

  describe('getPreset', () => {
    it('should return preset config for valid name', () => {
      const preset = getPreset('simple-hierarchy');
      expect(preset).not.toBeNull();
      expect(Array.isArray(preset)).toBe(true);
    });

    it('should return null for invalid name', () => {
      const preset = getPreset('nonexistent');
      expect(preset).toBeNull();
    });

    it('should return valid configuration', () => {
      const preset = getPreset('simple-hierarchy');
      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBeGreaterThan(0);
        preset.forEach(field => {
          expect(validateParentFieldConfig(field)).toBe(true);
        });
      }
    });

    it('should have correct structure for simple-hierarchy', () => {
      const preset = getPreset('simple-hierarchy');
      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(1);
        expect(preset[0].name).toBe('parent');
        expect(preset[0].ancestors).toBeDefined();
        expect(preset[0].descendants).toBeDefined();
        expect(preset[0].siblings).toBeDefined();
      }
    });

    it('should have correct structure for project-management', () => {
      const preset = getPreset('project-management');
      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(2);
        expect(preset[0].name).toBe('project');
        expect(preset[1].name).toBe('category');
      }
    });

    it('should have correct structure for knowledge-base', () => {
      const preset = getPreset('knowledge-base');
      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(1);
        expect(preset[0].name).toBe('parent');
        expect(preset[0].displayName).toBe('Parent Topic');
        expect(preset[0].ancestors.maxDepth).toBe(10);
      }
    });

    it('should have correct structure for compact', () => {
      const preset = getPreset('compact');
      expect(preset).not.toBeNull();
      if (preset) {
        expect(preset.length).toBe(1);
        expect(preset[0].siblings.visible).toBe(false);
      }
    });
  });

  describe('getPresetDescription', () => {
    it('should return description for valid preset', () => {
      const description = getPresetDescription('simple-hierarchy');
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should return empty string for invalid preset', () => {
      const description = getPresetDescription('nonexistent');
      expect(description).toBe('');
    });

    it('should have descriptions for all presets', () => {
      const names = getPresetNames();
      names.forEach(name => {
        const description = getPresetDescription(name);
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('isValidPreset', () => {
    it('should return true for valid preset names', () => {
      expect(isValidPreset('simple-hierarchy')).toBe(true);
      expect(isValidPreset('project-management')).toBe(true);
      expect(isValidPreset('knowledge-base')).toBe(true);
      expect(isValidPreset('compact')).toBe(true);
    });

    it('should return false for invalid preset names', () => {
      expect(isValidPreset('nonexistent')).toBe(false);
      expect(isValidPreset('')).toBe(false);
      expect(isValidPreset('invalid-preset')).toBe(false);
    });
  });

  describe('getPresetMetadata', () => {
    it('should return array of metadata objects', () => {
      const metadata = getPresetMetadata();
      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
    });

    it('should have correct structure', () => {
      const metadata = getPresetMetadata();
      metadata.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description');
        expect(typeof item.name).toBe('string');
        expect(typeof item.description).toBe('string');
      });
    });

    it('should include all presets', () => {
      const metadata = getPresetMetadata();
      const names = getPresetNames();
      expect(metadata.length).toBe(names.length);
      names.forEach(name => {
        const found = metadata.find(m => m.name === name);
        expect(found).toBeDefined();
      });
    });
  });

  describe('All Presets Validation', () => {
    it('should have all presets pass validation', () => {
      const names = getPresetNames();
      names.forEach(name => {
        const preset = getPreset(name);
        expect(preset).not.toBeNull();
        if (preset) {
          preset.forEach((field, index) => {
            expect(validateParentFieldConfig(field)).toBe(true);
          });

          // Validate as complete settings
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

    it('should have no duplicate field names within presets', () => {
      const names = getPresetNames();
      names.forEach(presetName => {
        const preset = getPreset(presetName);
        if (preset) {
          const fieldNames = preset.map(f => f.name);
          const uniqueNames = new Set(fieldNames);
          expect(fieldNames.length).toBe(uniqueNames.size);
        }
      });
    });
  });
});
