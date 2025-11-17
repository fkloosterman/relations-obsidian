/**
 * Codeblock parameter parsing and validation for relation-tree codeblocks.
 */

/**
 * Relationship type for the tree.
 */
export type RelationType = 'ancestors' | 'descendants' | 'siblings' | 'cousins';

/**
 * Display mode for the tree.
 * - tree: Full hierarchical tree with expand/collapse
 * - list: Flat list of results
 * - compact: Condensed tree with minimal spacing
 */
export type DisplayMode = 'tree' | 'list' | 'compact';

/**
 * Visual style variant for the tree.
 * - compact: Minimal spacing and indentation
 * - detailed: Full information with metadata
 * - minimal: Ultra-compact single-line format
 */
export type StyleVariant = 'compact' | 'detailed' | 'minimal';

/**
 * Title display mode for the codeblock.
 * - none: No title displayed
 * - simple: Basic title (e.g., "Descendants of Note")
 * - detailed: Detailed title with filter information
 */
export type TitleMode = 'none' | 'simple' | 'detailed';

/**
 * Parameters for relation-tree codeblock.
 */
export interface CodeblockParams {
	/** Target note (wiki-link or file path) */
	note?: string;

	/** Type of relationship to display */
	type: RelationType;

	/** Maximum depth to traverse (default: from settings) */
	depth?: number;

	/** Display mode (default: tree) */
	mode?: DisplayMode;

	/** Parent field to use (default: first field from settings) */
	field?: string;

	/** Whether to show cycle indicators (default: true) */
	showCycles?: boolean;

	/** Whether tree should be initially collapsed (default: false) */
	collapsed?: boolean;

	// Filtering parameters

	/** Filter by tag (e.g., "#project" or "project") */
	filterTag?: string;

	/** Filter by folder path (e.g., "Projects/" or "Projects/Active") */
	filterFolder?: string;

	/** Exclude specific notes (comma-separated wiki-links) */
	exclude?: string;

	/** Maximum number of nodes to display (truncate if exceeded) */
	maxNodes?: number;

	/** Visual style variant (default: uses mode) */
	style?: StyleVariant;

	/** Title display mode (default: none) */
	title?: TitleMode;
}

/**
 * Default parameter values.
 */
export const DEFAULT_PARAMS: Partial<CodeblockParams> = {
	type: 'ancestors',
	mode: 'tree',
	showCycles: true,
	collapsed: false,
	// No defaults for filters (undefined = no filtering)
	maxNodes: undefined,
	style: undefined
};

/**
 * Validation error for codeblock parameters.
 */
export class CodeblockValidationError extends Error {
	constructor(message: string, public field?: string) {
		super(message);
		this.name = 'CodeblockValidationError';
	}
}

/**
 * Parses YAML content from codeblock into typed parameters.
 *
 * @param source - Raw codeblock content
 * @returns Parsed parameters
 * @throws CodeblockValidationError if parsing fails
 *
 * @example
 * ```typescript
 * const source = `
 * note: [[My Note]]
 * type: ancestors
 * depth: 3
 * `;
 * const params = parseCodeblockParams(source);
 * // params.note === '[[My Note]]'
 * // params.type === 'ancestors'
 * // params.depth === 3
 * ```
 */
