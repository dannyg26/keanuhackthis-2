import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import {
  SearchIcon, PillIcon, ClockIcon, AlertIcon, CheckIcon, BookIcon, SunIcon, MoonIcon, CoffeeIcon, SparklesIcon, ScanIcon, XIcon, PlusIcon,
} from "../components/Icon";
import { api, type Medication } from "../lib/api";
import { useApi } from "../lib/useApi";
import MedScanner from "../components/MedScanner";

function timeOfDay(time: string): "morning" | "midday" | "evening" | "night" {
  const h = parseInt(time.split(":")[0]);
  if (h < 11) return "morning";
  if (h < 16) return "midday";
  if (h < 20) return "evening";
  return "night";
}

const SLOT_META = {
  morning: { label: "Morning", icon: SunIcon,    color: "from-sun-50 to-white ring-sun-100",     dot: "bg-sun-400"   },
  midday:  { label: "Midday",  icon: CoffeeIcon, color: "from-mint-50 to-white ring-mint-200",   dot: "bg-mint-500"  },
  evening: { label: "Evening", icon: ClockIcon,  color: "from-sky2-50 to-white ring-sky2-100",   dot: "bg-sky2-500"  },
  night:   { label: "Night",   icon: MoonIcon,   color: "from-brand-50 to-white ring-brand-100", dot: "bg-brand-500" },
} as const;

