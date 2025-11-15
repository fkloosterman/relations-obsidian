# Test Suite Documentation

This directory contains the test suite for the Relations Obsidian plugin.

## Structure

```
tests/
├── README.md                    # This file
├── cycle-detector.test.ts       # Cycle detection tests (Milestone 1.1)
└── (future test files...)
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with UI (browser-based interface)
npm run test:ui
```

## Testing Framework

We use [Vitest](https://vitest.dev/) for testing because:
- Fast and modern (uses Vite)
- Excellent TypeScript support
- Great for ESM projects
- Compatible with Obsidian plugin development

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    // Setup code
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Mocking Obsidian API

When testing code that uses Obsidian APIs, we'll need to create mocks:

```typescript
import { vi } from 'vitest';

// Mock TFile
const mockFile = {
  path: 'test.md',
  name: 'test',
  basename: 'test',
  extension: 'md',
} as any;
```

**Note:** Full Obsidian API mocking utilities will be added as needed.

## Test Coverage

To generate coverage reports (requires `@vitest/coverage-v8`):

```bash
npm test -- --coverage
```

Coverage reports will be generated in the `coverage/` directory.

## Best Practices

1. **One assertion per test when possible** - Makes failures easier to debug
2. **Use descriptive test names** - Should read like documentation
3. **Follow AAA pattern** - Arrange, Act, Assert
4. **Test edge cases** - Empty inputs, null values, cycles, etc.
5. **Keep tests isolated** - Each test should be independent
6. **Mock external dependencies** - Test your code, not Obsidian's

## Test Categories

### Unit Tests
- Test individual functions/classes in isolation
- Fast and focused
- Located in `tests/*.test.ts`

### Integration Tests (future)
- Test how components work together
- May use real Obsidian APIs in test environment
- Located in `tests/integration/*.test.ts`

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Obsidian Plugin Development](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)