import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import {
  TagIcon, StoreIcon, DollarIcon, PlusIcon, SparklesIcon, ClockIcon,
} from "../components/Icon";
import { SAMPLE_PHARMACY_PRICES } from "../data/sampleCoupons";
import { api, type Coupon } from "../lib/api";
import { useApi } from "../lib/useApi";
import CouponTicket from "../components/CouponTicket";

function daysUntil(date: string): number {
  const target = new Date(date + "T12:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Savings() {
  const { data, loading, error: loadError, refetch, setData } =
    useApi(() => api.coupons.list());
  const coupons: Coupon[] = data?.coupons ?? [];
  const savedIds = useMemo(() => coupons.filter(c => c.saved).map(c => c.id), [coupons]);

  const [comparePick, setComparePick] = useState<string>("Lisinopril 10mg");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add coupon form
  const [form, setForm] = useState({
    medication: "", pharmacy: "", originalPrice: "", couponPrice: "", code: "",
  });
  const [adding, setAdding] = useState(false);

  const totalSavings = useMemo(
    () => coupons.filter(c => c.saved).reduce((sum, c) => sum + (c.originalPrice - c.couponPrice), 0),
    [coupons],
  );

  const expiringSoon = useMemo(
    () => coupons.filter(c => c.saved && daysUntil(c.expiresOn) <= 30),
    [coupons],
  );

  const compareList = SAMPLE_PHARMACY_PRICES[comparePick] ?? [];
  const cheapest = compareList.length > 0
    ? [...compareList].sort((a, b) => a.withCouponPrice - b.withCouponPrice)[0]
    : null;

  const toggleSaved = async (id: string) => {
    const target = coupons.find(c => c.id === id);
    if (!target) return;
    setBusyId(id);
    setActionError(null);
    // Optimistic
    setData(prev => ({
      coupons: (prev?.coupons ?? []).map(c => c.id === id ? { ...c, saved: !c.saved } : c),
    }));
    try {
      await api.coupons.toggleSaved(id, !target.saved);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update");
      await refetch();
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (code: string, id: string) => {
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const addCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const original = parseFloat(form.originalPrice);
    const couponP  = parseFloat(form.couponPrice);
    if (!form.medication || !form.pharmacy || !isFinite(original) || !isFinite(couponP) || !form.code) return;

    setAdding(true);
    setActionError(null);
    try {
      const expiresOn = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10);
      await api.coupons.create({
        medication: form.medication,
        pharmacy: form.pharmacy,
        originalPrice: original,
        couponPrice: couponP,
        code: form.code,
        expiresOn,
        source: "Custom",
        note: "Added by you.",
        saved: true,
      });
      await refetch();
      setForm({ medication: "", pharmacy: "", originalPrice: "", couponPrice: "", code: "" });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add coupon");
    } finally {
      setAdding(false);
    }
  };

  const removeCoupon = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    // Optimistic
    setData(prev => ({ coupons: (prev?.coupons ?? []).filter(c => c.id !== id) }));
    try {
      await api.coupons.remove(id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete");
      await refetch();
    } finally {
      setBusyId(null);
    }
  };

  const medOptions = useMemo(
    () => Array.from(new Set([...Object.keys(SAMPLE_PHARMACY_PRICES), ...coupons.map(c => c.medication)])),
    [coupons],
  );

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Savings & Coupons" title="Pay less for the meds you already take" />
        <div className="card text-center text-ink-400 py-16">Loading your coupons…</div>
      </>
    );
  }
  if (loadError) {
    return (
      <>
        <PageHeader eyebrow="Savings & Coupons" title="Pay less for the meds you already take" />
        <div className="card text-center text-coral-600 py-12">{loadError}</div>
      </>
    );
  }


  return (
    <>
      <PageHeader
        eyebrow="Savings & Coupons"
        title="Pay less for the meds you already take"
        subtitle="Save coupons, compare nearby pharmacies, and add your own discount cards. We'll track how much you've saved."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          tone="lavender"
          icon={<DollarIcon className="w-5 h-5 text-lavender-500" />}
          label="Estimated Savings"
          value={`$${totalSavings.toFixed(0)}`}
          hint={`${savedIds.length} coupon${savedIds.length === 1 ? "" : "s"} active`}
        />
        <StatCard
          tone="butter"
          icon={<TagIcon className="w-5 h-5 text-butter-500" />}
          label="Available Coupons"
          value={`${coupons.length}`}
          hint="Across your medications"
        />
        <StatCard
          tone="blush"
          icon={<ClockIcon className="w-5 h-5 text-blush-500" />}
          label="Expiring Soon"
          value={`${expiringSoon.length}`}
          hint={expiringSoon.length === 0 ? "Nothing urgent" : "Use within 30 days"}
        />
      </div>

      <div className="mt-6 grid lg:grid-cols-5 gap-4">
        {/* Coupons list */}
        <section className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-title">Your coupons</p>
            <span className="pill bg-ink-100 text-ink-600">{coupons.length} total</span>
          </div>
          <ul className="space-y-4">
            {coupons.map(c => (
              <CouponTicket
                key={c.id}
                coupon={c}
                saved={c.saved}
                copied={copiedId === c.id}
                busy={busyId === c.id}
                onToggleSaved={() => toggleSaved(c.id)}
                onCopy={() => copy(c.code, c.id)}
                onRemove={c.source === "Custom" ? () => removeCoupon(c.id) : undefined}
              />
            ))}
            {coupons.length === 0 && (
              <li className="card text-center text-ink-400 py-12">
                <TagIcon className="w-8 h-8 mx-auto" />
                <p className="mt-2 text-sm">No coupons yet — add one on the right.</p>
              </li>
            )}
          </ul>
        </section>

        {/* Sidebar: add + compare */}
        <aside className="lg:col-span-2 space-y-4">
          {/* Add coupon */}
          <form onSubmit={addCoupon} className="card space-y-3 bg-blush-50 border-blush-100">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-brand-700" />
              <p className="section-title">Add your own coupon</p>
            </div>
            <div>
              <label className="label">Medication</label>
              <input
                className="input"
                placeholder="e.g. Lisinopril 10mg"
                value={form.medication}
                onChange={e => setForm(f => ({ ...f, medication: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Pharmacy</label>
              <input
                className="input"
                placeholder="e.g. CVS Pharmacy"
                value={form.pharmacy}
                onChange={e => setForm(f => ({ ...f, pharmacy: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Original $</label>
                <input
                  className="input tabular-nums"
                  inputMode="decimal"
                  placeholder="24.99"
                  value={form.originalPrice}
                  onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">With coupon $</label>
                <input
                  className="input tabular-nums"
                  inputMode="decimal"
                  placeholder="4.50"
                  value={form.couponPrice}
                  onChange={e => setForm(f => ({ ...f, couponPrice: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label">Coupon code</label>
              <input
                className="input font-mono tracking-wider"
                placeholder="GRX-LIS-4502"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <button type="submit" disabled={adding} className="btn-primary w-full justify-center">
              <PlusIcon className="w-4 h-4" /> {adding ? "Adding…" : "Add coupon"}
            </button>
            {actionError && (
              <p className="text-xs text-coral-600 mt-1">{actionError}</p>
            )}
          </form>

          {/* Pharmacy comparison */}
          <div className="card bg-butter-50 border-butter-200">
            <div className="flex items-center gap-2 mb-2">
              <StoreIcon className="w-4 h-4 text-brand-700" />
              <p className="section-title">Compare pharmacies</p>
            </div>
            <select
              value={comparePick}
              onChange={e => setComparePick(e.target.value)}
              className="input"
            >
              {medOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {compareList.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">No price data yet for this medication.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {compareList.map(p => {
                  const isCheapest = cheapest && p.pharmacy === cheapest.pharmacy;
                  return (
                    <li
                      key={p.pharmacy}
                      className={`p-3 rounded-xl border ${
                        isCheapest ? "border-brand-400 bg-brand-50" : "border-ink-100 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-900 truncate">{p.pharmacy}</p>
                          <p className="text-xs text-ink-600">{p.distanceMiles.toFixed(1)} mi away</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-ink-400 line-through tabular-nums">${p.cashPrice.toFixed(2)}</p>
                          <p className="text-base font-extrabold text-brand-700 tabular-nums leading-none">
                            ${p.withCouponPrice.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {isCheapest && (
                        <span className="inline-flex items-center gap-1 mt-2 pill bg-brand-gradient text-white">
                          <SparklesIcon className="w-3 h-3" /> Cheapest with coupon
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
              Demo prices for illustration. Real prices vary by plan, location, and stock.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
