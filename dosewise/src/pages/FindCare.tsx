import { useState, useCallback, useRef, useEffect } from "react";
import PageHeader from "../components/PageHeader";
import {
  MapPinIcon, AlertIcon, CheckIcon, SparklesIcon, NavigationIcon,
  SearchIcon, PillIcon, XIcon, ShieldIcon, HeartPulseIcon, ClockIcon,
} from "../components/Icon";
import { api, type TriageResult, type OTCRecommendation, type PlaceInsight } from "../lib/api";
import InteractiveMap, {
  type Coordinates, type RadarPlace, type HoursStatus, type InteractiveMapHandle,
} from "../components/InteractiveMap";

/* ── Constants ─────────────────────────────────────────────────────── */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const DEFAULT_COORDS: Coordinates = { lng: -74.2632, lat: 40.6976, label: "Select your location" };

type CareType = "urgent_care" | "hospital" | "primary_care" | "pharmacy";
type InsuranceMatch = "in_network" | "likely" | "verify" | "unknown" | "out_of_network";

const CARE_COLORS: Record<CareType, string> = {
  urgent_care: "#0d9488",
  hospital: "#dc2626",
  primary_care: "#2563eb",
  pharmacy: "#7c3aed",
};

const CARE_TYPE_META = {
  hospital:     { label: "Emergency Room",  color: "bg-coral-100 text-coral-700 ring-coral-200",   dot: "bg-coral-500"   },
  urgent_care:  { label: "Urgent Care",     color: "bg-sun-100 text-sun-700 ring-sun-200",           dot: "bg-sun-500"     },
  primary_care: { label: "Primary Care",    color: "bg-sky2-100 text-sky2-700 ring-sky2-200",        dot: "bg-sky2-500"    },
  pharmacy:     { label: "Pharmacy",        color: "bg-mint-100 text-mint-700 ring-mint-200",        dot: "bg-mint-500"    },
};

const URGENCY_META = {
  emergency: { label: "Emergency — Go NOW",    color: "bg-coral-600 text-white" },
  urgent:    { label: "Urgent — Within 1-4 h", color: "bg-sun-500 text-white"  },
  soon:      { label: "Soon — Within 24-48 h", color: "bg-sky2-500 text-white" },
  routine:   { label: "Routine — Schedule",    color: "bg-mint-600 text-white" },
};

const INSURANCE_STYLES: Record<InsuranceMatch, { bg: string; color: string; label: string; dot: string; helper: string }> = {
  in_network:     { bg: "#dcfce7", color: "#15803d", label: "In-network",      dot: "#22c55e", helper: "Your plan is accepted — pay just your normal copay/coinsurance." },
  likely:         { bg: "#dcfce7", color: "#15803d", label: "Likely accepted",  dot: "#22c55e", helper: "Probably accepts your plan, but call to confirm before your visit." },
  verify:         { bg: "#fef3c7", color: "#92400e", label: "Verify with plan", dot: "#f59e0b", helper: "Couldn't confirm coverage — call them or your insurer first." },
  out_of_network: { bg: "#fef2f2", color: "#991b1b", label: "Out-of-network",   dot: "#ef4444", helper: "Your plan probably doesn't cover this — you'd pay much more out of pocket." },
  unknown:        { bg: "#f1f5f9", color: "#475569", label: "Unknown",          dot: "#94a3b8", helper: "Add your insurance plan above to check coverage here." },
};

/* ── Types ─────────────────────────────────────────────────────────── */

interface OpenPeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}
interface OpenHours { periods?: OpenPeriod[]; }
interface SearchBoxFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    name?: string; name_preferred?: string; mapbox_id?: string;
    full_address?: string; place_formatted?: string; address?: string;
    metadata?: { phone?: string; website?: string; open_hours?: OpenHours };
    poi_category?: string[]; poi_category_ids?: string[];
    brand?: string[];
  };
}

/* ── Helper functions ───────────────────────────────────────────────── */

