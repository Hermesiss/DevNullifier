export interface ScanSnapshotItem {
  path: string
  size?: number
}

export interface ScanComparison {
  added: { path: string; size: number }[]
  grown: { path: string; previousSize: number; size: number }[]
  removed: { path: string; previousSize: number }[]
  freedBytes: number
}

interface PathKey {
  exact: string
  folded: string
  win32: boolean
}

interface IndexedItem {
  item: ScanSnapshotItem
  key: PathKey
  used: boolean
}

function finiteSize(size: number | undefined): number | undefined {
  return typeof size === 'number' && Number.isFinite(size) ? size : undefined
}

function pathKey(path: string): PathKey {
  let exact = path.replace(/\\/g, '/')
  while (exact.length > 1 && exact.endsWith('/')) exact = exact.slice(0, -1)
  const win32 = path.includes('\\') || /^[a-zA-Z]:/.test(exact)
  return { exact, folded: exact.toLowerCase(), win32 }
}

function pushIndex(map: Map<string, IndexedItem[]>, key: string, entry: IndexedItem): void {
  const list = map.get(key)
  if (list) list.push(entry)
  else map.set(key, [entry])
}

function takeMatch(
  key: PathKey,
  byExact: Map<string, IndexedItem[]>,
  byFolded: Map<string, IndexedItem[]>
): IndexedItem | undefined {
  const exact = byExact.get(key.exact)?.find(entry => !entry.used)
  if (exact) {
    exact.used = true
    return exact
  }

  const folded = byFolded.get(key.folded)?.find(entry => !entry.used && (key.win32 || entry.key.win32))
  if (folded) {
    folded.used = true
    return folded
  }
  return undefined
}

export function toScanSnapshot(
  entries: readonly (string | { path?: string; size?: number; totalCacheSize?: number })[]
): ScanSnapshotItem[] {
  const items: ScanSnapshotItem[] = []
  for (const entry of entries) {
    if (typeof entry === 'string') {
      if (entry) items.push({ path: entry })
      continue
    }
    if (!entry || typeof entry.path !== 'string' || !entry.path) continue
    const totalCacheSize = finiteSize(entry.totalCacheSize)
    const size = totalCacheSize !== undefined ? totalCacheSize : finiteSize(entry.size)
    if (size === undefined) items.push({ path: entry.path })
    else items.push({ path: entry.path, size })
  }
  return items
}

export function compareScans(
  previous: readonly ScanSnapshotItem[],
  current: readonly ScanSnapshotItem[]
): ScanComparison {
  const indexed: IndexedItem[] = []
  const byExact = new Map<string, IndexedItem[]>()
  const byFolded = new Map<string, IndexedItem[]>()

  for (const item of previous) {
    const entry: IndexedItem = { item, key: pathKey(item.path), used: false }
    indexed.push(entry)
    pushIndex(byExact, entry.key.exact, entry)
    pushIndex(byFolded, entry.key.folded, entry)
  }

  const added: ScanComparison['added'] = []
  const grown: ScanComparison['grown'] = []
  let freedBytes = 0

  for (const item of current) {
    const match = takeMatch(pathKey(item.path), byExact, byFolded)
    const currentSize = finiteSize(item.size)
    if (!match) {
      added.push({ path: item.path, size: currentSize ?? 0 })
      continue
    }

    const previousSize = finiteSize(match.item.size)
    if (previousSize !== undefined && currentSize !== undefined && currentSize > previousSize) {
      grown.push({ path: item.path, previousSize, size: currentSize })
    }
    const baseline = previousSize ?? 0
    if (currentSize !== undefined && currentSize < baseline) freedBytes += baseline - currentSize
  }

  const removed: ScanComparison['removed'] = []
  for (const entry of indexed) {
    if (entry.used) continue
    const previousSize = finiteSize(entry.item.size) ?? 0
    removed.push({ path: entry.item.path, previousSize })
    freedBytes += previousSize
  }

  return { added, grown, removed, freedBytes }
}
