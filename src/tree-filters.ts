import { TFile, MetadataCache } from 'obsidian';

/**
 * Configuration for filtering tree nodes.
 */
export interface FilterConfig {
	/** Filter by tags (include nodes with any of these tags) */
	includeTags?: string[];

	/** Exclude nodes with any of these tags */
	excludeTags?: string[];

	/** Include only nodes in these folders */
	includeFolders?: string[];

	/** Exclude nodes in these folders */
	excludeFolders?: string[];

	/** Custom filter predicate */
	predicate?: (file: TFile) => boolean;

	/** Filter mode: 'and' (all conditions must match) or 'or' (any condition matches) */
	mode?: 'and' | 'or';
}

/**
 * Creates a filter function from a filter configuration.
 *
 * @param config - The filter configuration
 * @param metadataCache - Obsidian's metadata cache for tag lookups
 * @returns Filter function that returns true if file should be included
 */
export function createFilter(
	config: FilterConfig,
	metadataCache: MetadataCache
): (file: TFile) => boolean {
	const filters: ((file: TFile) => boolean)[] = [];

	// Tag inclusion filter
	if (config.includeTags && config.includeTags.length > 0) {
		filters.push((file: TFile) => {
			const cache = metadataCache.getFileCache(file);
			const tags = cache?.tags?.map(t => t.tag) || [];
			const frontmatterTags = cache?.frontmatter?.tags || [];

			// Frontmatter tags can be string or array
			const frontmatterTagsArray = Array.isArray(frontmatterTags)
				? frontmatterTags
				: [frontmatterTags];

			const allTags = [...tags, ...frontmatterTagsArray].map(normalizeTag);

			return config.includeTags!.some(tag =>
				allTags.includes(normalizeTag(tag))
			);
		});
	}

	// Tag exclusion filter
	if (config.excludeTags && config.excludeTags.length > 0) {
		filters.push((file: TFile) => {
			const cache = metadataCache.getFileCache(file);
			const tags = cache?.tags?.map(t => t.tag) || [];
			const frontmatterTags = cache?.frontmatter?.tags || [];

			// Frontmatter tags can be string or array
			const frontmatterTagsArray = Array.isArray(frontmatterTags)
				? frontmatterTags
				: [frontmatterTags];

			const allTags = [...tags, ...frontmatterTagsArray].map(normalizeTag);

			return !config.excludeTags!.some(tag =>
				allTags.includes(normalizeTag(tag))
			);
		});
	}

	// Folder inclusion filter
	if (config.includeFolders && config.includeFolders.length > 0) {
		filters.push((file: TFile) => {
			return config.includeFolders!.some(folder =>
				file.path.startsWith(folder)
			);
		});
	}

	// Folder exclusion filter
	if (config.excludeFolders && config.excludeFolders.length > 0) {
		filters.push((file: TFile) => {
			return !config.excludeFolders!.some(folder =>
				file.path.startsWith(folder)
			);
		});
	}

	// Custom predicate
	if (config.predicate) {
		filters.push(config.predicate);
	}

	// No filters means include everything
	if (filters.length === 0) {
		return () => true;
	}

	// Combine filters based on mode
	const mode = config.mode || 'and';

	if (mode === 'and') {
		return (file: TFile) => filters.every(f => f(file));
	} else {
		return (file: TFile) => filters.some(f => f(file));
	}
}

/**
 * Normalizes a tag by ensuring it starts with #
 */
function normalizeTag(tag: string): string {
	if (typeof tag !== 'string') return '#';
	return tag.startsWith('#') ? tag : `#${tag}`;
}

/**
 * Common filter presets for convenience.
 */
export const FilterPresets = {
	/** Only markdown files */
	markdownOnly: (file: TFile) => file.extension === 'md',

	/** Exclude attachments folder */
	noAttachments: (file: TFile) => !file.path.startsWith('attachments/'),

	/** Exclude templates folder */
	noTemplates: (file: TFile) => !file.path.startsWith('templates/'),

	/** Only files modified in last 7 days */
	recentlyModified: (file: TFile) => {
		const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		return file.stat.mtime > weekAgo;
	},

	/** Only files created in last 30 days */
	recentlyCreated: (file: TFile) => {
		const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
		return file.stat.ctime > monthAgo;
	}
};
