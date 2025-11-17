import { App, TFile, CachedMetadata } from 'obsidian';
import { TreeNode } from './tree-model';

/**
 * Type for a filter function that tests if a file should be included.
 */
export type FilterFunction = (file: TFile) => boolean;

/**
 * Builds a filter function from codeblock parameters.
 *
 * Combines multiple filter types using AND logic - all filters must pass
 * for a file to be included in the results.
 *
 * @param params - Codeblock parameters with filter options
 * @param app - Obsidian app instance (for metadata access)
 * @returns Combined filter function, or null if no filters specified
 *
 * @example
 * const filter = buildFilterFunction({
 *   filterTag: '#project',
 *   filterFolder: 'Projects/',
 *   exclude: '[[Archive]], [[Template]]'
 * }, app);
 *
 * // Filter returns true only for files that:
 * // - Have #project tag AND
 * // - Are in Projects/ folder AND
 * // - Are not Archive or Template
 */
export function buildFilterFunction(
	params: {
		filterTag?: string;
		filterFolder?: string;
		exclude?: string;
	},
	app: App
): FilterFunction | null {
	const filters: FilterFunction[] = [];

	// Build tag filter
	if (params.filterTag) {
		filters.push(createTagFilter(params.filterTag, app));
	}

	// Build folder filter
	if (params.filterFolder) {
		filters.push(createFolderFilter(params.filterFolder));
	}

	// Build exclusion filter
	if (params.exclude) {
		filters.push(createExclusionFilter(params.exclude, app));
	}

	// If no filters, return null (no filtering)
	if (filters.length === 0) {
		return null;
	}

	// Combine filters with AND logic
	return (file: TFile) => {
		return filters.every(filter => filter(file));
	};
}

/**
 * Creates a filter function for tag matching.
 *
 * Supports both exact tag matches and nested tag hierarchies.
 * For example, filtering by "#project" will match files with
 * "#project", "#project/active", "#project/active/urgent", etc.
 *
 * @param tagPattern - Tag to match (with or without # prefix)
 * @param app - Obsidian app instance
 * @returns Filter function that returns true if file has matching tag
 *
 * @example
 * const filter = createTagFilter('#project', app);
 * filter(fileWithProjectTag); // true
 * filter(fileWithProjectActiveTag); // true (nested)
 * filter(fileWithoutTag); // false
 */
export function createTagFilter(tagPattern: string, app: App): FilterFunction {
	// Normalize tag (remove # if present)
	const normalizedTag = tagPattern.startsWith('#')
		? tagPattern.substring(1)
		: tagPattern;

	return (file: TFile) => {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache) return false;

		// Get all tags from frontmatter and inline tags
		const tags = getAllTags(cache);

		// Check if any tag matches (supports nested tags like "project/active")
		return tags.some(tag => {
			// Remove # from tag
			const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;

			// Exact match or parent tag match
			return cleanTag === normalizedTag ||
				cleanTag.startsWith(normalizedTag + '/');
		});
	};
}

/**
 * Creates a filter function for folder path matching.
 *
 * Matches files in the specified folder or any of its subfolders.
 * Path comparison is prefix-based, so "Projects/" matches both
 * "Projects/file.md" and "Projects/Active/file.md".
 *
 * @param folderPath - Folder path to match (e.g., "Projects/" or "Projects/Active")
 * @returns Filter function that returns true if file is in matching folder
 *
 * @example
 * const filter = createFolderFilter('Projects/');
 * filter(fileInProjects); // true
 * filter(fileInProjectsActive); // true (subfolder)
 * filter(fileInArchive); // false
 */
export function createFolderFilter(folderPath: string): FilterFunction {
	// Normalize folder path (ensure trailing slash, remove leading slash)
	let normalizedPath = folderPath.trim();
	if (normalizedPath.startsWith('/')) {
		normalizedPath = normalizedPath.substring(1);
	}
	if (!normalizedPath.endsWith('/')) {
		normalizedPath += '/';
	}

	return (file: TFile) => {
		// Get file's folder path
		const filePath = file.parent?.path || '';

		// Check if file is in the specified folder or subfolder
		if (filePath === '') {
			// File is at vault root
			return normalizedPath === '/';
		}

		// Ensure we're matching complete folder segments, not substrings
		// "Projects/" should match "Projects" and "Projects/Active"
		// but NOT "ProjectsOld"
		const normalizedFolder = normalizedPath.endsWith('/')
			? normalizedPath.slice(0, -1)
			: normalizedPath;

		return filePath === normalizedFolder ||
			filePath.startsWith(normalizedFolder + '/');
	};
}

/**
 * Creates a filter function for excluding specific notes.
 *
 * Parses a comma-separated list of note references (wiki-links or plain names)
 * and creates a filter that excludes those notes from results.
 *
 * @param excludeList - Comma-separated list of note references
 * @param app - Obsidian app instance
 * @returns Filter function that returns false for excluded notes
 *
 * @example
 * const filter = createExclusionFilter('[[Archive]], [[Template]]', app);
 * filter(archiveFile); // false (excluded)
 * filter(templateFile); // false (excluded)
 * filter(otherFile); // true (not excluded)
 */
