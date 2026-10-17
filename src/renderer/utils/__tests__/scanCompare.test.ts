import { describe, expect, it } from 'vitest'
import { compareScans, toScanSnapshot } from '../scanCompare'

describe('compareScans', () => {
  it('lists a path only in the current scan as added', () => {
    const result = compareScans(
      [{ path: '/keep', size: 10 }],
      [{ path: '/keep', size: 10 }, { path: '/new', size: 5 }]
    )

    expect(result.added).toEqual([{ path: '/new', size: 5 }])
    expect(result.grown).toEqual([])
    expect(result.removed).toEqual([])
    expect(result.freedBytes).toBe(0)
  })

  it('lists a path that grew', () => {
    const result = compareScans([{ path: '/a', size: 10 }], [{ path: '/a', size: 25 }])

    expect(result.grown).toEqual([{ path: '/a', previousSize: 10, size: 25 }])
    expect(result.added).toEqual([])
    expect(result.freedBytes).toBe(0)
  })

  it('does not treat a missing previous size as grown', () => {
    const result = compareScans([{ path: '/a' }], [{ path: '/a', size: 25 }])

    expect(result.grown).toEqual([])
    expect(result.freedBytes).toBe(0)
  })

  it('lists a path only in the previous scan as removed', () => {
    const result = compareScans(
      [{ path: '/gone', size: 40 }, { path: '/stay', size: 10 }],
      [{ path: '/stay', size: 10 }]
    )

    expect(result.removed).toEqual([{ path: '/gone', previousSize: 40 }])
    expect(result.freedBytes).toBe(40)
  })

  it('counts a shrink toward freedBytes', () => {
    const result = compareScans(
      [{ path: '/a', size: 100 }, { path: '/gone', size: 15 }],
      [{ path: '/a', size: 40 }]
    )

    expect(result.grown).toEqual([])
    expect(result.removed).toEqual([{ path: '/gone', previousSize: 15 }])
    expect(result.freedBytes).toBe(75)
  })

  it('matches C:/A with c:\\a', () => {
    const previous = [{ path: 'C:/A', size: 10 }]
    const current = [{ path: 'c:\\a', size: 4 }]

    const result = compareScans(previous, current)

    expect(result.added).toEqual([])
    expect(result.removed).toEqual([])
    expect(result.grown).toEqual([])
    expect(result.freedBytes).toBe(6)
    expect(previous).toEqual([{ path: 'C:/A', size: 10 }])
    expect(current).toEqual([{ path: 'c:\\a', size: 4 }])
  })

  it('treats a missing removed size as zero', () => {
    const result = compareScans([{ path: '/gone' }], [])

    expect(result.removed).toEqual([{ path: '/gone', previousSize: 0 }])
    expect(result.freedBytes).toBe(0)
  })
})

describe('toScanSnapshot', () => {
  it('reads path strings and keeps a missing size undefined', () => {
    expect(toScanSnapshot(['C:/Cache', { path: '/a', keyword: 'cache' } as { path: string }])).toEqual([
      { path: 'C:/Cache' },
      { path: '/a' },
    ])
  })

  it('uses totalCacheSize when a project also has size', () => {
    expect(toScanSnapshot([{ path: '/proj', totalCacheSize: 20, size: 5 }])).toEqual([
      { path: '/proj', size: 20 },
    ])
  })
})