export function parseCodeblockParams(source: string): CodeblockParams {
	const lines = source.trim().split('\n');
	const params: any = {};

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#')) continue;

		// Parse key: value format
		const colonIndex = trimmed.indexOf(':');
		if (colonIndex === -1) {
			throw new CodeblockValidationError(
				`Invalid parameter format: "${trimmed}". Expected "key: value"`,
				undefined
			);
		}

		const key = trimmed.substring(0, colonIndex).trim();
		const value = trimmed.substring(colonIndex + 1).trim();

		// Parse value based on key
		switch (key) {
			case 'note':
				params.note = value;
				break;

			case 'type':
				if (!['ancestors', 'descendants', 'siblings', 'cousins'].includes(value)) {
					throw new CodeblockValidationError(
						`Invalid type: "${value}". Must be one of: ancestors, descendants, siblings, cousins`,
						'type'
					);
				}
				params.type = value as RelationType;
				break;

			case 'depth':
				const depth = parseInt(value);
				if (isNaN(depth) || depth < 0) {
					throw new CodeblockValidationError(
						`Invalid depth: "${value}". Must be a positive number`,
						'depth'
					);
				}
				params.depth = depth;
				break;

			case 'mode':
				if (!['tree', 'list', 'compact'].includes(value)) {
					throw new CodeblockValidationError(
						`Invalid mode: "${value}". Must be one of: tree, list, compact`,
						'mode'
					);
				}
				params.mode = value as DisplayMode;
				break;

			case 'field':
				params.field = value;
				break;

			case 'showCycles':
				params.showCycles = value === 'true';
				break;

			case 'collapsed':
				params.collapsed = value === 'true';
				break;

			case 'filter-tag':
			case 'filterTag':
				params.filterTag = value;
				break;

			case 'filter-folder':
			case 'filterFolder':
				params.filterFolder = value;
				break;

			case 'exclude':
				params.exclude = value;
				break;

			case 'max-nodes':
			case 'maxNodes':
				const maxNodes = parseInt(value);
				if (isNaN(maxNodes) || maxNodes < 1) {
					throw new CodeblockValidationError(
						`Invalid max-nodes: "${value}". Must be a positive number`,
						'max-nodes'
					);
				}
				params.maxNodes = maxNodes;
				break;

			case 'style':
				if (!['compact', 'detailed', 'minimal'].includes(value)) {
					throw new CodeblockValidationError(
						`Invalid style: "${value}". Must be one of: compact, detailed, minimal`,
						'style'
					);
				}
				params.style = value as StyleVariant;
				break;

			case 'title':
				if (!['none', 'simple', 'detailed'].includes(value)) {
					throw new CodeblockValidationError(
						`Invalid title: "${value}". Must be one of: none, simple, detailed`,
						'title'
					);
				}
				params.title = value as TitleMode;
				break;

			default:
				throw new CodeblockValidationError(
					`Unknown parameter: "${key}"`,
					key
				);
		}
	}

	// Merge with defaults
	const result = { ...DEFAULT_PARAMS, ...params };

	return result as CodeblockParams;
}

/**
 * Validates codeblock parameters.
 *
 * @param params - Parameters to validate
 * @param availableFields - List of available parent field names
 * @throws CodeblockValidationError if validation fails
 *
 * @example
 * ```typescript
 * const params = { type: 'ancestors', field: 'parent' };
 * validateCodeblockParams(params, ['parent', 'project']);
 * // No error - validation passes
 *
 * const invalidParams = { type: 'ancestors', field: 'nonexistent' };
 * validateCodeblockParams(invalidParams, ['parent', 'project']);
 * // Throws: Invalid field: "nonexistent"...
 * ```
 */
export function validateCodeblockParams(
	params: CodeblockParams,
	availableFields: string[]
): void {
	// Validate field exists if specified
	if (params.field && !availableFields.includes(params.field)) {
		throw new CodeblockValidationError(
			`Invalid field: "${params.field}". Available fields: ${availableFields.join(', ')}`,
			'field'
		);
	}

	// Validate depth is reasonable
	if (params.depth !== undefined && params.depth > 100) {
		throw new CodeblockValidationError(
			`Depth too large: ${params.depth}. Maximum is 100`,
			'depth'
		);
	}

	// Validate max-nodes is reasonable
	if (params.maxNodes !== undefined && params.maxNodes > 10000) {
		throw new CodeblockValidationError(
			`max-nodes too large: ${params.maxNodes}. Maximum is 10000`,
			'max-nodes'
		);
	}

	// Validate filter-tag format
	if (params.filterTag) {
		const tag = params.filterTag.trim();
		// Allow tags with # prefix or alphanumeric with / and -
		if (!tag.startsWith('#') && !tag.match(/^[a-zA-Z0-9/_-]+$/)) {
			throw new CodeblockValidationError(
				`Invalid filter-tag format: "${params.filterTag}". Use "#tag" or "tag"`,
				'filter-tag'
			);
		}
	}

	// Validate filter-folder format (no path traversal)
	if (params.filterFolder) {
		const folder = params.filterFolder.trim();
		if (folder.includes('..')) {
			throw new CodeblockValidationError(
				`Invalid filter-folder: "${params.filterFolder}". Path traversal not allowed`,
				'filter-folder'
			);
		}
	}
}
