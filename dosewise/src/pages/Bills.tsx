import { useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import {
  ReceiptIcon, AlertIcon, UploadIcon, SparklesIcon, CheckIcon, XIcon, ScanIcon,
} from "../components/Icon";
import { api, type AIBillAnalysis, type AICharge, type AIIssue, type BenchmarkHit } from "../lib/api";

interface QAMessage { role: "user" | "assistant"; content: string; }

const CATEGORY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "Facility Fee":     { bg: "bg-brand-50",    text: "text-brand-700",    dot: "bg-brand-500"    },
  "Professional Fee": { bg: "bg-sky2-50",      text: "text-sky2-600",     dot: "bg-sky2-500"     },
  "Laboratory":       { bg: "bg-lavender-50",  text: "text-lavender-700", dot: "bg-lavender-500" },
  "Imaging":          { bg: "bg-mint-50",      text: "text-mint-600",     dot: "bg-mint-500"     },
  "Medication":       { bg: "bg-butter-50",    text: "text-sun-600",      dot: "bg-sun-400"      },
  "Procedure":        { bg: "bg-blush-50",     text: "text-blush-600",    dot: "bg-blush-500"    },
  "Administrative":   { bg: "bg-sun-50",       text: "text-sun-600",      dot: "bg-sun-400"      },
  "Manually Added":   { bg: "bg-sky2-50",      text: "text-sky2-700",     dot: "bg-sky2-400"     },
  "Other":            { bg: "bg-ink-50",       text: "text-ink-600",      dot: "bg-ink-400"      },
};

const ISSUE_LABELS: Record<string, string> = {
  duplicate: "Duplicate charge",
  high_cost: "Unusually high",
  vague: "Vague description",
  unclear: "Needs clarification",
  repeated_fee: "Repeated fee",
};

const SEVERITY_DOT: Record<BenchmarkHit["severity"], string> = {
  ok: "bg-mint-500",
  watch: "bg-sun-500",
  high: "bg-coral-500",
};
const SEVERITY_LABEL: Record<BenchmarkHit["severity"], string> = {
  ok: "Within range",
  watch: "Above range",
  high: "High — ask billing",
};

function catStyle(cat: string) {
  return CATEGORY_STYLE[cat] ?? CATEGORY_STYLE["Other"];
}

function scoreColor(score: number) {
  if (score >= 80) return "text-mint-600";
  if (score >= 60) return "text-sun-500";
  return "text-coral-600";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Looks clean";
  if (score >= 60) return "Review needed";
  return "Investigate";
}

const SAMPLE_TEXT = `Emergency Room Facility Fee - $980
Comprehensive Blood Panel - $320
Physician Evaluation - $450
Lab Processing Fee - $75
Saline IV Bag - $95
Lab Processing Fee - $75
Imaging Review - $280
Miscellaneous Supplies - $140`;

