export type BodySystem =
  | "head"
  | "heart"
  | "lungs"
  | "liver"
  | "stomach"
  | "skin";

/**
 * Hotspot positions as fractions of the model's bounding box, in [-0.5, 0.5]:
 *   x: left (negative) to right (positive) — viewer's perspective
 *   y: bottom (-0.5) to top (+0.5)
 *   z: back (-0.5) to front (+0.5)
 *
 * These work for any humanoid GLB once it's centered at origin and normalized
 * to a known size. Tweak per-model if proportions differ.
 */
export const HOTSPOT_FRACTIONS: Record<
  BodySystem,
  { x: number; y: number; z: number }
> = {
  head: { x: 0.0, y: 0.42, z: 0.1 }, // top of head — unchanged
  heart: { x: -0.07, y: 0.26, z: 0.18 }, // left chest, nipple line
  lungs: { x: 0.09, y: 0.3, z: 0.18 }, // right upper chest
  liver: { x: 0.13, y: 0.17, z: 0.18 }, // right upper abdomen
  stomach: { x: -0.05, y: 0.12, z: 0.2 }, // left upper abdomen, below ribs
  skin: { x: -0.38, y: 0.2, z: 0.05 }, // upper-left arm (not thigh)
};

export interface BodyRegion {
  id: BodySystem;
  name: string;
  /** Hotspot position in 3D space relative to body center. */
  position: [number, number, number];
  color: string;
  conditions: string[];
  labs: string[];
  symptoms: string[];
  description: string;
}

export type AlertLevel = "info" | "warning" | "danger";

export interface RegionAlert {
  level: AlertLevel;
  title: string;
  detail: string;
  /** Optional medication that triggered this alert. */
  triggeredBy?: string;
}

export const BODY_REGIONS: BodyRegion[] = [
  {
    id: "head",
    name: "Head & Brain",
    position: [0, 2.55, 0.45],
    color: "#a855f7",
    description: "Mental health, sleep, neurological symptoms, and migraines.",
    conditions: ["Migraines", "Anxiety", "Depression", "Insomnia"],
    labs: ["Sleep study", "Thyroid panel", "Vitamin D"],
    symptoms: [
      "Headache",
      "Migraine",
      "Dizziness",
      "Brain fog",
      "Trouble sleeping",
      "Low mood",
      "Anxious feelings",
    ],
  },
  {
    id: "heart",
    name: "Heart & Vessels",
    position: [-0.18, 1.32, 0.55],
    color: "#ec4899",
    description:
      "Cardiovascular system — blood pressure, cholesterol, and circulation.",
    conditions: ["High blood pressure", "High cholesterol", "Arrhythmia"],
    labs: ["Lipid panel", "Blood pressure log", "ECG", "BNP"],
    symptoms: [
      "Chest pain",
      "Palpitations",
      "Shortness of breath",
      "Fatigue",
      "Swelling in ankles",
      "Lightheaded standing up",
    ],
  },
  {
    id: "lungs",
    name: "Lungs & Breathing",
    position: [0.3, 1.48, 0.5],
    color: "#0ea5e9",
    description: "Respiratory system — breathing, allergies, lung capacity.",
    conditions: ["Asthma", "Allergic rhinitis", "COPD"],
    labs: ["Pulmonary function test", "Chest X-ray", "Peak flow"],
    symptoms: [
      "Cough",
      "Wheezing",
      "Shortness of breath",
      "Tight chest",
      "Seasonal allergies",
    ],
  },
  {
    id: "liver",
    name: "Liver & Metabolism",
    position: [0.32, 0.72, 0.55],
    color: "#fbbf24",
    description: "Drug processing, blood sugar control, liver health.",
    conditions: ["Liver function", "Type 2 diabetes", "Statin monitoring"],
    labs: ["ALT / AST", "HbA1c", "Glucose", "Liver panel"],
    symptoms: [
      "Nausea",
      "Unusual fatigue",
      "Yellow skin or eyes",
      "Dark urine",
      "Right-side abdominal pain",
    ],
  },
  {
    id: "stomach",
    name: "Stomach & Digestion",
    position: [0, 0.45, 0.55],
    color: "#22c55e",
    description: "Digestive symptoms — heartburn, nausea, gut health.",
    conditions: ["GERD", "IBS", "Ulcers"],
    labs: ["H. pylori", "Stool test", "Endoscopy"],
    symptoms: [
      "Heartburn",
      "Nausea",
      "Bloating",
      "Abdominal pain",
      "Diarrhea",
      "Constipation",
    ],
  },
  {
    id: "skin",
    name: "Skin & Allergies",
    position: [-0.78, 0.85, 0.4],
    color: "#f59e0b",
    description: "Allergic reactions, rashes, and skin sensitivities.",
    conditions: ["Allergies", "Hives", "Eczema", "Photosensitivity"],
    labs: ["Allergy panel", "IgE test"],
    symptoms: ["Rash", "Hives", "Itching", "Swelling", "Sun sensitivity"],
  },
];

/** Map medication name (lowercased prefix matching) → body systems it affects. */
export const MED_TO_SYSTEMS: Record<string, BodySystem[]> = {
  lisinopril: ["heart"],
  metformin: ["liver", "stomach"],
  atorvastatin: ["heart", "liver"],
  sertraline: ["head", "stomach"],
  warfarin: ["heart"],
  ibuprofen: ["stomach", "liver"],
  diphenhydramine: ["skin", "head"],
  levothyroxine: ["head", "heart"],
  amlodipine: ["heart"],
  omeprazole: ["stomach"],
  prednisone: ["skin", "lungs"],
  albuterol: ["lungs"],
  loratadine: ["skin", "lungs"],
};

