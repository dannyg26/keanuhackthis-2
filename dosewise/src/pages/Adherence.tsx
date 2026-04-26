import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { CheckIcon, XIcon, FlameIcon, PillIcon, AlertIcon, SparklesIcon, ClockIcon } from "../components/Icon";
import { api, type AdherenceLog, type Medication } from "../lib/api";
import { useApi } from "../lib/useApi";

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function dayName(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });
}
function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function Adherence() {
  const medsQ = useApi(() => api.medications.list());
  const logsQ = useApi(() => api.adherence.list());

  const meds: Medication[] = medsQ.data?.medications ?? [];
  const logs: AdherenceLog[] = logsQ.data?.logs ?? [];
  const loading = medsQ.loading || logsQ.loading;
  const error = medsQ.error || logsQ.error;

  const [busyKey, setBusyKey] = useState<string | null>(null); // medId-date during mutation

  const today = todayStr();
  const last7 = useMemo(() => lastNDays(7), []);

  // Local optimistic updates layered on top of server logs
  const [optimistic, setOptimistic] = useState<AdherenceLog[]>([]);
  useEffect(() => { setOptimistic([]); }, [logs]);

  function effectiveLog(medId: string, date: string): AdherenceLog | undefined {
    const opt = optimistic.find(o => o.medicationId === medId && o.date === date);
    if (opt) return opt;
    return logs.find(l => l.medicationId === medId && l.date === date);
  }

  const setToday = async (medicationId: string, taken: boolean) => {
    const key = `${medicationId}-${today}`;
    setBusyKey(key);
    // Optimistic
    setOptimistic(prev => {
      const filtered = prev.filter(o => !(o.medicationId === medicationId && o.date === today));
      return [...filtered, {
        id: `opt-${key}`, medicationId, date: today, taken,
        createdAt: new Date().toISOString(),
      }];
    });
    try {
      await api.adherence.log({ medicationId, date: today, taken });
      await logsQ.refetch();
    } catch {
      // Roll back optimistic on failure
      setOptimistic(prev => prev.filter(o => o.id !== `opt-${key}`));
    } finally {
      setBusyKey(null);
    }
  };

  const todayState = (id: string): boolean | undefined => effectiveLog(id, today)?.taken;

  const chartData = useMemo(() => {
    return last7.map(d => {
      const expected = meds.length;
      const taken = meds.filter(m => effectiveLog(m.id, d)?.taken).length;
      const isToday = d === today;
      return {
        day: dayName(d), date: d,
        pct: Math.round((taken / Math.max(1, expected)) * 100),
        taken, expected, isToday,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, optimistic, last7, today, meds]);

  const weekPct = useMemo(() => {
    const expected = last7.length * meds.length;
    if (expected === 0) return 0;
    let taken = 0;
    for (const d of last7) {
      for (const m of meds) {
        if (effectiveLog(m.id, d)?.taken) taken++;
      }
    }
    return Math.round((taken / expected) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, optimistic, last7, meds]);

  const missedThisWeek = useMemo(() => {
    let missed = 0;
    for (const d of last7) {
      for (const m of meds) {
        const log = effectiveLog(m.id, d);
        if (log && !log.taken) missed++;
      }
    }
    return missed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, optimistic, last7, meds]);

  const streak = useMemo(() => {
    if (meds.length === 0) return 0;
    const days = lastNDays(60);
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      const all = meds.every(m => effectiveLog(m.id, d)?.taken);
      if (all) s++;
      else break;
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, optimistic, meds]);

  const insight = useMemo(() => {
    let weekend = 0, weekday = 0;
    for (const d of lastNDays(28)) {
      const dow = new Date(d + "T12:00:00").getDay();
      for (const m of meds) {
        const log = effectiveLog(m.id, d);
        if (log && !log.taken) {
          if (dow === 0 || dow === 6) weekend++;
          else weekday++;
        }
      }
    }
    if (weekend > weekday * 0.6 && weekend > 0)
      return "You miss doses mostly on weekends. Try setting a reminder or pairing with a routine like Saturday breakfast.";
    if (missedThisWeek === 0) return "Perfect week so far — your routine is sticking.";
    if (missedThisWeek <= 2) return "Just a couple of misses this week. Keep going — consistency compounds.";
    return "Several missed doses recently. Consider a daily phone alarm or a 7-day pill organizer.";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, optimistic, meds, missedThisWeek]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Adherence Tracker" title="Stay consistent, day after day" />
        <div className="card text-center text-ink-400 py-16">Loading your adherence…</div>
      </>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader eyebrow="Adherence Tracker" title="Stay consistent, day after day" />
        <div className="card text-center text-coral-600 py-12">{error}</div>
      </>
    );
  }
  if (meds.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Adherence Tracker" title="Stay consistent, day after day" />
        <div className="card text-center text-ink-400 py-16">
          You don't have any medications yet. Add one in MedGuide first.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Adherence Tracker"
        title="Stay consistent, day after day"
        subtitle="Tap a medication to log today's dose. Streaks, weekly trends, and insights update automatically."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          tone="butter"
          icon={<PillIcon className="w-5 h-5 text-butter-500" />}
          label="Weekly Adherence"
          value={`${weekPct}%`}
          hint={`Last 7 days · ${meds.length} med${meds.length === 1 ? "" : "s"}`}
        />
        <StatCard
          tone="blush"
          icon={<FlameIcon className="w-5 h-5 text-blush-500" />}
          label="Current Streak"
          value={`${streak}d`}
          hint={streak > 0 ? "Every dose, every day" : "Take all today's doses to start a streak"}
        />
        <StatCard
          tone="lavender"
          icon={<AlertIcon className="w-5 h-5 text-lavender-500" />}
          label="Missed (7d)"
          value={`${missedThisWeek}`}
          hint={missedThisWeek === 0 ? "Clean slate" : "Doses to make up next time"}
        />
      </div>

      <div className="mt-6 grid lg:grid-cols-5 gap-4">
        <div className="card lg:col-span-3 bg-cream-50 border-cream-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-title">Weekly chart</p>
              <h2 className="text-xl font-bold mt-1">Adherence over the last 7 days</h2>
            </div>
            <span className="pill bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <ClockIcon className="w-3.5 h-3.5" /> {today}
            </span>
          </div>
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                    boxShadow: "0 10px 30px -10px rgba(15,111,112,0.18)", fontSize: 12,
                  }}
                  formatter={(v) => [`${v}%`, "Adherence"]}
                />
                <Bar dataKey="pct" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isToday ? "#0ea5e9" : entry.pct >= 80 ? "#0f766e" : entry.pct >= 50 ? "#facc15" : "#f25c4a"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card lg:col-span-2 bg-gradient-to-br from-blush-100 to-butter-50 border-blush-200">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-brand-700" />
            <p className="section-title">Insight</p>
          </div>
          <p className="mt-3 text-lg font-bold text-ink-900 leading-snug">{insight}</p>

          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {chartData.map((c) => (
              <div key={c.date} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-full h-9 rounded-lg ${
                    c.expected === 0 ? "bg-ink-100" :
                    c.pct === 100 ? "bg-mint-500" :
                    c.pct >= 50  ? "bg-sun-400" :
                    c.pct > 0    ? "bg-coral-400" : "bg-ink-200"
                  }`}
                  title={`${c.date}: ${c.pct}%`}
                />
                <span className="text-[10px] text-ink-400 font-medium">{c.day[0]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-400 mt-3">Each square is a day. Color shows that day's adherence.</p>
        </div>
      </div>

      {/* Today's log */}
      <div className="mt-6 card bg-butter-50 border-butter-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-title">Today's log</p>
            <h2 className="text-xl font-bold mt-1">Did you take it?</h2>
          </div>
          <span className="pill bg-ink-100 text-ink-600">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </span>
        </div>

        <ul className="grid sm:grid-cols-2 gap-3">
          {meds.map(m => {
            const state = todayState(m.id);
            const key = `${m.id}-${today}`;
            const busy = busyKey === key;
            return (
              <li
                key={m.id}
                className={`p-4 rounded-2xl border-2 transition-colors
                  ${state === true ? "border-mint-500 bg-mint-50" :
                    state === false ? "border-coral-400 bg-coral-50" :
                    "border-ink-100 bg-white"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{m.name}</p>
                    <p className="text-xs text-ink-600">{m.dosage} · {m.frequency}</p>
                    <p className="text-xs text-ink-400 mt-1 flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {m.schedule.map(s => s.time).join(" · ") || "anytime"}
                    </p>
                  </div>
                  {state !== undefined && (
                    <span className={`pill ${state ? "bg-mint-500 text-white" : "bg-coral-500 text-white"}`}>
                      {state ? "Taken" : "Missed"}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setToday(m.id, true)}
                    disabled={busy}
                    className={`btn ${state === true ? "bg-mint-500 text-white shadow-soft" : "btn-secondary hover:border-mint-300"}`}
                  >
                    <CheckIcon className="w-4 h-4" /> Taken
                  </button>
                  <button
                    onClick={() => setToday(m.id, false)}
                    disabled={busy}
                    className={`btn ${state === false ? "bg-coral-500 text-white shadow-soft" : "btn-secondary hover:border-coral-300"}`}
                  >
                    <XIcon className="w-4 h-4" /> Missed
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
