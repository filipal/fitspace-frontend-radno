import { morphAttributes, type MorphAttribute } from '../data/morphAttributes'
import type { BasicMeasurements, BodyMeasurements } from '../context/AvatarConfigurationContext'
import { getBackendKeyForMorphId } from '../services/avatarTransformationService'
import { deriveMissingMeasurements } from './deriveMeasurements'

type MeasurementKey = keyof BodyMeasurements

const MEASUREMENT_KEYS = [
  'shoulder',
  'chest',
  'underchest',
  'waist',
  'highHip',
  'lowHip',
  'inseam',
  'highThigh',
  'midThigh',
  'knee',
  'calf',
  'ankle',
  'footLength',
  'footBreadth',
  'bicep',
  'forearm',
  'wrist',
  'shoulderToWrist',
  'handLength',
  'handBreadth',
  'neck',
  'head',
] as const satisfies readonly MeasurementKey[]

const MEASUREMENT_SLOPE: Partial<Record<MeasurementKey, number>> = {
  chest: 0.5,
  underchest: 0.45,
  waist: 0.4,
  highHip: 0.38,
  lowHip: 0.45,
  shoulder: 0.35,
  inseam: 0.5,
  highThigh: 0.35,
  midThigh: 0.32,
  knee: 0.25,
  calf: 0.25,
  ankle: 0.18,
  footLength: 0.2,
  footBreadth: 0.14,
  bicep: 0.3,
  forearm: 0.24,
  wrist: 0.18,
  shoulderToWrist: 0.45,
  handLength: 0.14,
  handBreadth: 0.1,
  neck: 0.24,
  head: 0.18,
}

const KEYWORD_CONFIGS: Array<{ key: MeasurementKey; patterns: RegExp[] }> = [
  { key: 'highHip', patterns: [/high\s+hip/] },
  { key: 'underchest', patterns: [/under\s*chest|under\s*breast|breast\s*under|cleavage/] },
  { key: 'footBreadth', patterns: [/foot\s*breadth|feet\s*width|heel\s*(ball|depth)|foot\s*width/] },
  { key: 'footLength', patterns: [/foot\s*length|foot\s*size|toes\s*length|proportionfootlength|proportiontoeslength/] },
  { key: 'handLength', patterns: [/hand\s*length/] },
  { key: 'handBreadth', patterns: [/hand\s*breadth|hand\s*size/] },
  { key: 'shoulderToWrist', patterns: [/arms?\s*length|shoulder\s*to\s*wrist/] },
  { key: 'shoulder', patterns: [/shoulder/] },
  { key: 'forearm', patterns: [/forearm/] },
  { key: 'wrist', patterns: [/wrist/] },
  { key: 'neck', patterns: [/neck|trapezius/] },
  { key: 'head', patterns: [/head|cranium|forehead/] },
  { key: 'bicep', patterns: [/upper\s*arm|arm\s*muscular|arm\s*flab|armpit/] },
  { key: 'highThigh', patterns: [/upper\s*thigh|thigh\s*length|thigh\s*thickness|thigh\s*depth|thigh\s*size|thigh\s*muscular/] },
  { key: 'midThigh', patterns: [/thigh\s*inner|thigh\s*outer|thigh\s*gap|thigh\s*straight/] },
  { key: 'knee', patterns: [/knee/] },
  { key: 'calf', patterns: [/calf/] },
  { key: 'ankle', patterns: [/ankle/] },
  { key: 'inseam', patterns: [/inseam|leg\s*length|shin\s*length/] },
  { key: 'waist', patterns: [/waist|belly|abdomen|stomach|love\s*handle/] },
  { key: 'lowHip', patterns: [/hip|glute|pelvic/] },
  { key: 'chest', patterns: [/chest|breast|pector|sternum|rib|torso\s*(width|depth)/] },
]

const round1 = (value: number): number => Math.round(value * 10) / 10

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

const getSlope = (key: MeasurementKey): number => {
  return MEASUREMENT_SLOPE[key] ?? 0.3
}

const normalizeMeasurementValue = (value: unknown): number | undefined => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

const normalizeLabel = (label: string): string => {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
}