function milesBetween(a: Coordinates, b: { lng: number; lat: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

function radarSearchCategories(careType: CareType): string[] {
  switch (careType) {
    case "hospital": return ["hospital", "emergency_room", "medical_center", "health_services"];
    case "primary_care": return ["doctor", "medical_clinic", "physician", "health_services"];
    case "pharmacy": return ["pharmacy", "drugstore"];
    default: return ["urgent_care_clinic", "urgent_care", "medical_clinic", "health_services", "walk_in_clinic"];
  }
}

function radarForwardQueries(careType: CareType): string[] {
  switch (careType) {
    case "urgent_care": return ["urgent care", "walk-in clinic"];
    case "hospital": return [];
    case "primary_care": return ["primary care doctor"];
    case "pharmacy": return [];
  }
}

function normCat(s: string) { return s.toLowerCase().replace(/[_-]/g, " "); }

function isValidCategoryMatch(careType: CareType, poiCategories: string[] = [], name = ""): boolean {
  const cats = poiCategories.map(normCat);
  const lname = name.toLowerCase();
  // normalize keys too so "urgent_care" matches "urgent care" from API
  const hasCat = (...keys: string[]) => keys.some((k) => cats.some((c) => c.includes(normCat(k))));
  const nameHas = (...keys: string[]) => keys.some((k) => lname.includes(k));
  const nameForbids = (...keys: string[]) => keys.some((k) => lname.includes(k));
  switch (careType) {
    case "hospital":
      if (nameForbids("farmers market", "supermarket", "grocery", "dental", "veterinary", "animal")) return false;
      return hasCat("hospital", "emergency room", "emergency_room", "medical center", "medical_center", "health services")
        || nameHas("hospital", "medical center", "health system", "er ", " er", "emergency");
    case "pharmacy":
      if (nameForbids("hospital")) return false;
      return hasCat("pharmacy", "drugstore") || nameHas("pharmacy", "drugstore", "drug store", "cvs", "walgreens", "rite aid", "duane reade");
    case "primary_care":
      if (nameForbids("hospital", "pharmacy", "dental", "veterinary", "animal", "farmers market", "supermarket")) return false;
      if (hasCat("doctor", "physician", "medical clinic", "medical_clinic", "family practice", "family_practice", "health services", "health_services")) return true;
      return nameHas("doctor", "physician", "family medicine", "family practice", "primary care", "internal medicine", "pediatric", "medical group", "medical associates");
    case "urgent_care":
      if (nameForbids("dental", "veterinary", "animal", "farmers market", "supermarket", "grocery", "spa", "gym", "salon")) return false;
      if (nameHas("urgent care", "walk-in", "walk in", "citymd", "medexpress", "patient first", "fastmed", "minuteclinic", "concentra", "immediate care", "express care", "rapid care", "after hours", "quickcare", "gohealth")) return true;
      if (hasCat("urgent care", "urgent_care", "walk in", "walk_in")) return true;
      if (hasCat("medical clinic", "medical_clinic", "health services", "health_services", "clinic")) return true;
      return false;
  }
}

function parseHHMM(t: string): { h: number; m: number } | null {
  if (!t || t.length < 3) return null;
  const padded = t.length === 3 ? `0${t}` : t;
  const h = parseInt(padded.slice(0, 2), 10), m = parseInt(padded.slice(2, 4), 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

function fmtTime12(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function computeHoursStatus(hours?: OpenHours, type = ""): HoursStatus {
  if (!hours?.periods?.length) {
    if (/hospital|er|emergency/i.test(type)) return { isOpen: true, label: "Open 24/7", detail: "Always open" };
    return { isOpen: null, label: "Hours unavailable", detail: "Call to confirm" };
  }
  const now = new Date(), today = now.getDay(), minsNow = now.getHours() * 60 + now.getMinutes();
  if (hours.periods.length === 1 && hours.periods[0].open?.time === "0000" && !hours.periods[0].close) {
    return { isOpen: true, label: "Open 24/7", detail: "Always open" };
  }
  for (const period of hours.periods) {
    if (!period.open) continue;
    const open = parseHHMM(period.open.time);
    if (!open) continue;
    const closeDay = period.close?.day ?? period.open.day;
    const close = period.close ? parseHHMM(period.close.time) : null;
    const openMins = open.h * 60 + open.m, closeMins = close ? close.h * 60 + close.m : 24 * 60;
    if (period.open.day === today) {
      if (closeDay === today) {
        if (minsNow >= openMins && minsNow < closeMins)
          return { isOpen: true, label: "Open now", detail: `Closes ${fmtTime12(close!.h, close!.m)}` };
        if (minsNow < openMins)
          return { isOpen: false, label: "Closed", detail: `Opens ${fmtTime12(open.h, open.m)}` };
      } else if (minsNow >= openMins) {
        return { isOpen: true, label: "Open now", detail: close ? `Closes ${fmtTime12(close.h, close.m)} tomorrow` : "Closes tomorrow" };
      }
    }
    if (period.open.day === (today - 1 + 7) % 7 && closeDay === today && close && minsNow < closeMins) {
      return { isOpen: true, label: "Open now", detail: `Closes ${fmtTime12(close.h, close.m)}` };
    }
  }
  let nextOpen: { day: number; h: number; m: number } | null = null;
  for (let offset = 0; offset < 7; offset++) {
    const checkDay = (today + offset) % 7;
    for (const period of hours.periods) {
      if (period.open?.day !== checkDay) continue;
      const open = parseHHMM(period.open.time);
      if (!open) continue;
      if (offset === 0 && open.h * 60 + open.m <= minsNow) continue;
      nextOpen = { day: checkDay, h: open.h, m: open.m };
      break;
    }
    if (nextOpen) break;
  }
  if (nextOpen) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayLabel = nextOpen.day === today ? "today" : nextOpen.day === (today + 1) % 7 ? "tomorrow" : days[nextOpen.day];
    return { isOpen: false, label: "Closed", detail: `Opens ${fmtTime12(nextOpen.h, nextOpen.m)} ${dayLabel}` };
  }
  return { isOpen: null, label: "Check hours", detail: "Call to confirm" };
}

function detectBrand(name: string): string | undefined {
  const n = name.toLowerCase();
  const brands: Record<string, string> = {
    citymd: "CityMD", medexpress: "MedExpress", minuteclinic: "MinuteClinic",
    "patient first": "Patient First", concentra: "Concentra", fastmed: "FastMed",
    cvs: "CVS", walgreens: "Walgreens", "rite aid": "Rite Aid",
    "duane reade": "Duane Reade", kaiser: "Kaiser", "one medical": "One Medical",
  };
  for (const key in brands) { if (n.includes(key)) return brands[key]; }
  return undefined;
}

function placeFromSearchBox(careType: CareType, feature: SearchBoxFeature, coords: Coordinates, index: number): RadarPlace | null {
  const [lng, lat] = feature.geometry.coordinates || [];
  if (lng == null || lat == null) return null;
  const miles = milesBetween(coords, { lng, lat });
  const drive = Math.max(4, Math.round(miles * 5 + 4));
  const score = Math.max(52, Math.round(98 - miles * 8 - index * 2));
  const name = feature.properties.name_preferred || feature.properties.name || "Nearby location";
  const address = feature.properties.full_address || feature.properties.place_formatted || feature.properties.address;
  const phone = feature.properties.metadata?.phone || "";
  const hours = feature.properties.metadata?.open_hours;
  const brand = detectBrand(name) || feature.properties.brand?.[0];
  const base = { name, address, phone, lng, lat, miles, distance: `${miles.toFixed(1)} mi`, hours, brand, source: "live" as const };
  if (careType === "pharmacy") {
    const prices = ["Est. $12 with discount", "Est. $18 with discount", "Est. $9 generic", "Est. $24 cash"];
    const hoursStatus = computeHoursStatus(hours, "pharmacy");
    return { id: feature.properties.mapbox_id || `pharm-${index}`, ...base, type: "Pharmacy", time: `${drive} min drive`, price: prices[index % prices.length], status: hoursStatus.label, note: "Call to confirm stock and price before pickup.", score, hoursStatus };
  }
  if (careType === "hospital") {
    const hoursStatus = computeHoursStatus(hours, "hospital");
    return { id: feature.properties.mapbox_id || `hosp-${index}`, ...base, type: "Hospital / ER", time: `${Math.round(35 + miles * 4)} min est.`, price: "Highest cost", status: hoursStatus.label, note: "Use for serious or life-threatening symptoms.", score: Math.max(50, score - 5), hoursStatus };
  }
  if (careType === "primary_care") {
    const hoursStatus = computeHoursStatus(hours, "primary care");
    return { id: feature.properties.mapbox_id || `pc-${index}`, ...base, type: "Primary Care", time: "Schedule needed", price: "Lowest cost", status: hoursStatus.label, note: "Best for ongoing issues, refills, follow-ups, and non-urgent concerns.", score, hoursStatus };
  }
  const hoursStatus = computeHoursStatus(hours, "urgent care");
  return { id: feature.properties.mapbox_id || `uc-${index}`, ...base, type: "Urgent Care", time: `${Math.round(14 + miles * 3)} min wait`, price: "Lower cost", status: hoursStatus.label, note: "Good for non-emergency symptoms, minor injuries, infections, or quick evaluation.", score, hoursStatus };
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function MatchDots({ score, color = "#0d9488" }: { score: number; color?: string }) {
  const filled = Math.max(1, Math.min(5, Math.round(score / 20)));
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${filled} of 5 match`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: n <= filled ? color : "#e2e8f0", transition: "background 0.2s" }} />
      ))}
    </div>
  );
}

function HoursPill({ status, compact = false }: { status?: HoursStatus; compact?: boolean }) {
  if (!status) return null;
  const isOpen = status.isOpen === true, isClosed = status.isOpen === false;
  const bg = isOpen ? "#dcfce7" : isClosed ? "#fef2f2" : "#f1f5f9";
  const color = isOpen ? "#15803d" : isClosed ? "#dc2626" : "#64748b";
  const dotColor = isOpen ? "#22c55e" : isClosed ? "#ef4444" : "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ fontSize: compact ? 11 : 12, background: bg, color, padding: compact ? "3px 8px" : "4px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      <span>{status.label}</span>
      {!compact && status.detail && (
        <><span style={{ opacity: 0.4 }}>·</span><span style={{ fontWeight: 500 }}>{status.detail}</span></>
      )}
    </span>
  );
}

function InsuranceBadge({ match, compact = false }: { match?: string; compact?: boolean }) {
  if (!match || match === "unknown") return null;
  const cfg = INSURANCE_STYLES[match as InsuranceMatch] ?? INSURANCE_STYLES.unknown;
  return (
    <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap" title={cfg.helper}
      style={{ fontSize: compact ? 10 : 11, background: cfg.bg, color: cfg.color, padding: compact ? "3px 7px" : "4px 9px", borderRadius: 99 }}>
      <svg width={compact ? 9 : 10} height={compact ? 9 : 10} viewBox="0 0 24 24" fill={cfg.dot}>
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
      </svg>
      {cfg.label}
    </span>
  );
}

function InsuranceChip({ insurance, editing, draft, setDraft, onStartEdit, onSave, onCancel, onClear }: {
  insurance: string; editing: boolean; draft: string;
  setDraft: (v: string) => void; onStartEdit: () => void;
  onSave: () => void; onCancel: () => void; onClear: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          placeholder="e.g. Aetna PPO" className="input text-sm"
          style={{ minWidth: 140, flex: "0 1 auto" }} />
        <button type="button" onClick={onSave} className="btn-primary px-3 py-1.5 text-xs">Save</button>
        <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
      </div>
    );
  }
  if (!insurance) {
    return (
      <button type="button" onClick={onStartEdit}
        className="inline-flex items-center gap-1.5 font-semibold text-xs px-3 py-1.5 rounded-full bg-sky2-50 text-sky2-700 border border-dashed border-sky2-300 hover:bg-sky2-100 transition">
        <ShieldIcon className="w-3.5 h-3.5" /> Add insurance plan
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-sky2-100 border border-sky2-300 pl-2.5 pr-1 py-1">
      <ShieldIcon className="w-3 h-3 text-sky2-600" />
      <button type="button" onClick={onStartEdit} className="text-xs font-semibold text-sky2-800 px-1 hover:underline">{insurance}</button>
      <button type="button" onClick={onClear} className="text-sky2-500 hover:text-sky2-700 p-0.5" aria-label="Remove insurance">
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

function PlaceCard({ place, index, careColor, isSelected, onClick, insight }: {
  place: RadarPlace; index: number; careColor: string;
  isSelected: boolean; onClick: () => void; insight?: PlaceInsight;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left transition-all active:scale-[0.99]"
      style={{ borderRadius: 16, padding: "14px 16px",
        background: isSelected ? "#f0fdfa" : "#fff",
        border: isSelected ? `2px solid ${careColor}` : "1px solid #e2e8f0",
        boxShadow: isSelected ? `0 6px 18px ${careColor}24` : "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl flex items-center justify-center font-bold shrink-0"
          style={{ width: 36, height: 36, fontSize: 14,
            background: isSelected ? careColor : "#f1f5f9",
            color: isSelected ? "#fff" : "#64748b",
            boxShadow: isSelected ? `0 4px 10px ${careColor}40` : "none" }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 truncate" style={{ fontSize: 14, lineHeight: 1.3 }}>{place.name}</p>
            {place.brand && (
              <span className="font-bold shrink-0 text-slate-500"
                style={{ fontSize: 9, letterSpacing: "0.05em", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                {place.brand}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <HoursPill status={place.hoursStatus} compact />
            <InsuranceBadge match={insight?.insurance_match} compact />
            <span className="text-slate-500 font-medium" style={{ fontSize: 12 }}>{place.distance}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500" style={{ fontSize: 12 }}>{place.time}</span>
          </div>
          {(insight?.cost_estimate || insight?.wait_estimate) ? (
            <div className="flex items-center gap-3 mt-1.5">
              {insight.cost_estimate && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 11, color: "#0f766e", fontWeight: 600 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>
                  {insight.cost_estimate}
                </span>
              )}
              {insight.wait_estimate && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {insight.wait_estimate}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1.5">
              <MatchDots score={place.score} color={careColor} />
              <span className="text-slate-400" style={{ fontSize: 11 }}>Match {place.score}</span>
            </div>
          )}
        </div>
        <div className="shrink-0 self-center text-slate-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

function SelectedPlaceCard({ place, careColor, onClose, insight, insurance }: {
  place: RadarPlace; careColor: string; onClose: () => void;
  insight?: PlaceInsight; insurance?: string;
}) {
  const insMatch = (insight?.insurance_match || "unknown") as InsuranceMatch;
  const insStyle = INSURANCE_STYLES[insMatch] ?? INSURANCE_STYLES.unknown;
  return (
    <div className="overflow-hidden" style={{ borderRadius: 22, background: "#fff", border: `1px solid ${careColor}40`, boxShadow: "0 12px 32px rgba(15,23,42,0.10)" }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${careColor}, ${careColor}90)` }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: "0.1em", color: careColor, background: `${careColor}15`, padding: "4px 10px", borderRadius: 99 }}>
              {place.type}
            </span>
            {place.brand && (
              <span className="font-bold" style={{ fontSize: 10, letterSpacing: "0.05em", background: "#f1f5f9", color: "#0f172a", padding: "4px 8px", borderRadius: 6, textTransform: "uppercase" }}>
                {place.brand}
              </span>
            )}
            <InsuranceBadge match={insight?.insurance_match} />
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="Close">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="font-bold text-slate-900 leading-tight" style={{ fontSize: 19 }}>{place.name}</p>
        {place.address && <p className="text-slate-500 mt-1 leading-snug" style={{ fontSize: 13 }}>{place.address}</p>}

        {insight?.fit_reason && (insight.fit_score ?? 0) >= 70 && (
          <div className="mt-3 rounded-xl p-3 flex items-start gap-2.5" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%)", border: "1px solid #ddd6fe" }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: "#7c3aed", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2z" /></svg>
            </div>
            <div>
              <p className="font-bold" style={{ fontSize: 12, color: "#581c87" }}>AI fit · {insight.fit_score}/100</p>
              <p className="leading-snug" style={{ fontSize: 13, color: "#5b21b6" }}>{insight.fit_reason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl p-3" style={{ background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
            <p className="font-bold uppercase text-teal-700 mb-1" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Est. cost</p>
            <p className="font-bold text-slate-900" style={{ fontSize: 15 }}>{insight?.cost_estimate || place.price}</p>
            <p style={{ fontSize: 10, color: "#64748b" }}>Call to confirm</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <p className="font-bold uppercase text-blue-700 mb-1" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Wait time</p>
            <p className="font-bold text-slate-900" style={{ fontSize: 15 }}>{insight?.wait_estimate || place.time}</p>
            <p style={{ fontSize: 10, color: "#64748b" }}>AI estimate</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
            <p className="font-bold uppercase text-slate-400 mb-1" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Distance</p>
            <p className="font-bold text-slate-900" style={{ fontSize: 14 }}>{place.distance}</p>
            <p className="text-slate-500" style={{ fontSize: 11 }}>{place.time}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
            <p className="font-bold uppercase text-slate-400 mb-1" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Insurance</p>
            {insMatch !== "unknown" ? (
              <>
                <p className="font-bold mt-1" style={{ fontSize: 14, color: insStyle.color }}>{insStyle.label}</p>
                <p className="text-slate-500 leading-snug mt-0.5" style={{ fontSize: 11 }}>{insStyle.helper}</p>
                {insight?.insurance_note && <p className="text-slate-400 italic mt-1" style={{ fontSize: 10.5 }}>{insight.insurance_note}</p>}
                {insurance && <p className="text-slate-400 mt-1" style={{ fontSize: 10 }}>Plan: <span className="font-semibold text-slate-500">{insurance}</span></p>}
              </>
            ) : (
              <>
                <p className="font-bold text-slate-500 mt-1" style={{ fontSize: 14 }}>—</p>
                <p className="text-slate-400 leading-snug mt-0.5" style={{ fontSize: 11 }}>
                  {insurance ? "Couldn't confirm — call to verify." : "Add your plan above to check."}
                </p>
              </>
            )}
          </div>
        </div>

        {place.hoursStatus && (
          <div className="mt-3 rounded-xl p-3 flex items-center gap-3" style={{
            background: place.hoursStatus.isOpen ? "#f0fdf4" : place.hoursStatus.isOpen === false ? "#fef2f2" : "#f8fafc",
            border: `1px solid ${place.hoursStatus.isOpen ? "#bbf7d0" : place.hoursStatus.isOpen === false ? "#fecaca" : "#e2e8f0"}`,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: place.hoursStatus.isOpen ? "#dcfce7" : place.hoursStatus.isOpen === false ? "#fee2e2" : "#f1f5f9",
              color: place.hoursStatus.isOpen ? "#15803d" : place.hoursStatus.isOpen === false ? "#dc2626" : "#64748b" }}>
              <ClockIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold" style={{ fontSize: 14, color: place.hoursStatus.isOpen ? "#15803d" : place.hoursStatus.isOpen === false ? "#dc2626" : "#475569" }}>
                {place.hoursStatus.label}
              </p>
              {place.hoursStatus.detail && <p className="text-slate-500" style={{ fontSize: 12 }}>{place.hoursStatus.detail}</p>}
            </div>
          </div>
        )}

        {place.note && <p className="mt-3 text-slate-600 leading-relaxed" style={{ fontSize: 13 }}>{place.note}</p>}

        <div className="flex gap-2 mt-3">
          {place.phone && (
            <a href={`tel:${place.phone}`} className="flex-1 flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98]"
              style={{ fontSize: 14, borderRadius: 12, padding: "13px", background: careColor, color: "#fff", boxShadow: `0 4px 14px ${careColor}50` }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              Call
            </a>
          )}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98]"
            style={{ fontSize: 14, borderRadius: 12, padding: "13px", background: "#0f172a", color: "#fff" }}>
            <NavigationIcon className="w-4 h-4" /> Directions
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────── */

export default function FindCare() {
  const [symptoms, setSymptoms] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [history, setHistory] = useState("");
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeCareType, setActiveCareType] = useState<CareType>("urgent_care");

  const [userCoords, setUserCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [places, setPlaces] = useState<RadarPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<RadarPlace | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [insights, setInsights] = useState<Record<string, PlaceInsight>>({});
  const [insightsBusy, setInsightsBusy] = useState(false);

  const [insurance, setInsurance] = useState("");
  const [insuranceEditing, setInsuranceEditing] = useState(false);
  const [insuranceDraft, setInsuranceDraft] = useState("");

  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const mapRef = useRef<InteractiveMapHandle>(null);

  const hasRealCoords = userCoords.lat !== DEFAULT_COORDS.lat || userCoords.lng !== DEFAULT_COORDS.lng;

  const searchPlaces = useCallback(async (coords: Coordinates, careType: CareType) => {
    setSearchBusy(true);
    setSearchError(null);
    setSelectedPlace(null);
    try {
      const categories = radarSearchCategories(careType);
      const forwardQueries = radarForwardQueries(careType);
      const catResults = await Promise.all(
        categories.map(async (cat) => {
          try {
            const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/category/${cat}?access_token=${MAPBOX_TOKEN}&proximity=${coords.lng},${coords.lat}&limit=25&language=en`);
            if (!res.ok) return [] as SearchBoxFeature[];
            const data = await res.json() as { features?: SearchBoxFeature[] };
            return data.features || [];
          } catch { return [] as SearchBoxFeature[]; }
        })
      );
      const fwdResults = await Promise.all(
        forwardQueries.map(async (q) => {
          try {
            const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(q)}&access_token=${MAPBOX_TOKEN}&proximity=${coords.lng},${coords.lat}&limit=10&language=en&types=poi`);
            if (!res.ok) return [] as SearchBoxFeature[];
            const data = await res.json() as { features?: SearchBoxFeature[] };
            return data.features || [];
          } catch { return [] as SearchBoxFeature[]; }
        })
      );
      const merged = new Map<string, SearchBoxFeature>();
      for (const features of [...catResults, ...fwdResults]) {
        for (const f of features) {
          const id = f.properties?.mapbox_id || `${f.geometry?.coordinates?.[0]},${f.geometry?.coordinates?.[1]}`;
          if (!merged.has(id)) merged.set(id, f);
        }
      }
      const validated = Array.from(merged.values()).filter((f) => {
        const cats = f.properties?.poi_category || f.properties?.poi_category_ids || [];
        return isValidCategoryMatch(careType, cats, f.properties?.name || "");
      });
      const newPlaces = validated
        .map((f, i) => placeFromSearchBox(careType, f, coords, i))
        .filter((p): p is RadarPlace => p !== null)
        .sort((a, b) => a.miles - b.miles);
      setPlaces(newPlaces);
      if (newPlaces.length === 0) setSearchError("No matching locations found nearby. Try a different area.");
    } catch (e) {
      setPlaces([]);
      setSearchError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearchBusy(false);
    }
  }, []);

  const fetchInsights = useCallback(async (currentPlaces: RadarPlace[], ins: string, currentTriage: TriageResult | null) => {
    if (currentPlaces.length === 0) { setInsights({}); return; }
    setInsightsBusy(true);
    try {
      const slim = currentPlaces.slice(0, 20).map((p) => ({
        id: p.id, name: p.name, type: p.type, brand: p.brand, distance: p.distance,
        open: (p.hoursStatus?.isOpen === true ? "open" : p.hoursStatus?.isOpen === false ? "closed" : "unknown") as "open" | "closed" | "unknown",
      }));
      const result = await api.placeInsights.score({
        places: slim,
        insurance: ins || undefined,
        triage: currentTriage ? { care_type: currentTriage.care_type, urgency: currentTriage.urgency, reasoning: currentTriage.reasoning } : null,
      });
      const map: Record<string, PlaceInsight> = {};
      for (const insight of result.insights) map[insight.id] = insight;
      setInsights(map);
    } catch { /* silently fail */ }
    finally { setInsightsBusy(false); }
  }, []);

  useEffect(() => {
    if (places.length > 0) fetchInsights(places, insurance, triage);
  }, [places, insurance, triage]);

  const geocodeAddress = useCallback(async () => {
    const q = addressInput.trim();
    if (!q) return;
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(q)}&access_token=${MAPBOX_TOKEN}&limit=1&language=en`,
      );
      const data = await res.json() as { features?: SearchBoxFeature[] };
      const f = data.features?.[0];
      if (!f) { setGeocodeError("Address not found. Try a ZIP code or city name."); return; }
      const [lng, lat] = f.geometry.coordinates;
      const label = f.properties.full_address || f.properties.place_formatted || q;
      const coords: Coordinates = { lat, lng, label };
      setUserCoords(coords);
      setLocError(null);
      searchPlaces(coords, activeCareType);
    } catch {
      setGeocodeError("Couldn't look up that address. Check your connection.");
    } finally {
      setGeocoding(false);
    }
  }, [addressInput, activeCareType, searchPlaces]);

  // Auto-locate on mount: try GPS, fall back to IP geolocation silently
  useEffect(() => {
    let cancelled = false;

    async function ipLocate() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return;
        const data = await res.json() as { latitude?: number; longitude?: number; city?: string; region?: string };
        if (cancelled || !data.latitude || !data.longitude) return;
        const coords: Coordinates = {
          lat: data.latitude,
          lng: data.longitude,
          label: data.city ? `${data.city}, ${data.region ?? ""}`.trim() : "Your area",
        };
        setUserCoords(coords);
        setLocating(false);
        searchPlaces(coords, "urgent_care");
      } catch {
        if (!cancelled) setLocating(false);
      }
    }

    setLocating(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const coords: Coordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" };
          setUserCoords(coords);
          setLocating(false);
          searchPlaces(coords, "urgent_care");
        },
        () => { if (!cancelled) ipLocate(); }, // GPS failed → try IP
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
      );
    } else {
      ipLocate();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError("Geolocation not supported by your browser."); return; }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" };
        setUserCoords(coords);
        setLocating(false);
        searchPlaces(coords, activeCareType);
      },
      async () => {
        // GPS failed — silently fall back to IP geolocation
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json() as { latitude?: number; longitude?: number; city?: string; region?: string };
          if (data.latitude && data.longitude) {
            const coords: Coordinates = {
              lat: data.latitude, lng: data.longitude,
              label: data.city ? `${data.city}, ${data.region ?? ""}`.trim() : "Your area",
            };
            setUserCoords(coords);
            setLocating(false);
            searchPlaces(coords, activeCareType);
            return;
          }
        } catch { /* fall through */ }
        setLocError("Couldn't detect location. Enter your ZIP below.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  }, [activeCareType, searchPlaces]);

  const handleUserCoordsChange = useCallback((coords: Coordinates) => {
    setUserCoords(coords);
    searchPlaces(coords, activeCareType);
  }, [activeCareType, searchPlaces]);

  const analyze = async () => {
    if (!symptoms.trim()) { setError("Please describe your symptoms first."); return; }
    setError(null);
    setBusy(true);
    setTriage(null);
    setPlaces([]);
    setInsights({});
    try {
      const result = await api.triage.analyze({
        symptoms: symptoms.trim(),
        allergies: allergies.trim() || undefined,
        medications: medications.trim() || undefined,
        history: history.trim() || undefined,
      });
      setActiveCareType(result.care_type as CareType);
      setTriage(result);
      if (hasRealCoords) searchPlaces(userCoords, result.care_type as CareType);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Triage analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const careType = activeCareType;
  const urgency = triage?.urgency ?? "soon";
  const careMeta = CARE_TYPE_META[careType] ?? CARE_TYPE_META.urgent_care;
  const urgencyMeta = URGENCY_META[urgency] ?? URGENCY_META.soon;
  const careColor = CARE_COLORS[careType] ?? CARE_COLORS.urgent_care;

  return (
    <>
      <PageHeader
        backTo="/tools"
        eyebrow="Find Care"
        title="Find the right care, right now"
        subtitle="Describe your symptoms and let AI route you to the right level of care — then navigate to nearby facilities on the interactive map."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: triage form + results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Triage form */}
          <div className="card bg-blush-50 border-blush-100 space-y-3">
            <p className="section-title">Describe your symptoms</p>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={4}
              className="input w-full resize-none"
              placeholder="e.g. I have a fever of 102°F, sore throat, and body aches since yesterday…"
            />
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-3.5 h-3.5 text-ink-400 shrink-0" />
              <input
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                className="input flex-1 text-sm"
                placeholder="Insurance plan (optional)"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Known allergies <span className="text-ink-400 font-normal">(optional)</span></label>
              <input value={allergies} onChange={(e) => setAllergies(e.target.value)} className="input w-full text-sm" placeholder="e.g. Penicillin, sulfa drugs" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Current medications <span className="text-ink-400 font-normal">(optional)</span></label>
              <input value={medications} onChange={(e) => setMedications(e.target.value)} className="input w-full text-sm" placeholder="e.g. Lisinopril 10mg, Metformin 500mg" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Medical history <span className="text-ink-400 font-normal">(optional)</span></label>
              <input value={history} onChange={(e) => setHistory(e.target.value)} className="input w-full text-sm" placeholder="e.g. Type 2 diabetes, hypertension" />
            </div>
            {error && (
              <div className="mt-3 flex items-start gap-2 text-coral-600 text-sm bg-coral-50 rounded-xl p-3 border border-coral-100">
                <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            <button onClick={analyze} disabled={busy || !symptoms.trim()} className="mt-4 btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed">
              <SparklesIcon className="w-4 h-4" />
              {busy ? "Analyzing…" : "Get Care Recommendation"}
            </button>
          </div>

          {/* Triage results */}
          {triage && (
            <div className="space-y-4">
              {urgency === "emergency" && (
                <div className="rounded-2xl bg-coral-600 text-white p-4 flex items-center gap-3 shadow-soft">
                  <AlertIcon className="w-6 h-6 shrink-0" />
                  <div>
                    <p className="font-extrabold text-lg">Call 911 or go to the ER immediately</p>
                    <p className="text-sm text-white/80">This is a potential emergency. Do not wait.</p>
                  </div>
                </div>
              )}

              <div className="card bg-cream-50 border-cream-200">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="section-title">Recommended care</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`pill ${careMeta.color} ring-1 text-sm font-bold`}>
                        <span className={`w-2 h-2 rounded-full ${careMeta.dot}`} />
                        {careMeta.label}
                      </span>
                      <span className={`pill ${urgencyMeta.color} text-sm font-bold`}>{urgencyMeta.label}</span>
                    </div>
                  </div>
                  {triage.estimated_cost && (
                    <div className="text-right">
                      <p className="text-xs text-ink-500 font-semibold uppercase tracking-wide">Est. cost</p>
                      <p className="text-base font-bold text-ink-900">{triage.estimated_cost}</p>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-sm text-ink-700 leading-relaxed">{triage.reasoning}</p>
              </div>

              {triage.what_to_bring?.length > 0 && (
                <div className="card bg-butter-50 border-butter-200">
                  <p className="section-title mb-3">What to bring</p>
                  <ul className="space-y-1.5">
                    {triage.what_to_bring.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-800">
                        <CheckIcon className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {triage.red_flags?.length > 0 && (
                <div className="card bg-coral-50 border-coral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertIcon className="w-4 h-4 text-coral-600" />
                    <p className="section-title text-coral-700">Go to ER if you experience</p>
                  </div>
                  <ul className="space-y-1.5">
                    {triage.red_flags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-coral-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-coral-500 mt-1.5 shrink-0" />{flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {triage.questions_to_ask?.length > 0 && (
                <div className="card bg-gradient-to-br from-butter-50 to-blush-50 border-butter-200">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="w-4 h-4 text-brand-700" />
                    <p className="section-title">Questions to ask at the visit</p>
                  </div>
                  <ul className="space-y-2">
                    {triage.questions_to_ask.map((q, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-ink-100">
                        <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-sm text-ink-800">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {triage.otc_recommendations?.length > 0 && (
                <div className="card bg-mint-50 border-mint-200">
                  <div className="flex items-center gap-2 mb-3">
                    <PillIcon className="w-4 h-4 text-mint-600" />
                    <p className="section-title">Over-the-counter relief (in the meantime)</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {triage.otc_recommendations.map((otc: OTCRecommendation, i: number) => (
                      <div key={i} className="rounded-xl bg-white ring-1 ring-ink-100 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-ink-900 text-sm">{otc.name}</p>
                          <span className="text-xs text-ink-500 shrink-0">{otc.typical_price}</span>
                        </div>
                        <p className="text-xs text-ink-500 mt-0.5">{otc.generic}</p>
                        <p className="text-xs text-ink-700 mt-1">{otc.what_for}</p>
                        <p className="text-xs text-brand-700 mt-1 font-medium">{otc.dosage}</p>
                        {otc.caution && (
                          <p className="text-xs text-sun-600 mt-1 flex items-start gap-1">
                            <AlertIcon className="w-3 h-3 shrink-0 mt-0.5" />{otc.caution}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {triage.self_care_tips?.length > 0 && (
                <div className="card bg-lavender-50 border-lavender-100">
                  <p className="section-title mb-3">Self-care tips for right now</p>
                  <ul className="space-y-1.5">
                    {triage.self_care_tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-800">
                        <CheckIcon className="w-4 h-4 text-lavender-500 shrink-0 mt-0.5" />{tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-600 flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-sun-500 shrink-0 mt-0.5" />
            <p>This is a triage guide only — not a diagnosis or medical advice. In a true emergency, call 911 immediately.</p>
          </div>
        </div>

        {/* Right: interactive map + places */}
        <div className="lg:col-span-3 space-y-4">
          {/* Location status — only shows when something needs attention */}
          {locating && (
            <div className="flex items-center gap-2 text-xs text-brand-700 font-medium px-1">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-200 border-t-brand-700 animate-spin shrink-0" />
              Detecting your location…
            </div>
          )}
          {!locating && !hasRealCoords && (
            <div className="flex gap-2">
              <input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") geocodeAddress(); }}
                placeholder="Enter ZIP code or address to find care near you"
                className="input flex-1 text-sm"
              />
              <button
                type="button"
                onClick={geocodeAddress}
                disabled={geocoding || !addressInput.trim()}
                className="btn-primary px-4 disabled:opacity-60 shrink-0"
              >
                {geocoding ? <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <SearchIcon className="w-4 h-4" />}
              </button>
            </div>
          )}
          {geocodeError && (
            <p className="text-xs text-coral-600 px-1">{geocodeError}</p>
          )}

          {/* Care type filter tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {(["urgent_care", "hospital", "primary_care", "pharmacy"] as CareType[]).map((ct) => {
              const meta = CARE_TYPE_META[ct];
              const isActive = activeCareType === ct;
              return (
                <button
                  key={ct}
                  type="button"
                  onClick={() => {
                    setActiveCareType(ct);
                    setPlaces([]);
                    if (hasRealCoords) searchPlaces(userCoords, ct);
                  }}
                  className={`pill text-xs font-semibold ring-1 transition-colors ${
                    isActive ? meta.color : "bg-ink-50 text-ink-500 ring-ink-200 hover:bg-ink-100"
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
            {hasRealCoords && (
              <button
                type="button"
                onClick={() => searchPlaces(userCoords, activeCareType)}
                disabled={searchBusy}
                className="ml-auto btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
              >
                <SearchIcon className="w-3.5 h-3.5" />
                {searchBusy ? "Searching…" : "Search nearby"}
              </button>
            )}
          </div>

          {/* Interactive map */}
          <div className="rounded-2xl overflow-hidden ring-1 ring-ink-200" style={{ height: 360 }}>
            <InteractiveMap
              ref={mapRef}
              mapboxToken={MAPBOX_TOKEN}
              userCoords={userCoords}
              places={places}
              selectedPlace={selectedPlace}
              onSelectPlace={setSelectedPlace}
              onUserCoordsChange={handleUserCoordsChange}
            />
          </div>

          {/* Search status / trigger */}
          {triage && !hasRealCoords && (
            <div className="card bg-butter-50 border-butter-200 text-center py-6">
              <MapPinIcon className="w-8 h-8 mx-auto text-butter-500 mb-2" />
              <p className="text-sm font-semibold text-ink-700">Enter your location above to find nearby {careMeta.label} facilities</p>
              <p className="text-xs text-ink-500 mt-1">Your location is used only to search — nothing is stored.</p>
            </div>
          )}

          {searchBusy && (
            <div className="card bg-cream-50 border-cream-200 flex items-center justify-center gap-3 py-6">
              <div className="w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-700 animate-spin" />
              <span className="text-sm font-medium text-ink-600">Finding nearby {careMeta.label} facilities…</span>
            </div>
          )}

          {searchError && !searchBusy && (
            <div className="flex items-start gap-2 text-coral-600 text-sm bg-coral-50 rounded-xl p-3 border border-coral-100">
              <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" /><span>{searchError}</span>
            </div>
          )}

          {/* Selected place card */}
          {selectedPlace && (
            <SelectedPlaceCard
              place={selectedPlace}
              careColor={careColor}
              onClose={() => setSelectedPlace(null)}
              insight={insights[selectedPlace.id]}
              insurance={insurance}
            />
          )}

          {/* Place list */}
          {places.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="section-title">
                  {places.length} {careMeta.label} near you
                  {insightsBusy && <span className="ml-2 text-xs font-normal text-ink-400">· Scoring…</span>}
                </p>
                <span className="text-xs text-ink-400">Tap to navigate</span>
              </div>
              {places.slice(0, 10).map((place, i) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  index={i}
                  careColor={careColor}
                  isSelected={selectedPlace?.id === place.id}
                  onClick={() => setSelectedPlace(selectedPlace?.id === place.id ? null : place)}
                  insight={insights[place.id]}
                />
              ))}
            </div>
          )}

          {/* No-results placeholder */}
          {!searchBusy && places.length === 0 && (
            <div className="card bg-cream-50 border-cream-200 text-center py-10">
              <SearchIcon className="w-10 h-10 mx-auto text-ink-300 mb-3" />
              <p className="font-semibold text-ink-600">
                {hasRealCoords ? "Select a care type and tap Search nearby" : "Get your location to find facilities"}
              </p>
              <p className="text-sm text-ink-400 mt-1">Or describe symptoms above for an AI recommendation.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-left max-w-xs mx-auto">
                {[
                  { label: "Emergency Room", Icon: HeartPulseIcon, color: "text-coral-500" },
                  { label: "Urgent Care", Icon: ClockIcon, color: "text-sun-500" },
                  { label: "Primary Care", Icon: ShieldIcon, color: "text-sky2-500" },
                  { label: "Pharmacy", Icon: PillIcon, color: "text-mint-500" },
                ].map(({ label, Icon, color }) => (
                  <div key={label} className="flex items-center gap-2 p-2 rounded-xl bg-white ring-1 ring-ink-100">
                    <Icon className={`w-4 h-4 ${color} shrink-0`} />
                    <span className="text-xs font-medium text-ink-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
