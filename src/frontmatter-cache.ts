import { App, TFile, CachedMetadata } from 'obsidian';

/**
 * Centralized cache for frontmatter metadata.
 *
 * Provides a single source of truth for file metadata, avoiding
 * redundant parsing when multiple graphs query the same files.
 *
 * The cache is automatically invalidated on file changes through
 * explicit invalidation calls from the plugin's event handlers.
 */
export class FrontmatterCache {
	private app: App;
	private cache: Map<string, CachedMetadata | null> = new Map();
	private hits = 0;
	private misses = 0;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Checks if a file has a specific frontmatter field (even if empty).
	 *
	 * @param file - The file to query
	 * @param fieldName - The frontmatter field name
	 * @returns True if the field exists in frontmatter, false otherwise
	 *
	 * @example
	 * const cache = new FrontmatterCache(app);
	 * const hasParent = cache.hasField(file, 'parent');
	 * // Returns: true if 'parent:' exists in frontmatter, even if empty
	 */
	hasField(file: TFile, fieldName: string): boolean {
		const metadata = this.getMetadata(file);
		if (!metadata?.frontmatter) return false;

		return fieldName in metadata.frontmatter;
	}

	/**
	 * Gets the value of a frontmatter field for a file.
	 *
	 * @param file - The file to query
	 * @param fieldName - The frontmatter field name
	 * @returns The field value (string, string[], or null)
	 *
	 * @example
	 * const cache = new FrontmatterCache(app);
	 * const parentValue = cache.getFieldValue(file, 'parent');
	 * // Returns: "Parent Note" or ["Parent A", "Parent B"] or null
	 */
	getFieldValue(file: TFile, fieldName: string): string | string[] | null {
		const metadata = this.getMetadata(file);
		if (!metadata?.frontmatter) return null;

		const value = metadata.frontmatter[fieldName];

		// Return null for undefined or null values
		if (value === undefined || value === null) return null;

		return value;
	}

	/**
	 * Gets the cached metadata for a file.
	 *
	 * Uses a cache-aside pattern: checks cache first, then fetches
	 * from Obsidian's metadata cache if not found.
	 *
	 * @param file - The file to query
	 * @returns Cached metadata or null
	 */
	getMetadata(file: TFile): CachedMetadata | null {
		// Check cache first
		if (this.cache.has(file.path)) {
			this.hits++;
			return this.cache.get(file.path) ?? null;
		}

		// Cache miss - fetch from Obsidian's metadata cache
		this.misses++;
		const metadata = this.app.metadataCache.getFileCache(file);
		this.cache.set(file.path, metadata ?? null);

		return metadata ?? null;
	}

	/**
	 * Invalidates cache for a specific file.
	 *
	 * Should be called when a file's metadata changes.
	 *
	 * @param file - The file to invalidate
	 */
	invalidate(file: TFile): void {
		this.cache.delete(file.path);
	}

	/**
	 * Invalidates cache for a file by path (for renames).
	 *
	 * Should be called when a file is renamed to clear the old path.
	 *
	 * @param path - The old file path
	 */
	invalidateByPath(path: string): void {
		this.cache.delete(path);
	}

	/**
	 * Clears the entire cache.
	 *
	 * Useful for debugging or when a full rebuild is needed.
	 */
	clear(): void {
		this.cache.clear();
		this.hits = 0;
		this.misses = 0;
	}

	/**
	 * Gets cache statistics.
	 *
	 * @returns Object with cache stats (size, hit rate)
	 */
	getStats(): { size: number; hits: number; misses: number; hitRate: number } {
		const total = this.hits + this.misses;
		const hitRate = total > 0 ? this.hits / total : 0;

		return {
			size: this.cache.size,
			hits: this.hits,
			misses: this.misses,
			hitRate: Math.round(hitRate * 100) / 100  // Round to 2 decimal places
		};
	}
}