export function normalizeMeasurementRecord(
  record: Record<string, unknown> | undefined,
): Partial<Record<MeasurementKey, number>> {
  if (!record) return {}
  const out: Partial<Record<MeasurementKey, number>> = {}
  for (const key of MEASUREMENT_KEYS) {
    const value = normalizeMeasurementValue((record as Record<string, unknown>)[key])
    if (value !== undefined) out[key] = value
  }
  return out
}

export function computeBaselineMeasurementsFromBasics(
  basicMeasurements: Partial<BasicMeasurements> | undefined,
): Partial<Record<MeasurementKey, number>> {
  const height = normalizeMeasurementValue(basicMeasurements?.height)
  const weight = normalizeMeasurementValue(basicMeasurements?.weight)
  if (height == null) return {}
  const derived = deriveMissingMeasurements({}, { height, weight })
  return normalizeMeasurementRecord(derived)
}

export function inferMeasurementKeyFromMorph(morph: MorphAttribute): MeasurementKey | null {
  const label = normalizeLabel(morph.labelName)

  for (const entry of KEYWORD_CONFIGS) {
    if (entry.patterns.some(pattern => pattern.test(label))) return entry.key
  }

  switch (morph.category) {
    case 'Chest':
      return 'chest'
    case 'Waist':
      return 'waist'
    case 'Hips':
      return 'lowHip'
    case 'Legs':
      return 'highThigh'
    case 'Arms':
      return 'bicep'
    case 'Hand':
      return 'handBreadth'
    case 'Neck':
      return 'neck'
    case 'Head':
      return 'head'
    case 'Torso':
      return /torso|rib|abdomen|body/.test(label) ? 'chest' : 'waist'
    default:
      return null
  }
}

export function applyMeasurementsToMorphs(
  morphs: MorphAttribute[],
  measurements: Partial<Record<MeasurementKey, number>>,
  baseline: Partial<Record<MeasurementKey, number>>,
): { morphs: MorphAttribute[]; affectedMorphIds: Set<number> } {
  const updated = morphs.map(morph => ({ ...morph }))
  const affected = new Set<number>()

  updated.forEach((morph, index) => {
    const measurementKey = inferMeasurementKeyFromMorph(morph)
    if (!measurementKey) return

    const measurementValue = measurements[measurementKey]
    if (measurementValue == null) return

    const reference = baseline[measurementKey] ?? measurementValue
    if (reference == null) return

    const slope = getSlope(measurementKey)
    if (slope <= 0) return

    const sliderValue = clamp(Math.round(50 + (measurementValue - reference) / slope), 0, 100)
    if (sliderValue === morph.value) return

    updated[index] = { ...morph, value: sliderValue }
    affected.add(morph.morphId)
  })

  return { morphs: updated, affectedMorphIds: affected }
}

export function calculateMeasurementFromMorphs(
  morphs: MorphAttribute[],
  measurementKey: MeasurementKey,
  baselineValue: number | undefined,
  previousValue: number | undefined,
): number | undefined {
  const relevant = morphs.filter(m => inferMeasurementKeyFromMorph(m) === measurementKey)
  if (!relevant.length) return previousValue ?? baselineValue

  const averageSlider = relevant.reduce((sum, morph) => sum + morph.value, 0) / relevant.length
  const slope = getSlope(measurementKey)

  if (baselineValue != null) {
    return round1(baselineValue + (averageSlider - 50) * slope)
  }

  if (previousValue != null) {
    return round1(previousValue + (averageSlider - 50) * slope)
  }

  return undefined
}

export function buildMeasurementMorphTargetMap(
  measurements: Partial<Record<MeasurementKey, number>>,
  baseline: Partial<Record<MeasurementKey, number>>,
): Record<string, number> {
  const baseMorphs = morphAttributes.map(morph => ({ ...morph }))
  const { morphs, affectedMorphIds } = applyMeasurementsToMorphs(baseMorphs, measurements, baseline)

  const result: Record<string, number> = {}
  affectedMorphIds.forEach(morphId => {
    const morph = morphs.find(m => m.morphId === morphId)
    if (!morph) return
    const backendKey = getBackendKeyForMorphId(morphId)
    if (!backendKey) return
    result[backendKey] = clamp(Math.round(morph.value), 0, 100)
  })

  return result
}