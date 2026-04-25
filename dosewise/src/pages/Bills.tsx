import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import { ReceiptIcon, AlertIcon, UploadIcon, SparklesIcon, CheckIcon, XIcon } from "../components/Icon";
import { SAMPLE_BILL_TEXT } from "../data/sampleBill";
import { api, type BillFlagType, type BillItem } from "../lib/api";

const FLAG_STYLE: Record<BillFlagType, { label: string; color: string }> = {
  duplicate: { label: "Duplicate",   color: "bg-coral-50 text-coral-600 ring-1 ring-coral-100" },
  high:      { label: "Unusually high", color: "bg-sun-50 text-sun-500 ring-1 ring-sun-100" },
  vague:     { label: "Vague",       color: "bg-sky2-50 text-sky2-600 ring-1 ring-sky2-100" },
  facility:  { label: "Facility fee", color: "bg-brand-50 text-brand-700 ring-1 ring-brand-100" },
};

function billQuestions(items: BillItem[]): string[] {
  const q: string[] = [];
  if (items.some(i => i.flags.some(f => f.type === "duplicate"))) q.push("Can you confirm the duplicated line items are not billed twice?");
  if (items.some(i => i.flags.some(f => f.type === "high"))) q.push("These charges look higher than expected — can you share the negotiated rate or an itemized breakdown?");
  if (items.some(i => i.flags.some(f => f.type === "vague"))) q.push("Can you itemize the 'miscellaneous' or 'supplies' line item with specific codes?");
  if (items.some(i => i.flags.some(f => f.type === "facility"))) q.push("Is the facility fee in-network, and is any portion negotiable or eligible for financial assistance?");
  q.push("Has my insurance been billed correctly, and what is my final patient responsibility?");
  return q;
}

