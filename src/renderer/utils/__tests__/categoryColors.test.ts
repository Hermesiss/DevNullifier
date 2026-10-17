import { describe, it, expect } from 'vitest';
import { getTypeColor } from '../categoryColors';
import type { CacheCategory } from '@/types';

describe('categoryColors', () => {
  describe('getTypeColor', () => {
    it('should return correct color for known categories', () => {
      const testCases: Array<[CacheCategory, string]> = [
        ['Python', '#3D8B6E'],
        ['Node.js / JS / TS', '#C47A2C'],
        ['Rust', '#C46B3A'],
        ['Java / Kotlin / Android', '#B85C5C'],
        ['.NET / C#', '#6B6AAD'],
        ['C/C++', '#4A7BB8'],
        ['Xcode / iOS / macOS', '#4A9BAA'],
        ['Unity', '#5B6B9A'],
        ['Unreal Engine', '#A85A72'],
        ['PHP / Laravel', '#7A5FA8'],
        ['Symfony', '#6B5B95'],
        ['ML / Data Science', '#3D8A8A'],
        ['Docker / DevOps', '#5A6B7A'],
        ['Static Site Generators', '#5A8A5A'],
        ['Testing Tools', '#B89A3D'],
        ['IDEs / Editors', '#7A6A5A']
      ];

      testCases.forEach(([category, expectedColor]) => {
        expect(getTypeColor(category)).toBe(expectedColor);
      });
    });

    it('should return grey for unknown category', () => {
      // Using type assertion since we're intentionally testing with an invalid category
      expect(getTypeColor('Unknown Category' as CacheCategory)).toBe('#73777E');
    });
  });
});