export default function Bills() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [analysis, setAnalysis] = useState<AIBillAnalysis | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string>("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  const [qaInput, setQaInput] = useState("");
  const [qaBusy, setQaBusy] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const analyze = async (overrideText?: string, b64?: string, mediaType?: string) => {
    setError(null);
    setOcrNote(null);
    setBusy(true);
    try {
      const body: { rawText?: string; imageBase64?: string; imageMediaType?: string } = {};
      if (b64) {
        body.imageBase64 = b64;
        body.imageMediaType = mediaType || imageMediaType;
        setOcrNote("Extracting text from image using AI vision…");
      } else {
        body.rawText = overrideText ?? text;
      }
      const { analysis: result } = await api.bills.aiAnalyze(body);
      setAnalysis(result);
      setOcrNote(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setOcrNote(null);
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      const [header, b64] = result.split(",");
      const mt = header.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
      setImageBase64(b64);
      setImageMediaType(mt);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = () => {
    if (imageBase64) analyze(undefined, imageBase64, imageMediaType);
  };

  const reset = () => {
    setText(SAMPLE_TEXT);
    setImagePreview(null);
    setImageBase64(null);
    setAnalysis(null);
    setError(null);
    setOcrNote(null);
  };

  const potentialSavings = analysis?.audit?.potentialSavings ?? 0;

  const sendQuestion = async () => {
    const q = qaInput.trim();
    if (!q || !analysis || qaBusy) return;
    const billCtx = `Bill total: $${analysis.total.toFixed(0)}, score: ${analysis.score}/100. Summary: ${analysis.summary}. Issues: ${analysis.issues.map((i) => i.description).join("; ") || "none"}. Charges: ${analysis.charges.map((c) => `${c.name} $${c.amount}`).join(", ")}.`;
    setQaMessages((prev) => [...prev, { role: "user", content: q }]);
    setQaInput("");
    setQaBusy(true);
    setQaError(null);
    try {
      const { reply } = await api.companion.chat(
        `[Medical bill context: ${billCtx}]\n\nUser question: ${q}`,
      );
      setQaMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setQaError(e instanceof Error ? e.message : "Failed to get answer");
    } finally {
      setQaBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Medical Bill Breakdown"
        title="Decode your medical bill in seconds"
        subtitle="Paste bill text or upload a photo. AI + benchmark pricing will explain every charge and flag anything suspicious."
        actions={
          <>
            <button onClick={reset} disabled={busy} className="btn-secondary">Reset</button>
            <button onClick={() => analyze()} disabled={busy || !!imageBase64} className="btn-primary">
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
      {ocrNote && (
        <div className="rounded-2xl bg-brand-50 border border-brand-100 text-brand-700 text-sm p-3 mb-4 flex items-start gap-2">
          <SparklesIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{ocrNote}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Input column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-blush-50 border-blush-100">
            <p className="section-title">Paste bill text</p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setImageBase64(null); setImagePreview(null); }}
              rows={10}
              disabled={!!imageBase64}
              className="input mt-2 font-mono text-sm leading-relaxed resize-none disabled:opacity-60"
              placeholder={`Emergency Room Facility Fee - $980\nPhysician Evaluation - $450\n...`}
            />
            <p className="text-xs text-ink-400 mt-2">
              Format: <code className="px-1.5 py-0.5 rounded bg-ink-100">Description - $Amount</code> per line
            </p>
          </div>

          <div className="card bg-mint-50 border-mint-200">
            <p className="section-title">Or upload a photo / scan</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 w-full border-2 border-dashed border-ink-200 rounded-2xl p-6 text-center hover:border-brand-400 hover:bg-brand-50 transition group"
            >
              <UploadIcon className="w-6 h-6 mx-auto text-ink-400 group-hover:text-brand-700" />
              <p className="mt-2 text-sm font-medium text-ink-800">Drop or browse an image</p>
              <p className="text-xs text-ink-400">AI will read the bill from the photo</p>
            </button>
            {imagePreview && (
              <div className="mt-3 relative">
                <img src={imagePreview} alt="Bill preview" className="w-full rounded-xl ring-1 ring-ink-100" />
                <button
                  onClick={() => { setImagePreview(null); setImageBase64(null); }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow-soft flex items-center justify-center hover:bg-coral-50 hover:text-coral-600"
                >
                  <XIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={analyzeImage}
                  disabled={busy}
                  className="mt-3 btn-primary w-full justify-center disabled:opacity-60"
                >
                  <ScanIcon className="w-4 h-4" />
                  {busy ? "Reading image…" : "Analyze this image"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Output column */}
        <div className="lg:col-span-3 space-y-4">
          {!analysis ? (
            <div className="card bg-cream-50 border-cream-200 text-center py-16">
              <ReceiptIcon className="w-10 h-10 mx-auto text-ink-300" />
              <p className="mt-3 text-ink-500 font-medium">Paste a bill and click Analyze</p>
              <p className="text-sm text-ink-400 mt-1">Or upload a photo — AI will read it for you</p>
              {busy && (
                <div className="mt-6 flex items-center justify-center gap-2 text-brand-700">
                  <div className="w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-700 animate-spin" />
                  <span className="text-sm font-medium">Analyzing with AI + benchmarks…</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-3xl bg-butter-200 ring-1 ring-butter-300 p-4 shadow-card">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-charcoal-800/65">Total</p>
                  <p className="mt-1 text-lg sm:text-2xl font-extrabold text-charcoal-900 tabular-nums truncate">
                    ${analysis.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="rounded-3xl bg-blush-200 ring-1 ring-blush-300 p-4 shadow-card">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-charcoal-800/65">Bill Score</p>
                  <p className={`mt-1 text-lg sm:text-2xl font-extrabold tabular-nums ${scoreColor(analysis.score)}`}>
                    {analysis.score}/100
                  </p>
                  <p className="text-[10px] font-semibold text-ink-500">{scoreLabel(analysis.score)}</p>
                </div>
                <div className="rounded-3xl bg-lavender-200 ring-1 ring-lavender-300 p-4 shadow-card">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-charcoal-800/65">Potential Savings</p>
                  <p className={`mt-1 text-lg sm:text-2xl font-extrabold tabular-nums ${potentialSavings > 0 ? "text-mint-600" : "text-charcoal-900"}`}>
                    ${potentialSavings.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* AI Summary */}
              <div className="card bg-gradient-to-br from-brand-50 to-mint-50 border-brand-100">
                <div className="flex items-center gap-2 mb-2">
                  <SparklesIcon className="w-4 h-4 text-brand-700" />
                  <p className="section-title">AI Summary</p>
                </div>
                <p className="text-sm text-ink-800 leading-relaxed">{analysis.summary}</p>
                {analysis.audit?.summary && analysis.audit.summary !== analysis.summary && (
                  <p className="text-xs text-brand-700 mt-2 font-medium">{analysis.audit.summary}</p>
                )}
              </div>

              {/* Issues */}
              {analysis.issues.length > 0 && (
                <div className="card bg-cream-50 border-cream-200">
                  <p className="section-title mb-3">Flags &amp; Issues</p>
                  <ul className="space-y-2">
                    {analysis.issues.map((issue: AIIssue, i: number) => (
                      <li
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-xl ${
                          issue.severity === "warning"
                            ? "bg-coral-50 border border-coral-100"
                            : "bg-sun-50 border border-sun-100"
                        }`}
                      >
                        <AlertIcon className={`w-4 h-4 shrink-0 mt-0.5 ${issue.severity === "warning" ? "text-coral-500" : "text-sun-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold uppercase tracking-wide ${issue.severity === "warning" ? "text-coral-600" : "text-sun-600"}`}>
                              {ISSUE_LABELS[issue.type] ?? issue.type}
                            </span>
                            {issue.relatedCharges?.map((c, j) => (
                              <span key={j} className="pill bg-white text-ink-600 ring-1 ring-ink-100 text-[10px]">{c}</span>
                            ))}
                          </div>
                          <p className="text-sm text-ink-700 mt-0.5">{issue.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Benchmark pricing */}
              {analysis.audit?.benchmarkedCharges?.length > 0 && (
                <div className="card bg-cream-50 border-cream-200">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="w-4 h-4 text-brand-700" />
                    <p className="section-title">Benchmark pricing</p>
                  </div>
                  <ul className="space-y-3">
                    {analysis.audit.benchmarkedCharges.map((hit: BenchmarkHit, i: number) => (
                      <li key={i} className={`rounded-xl p-3 border ${
                        hit.severity === "high" ? "bg-coral-50 border-coral-100"
                        : hit.severity === "watch" ? "bg-sun-50 border-sun-100"
                        : "bg-mint-50 border-mint-100"
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-ink-900">{hit.chargeName}</span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                hit.severity === "high" ? "bg-coral-100 text-coral-700"
                                : hit.severity === "watch" ? "bg-sun-100 text-sun-700"
                                : "bg-mint-100 text-mint-700"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[hit.severity]}`} />
                                {SEVERITY_LABEL[hit.severity]}
                              </span>
                            </div>
                            <p className="text-xs text-ink-500 mt-1">
                              Benchmark: <span className="font-medium text-ink-700">{hit.benchmarkName}</span>
                              {" "}· typical range ${hit.low.toLocaleString()}–${hit.high.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-extrabold text-base ${hit.severity === "high" ? "text-coral-600" : hit.severity === "watch" ? "text-sun-600" : "text-mint-600"}`}>
                              {hit.multiple}×
                            </p>
                            {hit.potentialSavings > 0 && (
                              <p className="text-xs text-mint-600 font-semibold">save ~${hit.potentialSavings}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duplicate groups */}
              {analysis.audit?.duplicateGroups?.length > 0 && (
                <div className="card bg-coral-50 border-coral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertIcon className="w-4 h-4 text-coral-600" />
                    <p className="section-title text-coral-700">Possible duplicate charges</p>
                  </div>
                  <ul className="space-y-2">
                    {analysis.audit.duplicateGroups.map((group, i) => (
                      <li key={i} className="rounded-xl bg-white border border-coral-100 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {group.names.map((name, j) => (
                              <div key={j} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-coral-400 shrink-0" />
                                <span className="text-sm text-ink-800">{name}</span>
                                <span className="text-xs text-ink-500">${group.amount}</span>
                              </div>
                            ))}
                          </div>
                          {group.potentialSavings > 0 && (
                            <span className="shrink-0 text-xs font-bold text-mint-600 bg-mint-50 px-2 py-1 rounded-lg">
                              save ~${group.potentialSavings}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-coral-600 mt-1.5">Ask billing if each line is a separate service.</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Itemized charges */}
              <div className="card bg-cream-50 border-cream-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-title">Itemized charges</p>
                  <span className="pill bg-ink-100 text-ink-600">{analysis.charges.length} items</span>
                </div>
                <ul className="divide-y divide-ink-100">
                  {analysis.charges.map((charge: AICharge, i: number) => {
                    const cs = catStyle(charge.category);
                    return (
                      <li key={i} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <p className="font-semibold text-ink-900">{charge.name}</p>
                              <span className={`pill ${cs.bg} ${cs.text} ring-1 ring-current/20`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cs.dot}`} />
                                {charge.category}
                              </span>
                            </div>
                            <p className="text-sm text-ink-600 mt-1 leading-relaxed">{charge.explanation}</p>
                          </div>
                          <p className="text-lg font-extrabold shrink-0 text-ink-900">
                            ${charge.amount.toFixed(0)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                  <li className="pt-4 flex items-center justify-between font-bold text-ink-900">
                    <span>Total billed</span>
                    <span className="text-2xl">${analysis.total.toFixed(2)}</span>
                  </li>
                </ul>
              </div>

              {/* Questions */}
              <div className="card bg-gradient-to-br from-butter-50 to-blush-50 border-butter-200">
                <div className="flex items-center gap-2 mb-3">
                  <SparklesIcon className="w-4 h-4 text-brand-700" />
                  <p className="section-title">Questions to ask billing or insurance</p>
                </div>
                <ul className="space-y-2">
                  {analysis.questions.map((q: string, i: number) => (
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
                  These flags and benchmark comparisons are AI-generated starting points for conversation, not an official audit.
                  Always confirm the final amount with your provider and insurer.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Follow-up Q&A */}
      {analysis && (
        <div className="mt-6 card bg-gradient-to-br from-lavender-50 to-blush-50 border-lavender-100">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="w-4 h-4 text-brand-700" />
            <p className="section-title">Ask a follow-up question</p>
            <span className="pill bg-brand-100 text-brand-700 text-[10px] font-bold">AI</span>
          </div>

          {qaMessages.length > 0 && (
            <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
              {qaMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                      <SparklesIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-charcoal-800 text-white rounded-br-sm"
                        : "bg-white border border-ink-100 text-ink-800 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {qaBusy && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
                    <SparklesIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white border border-ink-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-brand-200 border-t-brand-700 animate-spin" />
                    <span className="text-sm text-ink-500">Thinking…</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {qaError && (
            <div className="mb-3 flex items-start gap-2 text-coral-600 text-sm bg-coral-50 rounded-xl p-3 border border-coral-100">
              <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" /><span>{qaError}</span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
              placeholder="e.g. Why was I charged twice for lab processing? What should I dispute?"
              className="input flex-1 text-sm"
              disabled={qaBusy}
            />
            <button
              onClick={sendQuestion}
              disabled={qaBusy || !qaInput.trim()}
              className="btn-primary px-4 disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-2">Ask anything about your bill — charges, flags, next steps, or how to dispute.</p>
        </div>
      )}
    </>
  );
}
