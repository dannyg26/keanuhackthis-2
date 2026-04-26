import type { RiskFactor, RiskInput, RiskLevel, RiskResult } from "../types";
import { COMMON_INTERACTING_PAIRS, SEDATING_CATEGORIES } from "../data/sampleBill";

const KNOWN_SEDATING = new Set([
  "diphenhydramine", "benadryl",
  "alprazolam", "xanax",
  "lorazepam", "ativan",
  "diazepam", "valium",
  "clonazepam", "klonopin",
  "zolpidem", "ambien",
  "tramadol", "oxycodone", "hydrocodone", "morphine",
  "cyclobenzaprine", "flexeril",
  "amitriptyline", "trazodone",
]);

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function computeRisk(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = [];
  const meds = input.medications.map(normalize).filter(Boolean);

  // Drug interaction check
  const interactions: string[] = [];
  for (const [a, b, note] of COMMON_INTERACTING_PAIRS) {
    if (meds.some(m => m.includes(a)) && meds.some(m => m.includes(b))) {
      interactions.push(`${a} + ${b}: ${note}`);
    }
  }
  if (interactions.length > 0) {
    factors.push({
      label: "Possible drug interaction",
      points: 30,
      detail: interactions.join("; "),
    });
  }

  // Alcohol with sedating med
  const usesAlcohol = input.alcoholUse !== "none";
  const sedatingFound = meds.find(m =>
    [...KNOWN_SEDATING].some(k => m.includes(k)) ||
    SEDATING_CATEGORIES.some(k => m.includes(k))
  );
  if (usesAlcohol && sedatingFound) {
    factors.push({
      label: "Alcohol with sedating medication",
      points: 25,
      detail: `Combining alcohol with ${sedatingFound} can cause excessive drowsiness and slowed breathing.`,
    });
  }

  if (input.sleepHours < 5) {
    factors.push({
      label: "Sleep under 5 hours",
      points: 15,
      detail: "Short sleep weakens the body's recovery and can amplify side effects.",
    });
  }

  if (input.missedDosesPerWeek >= 2) {
    factors.push({
      label: "Frequent missed doses",
      points: 20,
      detail: `Missing ${input.missedDosesPerWeek} doses per week reduces effectiveness and can destabilize chronic conditions.`,
    });
  }

  if (input.inconsistentTiming) {
    factors.push({
      label: "Inconsistent medication timing",
      points: 15,
      detail: "Taking medications at varying times causes uneven blood levels.",
    });
  }

  if (input.ageRange === "65+") {
    factors.push({
      label: "Age 65 or older",
      points: 15,
      detail: "Older adults are more sensitive to side effects and interactions.",
    });
  }

  if (input.numberOfMedications >= 3) {
    factors.push({
      label: "Polypharmacy (3+ medications)",
      points: 10,
      detail: "More medications increase the chance of interactions and side effects.",
    });
  }

  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.min(100, rawScore);
  const level = scoreLevel(score);
  const questions = generateQuestions(input, factors);

  return { score, level, factors, questions };
}

export function scoreLevel(score: number): RiskLevel {
  if (score >= 60) return "High";
  if (score >= 30) return "Moderate";
  return "Low";
}

export function levelColor(level: RiskLevel): { bg: string; text: string; ring: string } {
  switch (level) {
    case "High":
      return { bg: "bg-coral-50", text: "text-coral-600", ring: "ring-coral-400/40" };
    case "Moderate":
      return { bg: "bg-sun-50", text: "text-sun-500", ring: "ring-sun-400/40" };
    case "Low":
      return { bg: "bg-mint-50", text: "text-mint-500", ring: "ring-mint-300/50" };
  }
}

function generateQuestions(input: RiskInput, factors: RiskFactor[]): string[] {
  const q: string[] = [];
  if (factors.some(f => f.label.includes("interaction"))) {
    q.push("Are any of my medications known to interact, and is there a safer alternative?");
  }
  if (factors.some(f => f.label.includes("Alcohol"))) {
    q.push("How much alcohol, if any, is safe while I am taking these medications?");
  }
  if (input.missedDosesPerWeek >= 2) {
    q.push("If I miss a dose, what is the right way to catch up — should I double up or skip it?");
  }
  if (input.inconsistentTiming) {
    q.push("Does the exact time of day matter for these medications, and how strict do I need to be?");
  }
  if (input.ageRange === "65+" || input.numberOfMedications >= 3) {
    q.push("Can we review the full list together to see if any medication can be reduced or stopped?");
  }
  q.push("Are there lifestyle changes that could lower my dependence on any of these medications?");
  return q;
}
