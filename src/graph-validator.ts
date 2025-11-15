import { TFile, CachedMetadata } from 'obsidian';
import { RelationGraph } from './relation-graph';
import { CycleDetector, CycleInfo } from './cycle-detector';

/**
 * Severity level for diagnostic issues
 */
export enum DiagnosticSeverity {
  ERROR = 'error',     // Critical issues (cycles, broken references)
  WARNING = 'warning', // Potential issues (orphaned nodes)
  INFO = 'info'        // Informational (graph statistics)
}

/**
 * Type of diagnostic issue
 */
export enum DiagnosticType {
  CYCLE = 'cycle',
  UNRESOLVED_LINK = 'unresolved_link',
  ORPHANED_NODE = 'orphaned_node',
  BROKEN_REFERENCE = 'broken_reference',
  GRAPH_STATS = 'graph_stats'
}

/**
 * Individual diagnostic issue
 */
export interface DiagnosticIssue {
  /** Severity level */
  severity: DiagnosticSeverity;

  /** Type of issue */
  type: DiagnosticType;

  /** Human-readable message */
  message: string;

  /** File(s) involved */
  files: TFile[];

  /** Additional context (e.g., cycle path, link text) */
  context?: Record<string, any>;
}

/**
 * Complete diagnostic report for the graph
 */
export interface DiagnosticInfo {
  /** Timestamp of validation */
  timestamp: number;

  /** Total number of nodes in graph */
  totalNodes: number;

  /** Total number of edges (parent-child relationships) */
  totalEdges: number;

  /** All diagnostic issues found */
  issues: DiagnosticIssue[];

  /** Summary counts by severity */
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };

  /** Whether the graph is considered healthy */
  isHealthy: boolean;
}

/**
 * Validates graph health and provides diagnostic information.
 *
 * Checks for:
 * - Cycles in the relationship graph
 * - Unresolved parent links (references to non-existent files)
 * - Orphaned nodes (no parents, no children)
 * - Broken bidirectional references
 */
export class GraphValidator {
  constructor(
    private graph: RelationGraph,
    private cycleDetector: CycleDetector
  ) {}

  /**
   * Performs comprehensive graph validation.
   *
   * @returns Complete diagnostic report
   */
  validateGraph(): DiagnosticInfo {
    const issues: DiagnosticIssue[] = [];
    const startTime = Date.now();

    // Check for all cycles
    const cycles = this.getAllCycles();
    cycles.forEach(cycle => {
      issues.push({
        severity: DiagnosticSeverity.ERROR,
        type: DiagnosticType.CYCLE,
        message: cycle.description,
        files: cycle.cyclePath,
        context: { length: cycle.length }
      });
    });

    // Check for unresolved parent links
    const unresolvedLinks = this.findUnresolvedLinks();
    unresolvedLinks.forEach(({ file, unresolvedParents }) => {
      issues.push({
        severity: DiagnosticSeverity.ERROR,
        type: DiagnosticType.UNRESOLVED_LINK,
        message: `File "${file.basename}" references non-existent parent(s): ${unresolvedParents.join(', ')}`,
        files: [file],
        context: { unresolvedParents }
      });
    });

    // Check for orphaned nodes
    const orphanedNodes = this.findOrphanedNodes();
    orphanedNodes.forEach(file => {
      issues.push({
        severity: DiagnosticSeverity.WARNING,
        type: DiagnosticType.ORPHANED_NODE,
        message: `File "${file.basename}" has no parents and no children`,
        files: [file],
        context: {}
      });
    });

    // Check for broken bidirectional references
    const brokenRefs = this.findBrokenReferences();
    brokenRefs.forEach(({ parent, child, direction }) => {
      issues.push({
        severity: DiagnosticSeverity.ERROR,
        type: DiagnosticType.BROKEN_REFERENCE,
        message: `Broken ${direction} reference: "${parent.basename}" <-> "${child.basename}"`,
        files: [parent, child],
        context: { direction }
      });
    });

    // Calculate statistics
    const stats = this.getGraphStats();
    issues.push({
      severity: DiagnosticSeverity.INFO,
      type: DiagnosticType.GRAPH_STATS,
      message: `Graph contains ${stats.nodes} nodes, ${stats.edges} edges, ${stats.roots} roots, ${stats.leaves} leaves`,
      files: [],
      context: stats
    });

    // Build summary
    const summary = {
      errors: issues.filter(i => i.severity === DiagnosticSeverity.ERROR).length,
      warnings: issues.filter(i => i.severity === DiagnosticSeverity.WARNING).length,
      info: issues.filter(i => i.severity === DiagnosticSeverity.INFO).length
    };

    return {
      timestamp: startTime,
      totalNodes: stats.nodes,
      totalEdges: stats.edges,
      issues,
      summary,
      isHealthy: summary.errors === 0
    };
  }

