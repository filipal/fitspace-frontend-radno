// src/utils/deriveMeasurements.ts
type Num = number | undefined | null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function toNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Popuni prazne body mjere blagim omjerima po visini (i malo po težini).
 * Ne dira postojeće vrijednosti; puni samo praznine.
 */
export function deriveMissingMeasurements(
  input: Record<string, Num>,
  basics: { height?: Num; weight?: Num }
): Record<string, number> {
  const out: Record<string, number> = {};
  // kopiraj postojeće validne
  for (const [k, v] of Object.entries(input)) {
    const n = toNum(v);
    if (typeof n === 'number') out[k] = n;
  }

  const H = toNum(basics.height);
  const W = toNum(basics.weight);
  if (!H) return out; // bez visine ne deriviramo

  const want: Record<string, number> = {
    shoulder: H * 0.235,
    chest: H * 0.51,
    underchest: H * 0.49,
    waist: H * 0.44,
    highHip: H * 0.46,
    lowHip: H * 0.50,
    inseam: H * 0.45,
    highThigh: H * 0.30,
    midThigh: H * 0.265,
    knee: H * 0.185,
    calf: H * 0.167,
    ankle: H * 0.102,
    footLength: H * 0.152,
    footBreadth: H * 0.062,
    bicep: H * 0.165,
    forearm: H * 0.139,
    wrist: H * 0.092,
    shoulderToWrist: H * 0.31,
    handLength: H * 0.108,
    handBreadth: H * 0.047,
    neck: H * 0.175,
  };

  if (W) {
    const bmiAdj = clamp((W / (H / 100) ** 2 - 22) * 0.007, -0.05, 0.07);
    const girths = [
      'chest','underchest','waist','highHip','lowHip',
      'highThigh','midThigh','knee','calf','ankle',
      'bicep','forearm','wrist','neck','footBreadth','handBreadth'
    ];
    for (const k of girths) want[k] = want[k] * (1 + bmiAdj);
  }

  for (const [k, v] of Object.entries(want)) {
    if (out[k] == null) out[k] = Math.round(v * 10) / 10;
  }
  return out;
}
