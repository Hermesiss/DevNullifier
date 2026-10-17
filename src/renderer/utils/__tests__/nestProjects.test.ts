import { describe, it, expect } from 'vitest'
import { nestProjects } from '../nestProjects'

function project(path: string) {
  return { path }
}

describe('nestProjects', () => {
  it('nests two packages under a monorepo root', () => {
    const roots = nestProjects([
      project('C:/repo'),
      project('C:/repo/packages/a'),
      project('C:/repo/packages/b'),
    ])

    expect(roots).toHaveLength(1)
    expect(roots[0].project.path).toBe('C:/repo')
    expect(roots[0].children.map(n => n.project.path)).toEqual([
      'C:/repo/packages/a',
      'C:/repo/packages/b',
    ])
  })

  it('builds three levels: app under packages under repo', () => {
    const roots = nestProjects([
      project('C:/repo'),
      project('C:/repo/packages'),
      project('C:/repo/packages/app'),
    ])

    expect(roots).toHaveLength(1)
    expect(roots[0].children).toHaveLength(1)
    expect(roots[0].children[0].project.path).toBe('C:/repo/packages')
    expect(roots[0].children[0].children).toHaveLength(1)
    expect(roots[0].children[0].children[0].project.path).toBe('C:/repo/packages/app')
  })

  it('does not treat repo as parent of repo2', () => {
    const roots = nestProjects([project('C:/repo'), project('C:/repo2')])

    expect(roots).toHaveLength(2)
    expect(roots.map(n => n.project.path)).toEqual(['C:/repo', 'C:/repo2'])
  })

  it('normalizes backslash paths for nesting', () => {
    const roots = nestProjects([
      project('C:\\repo'),
      project('C:\\repo\\packages\\app'),
    ])

    expect(roots).toHaveLength(1)
    expect(roots[0].children).toHaveLength(1)
    expect(roots[0].children[0].project.path).toBe('C:\\repo\\packages\\app')
  })

  it('does not mutate the input array or project objects', () => {
    const input = [project('C:/repo'), project('C:/repo/pkg')]
    const snapshot = input.map(p => ({ ...p }))
    nestProjects(input)
    expect(input).toEqual(snapshot)
  })
})
