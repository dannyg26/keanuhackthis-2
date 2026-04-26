import { useMemo, useState } from "react";
import BodyMapAnatomy from "../components/BodyMapAnatomy";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  BODY_REGIONS,
  type BodySystem,
  systemsForMed,
  alertsForRegion,
  type AlertLevel,
} from "../data/bodyMap";
import {
  PillIcon,
  AlertIcon,
  SparklesIcon,
  BookIcon,
  XIcon,
  ArrowRightIcon,
  HeartPulseIcon,
} from "../components/Icon";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { AnatomySystem } from "../components/AnatomyChart";
import { ORGAN_BY_REGION } from "../components/OrganIllustrations";

interface SystemDef {
  id: AnatomySystem;
  label: string;
  color: string;
}
const SYSTEMS: SystemDef[] = [
  { id: "muscular", label: "Muscular", color: "#b85a4d" },
  { id: "cardiovascular", label: "Cardiovascular", color: "#ec4899" },
  { id: "respiratory", label: "Respiratory", color: "#0ea5e9" },
  { id: "digestive", label: "Digestive", color: "#22c55e" },
  { id: "hepatic", label: "Liver & Metabolism", color: "#fbbf24" },
  { id: "nervous", label: "Nervous", color: "#a855f7" },
  { id: "integumentary", label: "Skin", color: "#f59e0b" },
];

const SYSTEM_TO_REGION: Partial<Record<string, BodySystem>> = {
  cardiovascular: "heart",
  respiratory: "lungs",
  digestive: "stomach",
  hepatic: "liver",
  nervous: "head",
  integumentary: "skin",
};

