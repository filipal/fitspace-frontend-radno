import type { MorphAttribute } from '../data/morphAttributes'
import type {
  BasicMeasurements,
  BodyMeasurements,
  QuickModeSettings,
} from '../context/AvatarConfigurationContext'

interface MeasurementSources {
  basicMeasurements?: Partial<BasicMeasurements> | null
  bodyMeasurements?: Partial<BodyMeasurements> | null
  quickModeSettings?: QuickModeSettings | null
}

interface MeasurementMorphMapping {
  key: string
  morphId: number
  /** Ratio of the measurement to height that represents ~50% */
  baseHeightRatio?: number
  /** Allowable spread around the base ratio (e.g. 0.25 => ±25%) */
  ratioSpread?: number
  /** Absolute min/max values in centimetres when height isn't available */
  minValue?: number
  maxValue?: number
}

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const measurementAliases: Record<string, string> = {
  bustcircumference: 'chest',
  chestcircumference: 'chest',
  waistscircumference: 'waist',
  waistcircumference: 'waist',
  hipcircumference: 'lowhip',
  lowhipcircumference: 'lowhip',
  highhipcircumference: 'highhip',
  underbust: 'underchest',
}

const mappings: MeasurementMorphMapping[] = [
  { key: 'shoulder', morphId: 34, baseHeightRatio: 0.235, ratioSpread: 0.25 },
  { key: 'chest', morphId: 53, baseHeightRatio: 0.51, ratioSpread: 0.25 },
  { key: 'underchest', morphId: 45, baseHeightRatio: 0.49, ratioSpread: 0.25 },
  { key: 'waist', morphId: 11, baseHeightRatio: 0.44, ratioSpread: 0.35 },
  { key: 'highhip', morphId: 92, baseHeightRatio: 0.46, ratioSpread: 0.25 },
  { key: 'lowhip', morphId: 99, baseHeightRatio: 0.5, ratioSpread: 0.25 },
  { key: 'inseam', morphId: 116, baseHeightRatio: 0.45, ratioSpread: 0.2 },
  { key: 'highthigh', morphId: 136, baseHeightRatio: 0.30, ratioSpread: 0.3 },
  { key: 'midthigh', morphId: 128, baseHeightRatio: 0.265, ratioSpread: 0.3 },
  { key: 'knee', morphId: 121, baseHeightRatio: 0.185, ratioSpread: 0.3 },
  { key: 'calf', morphId: 134, baseHeightRatio: 0.167, ratioSpread: 0.3 },
  { key: 'ankle', morphId: 137, baseHeightRatio: 0.102, ratioSpread: 0.3 },
  { key: 'bicep', morphId: 29, baseHeightRatio: 0.165, ratioSpread: 0.35 },
  { key: 'forearm', morphId: 27, baseHeightRatio: 0.139, ratioSpread: 0.35 },
  { key: 'wrist', morphId: 37, baseHeightRatio: 0.092, ratioSpread: 0.35 },
  { key: 'shouldertowrist', morphId: 24, baseHeightRatio: 0.31, ratioSpread: 0.2 },
  { key: 'handlength', morphId: 33, baseHeightRatio: 0.108, ratioSpread: 0.25 },
  { key: 'handbreadth', morphId: 32, baseHeightRatio: 0.047, ratioSpread: 0.35 },
  { key: 'footlength', morphId: 118, baseHeightRatio: 0.152, ratioSpread: 0.2 },
  { key: 'footbreadth', morphId: 139, baseHeightRatio: 0.062, ratioSpread: 0.3 },
  { key: 'neck', morphId: 108, baseHeightRatio: 0.175, ratioSpread: 0.3 },
]

const normalizeKey = (key: unknown): string | null => {
  if (typeof key !== 'string') return null
  const normalized = key
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]/giu, '')
    .toLowerCase()
  if (!normalized) return null
  return measurementAliases[normalized] ?? normalized
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const collectMeasurements = ({
  basicMeasurements,
  bodyMeasurements,
  quickModeSettings,
}: MeasurementSources) => {
  const map = new Map<string, number>()

  const ingestRecord = (record?: Record<string, unknown> | null) => {
    if (!record) return
    for (const [rawKey, rawValue] of Object.entries(record)) {
      const key = normalizeKey(rawKey)
      if (!key) continue
      if (map.has(key)) continue
      const value = toFiniteNumber(rawValue)
      if (value == null) continue
      map.set(key, value)
    }
  }

  ingestRecord(basicMeasurements as Record<string, unknown> | undefined)
  ingestRecord(bodyMeasurements as Record<string, unknown> | undefined)
  ingestRecord(quickModeSettings?.measurements as Record<string, unknown> | undefined)

  return map
}

export const computePercentFromRatio = (
  value: number,
  height: number | null | undefined,
  baseRatio?: number,
  spread?: number,
  fallback?: { min?: number; max?: number }
): number | null => {
  if (baseRatio && height && height > 0) {
    const ratio = value / height
    const tolerance = spread ?? 0.25
    const minRatio = baseRatio * (1 - tolerance)
    const maxRatio = baseRatio * (1 + tolerance)
    if (maxRatio <= minRatio) return null
    const normalized = (ratio - minRatio) / (maxRatio - minRatio)
    return clamp01(normalized) * 100
  }

  if (fallback?.min != null && fallback.max != null && fallback.max > fallback.min) {
    const normalized = (value - fallback.min) / (fallback.max - fallback.min)
    return clamp01(normalized) * 100
  }

  return null
}

export function applyMeasurementMorphOverrides(
  morphs: MorphAttribute[] | undefined,
  sources: MeasurementSources,
): MorphAttribute[] {
  if (!morphs?.length) return []

  const measurementMap = collectMeasurements(sources)
  if (!measurementMap.size) return morphs.map(m => ({ ...m }))

  const height = measurementMap.get('height') ?? toFiniteNumber(sources.basicMeasurements?.height) ?? null

  const overrides = new Map<number, number>()
  for (const mapping of mappings) {
    const measurementValue = measurementMap.get(mapping.key)
    if (measurementValue == null) continue

    const percent = computePercentFromRatio(
      measurementValue,
      height,
      mapping.baseHeightRatio,
      mapping.ratioSpread,
      mapping.minValue != null && mapping.maxValue != null
        ? { min: mapping.minValue, max: mapping.maxValue }
        : undefined,
    )

    if (percent == null) continue
    overrides.set(mapping.morphId, Math.round(percent))
  }

  if (!overrides.size) return morphs.map(m => ({ ...m }))

  return morphs.map(morph => {
    const override = overrides.get(morph.morphId)
    if (override == null) {
      return { ...morph }
    }

    // Ako je morph već ručno prilagođen (udaljen od neutralnih 50%), ostavi postojeću vrijednost.
    if (Math.abs((morph.value ?? 50) - 50) > 1) {
      return { ...morph }
    }

    return { ...morph, value: override }
  })
}

export type { MeasurementSources }