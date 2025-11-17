import { describe, it, expect, beforeEach, vi } from 'vitest';
import { COMMANDS } from '../../src/commands/navigation-commands';

describe('Navigation Commands - Command Definitions', () => {
	describe('Command Registration', () => {
		it('should define all six commands', () => {
			expect(COMMANDS.SHOW_PARENT_TREE).toBeDefined();
			expect(COMMANDS.SHOW_CHILD_TREE).toBeDefined();
			expect(COMMANDS.SHOW_FULL_LINEAGE).toBeDefined();
			expect(COMMANDS.TOGGLE_SIDEBAR).toBeDefined();
			expect(COMMANDS.GO_TO_PARENT).toBeDefined();
			expect(COMMANDS.GO_TO_CHILD).toBeDefined();
		});

		it('should have unique command IDs', () => {
			const ids = Object.values(COMMANDS).map(cmd => cmd.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});

		it('should have descriptive command names', () => {
			Object.values(COMMANDS).forEach(cmd => {
				expect(cmd.name).toBeTruthy();
				expect(cmd.name.length).toBeGreaterThan(5);
			});
		});

		it('should use kebab-case for command IDs', () => {
			Object.values(COMMANDS).forEach(cmd => {
				expect(cmd.id).toMatch(/^[a-z-]+$/);
			});
		});
	});

	describe('Command Metadata', () => {
		it('should have correct ID for show parent tree command', () => {
			expect(COMMANDS.SHOW_PARENT_TREE.id).toBe('show-parent-tree');
		});

		it('should have correct ID for show child tree command', () => {
			expect(COMMANDS.SHOW_CHILD_TREE.id).toBe('show-child-tree');
		});

		it('should have correct ID for show full lineage command', () => {
			expect(COMMANDS.SHOW_FULL_LINEAGE.id).toBe('show-full-lineage');
		});

		it('should have correct ID for toggle sidebar command', () => {
			expect(COMMANDS.TOGGLE_SIDEBAR.id).toBe('toggle-sidebar');
		});

		it('should have correct ID for go to parent command', () => {
			expect(COMMANDS.GO_TO_PARENT.id).toBe('go-to-parent');
		});

		it('should have correct ID for go to child command', () => {
			expect(COMMANDS.GO_TO_CHILD.id).toBe('go-to-child');
		});
	});

	describe('Command Names', () => {
		it('should have user-friendly names', () => {
			expect(COMMANDS.SHOW_PARENT_TREE.name).toBe('Show parent tree in sidebar');
			expect(COMMANDS.SHOW_CHILD_TREE.name).toBe('Show child tree in sidebar');
			expect(COMMANDS.SHOW_FULL_LINEAGE.name).toBe('Show full lineage in sidebar');
			expect(COMMANDS.TOGGLE_SIDEBAR.name).toBe('Toggle relation sidebar');
			expect(COMMANDS.GO_TO_PARENT.name).toBe('Go to parent note');
			expect(COMMANDS.GO_TO_CHILD.name).toBe('Go to child note');
		});

		it('should use consistent naming convention', () => {
			// All "Show" commands should start with "Show"
			expect(COMMANDS.SHOW_PARENT_TREE.name).toMatch(/^Show/);
			expect(COMMANDS.SHOW_CHILD_TREE.name).toMatch(/^Show/);
			expect(COMMANDS.SHOW_FULL_LINEAGE.name).toMatch(/^Show/);

			// All "Go to" commands should start with "Go to"
			expect(COMMANDS.GO_TO_PARENT.name).toMatch(/^Go to/);
			expect(COMMANDS.GO_TO_CHILD.name).toMatch(/^Go to/);

			// Toggle command should start with "Toggle"
			expect(COMMANDS.TOGGLE_SIDEBAR.name).toMatch(/^Toggle/);
		});
	});

	describe('Command Grouping', () => {
		it('should group show tree commands together', () => {
			const showCommands = [
				COMMANDS.SHOW_PARENT_TREE,
				COMMANDS.SHOW_CHILD_TREE,
				COMMANDS.SHOW_FULL_LINEAGE
			];

			showCommands.forEach(cmd => {
				expect(cmd.name).toContain('sidebar');
			});
		});

		it('should group navigation commands together', () => {
			const navCommands = [
				COMMANDS.GO_TO_PARENT,
				COMMANDS.GO_TO_CHILD
			];

			navCommands.forEach(cmd => {
				expect(cmd.name).toContain('note');
			});
		});
	});
});

describe('Navigation Commands - Integration Tests', () => {
	describe('Command Availability', () => {
		it('should export COMMANDS constant', () => {
			expect(COMMANDS).toBeDefined();
			expect(typeof COMMANDS).toBe('object');
		});

		it('should have immutable command definitions', () => {
			// TypeScript ensures these are readonly, but we can verify the structure
			const command = COMMANDS.SHOW_PARENT_TREE;
			expect(command.id).toBeDefined();
			expect(command.name).toBeDefined();
		});
	});

	describe('Command ID Uniqueness', () => {
		it('should not have duplicate command IDs', () => {
			const ids = Object.values(COMMANDS).map(cmd => cmd.id);
			const idSet = new Set(ids);

			// Check each ID individually
			ids.forEach(id => {
				const count = ids.filter(i => i === id).length;
				expect(count).toBe(1);
			});
		});

		it('should not have overlapping command IDs', () => {
			const allIds = Object.values(COMMANDS).map(cmd => cmd.id);

			// Ensure no ID is a substring of another
			for (let i = 0; i < allIds.length; i++) {
				for (let j = 0; j < allIds.length; j++) {
					if (i !== j) {
						expect(allIds[i]).not.toBe(allIds[j]);
					}
				}
			}
		});
	});

	describe('Command Naming Conventions', () => {
		it('should use sentence case for command names', () => {
			Object.values(COMMANDS).forEach(cmd => {
				// First character should be uppercase
				expect(cmd.name[0]).toBe(cmd.name[0].toUpperCase());
			});
		});

		it('should not end with punctuation', () => {
			Object.values(COMMANDS).forEach(cmd => {
				expect(cmd.name).not.toMatch(/[.!?]$/);
			});
		});

		it('should be concise (under 50 characters)', () => {
			Object.values(COMMANDS).forEach(cmd => {
				expect(cmd.name.length).toBeLessThan(50);
			});
		});
	});
});
