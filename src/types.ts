import { TFile } from 'obsidian';

/**
 * Result of an ancestor query, organized by generation.
 */
export interface AncestorQueryResult {
  /** The file that was queried */
  file: TFile;

  /** Ancestors organized by generation: [[parents], [grandparents], ...] */
  generations: TFile[][];

  /** Total number of unique ancestors found */
  totalCount: number;

  /** Maximum depth that was traversed */
  depth: number;

  /** Whether the query was limited by maxDepth setting */
  wasTruncated: boolean;
}

/**
 * Result of a descendant query, organized by generation.
 */
export interface DescendantQueryResult {
  /** The file that was queried */
  file: TFile;

  /** Descendants organized by generation: [[children], [grandchildren], ...] */
  generations: TFile[][];

  /** Total number of unique descendants found */
  totalCount: number;

  /** Maximum depth that was traversed */
  depth: number;

  /** Whether the query was limited by maxDepth setting */
  wasTruncated: boolean;
}

/**
 * Result of a sibling query.
 */
export interface SiblingQueryResult {
  /** The file that was queried */
  file: TFile;

  /** Sibling files */
  siblings: TFile[];

  /** Total number of siblings found */
  totalCount: number;

  /** Whether self was included in results */
  includesSelf: boolean;
}

/**
 * Result of a cousin query.
 */
export interface CousinQueryResult {
  /** The file that was queried */
  file: TFile;

  /** Cousin files */
  cousins: TFile[];

  /** Total number of cousins found */
  totalCount: number;

  /** Degree of cousinship (1 = first cousins, 2 = second cousins, etc.) */
  degree: number;
}

/**
 * Combined relationship query result (for full lineage queries).
 */
export interface FullLineageResult {
  /** The file that was queried */
  file: TFile;

  /** Ancestors by generation */
  ancestors: TFile[][];

  /** Descendants by generation */
  descendants: TFile[][];

  /** Siblings */
  siblings: TFile[];

  /** Statistics */
  stats: {
    totalAncestors: number;
    totalDescendants: number;
    totalSiblings: number;
    ancestorDepth: number;
    descendantDepth: number;
  };
}

/**
 * Options for relationship queries.
 */
export interface RelationshipQueryOptions {
  /** Maximum depth to traverse (overrides plugin setting) */
  maxDepth?: number;

  /** For sibling queries: whether to include the queried file */
  includeSelf?: boolean;

  /** For cousin queries: degree of cousinship */
  degree?: number;

  /** Whether to include cycle information in results */
  detectCycles?: boolean;
}

/**
 * Configuration for a single section (ancestors, descendants, or siblings)
 */
export interface SectionConfig {
  /** Display name for this section (e.g., "Parent Chain", "Children") */
  displayName: string;

  /** Whether this section is visible in the sidebar */
  visible: boolean;

  /** Whether this section is initially collapsed (only used if visible) */
  collapsed: boolean;

  /** Maximum depth to traverse (ancestors/descendants only) */
  maxDepth?: number;

  /** Initial unfold depth when rendering tree (ancestors/descendants only) */
  initialDepth?: number;

  /** Sort order for items (siblings only) */
  sortOrder?: 'alphabetical' | 'created' | 'modified';

  /** Whether to include the current file in results (siblings only) */
  includeSelf?: boolean;
}

/**
 * Configuration for a single parent field
 */
export interface ParentFieldConfig {
  /** Field name in frontmatter (e.g., "parent", "project") */
  name: string;

  /** Optional friendly display name for UI (e.g., "Project Hierarchy") */
  displayName?: string;

  /** Order in which sections are displayed in the sidebar */
  sectionOrder?: ('reference' | 'roots' | 'ancestors' | 'descendants' | 'siblings')[];

  /** Roots section configuration */
  roots: SectionConfig;

  /** Ancestors section configuration */
  ancestors: SectionConfig;

  /** Descendants section configuration */
  descendants: SectionConfig;

  /** Siblings section configuration */
  siblings: SectionConfig;
}

/**
 * Plugin settings with multi-parent-field support
 */
export interface ParentRelationSettings {
  /** Array of configured parent fields */
  parentFields: ParentFieldConfig[];

  /** Which parent field to show by default when opening sidebar */
  defaultParentField: string;

  /** UI style preference (deprecated, always uses dropdown now) */
  uiStyle?: 'auto' | 'segmented' | 'dropdown';

