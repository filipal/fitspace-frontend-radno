import type { MorphAttribute } from '../data/morphAttributes'
import type { MeasurementSources } from './morphEstimation'
import { clamp01, collectMeasurements, computePercentFromRatio } from './morphEstimation'

interface MeasurementDescriptor {
  keys: string[]
  baseRatio?: number
  spread?: number
  min?: number
  max?: number
}

interface DeriveMorphOptions {
  gender?: 'male' | 'female' | null
}

interface CategoryMetrics {
  width?: number
  height?: number
  length?: number
  depth?: number
  girth?: number
  mass?: number
  tone?: number
  upper?: number
  lower?: number
  inner?: number
  outer?: number
  front?: number
  back?: number
}

const measurementDescriptors: Record<string, MeasurementDescriptor> = {
  height: { keys: ['height'], min: 150, max: 200 },
  weight: { keys: ['weight'], min: 45, max: 120 },
  shoulder: { keys: ['shoulder'], baseRatio: 0.235, spread: 0.25, min: 35, max: 52 },
  chest: { keys: ['chest'], baseRatio: 0.51, spread: 0.25, min: 75, max: 125 },
  underchest: { keys: ['underchest'], baseRatio: 0.49, spread: 0.25, min: 70, max: 115 },
  waist: { keys: ['waist'], baseRatio: 0.44, spread: 0.35, min: 60, max: 115 },
  highhip: { keys: ['highhip'], baseRatio: 0.46, spread: 0.25, min: 70, max: 120 },
  lowhip: { keys: ['lowhip', 'hip'], baseRatio: 0.5, spread: 0.25, min: 80, max: 125 },
  inseam: { keys: ['inseam'], baseRatio: 0.45, spread: 0.2, min: 65, max: 95 },
  highthigh: { keys: ['highthigh'], baseRatio: 0.3, spread: 0.3, min: 45, max: 75 },
  midthigh: { keys: ['midthigh'], baseRatio: 0.265, spread: 0.3, min: 40, max: 70 },
  knee: { keys: ['knee'], baseRatio: 0.185, spread: 0.3, min: 32, max: 55 },
  calf: { keys: ['calf'], baseRatio: 0.167, spread: 0.3, min: 28, max: 50 },
  ankle: { keys: ['ankle'], baseRatio: 0.102, spread: 0.3, min: 18, max: 30 },
  bicep: { keys: ['bicep'], baseRatio: 0.165, spread: 0.35, min: 25, max: 45 },
  forearm: { keys: ['forearm'], baseRatio: 0.139, spread: 0.35, min: 22, max: 40 },
  wrist: { keys: ['wrist'], baseRatio: 0.092, spread: 0.35, min: 15, max: 25 },
  shouldertowrist: { keys: ['shouldertowrist'], baseRatio: 0.31, spread: 0.2, min: 40, max: 60 },
  handlength: { keys: ['handlength'], baseRatio: 0.108, spread: 0.25, min: 16, max: 23 },
  handbreadth: { keys: ['handbreadth'], baseRatio: 0.047, spread: 0.35, min: 7, max: 11 },
  footlength: { keys: ['footlength'], baseRatio: 0.152, spread: 0.2, min: 21, max: 29 },
  footbreadth: { keys: ['footbreadth'], baseRatio: 0.062, spread: 0.3, min: 8, max: 12 },
  neck: { keys: ['neck'], baseRatio: 0.175, spread: 0.3, min: 28, max: 45 },
  head: { keys: ['head'], baseRatio: 0.145, spread: 0.2, min: 53, max: 62 },
}

const athleticLevelMap: Record<string, number> = {
  low: 0.35,
  medium: 0.5,
  high: 0.7,
}

const normalizeRange = (value: number | null | undefined, min: number, max: number): number | null => {
  if (value == null || !Number.isFinite(value)) return null
  if (max <= min) return null
  return clamp01((value - min) / (max - min))
}

