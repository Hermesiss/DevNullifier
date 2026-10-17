export interface ProjectNode<T extends { path: string }> {
  project: T
  children: ProjectNode<T>[]
}

function normalizePath(path: string): string {
  let normalized = path.replace(/\\/g, '/')
  while (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

function isAncestor(ancestorPath: string, descendantPath: string): boolean {
  if (descendantPath.length <= ancestorPath.length) return false
  if (!descendantPath.startsWith(ancestorPath)) return false
  return descendantPath[ancestorPath.length] === '/'
}

function findNearestParentPath(childNorm: string, normalizedPaths: readonly string[]): string | null {
  let best: string | null = null
  let bestLength = -1
  for (const candidate of normalizedPaths) {
    if (candidate === childNorm) continue
    if (!isAncestor(candidate, childNorm)) continue
    if (candidate.length > bestLength) {
      best = candidate
      bestLength = candidate.length
    }
  }
  return best
}

export function nestProjects<T extends { path: string }>(projects: readonly T[]): ProjectNode<T>[] {
  const nodesByPath = new Map<string, ProjectNode<T>>()
  const normalizedPaths: string[] = []

  for (const project of projects) {
    const norm = normalizePath(project.path)
    normalizedPaths.push(norm)
    nodesByPath.set(norm, { project, children: [] })
  }

  const roots: ProjectNode<T>[] = []

  for (const project of projects) {
    const childNorm = normalizePath(project.path)
    const node = nodesByPath.get(childNorm)!
    const parentNorm = findNearestParentPath(childNorm, normalizedPaths)
    if (parentNorm == null) {
      roots.push(node)
    } else {
      nodesByPath.get(parentNorm)!.children.push(node)
    }
  }

  return roots
}

export function countNestedProjects<T extends { path: string }>(node: ProjectNode<T>): number {
  let count = 0
  for (const child of node.children) {
    count += 1 + countNestedProjects(child)
  }
  return count
}