export function createExclusionFilter(excludeList: string, app: App): FilterFunction {
	// Parse excluded note paths
	const excludedPaths = new Set<string>();

	const excludeItems = excludeList.split(',').map(s => s.trim());

	for (const item of excludeItems) {
		if (!item) continue;

		// Remove wiki-link brackets if present
		let cleanRef = item;
		if (cleanRef.startsWith('[[') && cleanRef.endsWith(']]')) {
			cleanRef = cleanRef.substring(2, cleanRef.length - 2);
		}

		// Remove alias if present (e.g., "Note|Alias" -> "Note")
		const pipeIndex = cleanRef.indexOf('|');
		if (pipeIndex >= 0) {
			cleanRef = cleanRef.substring(0, pipeIndex);
		}

		// Try to resolve to file
		const excludedFile = app.metadataCache.getFirstLinkpathDest(cleanRef, '');
		if (excludedFile) {
			excludedPaths.add(excludedFile.path);
		}
	}

	return (file: TFile) => {
		return !excludedPaths.has(file.path);
	};
}

/**
 * Helper to get all tags from file cache.
 *
 * Collects tags from both frontmatter (tags: and tag: fields) and
 * inline tags in the note content.
 *
 * @param cache - File metadata cache
 * @returns Array of all tags found in the file
 */
export function getAllTags(cache: CachedMetadata): string[] {
	const tags: string[] = [];

	// Frontmatter tags
	if (cache.frontmatter?.tags) {
		const fmTags = cache.frontmatter.tags;
		if (Array.isArray(fmTags)) {
			tags.push(...fmTags);
		} else if (typeof fmTags === 'string') {
			tags.push(fmTags);
		}
	}

	// Frontmatter 'tag' field (alternative)
	if (cache.frontmatter?.tag) {
		const fmTag = cache.frontmatter.tag;
		if (Array.isArray(fmTag)) {
			tags.push(...fmTag);
		} else if (typeof fmTag === 'string') {
			tags.push(fmTag);
		}
	}

	// Inline tags
	if (cache.tags) {
		tags.push(...cache.tags.map(t => t.tag));
	}

	return tags;
}

/**
 * Counts total nodes in a tree.
 *
 * Recursively traverses the tree structure and counts all nodes.
 * Handles both single TreeNode objects and arrays of TreeNodes.
 *
 * @param tree - TreeNode or array of TreeNodes
 * @returns Total node count
 *
 * @example
 * const tree = buildAncestorTree(file, engine, graph);
 * const count = countTreeNodes(tree); // e.g., 15
 */
export function countTreeNodes(tree: TreeNode | TreeNode[] | null): number {
	if (!tree) return 0;

	if (Array.isArray(tree)) {
		return tree.reduce((sum, node) => sum + countTreeNodes(node), 0);
	}

	let count = 1; // Count self

	if (tree.children && Array.isArray(tree.children)) {
		count += tree.children.reduce((sum, child) =>
			sum + countTreeNodes(child), 0);
	}

	return count;
}

/**
 * Truncates a tree to a maximum number of nodes.
 *
 * Performs a breadth-first traversal and keeps nodes up to the specified
 * limit. Returns both the truncated tree and the count of nodes that were
 * removed.
 *
 * @param tree - TreeNode or array of TreeNodes
 * @param maxNodes - Maximum nodes to keep
 * @returns Object with truncated tree and count of truncated nodes
 *
 * @example
 * const tree = buildDescendantTree(file, engine, graph);
 * const { tree: truncated, truncatedCount } = truncateTree(tree, 50);
 * console.log(`Showing 50 nodes, ${truncatedCount} hidden`);
 */
export function truncateTree(
	tree: TreeNode | TreeNode[] | null,
	maxNodes: number
): { tree: TreeNode | TreeNode[] | null; truncatedCount: number } {
	if (!tree) {
		return { tree: null, truncatedCount: 0 };
	}

	let nodeCount = 0;
	let truncatedCount = 0;

	/**
	 * Recursively truncates a single node and its children.
	 * Returns null if node should be excluded due to limit.
	 */
	function truncateNode(node: TreeNode): TreeNode | null {
		if (nodeCount >= maxNodes) {
			truncatedCount++;
			return null;
		}

		nodeCount++;

		if (!node.children || node.children.length === 0) {
			return node;
		}

		const truncatedChildren: TreeNode[] = [];
		for (const child of node.children) {
			const truncatedChild = truncateNode(child);
			if (truncatedChild !== null) {
				truncatedChildren.push(truncatedChild);
			}
		}

		return {
			...node,
			children: truncatedChildren
		};
	}

	// Handle array of trees (siblings, cousins)
	if (Array.isArray(tree)) {
		const truncatedArray: TreeNode[] = [];
		for (const node of tree) {
			const truncatedNode = truncateNode(node);
			if (truncatedNode !== null) {
				truncatedArray.push(truncatedNode);
			}
		}
		return { tree: truncatedArray, truncatedCount };
	}

	// Handle single tree (ancestors, descendants)
	const truncatedTree = truncateNode(tree);
	return { tree: truncatedTree, truncatedCount };
}
