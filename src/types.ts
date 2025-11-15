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
