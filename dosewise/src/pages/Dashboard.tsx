import { Link } from "react-router-dom";
import { useMemo } from "react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import RiskGauge from "../components/RiskGauge";
import CompanionPanel from "../components/CompanionPanel";
import {
  ShieldIcon,
  PillIcon,
  ReceiptIcon,
  AlertIcon,
  ArrowRightIcon,
  ClockIcon,
  FlameIcon,
  SparklesIcon,
  HeartPulseIcon,
  TagIcon,
  DollarIcon,
} from "../components/Icon";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";

const DEFAULT_RISK = {
  score: 0,
  level: "Low" as const,
  factors: [] as { label: string; points: number; detail: string }[],
  questions: [] as string[],
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
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

export default function Dashboard() {
  const medsQ = useApi(() => api.medications.list());
  const adherenceQ = useApi(() => api.adherence.list());
  const couponsQ = useApi(() => api.coupons.list());
  const billsQ = useApi(() => api.bills.list());
  const riskQ = useApi(() => api.risk.latest());
  const meQ = useApi(() => api.auth.me());

  const meds = medsQ.data?.medications ?? [];
  const adherenceLogs = adherenceQ.data?.logs ?? [];
  const coupons = couponsQ.data?.coupons ?? [];
  const bills = billsQ.data?.bills ?? [];
  const latestBill = bills[0];
  const billItems = latestBill?.items ?? [];

  const risk = riskQ.data?.assessment?.result ?? DEFAULT_RISK;
  const savedCoupons = useMemo(() => coupons.filter((c) => c.saved), [coupons]);
  const totalSavings = useMemo(
    () =>
      savedCoupons.reduce((s, c) => s + (c.originalPrice - c.couponPrice), 0),
    [savedCoupons],
  );

  const adherencePct = useMemo(() => {
    if (meds.length === 0) return 0;
    const last7 = lastNDays(7);
    const expected = last7.length * meds.length;
    let taken = 0;
    for (const d of last7) {
      for (const m of meds) {
        const log = adherenceLogs.find(
          (a) => a.date === d && a.medicationId === m.id,
        );
        if (log?.taken) taken++;
      }
    }
    return Math.round((taken / Math.max(1, expected)) * 100);
  }, [adherenceLogs, meds]);

  const total = latestBill?.total ?? 0;
  const topWarning = useMemo(() => {
    if (risk.factors.length === 0)
      return "Your risk profile looks low — keep it up.";
    const top = [...risk.factors].sort((a, b) => b.points - a.points)[0];
    return top.label + " — " + top.detail;
  }, [risk]);

  const nextAction = useMemo(() => {
    if (risk.score >= 60)
      return "Book a medication review with your pharmacist this week.";
    if (adherencePct < 80)
      return "Set consistent dose times to push adherence above 80%.";
    if (billItems.some((b) => b.flags.length > 0))
      return "Call billing about the flagged charges before paying.";
    return "Log today's doses to keep your streak alive.";
  }, [risk.score, adherencePct, billItems]);

  const streakDays = useMemo(() => {
    if (meds.length === 0) return 0;
    const days = lastNDays(60);
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d === todayStr()) continue;
      const all = meds.every((m) => {
        const log = adherenceLogs.find(
          (l) => l.date === d && l.medicationId === m.id,
        );
        return log?.taken;
      });
      if (all) s++;
      else break;
    }
    return s;
  }, [adherenceLogs, meds]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        eyebrow={greeting}
        title="Welcome back, friend"
        subtitle="Clarity wishes you a calm, healthy day. Here's a quick look at where things stand."
        actions={
          <>
            <Link to="/risk" className="btn-secondary">
              <ShieldIcon className="w-4 h-4" />
              Run risk check
            </Link>
            <Link to="/adherence" className="btn-primary">
              <PillIcon className="w-4 h-4" />
              Log a dose
            </Link>
          </>
        }
      />

      {/* AI Companion hero */}
      <div className="mb-6">
        <CompanionPanel
          riskScore={risk.score}
          riskLevel={risk.level}
          adherencePct={adherencePct}
          streakDays={streakDays}
          medicationNames={meds.map((m) => m.name)}
          userName={meQ.data?.user?.name ?? "friend"}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          tone="butter"
          icon={<HeartPulseIcon className="w-5 h-5 text-butter-500" />}
          label="Risk Score"
          value={
            <span>
              {risk.score}
              <span className="text-sm font-medium text-charcoal-800/50 ml-1">
                /100
              </span>
            </span>
          }
          hint={`${risk.level} risk · ${risk.factors.length} factors`}
        />
        <StatCard
          tone="blush"
          icon={<PillIcon className="w-5 h-5 text-blush-500" />}
          label="Adherence (7d)"
          value={`${adherencePct}%`}
          hint={`${meds.length} medications tracked`}
        />
        <StatCard
          tone="lavender"
          icon={<ReceiptIcon className="w-5 h-5 text-lavender-500" />}
          label="Recent Bill"
          value={`$${total.toFixed(0)}`}
          hint={`${billItems.length} line items`}
        />
        <StatCard
          tone="mint"
          icon={<DollarIcon className="w-5 h-5 text-mint-500" />}
          label="Coupon Savings"
          value={`$${totalSavings.toFixed(0)}`}
          hint={`${savedCoupons.length} active · ${coupons.length} available`}
        />
        <StatCard
          tone="charcoal"
          icon={<AlertIcon className="w-5 h-5 text-blush-300" />}
          label="Top Warning"
          value={
            <span className="text-base font-semibold text-white leading-snug">
              {topWarning.split(" — ")[0]}
            </span>
          }
          hint={topWarning.split(" — ")[1] ?? ""}
        />
      </div>

      {/* Hero row: gauge + next action */}
      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 bg-butter-50 border-butter-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Today's risk</p>
              <h2 className="text-xl font-bold mt-1">
                Your medication risk picture
              </h2>
            </div>
            <Link to="/risk" className="btn-ghost text-sm">
              Recalculate <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <div className="mt-6 grid sm:grid-cols-2 items-center gap-6">
            <div className="flex justify-center">
              <RiskGauge score={risk.score} />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-ink-600">Driving factors:</p>
              <ul className="space-y-2">
                {risk.factors.slice(0, 3).map((f) => (
                  <li
                    key={f.label}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-ink-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {f.label}
                      </p>
                      <p className="text-xs text-ink-600 leading-snug">
                        {f.detail}
                      </p>
                    </div>
                    <span className="pill bg-white ring-1 ring-ink-100 text-ink-600 shrink-0">
                      +{f.points}
                    </span>
                  </li>
                ))}
                {risk.factors.length === 0 && (
                  <li className="text-sm text-mint-500 font-medium">
                    No major risk factors detected.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="card bg-brand-gradient text-white relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-white/15 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4" />
              <p className="text-xs uppercase tracking-wider font-semibold opacity-90">
                Next recommended action
              </p>
            </div>
            <p className="mt-3 text-xl font-bold leading-snug">{nextAction}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                to="/adherence"
                className="rounded-xl bg-white/15 hover:bg-white/25 transition p-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FlameIcon className="w-4 h-4" /> Streak
                </div>
                <p className="text-xs opacity-90 mt-1">View weekly chart</p>
              </Link>
              <Link
                to="/bills"
                className="rounded-xl bg-white/15 hover:bg-white/25 transition p-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ReceiptIcon className="w-4 h-4" /> Bills
                </div>
                <p className="text-xs opacity-90 mt-1">Decode another</p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Today's medications quick log */}
      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 bg-blush-50 border-blush-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-title">Today's plan</p>
              <h2 className="text-xl font-bold mt-1">Medications scheduled</h2>
            </div>
            <Link to="/medguide" className="btn-ghost text-sm">
              Open MedGuide <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <ul className="divide-y divide-ink-100">
            {meds.map((m) => (
              <li
                key={m.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                    <PillIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900">
                      {m.name}{" "}
                      <span className="text-ink-400 font-normal">
                        · {m.dosage}
                      </span>
                    </p>
                    <p className="text-xs text-ink-600 flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {m.schedule.map((s) => s.time).join(" · ")}
                      <span className="text-ink-400">·</span>
                      {m.frequency}
                    </p>
                  </div>
                </div>
                <span className="pill bg-mint-50 text-mint-500 ring-1 ring-mint-200">
                  {m.category.split(" ")[0]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card bg-mint-50 border-mint-100">
          <p className="section-title">Bill snapshot</p>
          <h2 className="text-xl font-bold mt-1">Recent itemized charges</h2>
          <ul className="mt-4 space-y-2">
            {billItems.slice(0, 4).map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-ink-800">{b.description}</span>
                <span
                  className={`font-semibold ${b.flags.length ? "text-coral-600" : "text-ink-900"}`}
                >
                  ${b.amount.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-ink-100 flex items-center justify-between">
            <span className="text-sm text-ink-600">Estimated total</span>
            <span className="text-lg font-extrabold">${total.toFixed(0)}</span>
          </div>
          <Link
            to="/bills"
            className="btn-secondary w-full mt-4 justify-center"
          >
            Open bill breakdown
          </Link>
        </div>
      </div>

      {/* Coupons strip */}
      <div className="mt-6 card bg-lavender-50 border-lavender-100">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <TagIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="section-title">Save on your meds</p>
              <h2 className="text-xl font-bold">Active coupons</h2>
            </div>
          </div>
          <Link to="/savings" className="btn-secondary text-sm">
            Browse all savings <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {savedCoupons.length === 0 ? (
          <div className="text-center py-6 text-ink-400">
            <TagIcon className="w-7 h-7 mx-auto" />
            <p className="text-sm mt-2">
              No active coupons yet — add one in Savings.
            </p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedCoupons.slice(0, 3).map((c) => {
              const savings = c.originalPrice - c.couponPrice;
              const off =
                c.originalPrice > 0
                  ? Math.round(
                      ((c.originalPrice - c.couponPrice) / c.originalPrice) *
                        100,
                    )
                  : 0;
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-ink-100 bg-white p-4 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-gradient text-white flex flex-col items-center justify-center shrink-0">
                    <span className="text-base font-extrabold leading-none">
                      {off}%
                    </span>
                    <span className="text-[9px] uppercase tracking-wider opacity-90">
                      Off
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900 truncate">
                      {c.medication}
                    </p>
                    <p className="text-xs text-ink-600 truncate">
                      {c.pharmacy} · {c.source}
                    </p>
                    <p className="text-sm font-bold text-brand-700 mt-0.5 tabular-nums">
                      Save ${savings.toFixed(2)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