export default function MedGuide() {
  const { data, loading, error, refetch } = useApi(() => api.medications.list());
  const meds: Medication[] = data?.medications ?? [];

  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState("08:00");
  const [newSlotLabel, setNewSlotLabel] = useState("Morning dose");
  const [newSlotWithFood, setNewSlotWithFood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    dosage: string;
    frequency: string;
    purpose: string;
    category: string;
    refillsLeft: string; // string for input, parsed on save
  }>({ name: "", dosage: "", frequency: "", purpose: "", category: "", refillsLeft: "" });
  const [editError, setEditError] = useState<string | null>(null);

  // Once meds load, default-select the first one
  useEffect(() => {
    if (!activeId && meds.length > 0) setActiveId(meds[0].id);
  }, [meds, activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meds;
    return meds.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.purpose.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  }, [query, meds]);

  const active = meds.find(m => m.id === activeId) ?? null;

  const deleteMedication = async (med: Medication) => {
    if (!confirm(`Delete ${med.name}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api.medications.remove(med.id);
      // If we just removed the active med, switch to another one (or clear if none left)
      // so we don't flash the empty state.
      if (activeId === med.id) {
        const remaining = meds.filter(m => m.id !== med.id);
        setActiveId(remaining[0]?.id ?? null);
      }
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete medication.");
    } finally {
      setBusy(false);
    }
  };

  const startEditing = () => {
    if (!active) return;
    setForm({
      name: active.name,
      dosage: active.dosage,
      frequency: active.frequency,
      purpose: active.purpose,
      category: active.category,
      refillsLeft: active.refillsLeft == null ? "" : String(active.refillsLeft),
    });
    setEditError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditError(null);
  };

  const saveEdits = async () => {
    if (!active) return;
    if (!form.name.trim()) {
      setEditError("Name can't be empty.");
      return;
    }
    let refills: number | null = null;
    if (form.refillsLeft.trim() !== "") {
      const n = parseInt(form.refillsLeft, 10);
      if (Number.isNaN(n) || n < 0 || n > 99) {
        setEditError("Refills must be a whole number between 0 and 99.");
        return;
      }
      refills = n;
    }
    setBusy(true);
    setEditError(null);
    try {
      await api.medications.update(active.id, {
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        frequency: form.frequency.trim(),
        purpose: form.purpose.trim(),
        category: form.category.trim(),
        sideEffects: active.sideEffects,
        callDoctor: active.callDoctor,
        schedule: active.schedule,
        refillsLeft: refills,
      });
      await refetch();
      setEditing(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!active) return;
    void deleteMedication(active);
  };

  const saveSchedule = async (nextSchedule: Medication["schedule"]) => {
    if (!active) return;
    setBusy(true);
    try {
      await api.medications.update(active.id, {
        name: active.name,
        dosage: active.dosage,
        frequency: active.frequency,
        purpose: active.purpose,
        category: active.category,
        sideEffects: active.sideEffects,
        callDoctor: active.callDoctor,
        schedule: nextSchedule,
        refillsLeft: active.refillsLeft,
      });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update schedule.");
    } finally {
      setBusy(false);
    }
  };

  const addSlot = async () => {
    if (!active) return;
    const next = [...active.schedule, { time: newSlotTime, label: newSlotLabel.trim() || "Dose", withFood: newSlotWithFood }]
      .sort((a, b) => a.time.localeCompare(b.time));
    await saveSchedule(next);
    setNewSlotLabel("Morning dose");
    setNewSlotTime("08:00");
    setNewSlotWithFood(false);
  };

  const removeSlot = async (time: string) => {
    if (!active) return;
    await saveSchedule(active.schedule.filter(s => s.time !== time));
  };

  // Aggregate daily schedule grouped by slot
  const dailySchedule = useMemo(() => {
    const slots = { morning: [] as Medication[], midday: [] as Medication[], evening: [] as Medication[], night: [] as Medication[] };
    for (const m of meds) {
      for (const s of m.schedule) {
        slots[timeOfDay(s.time)].push(m);
      }
    }
    return slots;
  }, [meds]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="MedGuide" title="Explain my medication" />
        <div className="card text-center text-ink-400 py-16">Loading your medications…</div>
      </>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader eyebrow="MedGuide" title="Explain my medication" />
        <div className="card text-center text-coral-600 py-12">{error}</div>
      </>
    );
  }
  if (!active) {
    return (
      <>
        <PageHeader eyebrow="MedGuide" title="Explain my medication" />
        <div className="card text-center py-16 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blush-100 flex items-center justify-center">
            <PillIcon className="w-7 h-7 text-blush-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-charcoal-900">No medications yet</p>
            <p className="text-sm text-ink-500 mt-1">Scan a bottle to add one — Clarity will look it up and fill in the details.</p>
          </div>
          <button onClick={() => setScannerOpen(true)} className="btn-primary mx-auto px-5 py-3">
            <ScanIcon className="w-4 h-4" /> Scan a medicine bottle
          </button>
        </div>
        {scannerOpen && (
          <MedScanner
            meds={meds}
            onClose={() => setScannerOpen(false)}
            onMatch={async (medId) => {
              setScannerOpen(false);
              await refetch();
              setActiveId(medId);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="MedGuide"
        title="Explain my medication"
        subtitle="Plain-language explanations, side effects, and a visual daily schedule for every medication you take."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Sidebar: med list */}
        <aside className="lg:col-span-2 space-y-4">
          <div className="card bg-blush-50 border-blush-100">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search a medication"
                  className="input pl-9"
                />
              </div>
              <button
                onClick={() => setScannerOpen(true)}
                className="btn-primary px-3 shrink-0"
                title="Scan a medicine bottle"
                aria-label="Scan a medicine bottle"
              >
                <ScanIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {filtered.map(m => (
                <li key={m.id}>
                  <div
                    className={`group w-full p-3 rounded-2xl transition border-2 flex items-center gap-2 ${
                      m.id === activeId
                        ? "border-brand-400 bg-brand-50"
                        : "border-transparent hover:bg-ink-50"
                    }`}
                  >
                    <button
                      onClick={() => setActiveId(m.id)}
                      className="flex-1 min-w-0 text-left flex items-center gap-3"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        m.id === activeId ? "bg-brand-gradient text-white shadow-soft" : "bg-white ring-1 ring-ink-100 text-brand-700"
                      }`}>
                        <PillIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900 truncate">{m.name}</p>
                        <p className="text-xs text-ink-600 truncate">{m.dosage} · {m.category}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => deleteMedication(m)}
                      disabled={busy}
                      className="shrink-0 w-8 h-8 rounded-full bg-white shadow-soft ring-1 ring-coral-100 flex items-center justify-center text-coral-500 hover:text-coral-600 hover:ring-coral-200 transition disabled:opacity-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      title={`Delete ${m.name}`}
                      aria-label={`Delete ${m.name}`}
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="text-sm text-ink-400 text-center py-6">No medications match "{query}"</li>
              )}
            </ul>
          </div>

          {/* Combined daily schedule */}
          <div className="card bg-butter-50 border-butter-200">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="w-4 h-4 text-brand-700" />
              <p className="section-title">Your visual day</p>
            </div>
            <div className="space-y-3">
              {(Object.keys(SLOT_META) as Array<keyof typeof SLOT_META>).map(slot => {
                const meds = dailySchedule[slot];
                const meta = SLOT_META[slot];
                const Icon = meta.icon;
                return (
                  <div key={slot} className={`rounded-2xl p-3 bg-gradient-to-br ${meta.color} ring-1`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-ink-800" />
                        <p className="text-sm font-semibold text-ink-900">{meta.label}</p>
                      </div>
                      <span className="pill bg-white text-ink-600 ring-1 ring-ink-100">
                        {meds.length} med{meds.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {meds.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {meds.map(m => (
                          <li key={m.id} className="text-xs text-ink-700 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {m.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Detail */}
        <section className="lg:col-span-3 space-y-4">
          <div className="card bg-cream-50 border-cream-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-title">Selected medication</p>
                <h2 className="text-2xl font-extrabold mt-1">{active.name}</h2>
                <p className="text-ink-600">{active.dosage} · {active.frequency}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="pill bg-brand-50 text-brand-700 ring-1 ring-brand-100">{active.category}</span>
                {!editing && (
                  <button
                    onClick={startEditing}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-charcoal-900 text-white text-xs font-semibold hover:bg-charcoal-800 transition disabled:opacity-50"
                    title={`Edit ${active.name}`}
                    aria-label={`Edit ${active.name}`}
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-coral-50 text-coral-600 ring-1 ring-coral-100 text-xs font-semibold hover:bg-coral-100 hover:ring-coral-200 transition disabled:opacity-50"
                  title={`Delete ${active.name}`}
                  aria-label={`Delete ${active.name}`}
                >
                  <XIcon className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            {editing && (
              <div className="mt-5 rounded-2xl bg-white ring-1 ring-blush-100 p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wider font-bold text-charcoal-800/60">
                  Edit medication
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-ink-600 block mb-1">Name</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="input w-full text-sm"
                      placeholder="Medication name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-ink-600 block mb-1">Dosage</label>
                    <input
                      value={form.dosage}
                      onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                      className="input w-full text-sm"
                      placeholder="e.g. 10 mg tablet"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-ink-600 block mb-1">Frequency</label>
                    <input
                      value={form.frequency}
                      onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                      className="input w-full text-sm"
                      placeholder="e.g. Once daily"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-ink-600 block mb-1">Category</label>
                    <input
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="input w-full text-sm"
                      placeholder="e.g. Pain relief"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold text-ink-600 block mb-1">What it's for</label>
                    <textarea
                      value={form.purpose}
                      onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                      className="input w-full text-sm min-h-[80px] resize-y"
                      placeholder="Plain-language description"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-ink-600 block mb-1">Refills left</label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={form.refillsLeft}
                      onChange={e => setForm(f => ({ ...f, refillsLeft: e.target.value }))}
                      className="input w-full text-sm"
                      placeholder="—"
                    />
                  </div>
                </div>
                {editError && (
                  <p className="text-xs text-coral-600">{editError}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={cancelEditing}
                    disabled={busy}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdits}
                    disabled={busy}
                    className="btn-primary disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-mint-50 ring-1 ring-mint-200 p-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-mint-500">What it's for</p>
                <p className="text-sm text-ink-800 mt-1.5 leading-relaxed">{active.purpose}</p>
              </div>
              <div className="rounded-2xl bg-sun-50 ring-1 ring-sun-100 p-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-sun-500 flex items-center gap-1.5">
                  <AlertIcon className="w-3.5 h-3.5" /> Common side effects
                </p>
                <ul className="text-sm text-ink-800 mt-1.5 space-y-1">
                  {active.sideEffects.map(s => (
                    <li key={s} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sun-400 mt-1.5 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-coral-50 ring-1 ring-coral-100 p-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-coral-600 flex items-center gap-1.5">
                  <AlertIcon className="w-3.5 h-3.5" /> Call a doctor if
                </p>
                <ul className="text-sm text-ink-800 mt-1.5 space-y-1">
                  {active.callDoctor.map(s => (
                    <li key={s} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-coral-500 mt-1.5 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Visual daily schedule for active med */}
          <div className="card bg-lavender-50 border-lavender-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-title">Daily schedule</p>
                <h3 className="text-lg font-bold mt-1">When to take {active.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="pill bg-ink-100 text-ink-600">
                  <BookIcon className="w-3.5 h-3.5" /> Refills left: {active.refillsLeft ?? "—"}
                </span>
                <button
                  onClick={() => setEditingSchedule(v => !v)}
                  className="pill bg-white text-charcoal-800 ring-1 ring-charcoal-800/15 hover:ring-charcoal-800/40 transition"
                >
                  <ClockIcon className="w-3.5 h-3.5" />
                  {editingSchedule ? "Done" : "Edit times"}
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="h-2 rounded-full bg-gradient-to-r from-sun-100 via-mint-100 via-sky2-100 to-brand-100" />
              <div className="grid grid-cols-4 mt-2 text-[10px] uppercase tracking-wider font-semibold text-ink-400">
                <span>Morning</span><span className="text-center">Midday</span><span className="text-center">Evening</span><span className="text-right">Night</span>
              </div>

              {active.schedule.length === 0 && !editingSchedule && (
                <div className="mt-6 rounded-2xl bg-white/70 ring-1 ring-lavender-100 p-6 text-center">
                  <p className="text-sm text-ink-600">No times set yet. Click <span className="font-semibold">Edit times</span> to add when you should take this medication.</p>
                </div>
              )}

              <ul className="mt-6 grid sm:grid-cols-2 gap-3">
                {active.schedule.map(s => {
                  const slot = timeOfDay(s.time);
                  const meta = SLOT_META[slot];
                  const Icon = meta.icon;
                  return (
                    <li key={s.time} className={`p-4 rounded-2xl bg-gradient-to-br ${meta.color} ring-1 relative group`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.dot} text-white`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-ink-900">{s.label}</p>
                            <p className="text-xs text-ink-600">{s.time}</p>
                          </div>
                        </div>
                        {editingSchedule ? (
                          <button
                            onClick={() => removeSlot(s.time)}
                            disabled={busy}
                            className="w-7 h-7 rounded-full bg-white shadow-soft ring-1 ring-coral-100 flex items-center justify-center text-coral-500 hover:text-coral-600 hover:ring-coral-200 transition disabled:opacity-50"
                            aria-label={`Remove ${s.label} at ${s.time}`}
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="pill bg-white text-ink-600 ring-1 ring-ink-100">
                            {s.withFood ? "With food" : "Anytime"}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {editingSchedule && (
                <div className="mt-4 rounded-2xl bg-white ring-1 ring-lavender-200 p-4">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-charcoal-800/60 mb-2">Add a dose time</p>
                  <div className="grid sm:grid-cols-4 gap-2">
                    <input
                      type="time"
                      value={newSlotTime}
                      onChange={e => setNewSlotTime(e.target.value)}
                      className="input"
                    />
                    <input
                      type="text"
                      value={newSlotLabel}
                      onChange={e => setNewSlotLabel(e.target.value)}
                      placeholder="Label (e.g. Morning dose)"
                      className="input sm:col-span-2"
                    />
                    <label className="flex items-center gap-2 px-3 rounded-xl bg-mint-50 ring-1 ring-mint-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSlotWithFood}
                        onChange={e => setNewSlotWithFood(e.target.checked)}
                      />
                      <span className="text-xs font-semibold text-mint-500">With food</span>
                    </label>
                  </div>
                  <button
                    onClick={addSlot}
                    disabled={busy || !newSlotTime}
                    className="btn-primary w-full justify-center mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="w-4 h-4" /> Add dose time
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* FAQs */}
          <div className="card bg-mint-50 border-mint-200">
            <p className="section-title">Frequently asked</p>
            <div className="mt-3 space-y-2">
              {[
                { q: "What if I miss a dose?", a: "Take it as soon as you remember unless it's almost time for your next dose. Do not double up." },
                { q: "Can I drink alcohol with this?", a: "Mixing alcohol with most medications can intensify side effects. Ask your pharmacist about specifics." },
                {
                  q: "Should I take it with food?",
                  a: active.schedule.some(s => s.withFood)
                    ? "Yes — taking it with food usually reduces stomach upset and improves absorption."
                    : "Food is not strictly required, but staying consistent helps your routine.",
                },
              ].map((item) => (
                <details key={item.q} className="group rounded-2xl border border-ink-100 bg-white p-4 open:bg-ink-50">
                  <summary className="cursor-pointer list-none flex items-center justify-between font-semibold text-ink-900">
                    {item.q}
                    <CheckIcon className="w-4 h-4 text-brand-600 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 text-sm text-ink-600 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-400">
              Information is general and educational. Your pharmacist or doctor is the final word for your situation.
            </p>
          </div>
        </section>
      </div>

      {scannerOpen && (
        <MedScanner
          meds={meds}
          onClose={() => setScannerOpen(false)}
          onMatch={async (medId) => {
            setScannerOpen(false);
            await refetch();
            setActiveId(medId);
          }}
        />
      )}
    </>
  );
}
