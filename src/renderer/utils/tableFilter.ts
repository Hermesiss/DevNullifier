export function matchesPathQuery(path: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return path.toLowerCase().includes(needle);
}

export function matchesCategory(value: string | null | undefined, category: string): boolean {
  const target = category.trim().toLowerCase();
  if (!target) return true;
  if (value == null) return false;
  if (value.trim().toLowerCase() === target) return true;
  return value.split(",").some(part => part.trim().toLowerCase() === target);
}
