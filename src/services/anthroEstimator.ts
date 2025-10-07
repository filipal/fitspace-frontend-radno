export type Sex = 'male' | 'female';
export type Athletic = 'low' | 'medium' | 'high';

type Known = {
  height?: number;   // cm
  weight?: number;   // kg (trenutno se ne koristi u formulama, ali ostavljeno za buduće)
  chest?: number;    // cm (female: bust)
  waist?: number;    // cm
  lowHip?: number;   // cm
  underchest?: number; // cm (ako već imaš)
};

type EstimatedKey =
  | 'shoulder' | 'underchest' | 'highHip' | 'inseam'
  | 'highThigh' | 'midThigh' | 'knee' | 'calf' | 'ankle'
  | 'bicep' | 'forearm' | 'wrist'
  | 'shoulderToWrist' | 'handLength' | 'handBreadth'
  | 'footLength' | 'footBreadth' | 'neck' | 'head';

export type EstimatedMeasurements = Partial<Record<EstimatedKey, number>>;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function athleticMuscleDelta(level: Athletic): number {
  if (level === 'low') return -1.0;
  if (level === 'high') return +1.5;
  return 0;
}

/**
 * "Mekoća" iz WHtR (waist/height) – blago širi/sužava mekane volumene.
 * 0.48 ~ sredina; mapiramo na [-1.5cm, +1.5cm]
 */
function softnessDelta(waist?: number, height?: number): number {
  if (!waist || !height) return 0;
  const whtr = waist / height;
  return clamp((whtr - 0.48) * 20, -1.5, 1.5);
}

/**
 * Heuristike za popunjavanje mjera kad fali scan.
 * SVE vrijednosti su u centimetrima.
 */
export function estimateMissingMeasurements(
  sex: Sex,
  known: Known,
  athletic: Athletic = 'medium'
): EstimatedMeasurements {
  const { height, chest, waist, lowHip } = known;
  const muscle = athleticMuscleDelta(athletic);
  const soft = softnessDelta(waist, height);

  const out: Record<string, number> = {};

  // Visina -> linearne mjere/duljine
  if (height != null) {
    out.inseam = (sex === 'male' ? 0.45 : 0.44) * height;
    out.shoulderToWrist = 0.31 * height;
    out.handLength = 0.108 * height;
    out.handBreadth = 0.44 * (out.handLength ?? 0);
    out.footLength = 0.152 * height;
    out.footBreadth = 0.41 * (out.footLength ?? 0);
  }

  // Kukovi i noge
  if (lowHip != null) {
    out.highHip = 0.92 * lowHip + soft; // mekši -> šire
    const highThigh = (sex === 'male' ? 0.60 : 0.58) * lowHip + soft;
    out.highThigh = highThigh;
    out.midThigh = 0.90 * highThigh + soft * 0.5;
    out.knee = 0.70 * (out.midThigh ?? highThigh) + soft * 0.2;
    out.calf = 0.90 * (out.knee ?? 0) + muscle; // mišić utječe
    out.ankle = 0.60 * (out.calf ?? 0) - soft * 0.2;
  }

  // Prsa/rame/ruke
  if (chest != null) {
    out.neck = (sex === 'male' ? 0.34 : 0.31) * chest + muscle * 0.5;
    out.shoulder = (sex === 'male' ? 0.46 : 0.42) * chest + muscle * 0.5; // širina ramena
    const bicep = (sex === 'male' ? 0.32 : 0.29) * chest + muscle;
    out.bicep = bicep;
    out.forearm = 0.85 * bicep + muscle * 0.5;
    out.wrist = 0.65 * (out.forearm ?? 0) - soft * 0.2;
  }

  // Underchest – ako fali, izvedi iz prsnog opsega
  if (known.underchest == null && chest != null) {
    out.underchest = (sex === 'female' ? chest - 7 : chest - 3);
  }

  // Opseg glave – lagana korekcija po visini
  if (height != null) {
    const base = sex === 'male' ? 56 : 54;
    const ref = sex === 'male' ? 170 : 165;
    out.head = base + 0.1 * (height - ref);
  }

  // Zaokruži sve na 1 decimalku
  Object.keys(out).forEach(k => {
    out[k] = round1(out[k]);
  });

  return out as EstimatedMeasurements;
}