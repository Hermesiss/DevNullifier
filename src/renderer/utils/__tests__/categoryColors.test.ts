import { describe, it, expect } from 'vitest';
import { getTypeColor } from '../categoryColors';
import type { CacheCategory } from '@/types';

describe('categoryColors', () => {
  describe('getTypeColor', () => {
    it('should return correct color for known categories', () => {
      const testCases: Array<[CacheCategory, string]> = [
        ['Python', 'green'],
        ['Node.js / JS / TS', 'orange'],
        ['Rust', 'orange'],
        ['Java / Kotlin / Android', 'red'],
        ['.NET / C#', 'purple'],
        ['C/C++', 'blue'],
        ['Xcode / iOS / macOS', 'cyan'],
        ['Unity', 'indigo'],
        ['Unreal Engine', 'pink'],
        ['PHP / Laravel', 'purple'],
        ['Symfony', 'deep-purple'],
        ['ML / Data Science', 'teal'],
        ['Docker / DevOps', 'blue-grey'],
        ['Static Site Generators', 'light-green'],
        ['Testing Tools', 'amber'],
        ['IDEs / Editors', 'brown']
      ];

      testCases.forEach(([category, expectedColor]) => {
        expect(getTypeColor(category)).toBe(expectedColor);
      });
    });

    it('should return grey for unknown category', () => {
      // Using type assertion since we're intentionally testing with an invalid category
      expect(getTypeColor('Unknown Category' as CacheCategory)).toBe('grey');
    });
  });
}); 