  /** Diagnostic mode toggle */
  diagnosticMode: boolean;
}

/**
 * Default configuration for a section
 */
export const DEFAULT_SECTION_CONFIG: SectionConfig = {
  displayName: '',  // Will be set per section type
  visible: true,
  collapsed: false,
  maxDepth: 5,
  initialDepth: 2,
  sortOrder: 'alphabetical',
  includeSelf: false
};

/**
 * Default configuration for a parent field
 */
export const DEFAULT_PARENT_FIELD_CONFIG: ParentFieldConfig = {
  name: 'parent',
  displayName: 'Parent',
  sectionOrder: ['reference', 'roots', 'ancestors', 'descendants', 'siblings'],
  roots: {
    ...DEFAULT_SECTION_CONFIG,
    displayName: 'Root Notes',
    sortOrder: 'alphabetical',
    visible: true,
    collapsed: true
  },
  ancestors: {
    ...DEFAULT_SECTION_CONFIG,
    displayName: 'Ancestors',
    maxDepth: 5,
    initialDepth: 2
  },
  descendants: {
    ...DEFAULT_SECTION_CONFIG,
    displayName: 'Descendants',
    maxDepth: 5,
    initialDepth: 2
  },
  siblings: {
    ...DEFAULT_SECTION_CONFIG,
    displayName: 'Siblings',
    sortOrder: 'alphabetical',
    includeSelf: false,
    collapsed: true
  }
};

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: ParentRelationSettings = {
  parentFields: [DEFAULT_PARENT_FIELD_CONFIG],
  defaultParentField: 'parent',
  diagnosticMode: false
};

/**
 * Validates a section configuration.
 *
 * @param config - The section config to validate
 * @returns True if valid, false otherwise
 */
export function validateSectionConfig(config: Partial<SectionConfig>): boolean {
  // Check for invalid depth values (must be >= 1 for initialDepth, >= 0 for maxDepth)
  if (config.maxDepth !== undefined && config.maxDepth < 0) {
    return false;
  }

  if (config.initialDepth !== undefined && config.initialDepth < 1) {
    return false;
  }

  // Check that initialDepth doesn't exceed maxDepth
  if (config.initialDepth !== undefined && config.maxDepth !== undefined) {
    if (config.initialDepth > config.maxDepth) {
      return false;
    }
  }

  // Check that sortOrder is valid if provided
  if (config.sortOrder !== undefined) {
    const validSortOrders = ['alphabetical', 'created', 'modified'];
    if (!validSortOrders.includes(config.sortOrder)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a parent field configuration.
 *
 * @param config - The parent field config to validate
 * @returns True if valid, false otherwise
 */
export function validateParentFieldConfig(config: Partial<ParentFieldConfig>): boolean {
  // Field name is required and must not be empty
  if (!config.name || config.name.trim() === '') {
    return false;
  }

  // Validate each section config if present
  if (config.roots && !validateSectionConfig(config.roots)) {
    return false;
  }

  if (config.ancestors && !validateSectionConfig(config.ancestors)) {
    return false;
  }

  if (config.descendants && !validateSectionConfig(config.descendants)) {
    return false;
  }

  if (config.siblings && !validateSectionConfig(config.siblings)) {
    return false;
  }

  return true;
}

/**
 * Validates plugin settings.
 *
 * @param settings - The settings to validate
 * @returns True if valid, false otherwise
 */
export function validateSettings(settings: Partial<ParentRelationSettings>): boolean {
  // Must have at least one parent field
  if (!settings.parentFields || settings.parentFields.length === 0) {
    return false;
  }

  // All parent fields must be valid
  if (!settings.parentFields.every(validateParentFieldConfig)) {
    return false;
  }

  // Check for duplicate field names
  const fieldNames = settings.parentFields.map(f => f.name);
  const uniqueNames = new Set(fieldNames);
  if (fieldNames.length !== uniqueNames.size) {
    return false;
  }

  // Default field must exist in the list
  if (settings.defaultParentField) {
    const hasDefaultField = settings.parentFields.some(
      f => f.name === settings.defaultParentField
    );
    if (!hasDefaultField) {
      return false;
    }
  }

  // UI style must be valid if provided
  if (settings.uiStyle) {
    const validStyles = ['auto', 'segmented', 'dropdown'];
    if (!validStyles.includes(settings.uiStyle)) {
      return false;
    }
  }

  return true;
}