  /**
   * Gets diagnostic information (alias for validateGraph).
   *
   * @returns Diagnostic report
   */
  getDiagnostics(): DiagnosticInfo {
    return this.validateGraph();
  }

  /**
   * Finds ALL cycles in the graph (enhancement from Milestone 1.1).
   *
   * Uses iterative DFS to find all unique cycles, not just the first one.
   *
   * @returns Array of all cycles found
   */
  getAllCycles(): CycleInfo[] {
    const cycles: CycleInfo[] = [];
    const visited = new Set<string>();
    const allNodes = this.graph.getAllFiles();

    for (const node of allNodes) {
      // Skip if we've already found this node in a cycle
      if (visited.has(node.path)) continue;

      const cycleInfo = this.cycleDetector.detectCycle(node);

      if (cycleInfo) {
        cycles.push(cycleInfo);
        // Mark all nodes in this cycle as visited
        cycleInfo.cyclePath.forEach(file => visited.add(file.path));
      }
    }

    return cycles;
  }

  /**
   * Finds unresolved parent links.
   *
   * Detects when a file's frontmatter references a parent that doesn't exist
   * in the vault.
   *
   * @returns Array of files with unresolved parent links
   */
  private findUnresolvedLinks(): Array<{ file: TFile; unresolvedParents: string[] }> {
    const unresolved: Array<{ file: TFile; unresolvedParents: string[] }> = [];
    const allNodes = this.graph.getAllFiles();

    for (const file of allNodes) {
      // Get parent links from frontmatter
      const declaredParents = this.graph.extractParentLinksRaw(file);

      // Get actual resolved parents
      const resolvedParents = this.graph.getParents(file);

      // Find parents that were declared but not resolved
      const unresolvedParents = declaredParents.filter(
        declared => !resolvedParents.some(resolved =>
          resolved.path.includes(declared) ||
          resolved.basename === declared ||
          declared.includes(resolved.basename)
        )
      );

      if (unresolvedParents.length > 0) {
        unresolved.push({ file, unresolvedParents });
      }
    }

    return unresolved;
  }

  /**
   * Finds orphaned nodes (no parents, no children).
   *
   * These nodes are isolated and not part of any relationship structure.
   *
   * @returns Array of orphaned files
   */
  private findOrphanedNodes(): TFile[] {
    const orphaned: TFile[] = [];
    const allNodes = this.graph.getAllFiles();

    for (const file of allNodes) {
      const parents = this.graph.getParents(file);
      const children = this.graph.getChildren(file);

      if (parents.length === 0 && children.length === 0) {
        orphaned.push(file);
      }
    }

    return orphaned;
  }

  /**
   * Finds broken bidirectional references.
   *
   * Validates that if A is a parent of B, then B is a child of A (and vice versa).
   *
   * @returns Array of broken references
   */
  private findBrokenReferences(): Array<{
    parent: TFile;
    child: TFile;
    direction: 'parent->child' | 'child->parent';
  }> {
    const broken: Array<{
      parent: TFile;
      child: TFile;
      direction: 'parent->child' | 'child->parent';
    }> = [];

    const allNodes = this.graph.getAllFiles();

    for (const file of allNodes) {
      const parents = this.graph.getParents(file);
      const children = this.graph.getChildren(file);

      // Check each parent relationship
      for (const parent of parents) {
        const parentChildren = this.graph.getChildren(parent);

        // Parent should have this file in its children
        if (!parentChildren.some(child => child.path === file.path)) {
          broken.push({
            parent,
            child: file,
            direction: 'child->parent'
          });
        }
      }

      // Check each child relationship
      for (const child of children) {
        const childParents = this.graph.getParents(child);

        // Child should have this file in its parents
        if (!childParents.some(parent => parent.path === file.path)) {
          broken.push({
            parent: file,
            child,
            direction: 'parent->child'
          });
        }
      }
    }

    return broken;
  }

  /**
   * Gets graph statistics.
   *
   * @returns Statistics about the graph structure
   */
  private getGraphStats(): {
    nodes: number;
    edges: number;
    roots: number;
    leaves: number;
    avgParents: number;
    avgChildren: number;
  } {
    const allNodes = this.graph.getAllFiles();
    let totalEdges = 0;
    let totalParents = 0;
    let totalChildren = 0;
    let roots = 0;
    let leaves = 0;

    for (const file of allNodes) {
      const parents = this.graph.getParents(file);
      const children = this.graph.getChildren(file);

      totalParents += parents.length;
      totalChildren += children.length;
      totalEdges += parents.length; // Each parent link is an edge

      if (parents.length === 0) roots++;
      if (children.length === 0) leaves++;
    }

    const nodeCount = allNodes.length;

    return {
      nodes: nodeCount,
      edges: totalEdges,
      roots,
      leaves,
      avgParents: nodeCount > 0 ? totalParents / nodeCount : 0,
      avgChildren: nodeCount > 0 ? totalChildren / nodeCount : 0
    };
  }
}
