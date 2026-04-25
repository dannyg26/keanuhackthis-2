import type { Medication } from "../types";

export const SAMPLE_MEDICATIONS: Medication[] = [
  {
    id: "lisinopril",
    name: "Lisinopril",
    dosage: "10 mg tablet",
    frequency: "Once daily",
    purpose: "Lowers blood pressure and protects the kidneys.",
    category: "Blood pressure (ACE inhibitor)",
    sideEffects: [
      "Dry cough",
      "Mild dizziness when standing up",
      "Slightly higher potassium levels",
    ],
    callDoctor: [
      "Swelling of lips, tongue, or face",
      "Trouble breathing or swallowing",
      "Persistent dizziness or fainting",
    ],
    schedule: [{ time: "08:00", label: "Morning", withFood: false }],
    refillsLeft: 2,
  },
  {
    id: "metformin",
    name: "Metformin",
    dosage: "500 mg tablet",
    frequency: "Twice daily with meals",
    purpose: "Helps your body use insulin and lowers blood sugar.",
    category: "Type 2 diabetes",
    sideEffects: [
      "Upset stomach or nausea",
      "Mild diarrhea (usually goes away)",
      "Metallic taste",
    ],
    callDoctor: [
      "Severe muscle pain or weakness",
      "Trouble breathing or unusual tiredness",
      "Cold or numb hands and feet",
    ],
    schedule: [
      { time: "08:00", label: "Morning", withFood: true },
      { time: "19:00", label: "Evening", withFood: true },
    ],
    refillsLeft: 1,
  },
  {
    id: "atorvastatin",
    name: "Atorvastatin",
    dosage: "20 mg tablet",
    frequency: "Once daily at bedtime",
    purpose: "Lowers cholesterol and reduces heart disease risk.",
    category: "Cholesterol (statin)",
    sideEffects: [
      "Muscle aches",
      "Mild headache",
      "Occasional digestive upset",
    ],
    callDoctor: [
      "Unexplained muscle pain or weakness",
      "Dark urine",
      "Yellowing of skin or eyes",
    ],
    schedule: [{ time: "21:00", label: "Bedtime", withFood: false }],
    refillsLeft: 3,
  },
  {
    id: "sertraline",
    name: "Sertraline",
    dosage: "50 mg tablet",
    frequency: "Once daily",
    purpose: "Helps balance brain chemicals to ease depression and anxiety.",
    category: "Antidepressant (SSRI)",
    sideEffects: [
      "Trouble sleeping or drowsiness",
      "Reduced appetite",
      "Mild nausea early on",
    ],
    callDoctor: [
      "Thoughts of self-harm",
      "Severe mood changes",
      "Unusual bleeding or bruising",
    ],
    schedule: [{ time: "08:00", label: "Morning", withFood: true }],
    refillsLeft: 4,
  },
];
