import { describe, it, expect } from 'vitest'
import { applyCategoryPreset, REGENERABLE_CATEGORY_IDS } from '../categoryPresets'

type TestCategory = { id: string; enabled: boolean; label?: string }

const sampleCategories: TestCategory[] = [
  { id: 'nodejs', enabled: false, label: 'Node' },
  { id: 'rust', enabled: true, label: 'Rust' },
  { id: 'python', enabled: true, label: 'Python' },
  { id: 'dotnet', enabled: false, label: 'Dotnet' },
  { id: 'java', enabled: true, label: 'Java' },
  { id: 'unity', enabled: false, label: 'Unity' }
]

describe('categoryPresets', () => {
  describe('applyCategoryPreset', () => {
    it('regenerable enables only REGENERABLE_CATEGORY_IDS', () => {
      const result = applyCategoryPreset(sampleCategories, 'regenerable')

      for (const id of REGENERABLE_CATEGORY_IDS) {
        expect(result.find(c => c.id === id)?.enabled).toBe(true)
      }
      expect(result.find(c => c.id === 'java')?.enabled).toBe(false)
      expect(result.find(c => c.id === 'unity')?.enabled).toBe(false)
    })

    it('aggressive enables every category', () => {
      const result = applyCategoryPreset(sampleCategories, 'aggressive')

      expect(result.every(c => c.enabled)).toBe(true)
      expect(result).toHaveLength(sampleCategories.length)
    })

    it('does not mutate the input array or its items', () => {
      const input: TestCategory[] = sampleCategories.map(c => ({ ...c }))
      const snapshot = input.map(c => ({ ...c }))

      applyCategoryPreset(input, 'aggressive')
      expect(input).toEqual(snapshot)

      applyCategoryPreset(input, 'regenerable')
      expect(input).toEqual(snapshot)
    })

    it('returns new objects', () => {
      const input: TestCategory[] = [{ id: 'nodejs', enabled: false }]
      const result = applyCategoryPreset(input, 'regenerable')

      expect(result[0]).not.toBe(input[0])
      expect(result[0].enabled).toBe(true)
      expect(input[0].enabled).toBe(false)
    })
  })
})
