export const REGENERABLE_CATEGORY_IDS = ['nodejs', 'rust', 'python', 'dotnet'] as const
export type CategoryPreset = 'regenerable' | 'aggressive'

const regenerableIds = new Set<string>(REGENERABLE_CATEGORY_IDS)

export function applyCategoryPreset<T extends { id: string; enabled: boolean }>(
  categories: readonly T[],
  preset: CategoryPreset
): T[] {
  if (preset === 'aggressive') {
    return categories.map(cat => ({ ...cat, enabled: true }))
  }
  return categories.map(cat => ({
    ...cat,
    enabled: regenerableIds.has(cat.id)
  }))
}
