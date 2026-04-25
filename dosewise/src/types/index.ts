export type RiskLevel = "Low" | "Moderate" | "High";

export interface RiskInput {
  medications: string[];
  sleepHours: number;
  alcoholUse: "none" | "occasional" | "regular";
  missedDosesPerWeek: number;
  inconsistentTiming: boolean;
  ageRange: "under-18" | "18-39" | "40-64" | "65+";
  numberOfMedications: number;
}

export interface RiskFactor {
  label: string;
  points: number;
  detail: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  questions: string[];
}

export interface AdherenceLog {
  date: string; // YYYY-MM-DD
  medicationId: string;
  taken: boolean;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  purpose: string;
  category: string;
  sideEffects: string[];
  callDoctor: string[];
  schedule: ScheduleSlot[];
  refillsLeft?: number;
}

export interface ScheduleSlot {
  time: string; // "08:00"
  label: string; // "Morning"
  withFood: boolean;
}

export interface BillItem {
  id: string;
  description: string;
  amount: number;
  flags: BillFlag[];
  explanation: string;
}

export type BillFlagType = "duplicate" | "high" | "vague" | "facility";

export interface BillFlag {
  type: BillFlagType;
  message: string;
}

export type CouponSource = "GoodRx" | "Manufacturer" | "Insurance" | "Local" | "Custom";

export interface Coupon {
  id: string;
  medication: string;
  pharmacy: string;
  originalPrice: number;
  couponPrice: number;
  expiresOn: string; // YYYY-MM-DD
  code: string;
  source: CouponSource;
  note?: string;
  saved?: boolean;
}

export interface PharmacyPrice {
  pharmacy: string;
  distanceMiles: number;
  cashPrice: number;
  withCouponPrice: number;
}
