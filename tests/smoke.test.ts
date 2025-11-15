import { describe, it, expect } from 'vitest';

/**
 * Smoke test to verify Vitest setup is working correctly.
 * This test should always pass and confirms that:
 * - Vitest is properly installed
 * - TypeScript configuration is correct
 * - Test discovery is working
 */
describe('Vitest Setup', () => {
  it('should run basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
    expect('hello').toContain('ell');
  });

  it('should handle arrays and objects', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);

    const obj = { name: 'test', value: 42 };
    expect(obj).toHaveProperty('name');
    expect(obj.value).toBe(42);
  });

  it('should support async operations', async () => {
    const promise = Promise.resolve('success');
    await expect(promise).resolves.toBe('success');
  });

  it('should handle TypeScript types', () => {
    interface TestInterface {
      id: number;
      name: string;
    }

    const item: TestInterface = {
      id: 1,
      name: 'Test Item',
    };

    expect(item.id).toBe(1);
    expect(item.name).toBe('Test Item');
  });
});