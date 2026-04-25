/**
 * Tiny fetch wrapper for the DoseWise backend.
 * Set VITE_API_URL in .env to point to a different host.
 */

/**
 * API base URL.
 *  1. If VITE_API_URL is set at build time, use it.
 *  2. Otherwise, derive from the page's own host (so phones hitting the LAN IP
 *     reach the API on the same machine instead of their own localhost).
 *  3. Fall back to localhost:3001 (used during SSR / tests).
 */
function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return "";
  return "http://localhost:3001";
}

const BASE = resolveBaseUrl();
const TOKEN_KEY = "dosewise.token";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(BASE + path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
      ? (data as { error: string }).error
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/* ───────── Types matching the server ───────── */

export interface User { id: string; email: string; name: string; createdAt: string; }

export interface ScheduleSlot { time: string; label: string; withFood: boolean; }
export interface Medication {
  id: string; name: string; dosage: string; frequency: string; purpose: string;
  category: string; sideEffects: string[]; callDoctor: string[]; schedule: ScheduleSlot[];
  refillsLeft: number | null; createdAt: string;
}
export type MedicationInput = Omit<Medication, "id" | "createdAt">;

export interface AdherenceLog {
  id: string; medicationId: string; date: string; taken: boolean; createdAt: string;
}

export interface RiskInput {
  medications: string[];
  sleepHours: number;
  alcoholUse: "none" | "occasional" | "regular";
  missedDosesPerWeek: number;
  inconsistentTiming: boolean;
  ageRange: "under-18" | "18-39" | "40-64" | "65+";
  numberOfMedications: number;
}
export interface RiskFactor { label: string; points: number; detail: string; }
export interface RiskResult {
  score: number; level: "Low" | "Moderate" | "High";
  factors: RiskFactor[]; questions: string[];
}
export interface RiskAssessment {
  id: string; input: RiskInput; result: RiskResult; score: number; level: string; createdAt: string;
}

export type BillFlagType = "duplicate" | "high" | "vague" | "facility";
export interface BillFlag { type: BillFlagType; message: string; }
export interface BillItem { id: string; description: string; amount: number; flags: BillFlag[]; explanation: string; }
export interface Bill {
  id: string; rawText: string; items: BillItem[]; total: number; createdAt: string;
}

export type CouponSource = "GoodRx" | "Manufacturer" | "Insurance" | "Local" | "Custom";
export interface Coupon {
  id: string; medication: string; pharmacy: string;
  originalPrice: number; couponPrice: number; expiresOn: string;
  code: string; source: CouponSource; note?: string; saved: boolean; createdAt: string;
}
export type CouponInput = Omit<Coupon, "id" | "createdAt">;

export interface CompanionMessage {
  id: string; role: "user" | "assistant"; content: string; createdAt: string;
}
export interface CompanionContext {
  riskScore?: number | null; riskLevel?: string | null;
  adherencePct?: number | null; streakDays?: number | null;
  medications?: string[];
}

/* ───────── API surface ───────── */

export const api = {
  health: () => request<{ ok: boolean; time: string }>("/api/health"),

  auth: {
    signup: (body: { email: string; password: string; name: string }) =>
      request<{ token: string; user: User }>("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    me: () => request<{ user: User }>("/api/auth/me"),
  },

  medications: {
    list: () => request<{ medications: Medication[] }>("/api/medications"),
    create: (body: MedicationInput) => request<{ medication: Medication }>("/api/medications", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: MedicationInput) => request<{ medication: Medication }>(`/api/medications/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/medications/${id}`, { method: "DELETE" }),
  },

  adherence: {
    list: (range?: { from: string; to: string }) => {
      const qs = range ? `?from=${range.from}&to=${range.to}` : "";
      return request<{ logs: AdherenceLog[] }>(`/api/adherence${qs}`);
    },
    log: (body: { medicationId: string; date: string; taken: boolean }) =>
      request<{ log: AdherenceLog }>("/api/adherence", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/api/adherence/${id}`, { method: "DELETE" }),
    stats: () => request<{ total: number; taken: number; missed: number; adherencePct: number }>("/api/adherence/stats"),
  },

  risk: {
    calculate: (body: RiskInput) => request<{ assessment: RiskAssessment }>("/api/risk/calculate", { method: "POST", body: JSON.stringify(body) }),
    history: () => request<{ assessments: RiskAssessment[] }>("/api/risk/history"),
    latest: () => request<{ assessment: RiskAssessment | null }>("/api/risk/latest"),
  },

  bills: {
    parse: (rawText: string) => request<{ bill: Bill }>("/api/bills/parse", { method: "POST", body: JSON.stringify({ rawText }) }),
    list: () => request<{ bills: Bill[] }>("/api/bills"),
    get: (id: string) => request<{ bill: Bill }>(`/api/bills/${id}`),
    remove: (id: string) => request<void>(`/api/bills/${id}`, { method: "DELETE" }),
  },

  coupons: {
    list: () => request<{ coupons: Coupon[] }>("/api/coupons"),
    create: (body: CouponInput) => request<{ coupon: Coupon }>("/api/coupons", { method: "POST", body: JSON.stringify(body) }),
    toggleSaved: (id: string, saved: boolean) =>
      request<{ coupon: Coupon }>(`/api/coupons/${id}/save`, { method: "PATCH", body: JSON.stringify({ saved }) }),
    remove: (id: string) => request<void>(`/api/coupons/${id}`, { method: "DELETE" }),
  },

  companion: {
    chat: (message: string, context?: CompanionContext) =>
      request<{ reply: string; provider: "claude" | "fallback" }>("/api/companion/chat", {
        method: "POST",
        body: JSON.stringify({ message, context }),
      }),
    history: () => request<{ messages: CompanionMessage[] }>("/api/companion/history"),
    clear: () => request<void>("/api/companion/history", { method: "DELETE" }),
  },
};
