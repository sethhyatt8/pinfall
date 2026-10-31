import rawCsv from './brandywine_holes.csv?raw'
import type { BasketId, CourseSeed, HoleSeed, TeeId, TeeSeed } from '../types.ts'

/**
 * Seeded courses. `center` is only where the map opens.
 * No tee or basket coordinate is included, because none were provided.
 */
export const COURSES: CourseSeed[] = [
  {
    id: 'brandywine',
    name: 'Brandywine Creek State Park',
    shortName: 'Brandywine',
    place: 'Wilmington, DE',
    summary: '18 holes with A and B baskets. Holes 2, 12, and 17 have S and ALT tees. Hole 17 has no B basket.',
    center: { lat: 39.80437, lng: -75.57828 },
    centerNote: 'The map opens on the course area. That spot is not a tee or a basket, and nothing is saved there.',
    holes: parseBrandywineCsv(rawCsv),
    layouts: [{ name: 'Holes', holeNumbers: range(1, 18) }],
  },
  {
    id: 'tamanend',
    name: 'Tamanend Park',
    shortName: 'Tamanend',
    place: 'Southampton, PA',
    summary: '9 holes, all par 3, about 1,785 ft total. Per-hole lengths are blank until you copy them off the signs.',
    // Camera only — approximate first tee, used to find the park. Not stored as a tee pin.
    center: { lat: 40.18016, lng: -75.03501 },
    centerNote: 'The map opens near the approximate first tee so you can find the course. That location is not saved as the tee.',
    totalLengthFt: 1785,
    holes: numberedHoles(9, () => ({
      par: 3,
      lengthFt: null,
      label: (hole) => String(hole),
    })),
    layouts: [{ name: 'Holes', holeNumbers: range(1, 9) }],
  },
  {
    id: 'tyler',
    name: 'Tyler State Park',
    shortName: 'Tyler',
    place: 'Newtown, PA',
    summary: '36 holes: East 1–18, then West 19–36. Pars and lengths are blank — edit each hole from the sign.',
    // Camera only — PDGA lists the upper plantation parking lot here, where both layouts start.
    // Not a tee pin and not a basket pin.
    center: { lat: 40.231118, lng: -74.959122 },
    centerNote:
      'The map opens at the upper plantation parking lot, where East 1 and West 1 start. It is not saved as a tee or basket.',
    holes: numberedHoles(36, () => ({
      par: null,
      lengthFt: null,
      label: (hole) => (hole <= 18 ? `East ${hole}` : `West ${hole - 18}`),
    })),
    layouts: [
      { name: 'East', holeNumbers: range(1, 18) },
      { name: 'West', holeNumbers: range(19, 36) },
    ],
  },
]

export function getCourse(id: string): CourseSeed | undefined {
  return COURSES.find((course) => course.id === id)
}

export function getHole(course: CourseSeed, holeNumber: number): HoleSeed | undefined {
  return course.holes.find((hole) => hole.number === holeNumber)
}

export function parseBrandywineCsv(csv: string): HoleSeed[] {
  const lines = csv.trim().split(/\r?\n/).slice(1)
  const tees = new Map<number, TeeSeed[]>()
  const baskets = new Map<number, BasketId[]>()

  for (const line of lines) {
    if (!line.trim()) continue
    const [holeRaw = '', aFtRaw = '', aParRaw = '', bFtRaw = '', bParRaw = ''] = line.split(',')
    const match = /^(\d+)(?:-(S|ALT))?$/.exec(holeRaw.trim())
    if (!match) throw new Error(`Bad Brandywine hole id: ${holeRaw}`)
    const number = Number(match[1])
    const teeId = (match[2] as TeeId | undefined) ?? 'main'
    const aFt = Number(aFtRaw)
    const aPar = Number(aParRaw)
    if (!Number.isFinite(aFt) || !Number.isFinite(aPar)) {
      throw new Error(`Bad A length or par for hole ${holeRaw}`)
    }
    const tee: TeeSeed = {
      id: teeId,
      label: teeId === 'main' ? 'Tee' : teeId,
      lengthFt: { A: aFt },
      par: { A: aPar },
    }
    const basketList = baskets.get(number) ?? ['A']
    if (!basketList.includes('A')) basketList.push('A')
    const hasB = bFtRaw.trim() !== '' || bParRaw.trim() !== ''
    if (hasB) {
      const bFt = Number(bFtRaw)
      const bPar = Number(bParRaw)
      if (!Number.isFinite(bFt) || !Number.isFinite(bPar)) {
        throw new Error(`Partial B basket for hole ${holeRaw}`)
      }
      tee.lengthFt.B = bFt
      tee.par.B = bPar
      if (!basketList.includes('B')) basketList.push('B')
    }
    baskets.set(number, basketList)
    const teeList = tees.get(number) ?? []
    teeList.push(tee)
    tees.set(number, teeList)
  }

  const holes: HoleSeed[] = []
  for (let number = 1; number <= 18; number += 1) {
    const holeTees = tees.get(number)
    const holeBaskets = baskets.get(number)
    if (!holeTees || !holeBaskets) throw new Error(`Missing Brandywine hole ${number}`)
    holes.push({
      number,
      label: String(number),
      tees: holeTees,
      baskets: holeBaskets,
    })
  }
  return holes
}

function numberedHoles(
  count: number,
  build: () => { par: number | null; lengthFt: number | null; label: (hole: number) => string },
): HoleSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const spec = build()
    return {
      number,
      label: spec.label(number),
      baskets: ['A'],
      tees: [
        {
          id: 'main',
          label: 'Tee',
          lengthFt: { A: spec.lengthFt },
          par: { A: spec.par },
        },
      ],
    }
  })
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}