export function systemsForMed(name: string): BodySystem[] {
  const key = name.trim().toLowerCase().split(/\s/)[0];
  return MED_TO_SYSTEMS[key] ?? [];
}

/* ───────── Med-specific alerts per body zone ─────────
 * Each entry maps (medication prefix) → which region the alert lives on,
 * plus the alert content. Multiple entries can target the same region.
 */

interface AlertRule {
  medPrefix: string;
  region: BodySystem;
  level: AlertLevel;
  title: string;
  detail: string;
}

const ALERT_RULES: AlertRule[] = [
  // Statins
  {
    medPrefix: "atorvastatin",
    region: "liver",
    level: "warning",
    title: "Liver enzymes worth checking",
    detail:
      "Statins can elevate ALT/AST. Ask for a liver panel at your annual visit.",
  },
  {
    medPrefix: "atorvastatin",
    region: "heart",
    level: "info",
    title: "Lipid panel reminder",
    detail:
      "Recheck cholesterol 6–12 weeks after starting or changing a statin.",
  },

  // ACE inhibitor
  {
    medPrefix: "lisinopril",
    region: "heart",
    level: "info",
    title: "Track blood pressure weekly",
    detail: "Most useful in the first 4 weeks after a dose change.",
  },
  {
    medPrefix: "lisinopril",
    region: "lungs",
    level: "info",
    title: "Watch for dry cough",
    detail:
      "ACE inhibitors can cause a persistent dry cough — flag it to your doctor if it lingers.",
  },

  // Metformin
  {
    medPrefix: "metformin",
    region: "liver",
    level: "warning",
    title: "Lactic acidosis (rare)",
    detail:
      "Stop and call a clinician if you have unusual muscle pain, trouble breathing, or extreme fatigue.",
  },
  {
    medPrefix: "metformin",
    region: "stomach",
    level: "info",
    title: "Take with food",
    detail: "Reduces nausea and diarrhea, especially in the first weeks.",
  },

  // SSRI
  {
    medPrefix: "sertraline",
    region: "head",
    level: "info",
    title: "Allow 4–6 weeks for full effect",
    detail:
      "Mood improvements are gradual. Don't stop abruptly without a taper plan.",
  },
  {
    medPrefix: "sertraline",
    region: "stomach",
    level: "info",
    title: "Mild GI upset is common early",
    detail: "Usually settles in 1–2 weeks. Take with food if needed.",
  },

  // Anticoagulant
  {
    medPrefix: "warfarin",
    region: "heart",
    level: "danger",
    title: "Bleeding risk — interactions matter",
    detail:
      "NSAIDs, alcohol, and vitamin K shifts all change INR. Get regular INR checks.",
  },

  // NSAID
  {
    medPrefix: "ibuprofen",
    region: "stomach",
    level: "warning",
    title: "GI bleeding risk",
    detail:
      "Watch for black stools or dark vomit. Limit daily use; pair with food.",
  },
  {
    medPrefix: "ibuprofen",
    region: "liver",
    level: "info",
    title: "Avoid with chronic alcohol use",
    detail: "Combo can stress the liver — flag it at your next visit.",
  },

  // Antihistamine (sedating)
  {
    medPrefix: "diphenhydramine",
    region: "head",
    level: "warning",
    title: "Drowsiness + cognitive fog",
    detail:
      "Avoid combining with alcohol or driving until you know how it affects you.",
  },

  // Steroid
  {
    medPrefix: "prednisone",
    region: "skin",
    level: "warning",
    title: "Photosensitivity & thinning",
    detail: "Use SPF; report unusual bruising or wound healing changes.",
  },
  {
    medPrefix: "prednisone",
    region: "lungs",
    level: "info",
    title: "Don't stop abruptly",
    detail:
      "Taper as prescribed — sudden discontinuation can trigger adrenal issues.",
  },

  // Bronchodilator
  {
    medPrefix: "albuterol",
    region: "lungs",
    level: "info",
    title: "Rescue use, not control",
    detail: "If you need this >2× per week, ask about a long-term controller.",
  },

  // PPI
  {
    medPrefix: "omeprazole",
    region: "stomach",
    level: "info",
    title: "Long-term use review",
    detail: "Discuss tapering after 8 weeks if symptoms have resolved.",
  },
];

/** Returns alerts for a given region based on the user's current medication list. */
export function alertsForRegion(
  region: BodySystem,
  medications: string[],
): RegionAlert[] {
  const lower = medications.map((m) => m.trim().toLowerCase());
  const out: RegionAlert[] = [];
  for (const rule of ALERT_RULES) {
    if (rule.region !== region) continue;
    const match = lower.find((m) => m.startsWith(rule.medPrefix));
    if (match) {
      out.push({
        level: rule.level,
        title: rule.title,
        detail: rule.detail,
        triggeredBy:
          match.charAt(0).toUpperCase() + match.slice(1).split(/\s/)[0],
      });
    }
  }
  // Sort: danger > warning > info
  const order: Record<AlertLevel, number> = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
