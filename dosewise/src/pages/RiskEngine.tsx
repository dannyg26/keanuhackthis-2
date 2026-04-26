import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import RiskGauge from "../components/RiskGauge";
import {
  ShieldIcon,
  PlusIcon,
  XIcon,
  AlertIcon,
  SparklesIcon,
  MoonIcon,
  CoffeeIcon,
  ClockIcon,
} from "../components/Icon";
import { levelColor } from "../utils/risk";
import { api, type RiskInput, type RiskResult } from "../lib/api";

const DEFAULT_INPUT: RiskInput = {
  medications: ["Lisinopril", "Metformin", "Atorvastatin"],
  sleepHours: 6,
  alcoholUse: "occasional",
  missedDosesPerWeek: 1,
  inconsistentTiming: false,
  ageRange: "40-64",
  numberOfMedications: 3,
};

export default function RiskEngine() {
  const [input, setInput] = useState<RiskInput>(DEFAULT_INPUT);
  const [newMed, setNewMed] = useState("");
  const [result, setResult] = useState<RiskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill medication chips with the user's actual medications on mount
  useEffect(() => {
    let cancelled = false;
    api.medications
      .list()
      .then(({ medications }) => {
        if (cancelled || medications.length === 0) return;
        const names = medications.map((m) => m.name);
        setInput((prev) => ({
          ...prev,
          medications: names,
          numberOfMedications: names.length,
        }));
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof RiskInput>(k: K, v: RiskInput[K]) =>
    setInput((prev) => ({ ...prev, [k]: v }));

  const addMed = () => {
    const m = newMed.trim();
    if (!m) return;
    setInput((prev) => ({
      ...prev,
      medications: [...prev.medications, m],
      numberOfMedications: prev.medications.length + 1,
    }));
    setNewMed("");
    // Persist to server so it survives reload
    api.medications
      .create({
        name: m,
        dosage: "As directed",
        frequency: "daily",
        purpose: "Added from Risk Engine",
        category: "Other",
        sideEffects: [],
        callDoctor: [],
        schedule: [],
        refillsLeft: null,
      })
      .catch(() => {
        /* non-critical — local state already updated */
      });
  };

  const removeMed = (idx: number) => {
    setInput((prev) => {
      const meds = prev.medications.filter((_, i) => i !== idx);
      return { ...prev, medications: meds, numberOfMedications: meds.length };
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { assessment } = await api.risk.calculate(input);
      setResult(assessment.result);
      setTimeout(() => {
        document
          .getElementById("risk-result")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not compute risk");
    } finally {
      setBusy(false);
    }
  };

  const tone = result ? levelColor(result.level) : null;

  return (
    <>
      <PageHeader
        eyebrow="Medication Risk Engine"
        title="Get your personalized risk picture"
        subtitle="Answer a few quick questions. We'll show you a 0–100 score, exactly what's driving it, and questions to ask your provider."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="lg:col-span-3 card space-y-6 bg-blush-50 border-blush-100"
        >
          {/* Medications */}
          <div>
            <label className="label">Your medications</label>
            <div className="flex gap-2">
              <input
                value={newMed}
                onChange={(e) => setNewMed(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMed();
                  }
                }}
                placeholder="e.g. Warfarin"
                className="input"
              />
              <button
                type="button"
                onClick={addMed}
                className="btn-secondary px-3"
              >
                <PlusIcon className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {input.medications.map((m, i) => (
                <span
                  key={i}
                  className="pill bg-brand-50 text-brand-700 ring-1 ring-brand-100 pr-1.5"
                >
                  {m}
                  <button
                    type="button"
                    onClick={() => removeMed(i)}
                    className="ml-1 hover:text-coral-600"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              {input.medications.length === 0 && (
                <p className="text-sm text-ink-400">
                  Add at least one medication to get started.
                </p>
              )}
            </div>
          </div>

          {/* Habits grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Sleep */}
            <div>
              <label className="label flex items-center gap-2">
                <MoonIcon className="w-4 h-4 text-brand-600" />
                Sleep per night
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  value={input.sleepHours}
                  onChange={(e) =>
                    update("sleepHours", parseInt(e.target.value))
                  }
                  className="flex-1 accent-brand-500"
                />
                <span className="w-16 text-center font-bold text-ink-900">
                  {input.sleepHours}h
                </span>
              </div>
            </div>

            {/* Alcohol */}
            <div>
              <label className="label flex items-center gap-2">
                <CoffeeIcon className="w-4 h-4 text-brand-600" />
                Alcohol use
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["none", "occasional", "regular"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update("alcoholUse", opt)}
                    className={`px-2 py-2 rounded-xl text-xs sm:text-sm font-medium border transition capitalize whitespace-nowrap
                      ${
                        input.alcoholUse === opt
                          ? "bg-brand-50 border-brand-400 text-brand-700"
                          : "bg-white border-ink-200 text-ink-600 hover:border-brand-200"
                      }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Missed doses */}
            <div>
              <label className="label">Missed doses per week</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={input.missedDosesPerWeek}
                  onChange={(e) =>
                    update("missedDosesPerWeek", parseInt(e.target.value))
                  }
                  className="flex-1 accent-brand-500"
                />
                <span className="w-16 text-center font-bold text-ink-900">
                  {input.missedDosesPerWeek}
                </span>
              </div>
            </div>

            {/* Inconsistent timing */}
            <div>
              <label className="label flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-brand-600" />I take meds at
                inconsistent times
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => update("inconsistentTiming", v)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition
                      ${
                        input.inconsistentTiming === v
                          ? "bg-brand-50 border-brand-400 text-brand-700"
                          : "bg-white border-ink-200 text-ink-600 hover:border-brand-200"
                      }`}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <div className="sm:col-span-2">
              <label className="label">Age range</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    ["under-18", "Under 18"],
                    ["18-39", "18 – 39"],
                    ["40-64", "40 – 64"],
                    ["65+", "65 +"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => update("ageRange", k)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition
                      ${
                        input.ageRange === k
                          ? "bg-brand-50 border-brand-400 text-brand-700"
                          : "bg-white border-ink-200 text-ink-600 hover:border-brand-200"
                      }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-coral-50 border border-coral-100 text-coral-600 text-sm p-3 flex items-start gap-2">
              <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full justify-center text-base py-3"
          >
            <ShieldIcon className="w-5 h-5" />
            {busy ? "Calculating…" : "Calculate my risk score"}
          </button>
        </form>

        {/* Side info */}
        <aside className="lg:col-span-2 space-y-4">
          <div className="card bg-gradient-to-br from-butter-50 to-cream-50 border-butter-200">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-brand-700" />
              <p className="section-title">How scoring works</p>
            </div>
            <ul className="mt-3 text-sm space-y-1.5 text-ink-700">
              <li>
                · Drug interaction found{" "}
                <span className="text-ink-400">+30</span>
              </li>
              <li>
                · Alcohol with sedating med{" "}
                <span className="text-ink-400">+25</span>
              </li>
              <li>
                · Frequent missed doses{" "}
                <span className="text-ink-400">+20</span>
              </li>
              <li>
                · Sleep under 5 hours <span className="text-ink-400">+15</span>
              </li>
              <li>
                · Inconsistent timing <span className="text-ink-400">+15</span>
              </li>
              <li>
                · Age 65 or older <span className="text-ink-400">+15</span>
              </li>
              <li>
                · 3+ medications <span className="text-ink-400">+10</span>
              </li>
            </ul>
            <p className="text-xs text-ink-400 mt-3 leading-relaxed">
              Capped at 100. Every point on your score traces back to one of
              these rules — no black boxes.
            </p>
          </div>

          <div className="card bg-coral-50 border-coral-100">
            <div className="flex items-center gap-2">
              <AlertIcon className="w-4 h-4 text-coral-600" />
              <p className="section-title">Important</p>
            </div>
            <p className="mt-2 text-sm text-ink-600 leading-relaxed">
              Clarity is a risk-awareness tool. It does not diagnose,
              prescribe, or replace medical advice from a licensed provider.
            </p>
          </div>
        </aside>
      </div>

      {/* Result */}
      {result && (
        <div
          id="risk-result"
          className="mt-8 grid lg:grid-cols-5 gap-6 animate-slideUp"
        >
          <div
            className={`lg:col-span-2 card flex flex-col items-center justify-center text-center ${tone?.bg ?? ""}`}
          >
            <RiskGauge score={result.score} size={220} />
            <p className="mt-4 text-sm text-ink-600 max-w-xs">
              Your score is <span className="font-bold">{result.score}</span>{" "}
              out of 100, which we classify as{" "}
              <span className={`font-bold ${tone?.text}`}>
                {result.level} risk
              </span>
              .
            </p>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="card bg-cream-50 border-cream-200">
              <p className="section-title">What's driving your score</p>
              <ul className="mt-3 space-y-2">
                {result.factors.length === 0 ? (
                  <li className="text-mint-500 font-medium">
                    No major risk factors detected — great work.
                  </li>
                ) : (
                  result.factors.map((f) => (
                    <li
                      key={f.label}
                      className="p-3 rounded-xl bg-ink-50 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-ink-900">{f.label}</p>
                        <p className="text-sm text-ink-600 leading-snug">
                          {f.detail}
                        </p>
                      </div>
                      <span className="pill bg-white text-coral-600 ring-1 ring-coral-100 shrink-0">
                        +{f.points}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="card bg-butter-50 border-butter-200">
              <p className="section-title">
                Questions to ask your doctor or pharmacist
              </p>
              <ul className="mt-3 space-y-2">
                {result.questions.map((q, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl border border-ink-100 bg-white"
                  >
                    <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-ink-800">{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-coral-100 bg-coral-50 p-4 text-sm text-coral-600">
              <strong>Disclaimer:</strong> This score is informational only and
              does not replace medical advice. Talk to a licensed healthcare
              provider before making any medication change.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