export default function BodyMap() {
  const { data, loading, error } = useApi(() => api.medications.list());
  const meds = data?.medications ?? [];

  const [activeId, setActiveId] = useState<BodySystem | null>(null);
  const [systemFilter, setSystemFilter] = useState<AnatomySystem | "all">(
    "all",
  );

  const activeRegion = useMemo(
    () => BODY_REGIONS.find((r) => r.id === activeId) ?? null,
    [activeId],
  );

  const connectedMeds = useMemo(() => {
    if (!activeId) return [];
    return meds.filter((m) => systemsForMed(m.name).includes(activeId));
  }, [activeId, meds]);

  const regionAlerts = useMemo(() => {
    if (!activeId) return [];
    return alertsForRegion(
      activeId,
      meds.map((m) => m.name),
    );
  }, [activeId, meds]);

  const systemCounts = useMemo(() => {
    const counts = new Map<BodySystem, number>();
    for (const m of meds) {
      for (const s of systemsForMed(m.name)) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    return counts;
  }, [meds]);

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Body Map"
          title="Tap a glowing point on your body"
        />
        <div className="card text-center text-ink-400 py-16">
          Loading your medications…
        </div>
      </>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader
          eyebrow="Body Map"
          title="Tap a glowing point on your body"
        />
        <div className="card text-center text-coral-600 py-12">{error}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Body Map"
        title="Tap a glowing point on your body"
        subtitle="See which systems each medication affects, what conditions live there, and which labs you might want to ask about."
      />

      <div className="grid lg:grid-cols-6 gap-4">
        {/* Systems sidebar */}
        <aside className="lg:col-span-1 order-3 lg:order-1">
          <div className="card bg-charcoal-800 text-white p-4 sticky lg:top-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/60 mb-3">
              Systems
            </p>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => {
                    setSystemFilter("all");
                    setActiveId(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-sm font-medium transition-colors ${
                    systemFilter === "all"
                      ? "bg-white text-charcoal-900"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  <HeartPulseIcon className="w-4 h-4" />
                  All systems
                </button>
              </li>
              {SYSTEMS.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      const isActive = systemFilter === s.id;
                      setSystemFilter(isActive ? "all" : s.id);
                      const rid = SYSTEM_TO_REGION[s.id];
                      setActiveId(isActive ? null : (rid ?? null));
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-sm font-medium transition-colors ${
                      systemFilter === s.id
                        ? "bg-white text-charcoal-900"
                        : "text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: s.color }}
                    />
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Anatomy chart */}
        <div className="lg:col-span-3 order-1 lg:order-2 card relative overflow-hidden p-0 bg-white border-ink-100">
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#f8fafc_0%,#ffffff_60%)]"
            aria-hidden
          />

          <div className="relative h-[600px] sm:h-[720px] flex items-center justify-center">
            <BodyMapAnatomy
              activeId={activeId}
              onSelectZone={(id) =>
                setActiveId((prev) => (prev === id ? null : id))
              }
            />

            {/* Floating helper chip */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 max-w-[60%] pointer-events-none">
              <div className="bg-white/90 backdrop-blur shadow-soft border border-ink-100 rounded-2xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-blush-500" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-800/65">
                    Drag to rotate · tap a pulsing point
                  </p>
                </div>
              </div>
            </div>

            {/* Active region chip */}
            {activeRegion && (
              <button
                onClick={() => setActiveId(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white shadow-soft border border-ink-100 rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold hover:bg-ink-50"
                style={{ color: activeRegion.color }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: activeRegion.color }}
                />
                {activeRegion.name}
                <XIcon className="w-3.5 h-3.5 text-ink-400" />
              </button>
            )}
          </div>

          {/* System legend (compact) */}
          <div className="relative px-4 pb-4 pt-2 border-t border-blush-100/60">
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-charcoal-800/60 mb-2">
              Quick jump
            </p>
            <div className="flex flex-wrap gap-2">
              {BODY_REGIONS.map((r) => {
                const count = systemCounts.get(r.id) ?? 0;
                const isActive = activeId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() =>
                      setActiveId((prev) => (prev === r.id ? null : r.id))
                    }
                    className={`pill ring-1 transition-all ${
                      isActive ? "shadow-soft scale-105" : "hover:scale-[1.03]"
                    }`}
                    style={{
                      background: isActive ? r.color : "white",
                      color: isActive ? "white" : r.color,
                      borderColor: r.color,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isActive ? "white" : r.color }}
                    />
                    {r.name.split(" ")[0]}
                    {count > 0 && (
                      <span
                        className="ml-1 px-1.5 py-0 text-[10px] rounded-full"
                        style={{
                          background: isActive
                            ? "rgba(255,255,255,0.25)"
                            : `${r.color}20`,
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Details panel */}
        <aside className="lg:col-span-2 order-2 lg:order-3 space-y-4">
          {!activeRegion ? (
            <div className="card bg-cream-100 border-cream-200">
              <div className="flex items-center gap-2 mb-1.5">
                <SparklesIcon className="w-4 h-4 text-brand-700" />
                <p className="section-title">How it works</p>
              </div>
              <h2 className="text-xl font-bold text-charcoal-900">
                Tap a glowing point on your body
              </h2>
              <p className="text-sm text-ink-600 mt-2 leading-relaxed">
                Each point is a system DoseWise tracks. Click it to see related
                conditions, your medications that affect it, and labs to keep an
                eye on.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blush-200 ring-1 ring-blush-300 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-800/65">
                    Systems
                  </p>
                  <p className="text-2xl font-extrabold text-charcoal-900 leading-none mt-1">
                    {BODY_REGIONS.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-butter-200 ring-1 ring-butter-300 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-800/65">
                    Your meds
                  </p>
                  <p className="text-2xl font-extrabold text-charcoal-900 leading-none mt-1">
                    {meds.length}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-ink-100">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-charcoal-800/60 mb-2">
                  Your medications
                </p>
                <ul className="space-y-1.5">
                  {meds.map((m) => {
                    const sys = systemsForMed(m.name);
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-ink-100 hover:border-blush-300 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PillIcon className="w-4 h-4 text-blush-500 shrink-0" />
                          <span className="text-sm font-semibold text-ink-900 truncate">
                            {m.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {sys.length === 0 ? (
                            <span className="text-[10px] text-ink-400">—</span>
                          ) : (
                            sys.map((s) => {
                              const region = BODY_REGIONS.find(
                                (r) => r.id === s,
                              )!;
                              return (
                                <button
                                  key={s}
                                  onClick={() => setActiveId(s)}
                                  className="pill ring-1 text-[10px]"
                                  style={{
                                    background: `${region.color}1a`,
                                    color: region.color,
                                    borderColor: `${region.color}40`,
                                  }}
                                >
                                  {region.name.split(" ")[0]}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : (
            <div
              className="card border-2 animate-slideUp"
              style={{
                borderColor: `${activeRegion.color}55`,
                background: `${activeRegion.color}0d`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="text-[10px] uppercase tracking-[0.18em] font-bold"
                    style={{ color: activeRegion.color }}
                  >
                    Selected system
                  </p>
                  <h2 className="text-2xl font-extrabold text-charcoal-900 mt-1">
                    {activeRegion.name}
                  </h2>
                </div>
                <span
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-soft shrink-0"
                  style={{ background: activeRegion.color }}
                >
                  <PillIcon className="w-5 h-5" />
                </span>
              </div>
              <p className="text-sm text-ink-700 mt-2 leading-relaxed">
                {activeRegion.description}
              </p>

              {/* Organ illustration with label callout */}
              <div className="mt-4 relative rounded-2xl bg-charcoal-900 p-4 overflow-hidden">
                <div
                  className="absolute inset-0 bg-mesh opacity-10"
                  aria-hidden
                />
                <div className="relative flex items-center justify-center">
                  {(() => {
                    const Organ = ORGAN_BY_REGION[activeRegion.id];
                    return <Organ className="w-44 h-44" />;
                  })()}
                </div>
                {/* Label callout */}
                <div className="absolute top-3 left-3 max-w-[55%]">
                  <div className="bg-white/95 backdrop-blur rounded-lg px-2.5 py-1.5 shadow-soft">
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: activeRegion.color }}
                    >
                      {activeRegion.name}
                    </p>
                    <p className="text-[10px] text-ink-600 italic leading-tight">
                      {activeRegion.description.split(" — ")[0].split(",")[0]}
                    </p>
                  </div>
                  <svg
                    className="absolute left-6 top-full"
                    width="80"
                    height="40"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="60"
                      y2="35"
                      stroke="white"
                      strokeWidth="1.2"
                      opacity="0.6"
                    />
                    <circle cx="60" cy="35" r="2" fill={activeRegion.color} />
                  </svg>
                </div>
              </div>

              {/* Med-specific alerts (computed from user's meds) */}
              {regionAlerts.length > 0 && (
                <div className="mt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertIcon
                      className="w-4 h-4"
                      style={{ color: activeRegion.color }}
                    />
                    <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-charcoal-800/65">
                      Alerts from your meds
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {regionAlerts.map((a, i) => {
                      const colorMap: Record<
                        AlertLevel,
                        { bg: string; text: string; ring: string; chip: string }
                      > = {
                        danger: {
                          bg: "bg-coral-50",
                          text: "text-coral-600",
                          ring: "ring-coral-200",
                          chip: "bg-coral-500 text-white",
                        },
                        warning: {
                          bg: "bg-sun-50",
                          text: "text-sun-500",
                          ring: "ring-sun-100",
                          chip: "bg-sun-400 text-charcoal-900",
                        },
                        info: {
                          bg: "bg-sky2-50",
                          text: "text-sky2-600",
                          ring: "ring-sky2-100",
                          chip: "bg-sky2-500 text-white",
                        },
                      };
                      const c = colorMap[a.level];
                      return (
                        <li
                          key={i}
                          className={`p-3 rounded-xl ring-1 ${c.bg} ${c.ring}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-bold ${c.text}`}>
                              {a.title}
                            </p>
                            <span
                              className={`pill text-[9px] uppercase tracking-wider ${c.chip}`}
                            >
                              {a.level}
                            </span>
                          </div>
                          <p className="text-xs text-ink-700 leading-snug mt-1">
                            {a.detail}
                          </p>
                          {a.triggeredBy && (
                            <p className="text-[10px] text-ink-400 mt-1">
                              Triggered by:{" "}
                              <span className="font-semibold">
                                {a.triggeredBy}
                              </span>
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Symptoms — what users might feel */}
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertIcon
                    className="w-4 h-4"
                    style={{ color: activeRegion.color }}
                  />
                  <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-charcoal-800/65">
                    Symptoms users tap this for
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeRegion.symptoms.map((s) => (
                    <span
                      key={s}
                      className="pill ring-1 bg-white"
                      style={{
                        color: activeRegion.color,
                        borderColor: `${activeRegion.color}40`,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertIcon
                    className="w-4 h-4"
                    style={{ color: activeRegion.color }}
                  />
                  <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-charcoal-800/65">
                    Common conditions
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeRegion.conditions.map((c) => (
                    <span
                      key={c}
                      className="pill ring-1"
                      style={{
                        background: `${activeRegion.color}1a`,
                        color: activeRegion.color,
                        borderColor: `${activeRegion.color}40`,
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Connected meds */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PillIcon
                      className="w-4 h-4"
                      style={{ color: activeRegion.color }}
                    />
                    <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-charcoal-800/65">
                      Your meds connected here
                    </p>
                  </div>
                  <span className="pill bg-white text-ink-600 ring-1 ring-ink-100">
                    {connectedMeds.length}
                  </span>
                </div>
                {connectedMeds.length === 0 ? (
                  <div className="rounded-xl bg-white border border-dashed border-ink-200 p-3 text-center text-xs text-ink-400">
                    None of your current medications affect this system.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {connectedMeds.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white border border-ink-100"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-900 truncate">
                            {m.name}
                          </p>
                          <p className="text-xs text-ink-600 truncate">
                            {m.dosage} · {m.category}
                          </p>
                        </div>
                        <Link
                          to="/medguide"
                          className="btn-secondary text-xs px-2.5 py-1.5 shrink-0"
                        >
                          MedGuide <ArrowRightIcon className="w-3 h-3" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Labs */}
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <BookIcon
                    className="w-4 h-4"
                    style={{ color: activeRegion.color }}
                  />
                  <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-charcoal-800/65">
                    Labs to ask about
                  </p>
                </div>
                <ul className="space-y-1">
                  {activeRegion.labs.map((l) => (
                    <li
                      key={l}
                      className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-ink-100 text-sm text-ink-800"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                        style={{ background: activeRegion.color }}
                      />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setActiveId(null)}
                className="btn-secondary w-full mt-5 justify-center"
              >
                <XIcon className="w-4 h-4" /> Clear selection
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-xs text-ink-600 leading-relaxed">
            This map is a learning aid, not a diagnosis. Discuss any new
            symptoms or medication concerns with a licensed provider.
          </div>
        </aside>
      </div>

      {/* Med rail (mobile-friendly) — also shown when a region is active so user can pivot */}
      {activeRegion && (
        <div className="mt-6 card bg-blush-50 border-blush-100">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">All your meds</p>
            <span className="pill bg-ink-100 text-ink-600">
              Hover to highlight regions
            </span>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {meds.map((m) => {
              const sys = systemsForMed(m.name);
              const active = sys.includes(activeRegion.id);
              return (
                <li
                  key={m.id}
                  className={`p-3 rounded-xl border-2 transition ${
                    active
                      ? "border-current bg-white"
                      : "border-ink-100 bg-white"
                  }`}
                  style={{ color: active ? activeRegion.color : undefined }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink-900 truncate">
                      {m.name}
                    </p>
                    {active && (
                      <span
                        className="pill ring-1 text-[10px]"
                        style={{
                          background: `${activeRegion.color}1a`,
                          color: activeRegion.color,
                          borderColor: `${activeRegion.color}40`,
                        }}
                      >
                        connected
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {sys.map((s) => {
                      const r = BODY_REGIONS.find((b) => b.id === s)!;
                      return (
                        <span
                          key={s}
                          className="text-[10px] font-semibold"
                          style={{ color: r.color }}
                        >
                          {r.name.split(" ")[0]}
                        </span>
                      );
                    })}
                    {sys.length === 0 && (
                      <span className="text-[10px] text-ink-400">
                        no system mapped
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
