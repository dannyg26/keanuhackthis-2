import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import {
  TagIcon, DollarIcon, PlusIcon, SparklesIcon, ClockIcon,
} from "../components/Icon";
import { api, type Coupon, type Medication } from "../lib/api";
import { useApi } from "../lib/useApi";
import CouponTicket from "../components/CouponTicket";
import { offersForMed, REAL_OFFERS, type RealOffer } from "../data/realOffers";

/** Recover the source URL for a real-offer-derived coupon by parsing its id. */
function lookupRealOfferUrl(couponId: string): string | undefined {
  // Coupon id shape: "real-{offerId}-{medId}". Find the offer whose id is a prefix.
  if (!couponId.startsWith("real-")) return undefined;
  const rest = couponId.slice("real-".length);
  const offer = REAL_OFFERS.find(o => rest.startsWith(o.id + "-"));
  return offer?.url;
}

// Map a real public program + a user med to a Coupon-shaped object so we can
// render it in the existing CouponTicket layout.
function realOfferToCoupon(offer: RealOffer, med: Medication): Coupon {
  return {
    id: `real-${offer.id}-${med.id}`,
    medication: med.name + (med.dosage ? ` ${med.dosage}` : ""),
    pharmacy: offer.pharmacy,
    originalPrice: offer.estimatedRetail,
    couponPrice: offer.estimatedPrice,
    expiresOn: offer.expiresOn,
    code: offer.code,
    source: offer.source,
    note: offer.note,
    saved: false,
    createdAt: "",
  };
}

function daysUntil(date: string): number {
  const target = new Date(date + "T12:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
}


export default function Savings() {
  const { data, loading, error: loadError, refetch, setData } =
    useApi(() => api.coupons.list());
  // Only show user-added coupons from the API — the seeded fake ones are filtered out.
  const userAddedCoupons: Coupon[] = (data?.coupons ?? []).filter(c => c.source === "Custom");

  // Pull in the user's actual medications so we can match real public discount programs to them.
  const { data: medsData } = useApi(() => api.medications.list());
  const userMeds: Medication[] = medsData?.medications ?? [];

  // Build the real-offer ticket list from the user's meds × matching public programs.
  const realOfferCoupons: Coupon[] = useMemo(() => {
    const out: Coupon[] = [];
    for (const med of userMeds) {
      for (const offer of offersForMed(med.name)) {
        out.push(realOfferToCoupon(offer, med));
      }
    }
    return out;
  }, [userMeds]);

  // Combined list shown to the user: their own saved coupons + matched real offers.
  const allCoupons: Coupon[] = useMemo(
    () => [...userAddedCoupons, ...realOfferCoupons],
    [userAddedCoupons, realOfferCoupons],
  );

  // Filter state
  const [filter, setFilter] = useState<string>("all");          // chip filter — by pharmacy/source keyword
  const [medFilter, setMedFilter] = useState<string>("all");    // dropdown — by medication

  const visibleCoupons = useMemo(() => {
    let out = allCoupons;
    if (filter === "yours") out = userAddedCoupons;
    else if (filter !== "all") out = out.filter(c => c.pharmacy === filter || c.source === filter);
    if (medFilter !== "all") out = out.filter(c => c.medication === medFilter);
    return out;
  }, [allCoupons, userAddedCoupons, filter, medFilter]);

  // Source/pharmacy chips drawn from what's actually on the page.
  const filterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCoupons) set.add(c.pharmacy);
    return Array.from(set);
  }, [allCoupons]);

  const savedIds = useMemo(() => userAddedCoupons.filter(c => c.saved).map(c => c.id), [userAddedCoupons]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add coupon form
  const [form, setForm] = useState({
    medication: "", pharmacy: "", originalPrice: "", couponPrice: "", code: "",
  });
  const [adding, setAdding] = useState(false);

  const totalSavings = useMemo(
    () => userAddedCoupons.filter(c => c.saved).reduce((sum, c) => sum + (c.originalPrice - c.couponPrice), 0),
    [userAddedCoupons],
  );

  const expiringSoon = useMemo(
    () => userAddedCoupons.filter(c => c.saved && daysUntil(c.expiresOn) <= 30),
    [userAddedCoupons],
  );

  const toggleSaved = async (id: string) => {
    const target = userAddedCoupons.find(c => c.id === id);
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

  // Dropdown options for the "filter by medication" dropdown — every med that
  // appears in the visible offers list (taken from the user's meds + any custom coupons).
  const medOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCoupons) set.add(c.medication);
    return Array.from(set).sort();
  }, [allCoupons]);

  // Reset the med dropdown if the picked med is no longer in the list.
  useEffect(() => {
    if (medFilter !== "all" && !medOptions.includes(medFilter)) {
      setMedFilter("all");
    }
  }, [medOptions, medFilter]);

  if (loading) {
    return (
      <>
        <PageHeader backTo="/tools" eyebrow="Savings & Coupons" title="Pay less for the meds you already take" />
        <div className="card text-center text-ink-400 py-16">Loading your coupons…</div>
      </>
    );
  }
  if (loadError) {
    return (
      <>
        <PageHeader backTo="/tools" eyebrow="Savings & Coupons" title="Pay less for the meds you already take" />
        <div className="card text-center text-coral-600 py-12">{loadError}</div>
      </>
    );
  }


  return (
    <>
      <PageHeader
        backTo="/tools"
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
          label="Available Offers"
          value={`${allCoupons.length}`}
          hint={`${realOfferCoupons.length} real programs match your meds`}
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
            <p className="section-title">Real offers for your meds</p>
            <span className="pill bg-ink-100 text-ink-600">{visibleCoupons.length} shown</span>
          </div>

          {/* Medication dropdown filter */}
          {medOptions.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-ink-500 block mb-1">
                Filter by medication
              </label>
              <select
                value={medFilter}
                onChange={e => setMedFilter(e.target.value)}
                className="input w-full text-sm"
              >
                <option value="all">All medications</option>
                {medOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Keyword filter chips */}
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            {userAddedCoupons.length > 0 && (
              <FilterChip active={filter === "yours"} onClick={() => setFilter("yours")}>
                Your coupons
              </FilterChip>
            )}
            {filterOptions.map(opt => (
              <FilterChip key={opt} active={filter === opt} onClick={() => setFilter(opt)}>
                {opt}
              </FilterChip>
            ))}
          </div>

          <ul className="space-y-4">
            {visibleCoupons.map(c => {
              const isReal = c.id.startsWith("real-");
              const url = isReal ? lookupRealOfferUrl(c.id) : undefined;
              return (
                <CouponTicket
                  key={c.id}
                  coupon={c}
                  saved={isReal ? false : c.saved}
                  copied={copiedId === c.id}
                  busy={busyId === c.id}
                  onToggleSaved={() => !isReal && toggleSaved(c.id)}
                  onCopy={() => copy(c.code, c.id)}
                  onRemove={!isReal && c.source === "Custom" ? () => removeCoupon(c.id) : undefined}
                  externalUrl={url}
                />
              );
            })}
            {visibleCoupons.length === 0 && (
              <li className="card text-center text-ink-400 py-12">
                <TagIcon className="w-8 h-8 mx-auto" />
                <p className="mt-2 text-sm">
                  {userMeds.length === 0
                    ? "Add a medication first to see matching real discount programs."
                    : "No offers match this filter."}
                </p>
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

        </aside>
      </div>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill ring-1 transition text-xs ${
        active
          ? "bg-charcoal-900 text-white ring-charcoal-900"
          : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-400"
      }`}
    >
      {children}
    </button>
  );
}
