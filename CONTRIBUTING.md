# Contributing to Relation Explorer

Thank you for your interest in contributing to the Relation Explorer plugin for Obsidian!

## Development Setup

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- Git
- Obsidian (for manual testing)

### Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/fkloosterman/relations-obsidian.git
   cd relations-obsidian
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Plugin**
   ```bash
   # Build once
   npm run build

   # Build and watch for changes
   npm run dev
   ```

4. **Link to Obsidian**
   ```bash
   # Create symbolic link in your Obsidian vault
   ln -s $(pwd) /path/to/your/vault/.obsidian/plugins/relations-obsidian
   ```

5. **Enable Plugin**
   - Open Obsidian
   - Go to Settings → Community Plugins
   - Reload plugins
   - Enable "Relation Explorer"

## Project Structure

```
relations-obsidian/
├── src/                          # Source code
│   ├── main.ts                   # Plugin entry point
│   ├── relation-graph.ts         # Core graph logic
│   ├── cycle-detector.ts         # Cycle detection
│   ├── relationship-engine.ts    # Relationship computation
│   ├── tree-model.ts             # Tree data structures
│   ├── tree-renderer.ts          # Tree rendering
│   ├── sidebar-view.ts           # Sidebar UI
│   ├── codeblock-processor.ts    # Codeblock rendering
│   ├── commands/                 # Command implementations
│   ├── components/               # UI components
│   └── utils/                    # Utility functions
├── tests/                        # Test suite
│   ├── **/*.test.ts              # Test files
│   └── __fixtures__/             # Test data
├── docs/                         # Documentation
│   ├── implementation-plan.md    # Master plan
│   ├── milestone-*.md            # Milestone plans
│   └── *.md                      # User guides
├── examples/                     # Example vaults
│   └── demo-vault/               # Demo vault
├── styles.css                    # Plugin styles
├── manifest.json                 # Plugin manifest
├── rollup.config.mjs             # Build configuration
└── package.json                  # Dependencies
```

## Development Workflow

### Making Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code following the style guide
   - Add tests for new features
   - Update documentation

3. **Test Your Changes**
   ```bash
   # Run tests
   npm test

   # Run tests in watch mode
   npm run test:watch

   # Run tests with UI
   npm run test:ui
   ```

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

   Then open a Pull Request on GitHub.

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add "Show all cycles" command
fix: resolve cycle detection infinite loop
docs: update CYCLES-GUIDE.md with examples
test: add tests for cousin resolution
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- cycle-detector.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

We use [Vitest](https://vitest.dev/) for testing.

**Test Structure:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyClass } from '@/my-class';

describe('MyClass', () => {
  describe('myMethod()', () => {
    it('should do something specific', () => {
      const instance = new MyClass();
      const result = instance.myMethod();
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      // Test edge case
    });
  });
});
```

**Test Coverage Guidelines:**
- Aim for >80% coverage for core modules
- Test happy path and edge cases
- Test error handling
- Use meaningful test descriptions

## Code Style

### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Document public APIs with JSDoc
- Use meaningful variable names
- Keep functions small and focused

**Example:**
```typescript
/**
 * Detects cycles in the relationship graph.
 *
 * @param startFile - The file to check for cycles
 * @returns Cycle information if found, null otherwise
 *
 * @example
 * ```typescript
 * const cycleInfo = detector.detectCycle(file);
 * if (cycleInfo) {
 *   console.log('Cycle detected:', cycleInfo.description);
 * }
 * ```
 */
detectCycle(startFile: TFile): CycleInfo | null {
  // Implementation
}
```

### File Organization

- One class per file (with related interfaces)
- Group related functionality in subdirectories
- Use index files for clean exports
- Keep files under 500 lines when possible

### Naming Conventions

- **Classes:** PascalCase - `RelationGraph`, `CycleDetector`
- **Interfaces:** PascalCase - `TreeNode`, `CycleInfo`
- **Functions:** camelCase - `detectCycle`, `buildTree`
- **Constants:** UPPER_CASE - `DEFAULT_DEPTH`, `MAX_NODES`
- **Files:** kebab-case - `cycle-detector.ts`, `tree-model.ts`

## Pull Request Guidelines

### Before Submitting

- [ ] Code builds without errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] Code follows style guide

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Documentation

### JSDoc Comments

All public methods should have JSDoc:

```typescript
/**
 * Brief description of what the method does.
 *
 * More detailed explanation if needed.
 * Can span multiple lines.
 *
 * @param paramName - Description of parameter
 * @param optionalParam - Description of optional parameter (optional)
 * @returns Description of return value
 * @throws Description of errors that may be thrown
 *
 * @example
 * ```typescript
 * const result = myMethod('example');
 * console.log(result);
 * ```
 */
```

### README Updates

When adding features:
1. Add to "Features" section
2. Add to "Usage" section with examples
3. Update API reference if public API changes
4. Add screenshots if UI changes

### Milestone Documentation

Each milestone has a detailed implementation plan in `docs/`.
Follow the established format when creating new plans.

## Release Process

1. **Version Bump**
   ```bash
   npm version [major|minor|patch]
   ```

2. **Update CHANGELOG**
   - Document all changes since last release
   - Group by type (Features, Fixes, etc.)

3. **Build Release**
   ```bash
   npm run build
   ```

4. **Tag Release**
   ```bash
   git tag v1.x.x
   git push origin v1.x.x
   ```

5. **GitHub Release**
   - Create GitHub release
   - Upload `main.js`, `manifest.json`, `styles.css`
   - Include changelog in release notes

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/fkloosterman/relations-obsidian/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/fkloosterman/relations-obsidian/issues)
- **Feature Requests**: Open a [GitHub Issue](https://github.com/fkloosterman/relations-obsidian/issues) with "enhancement" label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards other community members

Thank you for contributing! 🎉