const seededNoise = (seed: number) => {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const resolveBodyShape = (shape?: string | null): number | null => {
  if (!shape) return null
  const match = /shape_(\d)/i.exec(shape)
  if (!match) return null
  const index = Number(match[1])
  if (!Number.isFinite(index) || index < 1) return null
  return clamp01((index - 1) / 4)
}

const resolveAthleticLevel = (level?: string | null): number | null => {
  if (!level) return null
  return athleticLevelMap[level.toLowerCase()] ?? null
}

const getMeasurementValue = (
  key: string,
  map: Map<string, number>,
): number | null => {
  if (!key) return null
  const value = map.get(key)
  return value == null ? null : Number(value)
}

const getNormalizedMeasurement = (
  descriptor: MeasurementDescriptor,
  map: Map<string, number>,
  height: number | null,
): number | null => {
  for (const key of descriptor.keys) {
    const raw = getMeasurementValue(key, map)
    if (raw == null) continue

    const percent = computePercentFromRatio(
      raw,
      height,
      descriptor.baseRatio,
      descriptor.spread,
      descriptor.min != null && descriptor.max != null
        ? { min: descriptor.min, max: descriptor.max }
        : undefined,
    )
    if (percent != null) return percent / 100
  }
  return null
}

const combine = (
  base: number,
  contributions: Array<[number | null | undefined, number]>,
): number => {
  const result = contributions.reduce((acc, [metric, weight]) => {
    if (metric == null) return acc
    return acc + (metric - 0.5) * weight
  }, base)
  return clamp01(result)
}

const keywordAdjust = (
  label: string,
  keywords: string[],
  intensity: number,
  metric: number | null | undefined,
  weight: number,
  options?: { invert?: boolean },
) => {
  if (!metric?.toFixed) return intensity
  const matches = keywords.some(keyword => label.includes(keyword))
  if (!matches) return intensity

  const target = options?.invert ? 1 - metric : metric
  const adjusted = intensity + (target - 0.5) * weight
  return clamp01(adjusted)
}

const directionalAdjust = (
  condition: boolean,
  intensity: number,
  metric: number | null | undefined,
  weight: number,
  options?: { invert?: boolean },
) => {
  if (!condition || metric == null) return intensity
  const target = options?.invert ? 1 - metric : metric
  return clamp01(intensity + (target - 0.5) * weight)
}

export const deriveMorphTargetsFromMeasurements = (
  morphs: MorphAttribute[] | undefined,
  sources: MeasurementSources,
  options?: DeriveMorphOptions,
): MorphAttribute[] => {
  if (!morphs?.length) return []

  const measurementMap = collectMeasurements(sources)
  if (!measurementMap.size) return morphs.map(m => ({ ...m }))

  const height =
    getMeasurementValue('height', measurementMap) ??
    (sources.basicMeasurements?.height ?? null)
  const weight =
    getMeasurementValue('weight', measurementMap) ??
    (sources.basicMeasurements?.weight ?? null)

  const heightNormalized =
    normalizeRange(height, measurementDescriptors.height.min!, measurementDescriptors.height.max!) ?? 0.5
  const weightNormalized =
    normalizeRange(weight, measurementDescriptors.weight.min!, measurementDescriptors.weight.max!) ?? 0.5

  const bmi =
    height && weight
      ? weight / Math.pow(height / 100, 2)
      : null
  const bmiNormalized = bmi != null ? clamp01((bmi - 19) / (32 - 19)) : weightNormalized
  const massNormalized = bmiNormalized
  const leanNormalized = 1 - massNormalized

  const bodyShapeNormalized =
    resolveBodyShape(sources.quickModeSettings?.bodyShape) ??
    normalizeRange((getMeasurementValue('lowhip', measurementMap) ?? 0) - (getMeasurementValue('waist', measurementMap) ?? 0), -10, 25) ??
    massNormalized

  const athleticNormalized =
    resolveAthleticLevel(sources.quickModeSettings?.athleticLevel) ??
    clamp01((leanNormalized * 0.6) + 0.2)

  const normalizedMeasurements: Record<string, number | null> = {}
  for (const [key, descriptor] of Object.entries(measurementDescriptors)) {
    normalizedMeasurements[key] = getNormalizedMeasurement(descriptor, measurementMap, height)
  }

  const chest = normalizedMeasurements.chest ?? 0.5
  const underchest = normalizedMeasurements.underchest ?? chest
  const waist = normalizedMeasurements.waist ?? 0.5
  const hip = normalizedMeasurements.lowhip ?? waist
  const highHip = normalizedMeasurements.highhip ?? hip
  const shoulder = normalizedMeasurements.shoulder ?? chest
  const armGirth = normalizedMeasurements.bicep ?? normalizedMeasurements.forearm ?? normalizedMeasurements.wrist ?? 0.5
  const forearm = normalizedMeasurements.forearm ?? armGirth
  const wrist = normalizedMeasurements.wrist ?? armGirth
  const armLength = normalizedMeasurements.shouldertowrist ?? clamp01(heightNormalized * 0.7 + leanNormalized * 0.1)
  const handLength = normalizedMeasurements.handlength ?? armLength
  const handWidth = normalizedMeasurements.handbreadth ?? handLength
  const legLength = normalizedMeasurements.inseam ?? clamp01(heightNormalized * 0.8)
  const thigh = normalizedMeasurements.highthigh ?? normalizedMeasurements.midthigh ?? hip
  const midThigh = normalizedMeasurements.midthigh ?? thigh
  const knee = normalizedMeasurements.knee ?? midThigh
  const calf = normalizedMeasurements.calf ?? knee
  const ankle = normalizedMeasurements.ankle ?? calf
  const footLength = normalizedMeasurements.footlength ?? legLength
  const footWidth = normalizedMeasurements.footbreadth ?? footLength
  const neck = normalizedMeasurements.neck ?? shoulder
  const head = normalizedMeasurements.head ?? clamp01(0.5 + (0.5 - heightNormalized) * 0.2)

  const torsoWidth = clamp01((chest * 2 + waist + hip) / 4)
  const torsoLength = clamp01(heightNormalized * 0.55 + (1 - legLength) * 0.45)
  const bellyProminence = clamp01((waist * 0.6 + massNormalized * 0.3 + bodyShapeNormalized * 0.2))
  const gluteProminence = clamp01((hip * 0.6 + bodyShapeNormalized * 0.3 + massNormalized * 0.2))
  const upperVsLower = clamp01(0.5 + (chest - hip) * 0.4)
  const innerVsOuter = clamp01(0.5 + (hip - waist) * 0.4)
  const frontVsBack = clamp01(0.5 + (bellyProminence - leanNormalized) * 0.4)

  const categoryBase: Record<string, number> = {
    Waist: combine(0.5, [
      [waist, 0.7],
      [bellyProminence, 0.4],
      [massNormalized, 0.3],
      [athleticNormalized, -0.2],
    ]),
    Hips: combine(0.5, [
      [hip, 0.6],
      [gluteProminence, 0.4],
      [bodyShapeNormalized, 0.3],
      [massNormalized, 0.2],
    ]),
    Arms: combine(0.5, [
      [armGirth, 0.55],
      [athleticNormalized, 0.35],
      [massNormalized, 0.2],
      [armLength, 0.1],
    ]),
    Hand: combine(0.5, [
      [handLength, 0.5],
      [handWidth, 0.4],
      [athleticNormalized, 0.1],
    ]),
    Chest: combine(0.5, [
      [chest, 0.6],
      [underchest, 0.2],
      [massNormalized, 0.25],
      [athleticNormalized, 0.25],
      [bodyShapeNormalized, 0.15],
    ]),
    Neck: combine(0.5, [
      [neck, 0.6],
      [massNormalized, 0.25],
      [athleticNormalized, 0.2],
    ]),
    Head: combine(0.5, [
      [head, 0.7],
      [heightNormalized, 0.2],
      [bodyShapeNormalized, 0.1],
    ]),
    Legs: combine(0.5, [
      [legLength, 0.4],
      [thigh, 0.35],
      [calf, 0.25],
      [massNormalized, 0.2],
      [athleticNormalized, 0.25],
    ]),
    Torso: combine(0.5, [
      [torsoWidth, 0.4],
      [chest, 0.3],
      [waist, 0.2],
      [bodyShapeNormalized, 0.2],
      [massNormalized, 0.2],
    ]),
    Base: combine(0.5, [
      [heightNormalized, 0.3],
      [massNormalized, 0.35],
      [bodyShapeNormalized, 0.25],
      [athleticNormalized, 0.15],
    ]),
  }

  const categoryMetrics: Record<string, CategoryMetrics> = {
    Waist: {
      width: waist,
      depth: bellyProminence,
      girth: waist,
      mass: massNormalized,
      tone: leanNormalized,
      upper: chest,
      lower: hip,
      inner: waist,
      outer: hip,
      front: bellyProminence,
      back: leanNormalized,
      height: torsoLength,
    },
    Hips: {
      width: hip,
      depth: gluteProminence,
      girth: hip,
      mass: massNormalized,
      tone: leanNormalized,
      upper: highHip,
      lower: legLength,
      inner: innerVsOuter,
      outer: hip,
      front: bodyShapeNormalized,
      back: leanNormalized,
      height: legLength,
    },
    Arms: {
      width: armGirth,
      depth: armGirth,
      girth: armGirth,
      mass: massNormalized,
      tone: athleticNormalized,
      upper: armGirth,
      lower: forearm,
      inner: forearm,
      outer: armGirth,
      length: armLength,
      height: armLength,
    },
    Hand: {
      width: handWidth,
      depth: handWidth,
      girth: handWidth,
      mass: massNormalized,
      tone: athleticNormalized,
      length: handLength,
      height: handLength,
    },
    Chest: {
      width: chest,
      depth: chest,
      girth: chest,
      mass: massNormalized,
      tone: athleticNormalized,
      upper: chest,
      lower: underchest,
      inner: chest,
      outer: shoulder,
      front: chest,
      back: underchest,
      height: torsoLength,
    },
    Neck: {
      width: neck,
      girth: neck,
      mass: massNormalized,
      tone: athleticNormalized,
      height: heightNormalized,
    },
    Head: {
      width: head,
      depth: head,
      girth: head,
      mass: massNormalized,
      tone: leanNormalized,
      height: head,
    },
    Legs: {
      width: thigh,
      depth: calf,
      girth: thigh,
      mass: massNormalized,
      tone: athleticNormalized,
      upper: thigh,
      lower: calf,
      inner: innerVsOuter,
      outer: hip,
      front: frontVsBack,
      back: leanNormalized,
      length: legLength,
      height: heightNormalized,
    },
    Torso: {
      width: torsoWidth,
      depth: bellyProminence,
      girth: torsoWidth,
      mass: massNormalized,
      tone: athleticNormalized,
      upper: chest,
      lower: waist,
      inner: waist,
      outer: shoulder,
      front: bellyProminence,
      back: leanNormalized,
      length: torsoLength,
      height: torsoLength,
    },
    Base: {
      width: heightNormalized,
      depth: massNormalized,
      girth: torsoWidth,
      mass: massNormalized,
      tone: athleticNormalized,
      height: heightNormalized,
      length: heightNormalized,
    },
  }

  const genderAdjustment = options?.gender === 'male' ? 0.02 : options?.gender === 'female' ? -0.01 : 0

  return morphs.map(morph => {
    const original = morph.value ?? 50
    if (Math.abs(original - 50) > 1) {
      return { ...morph }
    }

    const category = morph.category
    const baseIntensity = categoryBase[category] ?? 0.5
    const metrics = categoryMetrics[category] ?? {}
    const label = morph.labelName.toLowerCase()

    let intensity = baseIntensity + genderAdjustment

    intensity = keywordAdjust(label, ['width', 'diameter', 'breadth'], intensity, metrics.width ?? metrics.girth, 0.6)
    intensity = keywordAdjust(label, ['thickness'], intensity, metrics.girth ?? metrics.width, 0.55)
    intensity = keywordAdjust(label, ['depth'], intensity, metrics.depth ?? metrics.mass, 0.5)
    intensity = keywordAdjust(label, ['height'], intensity, metrics.height ?? metrics.length ?? heightNormalized, 0.45)
    intensity = keywordAdjust(label, ['length'], intensity, metrics.length ?? heightNormalized, 0.45)
    intensity = keywordAdjust(label, ['size', 'volume'], intensity, metrics.girth ?? metrics.mass, 0.5)
    intensity = keywordAdjust(label, ['shape'], intensity, bodyShapeNormalized, 0.35)
    intensity = keywordAdjust(label, ['angle', 'rotate'], intensity, bodyShapeNormalized, 0.25)
    intensity = keywordAdjust(label, ['move'], intensity, heightNormalized, 0.2)

    intensity = directionalAdjust(label.includes('upper'), intensity, metrics.upper ?? metrics.front ?? categoryBase[category], 0.35)
    intensity = directionalAdjust(label.includes('lower'), intensity, metrics.lower ?? metrics.back ?? categoryBase[category], 0.35)
    intensity = directionalAdjust(label.includes('inner'), intensity, metrics.inner ?? metrics.width ?? categoryBase[category], 0.3)
    intensity = directionalAdjust(label.includes('outer'), intensity, metrics.outer ?? metrics.width ?? categoryBase[category], 0.3)
    intensity = directionalAdjust(label.includes('front'), intensity, metrics.front ?? bellyProminence, 0.35)
    intensity = directionalAdjust(label.includes('back'), intensity, metrics.back ?? leanNormalized, 0.35, { invert: label.includes('back') })
    intensity = directionalAdjust(label.includes('left'), intensity, metrics.outer ?? metrics.width, 0.25)
    intensity = directionalAdjust(label.includes('right'), intensity, metrics.outer ?? metrics.width, 0.25)

    intensity = keywordAdjust(label, ['muscular', 'strength'], intensity, athleticNormalized, 0.65)
    intensity = keywordAdjust(label, ['athletic', 'defined'], intensity, athleticNormalized, 0.5)
    intensity = keywordAdjust(label, ['tone'], intensity, metrics.tone ?? athleticNormalized, 0.4)
    intensity = keywordAdjust(label, ['fat', 'flab', 'heavy'], intensity, massNormalized, 0.6)
    intensity = keywordAdjust(label, ['preg'], intensity, bellyProminence, 0.85)
    intensity = keywordAdjust(label, ['bulge'], intensity, bellyProminence, 0.6)
    intensity = keywordAdjust(label, ['crease', 'fold', 'love'], intensity, bellyProminence, 0.45)
    intensity = keywordAdjust(label, ['sag', 'droop'], intensity, massNormalized, 0.45)
    intensity = keywordAdjust(label, ['perk'], intensity, leanNormalized, 0.4)
    intensity = keywordAdjust(label, ['flat', 'small', 'weak', 'tiny'], intensity, massNormalized, 0.5, { invert: true })
    intensity = keywordAdjust(label, ['big', 'large', 'xl'], intensity, massNormalized, 0.55)
    intensity = keywordAdjust(label, ['natural'], intensity, bodyShapeNormalized, 0.2)
    intensity = keywordAdjust(label, ['implant'], intensity, massNormalized, 0.5)

    const seed =
      morph.morphId * 13 +
      Math.round((massNormalized ?? 0.5) * 100) * 7 +
      Math.round((bodyShapeNormalized ?? 0.5) * 100) * 17
    const noise = seededNoise(seed)
    intensity = clamp01(intensity + (noise - 0.5) * 0.08)

    const sliderValue = Math.round(intensity * 100)
    return { ...morph, value: Math.max(0, Math.min(100, sliderValue)) }
  })
}

export type { DeriveMorphOptions }