import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { emptyBundle, mergeCourseReadings, type BundledCourse } from '../src/lib/merge-readings.ts'
import { parseReadingsExport, type ReadingRecord } from '../src/lib/readings.ts'

const exportPath = process.argv[2]
if (!exportPath) {
  console.error('Usage: npm run merge-readings -- <pinfall-readings.json> [public/data]')
  process.exit(1)
}
const outDir = resolve(process.argv[3] ?? 'public/data')
const parsed = parseReadingsExport(readFileSync(exportPath, 'utf8'))
if (!parsed.ok) {
  console.error(parsed.error)
  process.exit(1)
}

const incoming = new Map<string, ReadingRecord[]>()
for (const reading of parsed.data.readings) {
  const list = incoming.get(reading.courseId) ?? []
  list.push(reading)
  incoming.set(reading.courseId, list)
}

mkdirSync(outDir, { recursive: true })
for (const [courseId, readings] of incoming) {
  const file = join(outDir, `${courseId}-pins.json`)
  let existing: BundledCourse = emptyBundle(courseId)
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as BundledCourse
    if (raw && Array.isArray(raw.readings)) existing = { ...emptyBundle(courseId), ...raw, courseId }
  } catch {
    existing = emptyBundle(courseId)
  }
  const merged = mergeCourseReadings(existing.readings, readings)
  if (!merged) {
    console.error(`Could not merge ${courseId}`)
    process.exit(1)
  }
  writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`${file}: ${merged.readings.length} readings, ${merged.pins.length} pins`)
}