export default function Bills() {
  const [text, setText] = useState(SAMPLE_BILL_TEXT);
  const [items, setItems] = useState<BillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Initial parse via the API on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const { bill } = await api.bills.parse(SAMPLE_BILL_TEXT);
        if (cancelled) return;
        setItems(bill.items);
        setTotal(bill.total);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to parse");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const questions = useMemo(() => billQuestions(items), [items]);
  const flagsCount = items.reduce((sum, i) => sum + i.flags.length, 0);

  const analyze = async () => {
    setError(null);
    setBusy(true);
    try {
      const { bill } = await api.bills.parse(text);
      setItems(bill.items);
      setTotal(bill.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setImagePreview(typeof e.target?.result === "string" ? e.target.result : null);
    reader.readAsDataURL(file);
  };

  const reset = async () => {
    setText(SAMPLE_BILL_TEXT);
    setImagePreview(null);
    await analyze();
  };

  return (
    <>
      <PageHeader
        eyebrow="Medical Bill Breakdown"
        title="Decode your medical bill in seconds"
        subtitle="Paste any bill text below. We'll explain each charge in plain English and flag anything suspicious."
        actions={
          <>
            <button onClick={reset} disabled={busy} className="btn-secondary">Reset to sample</button>
            <button onClick={analyze} disabled={busy} className="btn-primary">
              <ReceiptIcon className="w-4 h-4" />
              {busy ? "Analyzing…" : "Analyze"}
            </button>
          </>
        }
      />

      {error && (
        <div className="rounded-2xl bg-coral-50 border border-coral-100 text-coral-600 text-sm p-3 mb-4 flex items-start gap-2">
          <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Input */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-blush-50 border-blush-100">
            <p className="section-title">Paste bill text</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              className="input mt-2 font-mono text-sm leading-relaxed resize-none"
              placeholder="Emergency Room Facility Fee - $980&#10;Comprehensive Blood Panel - $320..."
            />
            <p className="text-xs text-ink-400 mt-2">
              Each line should be: <code className="px-1.5 py-0.5 rounded bg-ink-100">Description - $Amount</code>
            </p>
          </div>

          <div className="card bg-mint-50 border-mint-200">
            <p className="section-title">Optional: upload a photo</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 w-full border-2 border-dashed border-ink-200 rounded-2xl p-6 text-center hover:border-brand-400 hover:bg-brand-50 transition group"
            >
              <UploadIcon className="w-6 h-6 mx-auto text-ink-400 group-hover:text-brand-700" />
              <p className="mt-2 text-sm font-medium text-ink-800">Drop or browse an image</p>
              <p className="text-xs text-ink-400">Preview only — type or paste the text above to analyze.</p>
            </button>
            {imagePreview && (
              <div className="mt-3 relative">
                <img src={imagePreview} alt="Bill preview" className="w-full rounded-xl ring-1 ring-ink-100" />
                <button
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow-soft flex items-center justify-center hover:bg-coral-50 hover:text-coral-600"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Output */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-3xl bg-butter-200 ring-1 ring-butter-300 p-4 min-w-0 shadow-card">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-charcoal-800/65">Total</p>
              <p className="mt-1 text-lg sm:text-2xl font-extrabold text-charcoal-900 tabular-nums tracking-tight truncate">
                ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-3xl bg-blush-200 ring-1 ring-blush-300 p-4 min-w-0 shadow-card">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-charcoal-800/65">Line Items</p>
              <p className="mt-1 text-lg sm:text-2xl font-extrabold text-charcoal-900 tabular-nums">{items.length}</p>
            </div>
            <div className="rounded-3xl bg-lavender-200 ring-1 ring-lavender-300 p-4 min-w-0 shadow-card">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-charcoal-800/65">Flags</p>
              <p className={`mt-1 text-lg sm:text-2xl font-extrabold tabular-nums ${flagsCount > 0 ? "text-coral-600" : "text-charcoal-900"}`}>
                {flagsCount}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="card bg-cream-50 border-cream-200">
            <div className="flex items-center justify-between mb-3">
              <p className="section-title">Itemized charges</p>
              <span className="pill bg-ink-100 text-ink-600">Plain English</span>
            </div>
            {items.length === 0 ? (
              <div className="text-center py-10 text-ink-400">
                <ReceiptIcon className="w-8 h-8 mx-auto" />
                <p className="mt-2 text-sm">No charges parsed yet — paste a bill and click Analyze.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {items.map(item => (
                  <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <p className="font-semibold text-ink-900">{item.description}</p>
                          {item.flags.map((f, i) => (
                            <span key={i} className={`pill ${FLAG_STYLE[f.type].color}`}>
                              <AlertIcon className="w-3 h-3" />
                              {FLAG_STYLE[f.type].label}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-ink-600 mt-1 leading-relaxed">{item.explanation}</p>
                        {item.flags.map((f, i) => (
                          <p key={i} className="text-xs text-coral-600 mt-1">↳ {f.message}</p>
                        ))}
                      </div>
                      <p className={`text-lg font-extrabold shrink-0 ${item.flags.length ? "text-coral-600" : "text-ink-900"}`}>
                        ${item.amount.toFixed(0)}
                      </p>
                    </div>
                  </li>
                ))}
                <li className="pt-4 flex items-center justify-between font-bold text-ink-900">
                  <span>Estimated total</span>
                  <span className="text-2xl">${total.toFixed(2)}</span>
                </li>
              </ul>
            )}
          </div>

          {/* Questions */}
          <div className="card bg-gradient-to-br from-butter-50 to-blush-50 border-butter-200">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-brand-700" />
              <p className="section-title">Questions to ask billing or insurance</p>
            </div>
            <ul className="mt-3 space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-ink-100">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-ink-800">{q}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-600 flex items-start gap-3">
            <CheckIcon className="w-5 h-5 text-mint-500 shrink-0 mt-0.5" />
            <p>
              These flags are based on common red-flag patterns. They're a starting point for conversation,
              not an audit. Always confirm the final amount with your provider and insurer.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
