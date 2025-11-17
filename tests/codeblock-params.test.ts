import { describe, it, expect } from 'vitest';
import {
	parseCodeblockParams,
	validateCodeblockParams,
	CodeblockValidationError,
	DEFAULT_PARAMS
} from '../src/codeblock-params';

describe('Codeblock Parameter Parsing', () => {
	describe('parseCodeblockParams()', () => {
		it('should parse valid parameters', () => {
			const source = `
note: [[My Note]]
type: ancestors
depth: 3
mode: tree
`;
			const params = parseCodeblockParams(source);

			expect(params.note).toBe('[[My Note]]');
			expect(params.type).toBe('ancestors');
			expect(params.depth).toBe(3);
			expect(params.mode).toBe('tree');
		});

		it('should apply default values', () => {
			const source = 'type: ancestors';
			const params = parseCodeblockParams(source);

			expect(params.type).toBe('ancestors');
			expect(params.mode).toBe('tree');
			expect(params.showCycles).toBe(true);
			expect(params.collapsed).toBe(false);
		});

		it('should parse all relationship types', () => {
			const types = ['ancestors', 'descendants', 'siblings', 'cousins'];

			for (const type of types) {
				const source = `type: ${type}`;
				const params = parseCodeblockParams(source);
				expect(params.type).toBe(type);
			}
		});

		it('should parse all display modes', () => {
			const modes = ['tree', 'list', 'compact'];

			for (const mode of modes) {
				const source = `
type: ancestors
mode: ${mode}
`;
				const params = parseCodeblockParams(source);
				expect(params.mode).toBe(mode);
			}
		});

		it('should throw error for invalid type', () => {
			const source = 'type: invalid';

			expect(() => parseCodeblockParams(source)).toThrow(CodeblockValidationError);
			expect(() => parseCodeblockParams(source)).toThrow(/Invalid type: "invalid"/);
		});

		it('should throw error for invalid mode', () => {
			const source = `
type: ancestors
mode: invalid-mode
`;

			expect(() => parseCodeblockParams(source)).toThrow(CodeblockValidationError);
			expect(() => parseCodeblockParams(source)).toThrow(/Invalid mode: "invalid-mode"/);
		});

		it('should throw error for invalid depth', () => {
			const source = `
type: ancestors
depth: not-a-number
`;

			expect(() => parseCodeblockParams(source)).toThrow(CodeblockValidationError);
			expect(() => parseCodeblockParams(source)).toThrow(/Invalid depth: "not-a-number"/);
		});

		it('should throw error for negative depth', () => {
			const source = `
type: ancestors
depth: -5
`;

			expect(() => parseCodeblockParams(source)).toThrow(CodeblockValidationError);
			expect(() => parseCodeblockParams(source)).toThrow(/Invalid depth/);
		});

		it('should use default type when type is not specified', () => {
			const source = 'note: [[Test]]';
			const params = parseCodeblockParams(source);

			expect(params.type).toBe('ancestors');
			expect(params.note).toBe('[[Test]]');
		});

		it('should throw error for invalid parameter format', () => {
			const source = `
type: ancestors
invalid-line-without-colon
`;

			expect(() => parseCodeblockParams(source)).toThrow(/Invalid parameter format/);
		});

		it('should throw error for unknown parameter', () => {
			const source = `
type: ancestors
unknownKey: value
`;

			expect(() => parseCodeblockParams(source)).toThrow(/Unknown parameter: "unknownKey"/);
		});

		it('should skip empty lines', () => {
			const source = `
type: ancestors

depth: 2

`;
			const params = parseCodeblockParams(source);

			expect(params.type).toBe('ancestors');
			expect(params.depth).toBe(2);
		});

		it('should skip comment lines', () => {
			const source = `
# This is a comment
type: ancestors
# Another comment
depth: 2
`;
			const params = parseCodeblockParams(source);

			expect(params.type).toBe('ancestors');
			expect(params.depth).toBe(2);
		});

		it('should parse boolean values correctly', () => {
			const source = `
type: ancestors
showCycles: false
collapsed: true
`;
			const params = parseCodeblockParams(source);

			expect(params.showCycles).toBe(false);
			expect(params.collapsed).toBe(true);
		});

		it('should parse note references with wiki-links', () => {
			const source = `
note: [[My Note]]
type: ancestors
`;
			const params = parseCodeblockParams(source);

			expect(params.note).toBe('[[My Note]]');
		});

		it('should parse note references without wiki-links', () => {
			const source = `
note: path/to/note.md
type: ancestors
`;
			const params = parseCodeblockParams(source);

			expect(params.note).toBe('path/to/note.md');
		});

		it('should parse field parameter', () => {
			const source = `
type: ancestors
field: project
`;
			const params = parseCodeblockParams(source);

			expect(params.field).toBe('project');
		});

		it('should handle depth of 0', () => {
			const source = `
type: ancestors
depth: 0
`;
			const params = parseCodeblockParams(source);

			expect(params.depth).toBe(0);
		});

		it('should handle large depth values', () => {
			const source = `
type: ancestors
depth: 50
`;
			const params = parseCodeblockParams(source);

			expect(params.depth).toBe(50);
		});

		it('should preserve note parameter with special characters', () => {
			const source = `
note: [[Note with spaces & special-chars]]
type: ancestors
`;
			const params = parseCodeblockParams(source);

			expect(params.note).toBe('[[Note with spaces & special-chars]]');
		});

		it('should handle all parameters together', () => {
			const source = `
note: [[Test Note]]
type: descendants
depth: 5
mode: compact
field: category
showCycles: false
collapsed: true
`;
			const params = parseCodeblockParams(source);

			expect(params.note).toBe('[[Test Note]]');
			expect(params.type).toBe('descendants');
			expect(params.depth).toBe(5);
			expect(params.mode).toBe('compact');
			expect(params.field).toBe('category');
			expect(params.showCycles).toBe(false);
			expect(params.collapsed).toBe(true);
		});

		it('should trim whitespace from keys and values', () => {
			const source = `
  note  :  [[My Note]]
  type  :  ancestors
`;
			const params = parseCodeblockParams(source);

			expect(params.note).toBe('[[My Note]]');
			expect(params.type).toBe('ancestors');
		});
	});

	describe('validateCodeblockParams()', () => {
		it('should validate field exists', () => {
			const params = {
				type: 'ancestors' as const,
				field: 'nonexistent'
			};

			expect(() => validateCodeblockParams(params, ['parent', 'project']))
				.toThrow(CodeblockValidationError);
			expect(() => validateCodeblockParams(params, ['parent', 'project']))
				.toThrow(/Invalid field: "nonexistent"/);
		});

		it('should allow valid field', () => {
			const params = {
				type: 'ancestors' as const,
				field: 'parent'
			};

			expect(() => validateCodeblockParams(params, ['parent', 'project']))
				.not.toThrow();
		});

		it('should allow undefined field', () => {
			const params = {
				type: 'ancestors' as const
			};

			expect(() => validateCodeblockParams(params, ['parent', 'project']))
				.not.toThrow();
		});

		it('should reject excessive depth', () => {
			const params = {
				type: 'ancestors' as const,
				depth: 150
			};

			expect(() => validateCodeblockParams(params, ['parent']))
				.toThrow(CodeblockValidationError);
			expect(() => validateCodeblockParams(params, ['parent']))
				.toThrow(/Depth too large: 150/);
		});

		it('should allow depth of 100', () => {
			const params = {
				type: 'ancestors' as const,
				depth: 100
			};

			expect(() => validateCodeblockParams(params, ['parent']))
				.not.toThrow();
		});

		it('should allow reasonable depth values', () => {
			const params = {
				type: 'ancestors' as const,
				depth: 50
			};

			expect(() => validateCodeblockParams(params, ['parent']))
				.not.toThrow();
		});

		it('should validate with multiple available fields', () => {
			const params = {
				type: 'ancestors' as const,
				field: 'category'
			};

			expect(() => validateCodeblockParams(params, ['parent', 'project', 'category']))
				.not.toThrow();
		});

		it('should provide helpful error message with available fields', () => {
			const params = {
				type: 'ancestors' as const,
				field: 'invalid'
			};

			expect(() => validateCodeblockParams(params, ['parent', 'project', 'category']))
				.toThrow(/Available fields: parent, project, category/);
		});
	});

	describe('DEFAULT_PARAMS', () => {
		it('should have correct default values', () => {
			expect(DEFAULT_PARAMS.type).toBe('ancestors');
			expect(DEFAULT_PARAMS.mode).toBe('tree');
			expect(DEFAULT_PARAMS.showCycles).toBe(true);
			expect(DEFAULT_PARAMS.collapsed).toBe(false);
		});

		it('should not have note field by default', () => {
			expect(DEFAULT_PARAMS.note).toBeUndefined();
		});

		it('should not have depth field by default', () => {
			expect(DEFAULT_PARAMS.depth).toBeUndefined();
		});

		it('should not have field parameter by default', () => {
			expect(DEFAULT_PARAMS.field).toBeUndefined();
		});
	});

	describe('CodeblockValidationError', () => {
		it('should be an instance of Error', () => {
			const error = new CodeblockValidationError('Test error');
			expect(error).toBeInstanceOf(Error);
		});

		it('should have correct name', () => {
			const error = new CodeblockValidationError('Test error');
			expect(error.name).toBe('CodeblockValidationError');
		});

		it('should store field when provided', () => {
			const error = new CodeblockValidationError('Test error', 'testField');
			expect(error.field).toBe('testField');
		});

		it('should have undefined field when not provided', () => {
			const error = new CodeblockValidationError('Test error');
			expect(error.field).toBeUndefined();
		});

		it('should store message', () => {
			const error = new CodeblockValidationError('Test error message');
			expect(error.message).toBe('Test error message');
		});
	});

	describe('Extended Codeblock Parameters (Milestone 5.2)', () => {
		describe('Filter parameter parsing', () => {
			it('should parse filter-tag parameter', () => {
				const source = `
type: ancestors
filter-tag: #project
`;
				const params = parseCodeblockParams(source);
				expect(params.filterTag).toBe('#project');
			});

			it('should parse filterTag parameter (camelCase)', () => {
				const source = `
type: ancestors
filterTag: #project
`;
				const params = parseCodeblockParams(source);
				expect(params.filterTag).toBe('#project');
			});

			it('should parse filter-folder parameter', () => {
				const source = `
type: ancestors
filter-folder: Projects/
`;
				const params = parseCodeblockParams(source);
				expect(params.filterFolder).toBe('Projects/');
			});

			it('should parse filterFolder parameter (camelCase)', () => {
				const source = `
type: ancestors
filterFolder: Projects/
`;
				const params = parseCodeblockParams(source);
				expect(params.filterFolder).toBe('Projects/');
			});

			it('should parse exclude parameter', () => {
				const source = `
type: ancestors
exclude: [[Note1]], [[Note2]]
`;
				const params = parseCodeblockParams(source);
				expect(params.exclude).toBe('[[Note1]], [[Note2]]');
			});

			it('should parse max-nodes parameter', () => {
				const source = `
type: ancestors
max-nodes: 50
`;
				const params = parseCodeblockParams(source);
				expect(params.maxNodes).toBe(50);
			});

			it('should parse maxNodes parameter (camelCase)', () => {
				const source = `
type: ancestors
maxNodes: 50
`;
				const params = parseCodeblockParams(source);
				expect(params.maxNodes).toBe(50);
			});

			it('should parse style parameter - compact', () => {
				const source = `
type: ancestors
style: compact
`;
				const params = parseCodeblockParams(source);
				expect(params.style).toBe('compact');
			});

			it('should parse style parameter - detailed', () => {
				const source = `
type: ancestors
style: detailed
`;
				const params = parseCodeblockParams(source);
				expect(params.style).toBe('detailed');
			});

			it('should parse style parameter - minimal', () => {
				const source = `
type: ancestors
style: minimal
`;
				const params = parseCodeblockParams(source);
				expect(params.style).toBe('minimal');
			});

			it('should parse title parameter - none', () => {
				const source = `
type: ancestors
title: none
`;
				const params = parseCodeblockParams(source);
				expect(params.title).toBe('none');
			});

			it('should parse title parameter - simple', () => {
				const source = `
type: ancestors
title: simple
`;
				const params = parseCodeblockParams(source);
				expect(params.title).toBe('simple');
			});

			it('should parse title parameter - detailed', () => {
				const source = `
type: ancestors
title: detailed
`;
				const params = parseCodeblockParams(source);
				expect(params.title).toBe('detailed');
			});

			it('should handle camelCase and kebab-case variants', () => {
				const source1 = 'type: ancestors\nfilter-tag: #test';
				const source2 = 'type: ancestors\nfilterTag: #test';

				const params1 = parseCodeblockParams(source1);
				const params2 = parseCodeblockParams(source2);

				expect(params1.filterTag).toBe(params2.filterTag);
			});

			it('should throw error for invalid max-nodes (not a number)', () => {
				const source = `
type: ancestors
max-nodes: not-a-number
`;
				expect(() => parseCodeblockParams(source)).toThrow('Invalid max-nodes');
			});

			it('should throw error for invalid max-nodes (zero)', () => {
				const source = `
type: ancestors
max-nodes: 0
`;
				expect(() => parseCodeblockParams(source)).toThrow('positive number');
			});

			it('should throw error for invalid max-nodes (negative)', () => {
				const source = `
type: ancestors
max-nodes: -5
`;
				expect(() => parseCodeblockParams(source)).toThrow('positive number');
			});

			it('should throw error for invalid style', () => {
				const source = `
type: ancestors
style: invalid
`;
				expect(() => parseCodeblockParams(source)).toThrow('compact, detailed, minimal');
			});

			it('should throw error for invalid title', () => {
				const source = `
type: ancestors
title: invalid
`;
				expect(() => parseCodeblockParams(source)).toThrow('none, simple, detailed');
			});

			it('should combine all filters', () => {
				const source = `
type: ancestors
filter-tag: #project
filter-folder: Projects/
exclude: [[Archived]]
max-nodes: 100
style: detailed
title: simple
`;
				const params = parseCodeblockParams(source);

				expect(params.filterTag).toBe('#project');
				expect(params.filterFolder).toBe('Projects/');
				expect(params.exclude).toBe('[[Archived]]');
				expect(params.maxNodes).toBe(100);
				expect(params.style).toBe('detailed');
				expect(params.title).toBe('simple');
			});

			it('should combine filter params with existing params', () => {
				const source = `
note: [[My Note]]
type: descendants
depth: 3
mode: tree
field: project
filter-tag: #active
max-nodes: 50
style: minimal
`;
				const params = parseCodeblockParams(source);

				expect(params.note).toBe('[[My Note]]');
				expect(params.type).toBe('descendants');
				expect(params.depth).toBe(3);
				expect(params.mode).toBe('tree');
				expect(params.field).toBe('project');
				expect(params.filterTag).toBe('#active');
				expect(params.maxNodes).toBe(50);
				expect(params.style).toBe('minimal');
			});
		});

		describe('Filter validation', () => {
			it('should reject max-nodes > 10000', () => {
				const params = {
					type: 'ancestors' as const,
					maxNodes: 15000
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.toThrow('max-nodes too large');
			});

			it('should allow max-nodes = 10000', () => {
				const params = {
					type: 'ancestors' as const,
					maxNodes: 10000
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});

			it('should allow reasonable max-nodes values', () => {
				const params = {
					type: 'ancestors' as const,
					maxNodes: 100
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});

			it('should reject invalid filter-tag format', () => {
				const params = {
					type: 'ancestors' as const,
					filterTag: '../invalid'
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.toThrow('Invalid filter-tag format');
			});

			it('should allow valid filter-tag with # prefix', () => {
				const params = {
					type: 'ancestors' as const,
					filterTag: '#project'
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});

			it('should allow valid filter-tag without # prefix', () => {
				const params = {
					type: 'ancestors' as const,
					filterTag: 'project'
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});

			it('should allow nested tag format', () => {
				const params = {
					type: 'ancestors' as const,
					filterTag: '#project/active'
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});

			it('should reject path traversal in filter-folder', () => {
				const params = {
					type: 'ancestors' as const,
					filterFolder: '../../../etc'
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.toThrow('Path traversal not allowed');
			});

			it('should allow valid filter-folder', () => {
				const params = {
					type: 'ancestors' as const,
					filterFolder: 'Projects/Active/'
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});

			it('should allow filter-folder at root', () => {
				const params = {
					type: 'ancestors' as const,
					filterFolder: '/'
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});

			it('should validate all new parameters together', () => {
				const params = {
					type: 'ancestors' as const,
					filterTag: '#project',
					filterFolder: 'Projects/',
					exclude: '[[Archive]]',
					maxNodes: 50,
					style: 'detailed' as const
				};

				expect(() => validateCodeblockParams(params, ['parent']))
					.not.toThrow();
			});
		});
	});
});
