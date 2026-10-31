import { describe, expect, it } from 'vitest'
import { COURSES, getHole } from './courses.ts'

describe('seeded courses', () => {
  it('loads Brandywine lengths and the S / ALT tees without inventing pins', () => {
    const course = COURSES.find((item) => item.id === 'brandywine')
    expect(course?.holes).toHaveLength(18)
    expect(course?.center).toEqual({ lat: 39.80437, lng: -75.57828 })

    const hole1 = getHole(course!, 1)!
    expect(hole1.tees).toHaveLength(1)
    expect(hole1.tees[0].lengthFt).toEqual({ A: 395, B: 540 })
    expect(hole1.tees[0].par).toEqual({ A: 3, B: 3 })
    expect(hole1.baskets).toEqual(['A', 'B'])

    const hole2 = getHole(course!, 2)!
    expect(hole2.tees.map((tee) => tee.id)).toEqual(['S', 'ALT'])
    expect(hole2.tees[0].lengthFt).toEqual({ A: 245, B: 285 })
    expect(hole2.tees[1].lengthFt).toEqual({ A: 290, B: 310 })

    const hole5 = getHole(course!, 5)!
    expect(hole5.tees[0].par).toEqual({ A: 4, B: 4 })
    expect(hole5.tees[0].lengthFt.A).toBe(666)

    const hole12 = getHole(course!, 12)!
    expect(hole12.tees.map((tee) => tee.id)).toEqual(['S', 'ALT'])
    expect(hole12.tees[1].lengthFt).toEqual({ A: 215, B: 280 })

    const hole17 = getHole(course!, 17)!
    expect(hole17.baskets).toEqual(['A'])
    expect(hole17.tees.map((tee) => tee.id)).toEqual(['S', 'ALT'])
    expect(hole17.tees[0].lengthFt).toEqual({ A: 245 })
    expect(hole17.tees[0].par).toEqual({ A: 3 })
    expect(hole17.tees[1].lengthFt).toEqual({ A: 340 })
    expect(hole17.tees[1].lengthFt.B).toBeUndefined()

    for (const hole of course!.holes) {
      expect(hole).not.toHaveProperty('lat')
      expect(hole).not.toHaveProperty('lng')
      expect(JSON.stringify(hole.tees)).not.toMatch(/"lat"/)
    }
  })

  it('keeps Tamanend as nine par 3s with no per-hole length or pin', () => {
    const course = COURSES.find((item) => item.id === 'tamanend')!
    expect(course.holes).toHaveLength(9)
    expect(course.totalLengthFt).toBe(1785)
    expect(course.center).toEqual({ lat: 40.18016, lng: -75.03501 })
    for (const hole of course.holes) {
      expect(hole.baskets).toEqual(['A'])
      expect(hole.tees[0].par.A).toBe(3)
      expect(hole.tees[0].lengthFt.A).toBeNull()
      expect(hole).not.toHaveProperty('lat')
    }
  })

  it('leaves Tyler pars and lengths empty across East and West', () => {
    const course = COURSES.find((item) => item.id === 'tyler')!
    expect(course.holes).toHaveLength(36)
    expect(course.holes[0].label).toBe('East 1')
    expect(course.holes[17].label).toBe('East 18')
    expect(course.holes[18].label).toBe('West 1')
    expect(course.holes[35].label).toBe('West 18')
    expect(course.layouts.map((layout) => layout.name)).toEqual(['East', 'West'])
    for (const hole of course.holes) {
      expect(hole.tees[0].par.A).toBeNull()
      expect(hole.tees[0].lengthFt.A).toBeNull()
      expect(hole).not.toHaveProperty('lat')
      expect(hole).not.toHaveProperty('lng')
    }
  })
})
