import { useState, useRef } from "react";
import PageHeader from "../components/PageHeader";
import {
  ShieldIcon, AlertIcon, CheckIcon, SparklesIcon, ArrowRightIcon, XIcon, UploadIcon, CopyIcon,
} from "../components/Icon";
import { api, type CoverageResult, type CoveragePath, type CoverageAlert, type DenialExplainResult, type DenialAppealResult } from "../lib/api";

const SEVERITY_STYLE = {
  high:   "bg-coral-50 border-coral-100 text-coral-700",
  medium: "bg-sun-50 border-sun-100 text-sun-700",
  low:    "bg-sky2-50 border-sky2-100 text-sky2-700",
};

const SCORE_COLOR = (s: number) => s >= 75 ? "text-mint-600" : s >= 50 ? "text-sun-500" : "text-coral-600";
const SCORE_LABEL = (s: number) => s >= 75 ? "Strong fit" : s >= 50 ? "Needs verification" : "Risky";


const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
  "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

interface CoverageForm {
  coverageType: string;
  age: string;
  state: string;
  zip: string;
  householdSize: string;
  employmentStatus: string;
  income: string;
  monthlyBudget: string;
  insuranceStatus: string;
  currentPlan: string;
  careNeeds: string;
  prescriptions: string;
}

const EMPTY_FORM: CoverageForm = {
  coverageType: "individual",
  age: "", state: "", zip: "", householdSize: "", employmentStatus: "",
  income: "", monthlyBudget: "", insuranceStatus: "", currentPlan: "",
  careNeeds: "", prescriptions: "",
};

const SUCCESS_STYLE = {
  high:   { label: "Strong case — most like this are overturned", color: "text-mint-600 bg-mint-50 border-mint-200" },
  medium: { label: "Moderate case — worth appealing",             color: "text-sun-600 bg-sun-50 border-sun-200"   },
  low:    { label: "Difficult — but still worth trying",          color: "text-coral-600 bg-coral-50 border-coral-200" },
};

export default function Insurance() {
  const [form, setForm] = useState<CoverageForm>(EMPTY_FORM);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Denial analysis state
  const [denialText, setDenialText] = useState("");
  const [denialImgData, setDenialImgData] = useState<string | null>(null);
  const [denialImgType, setDenialImgType] = useState("image/jpeg");
  const [denialImgPreview, setDenialImgPreview] = useState<string | null>(null);
  const [denialFileName, setDenialFileName] = useState("");
  const [denialBusy, setDenialBusy] = useState(false);
  const [denialError, setDenialError] = useState<string | null>(null);
  const [denialResult, setDenialResult] = useState<DenialExplainResult | null>(null);
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [appealResult, setAppealResult] = useState<DenialAppealResult | null>(null);
  const [letterCopied, setLetterCopied] = useState(false);
  const denialFileRef = useRef<HTMLInputElement>(null);

  const handleDenialFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setDenialImgData(url.split(",")[1]);
      setDenialImgType(file.type || "image/jpeg");
      setDenialImgPreview(file.type.startsWith("image/") ? url : null);
      setDenialFileName(file.name);
      setAppealResult(null);
      setAppealError(null);
    };
    reader.readAsDataURL(file);
  };

  const removeDenialFile = () => {
    setDenialImgData(null); setDenialImgPreview(null);
    setDenialFileName(""); setDenialImgType("image/jpeg");
    if (denialFileRef.current) denialFileRef.current.value = "";
  };

  const analyzeDenial = async () => {
    if (!denialText.trim() && !denialImgData) return;
    setDenialBusy(true); setDenialError(null); setDenialResult(null);
    setAppealResult(null); setAppealError(null);
    try {
      const data = await api.denial.explain({ text: denialText, imageData: denialImgData || undefined, imageType: denialImgType });
      setDenialResult(data);
    } catch (e) {
      setDenialError(e instanceof Error ? e.message : "Analysis failed.");
    } finally { setDenialBusy(false); }
  };

  const generateAppeal = async () => {
    if (!denialResult) return;
    setAppealBusy(true); setAppealError(null); setAppealResult(null);
    try {
      const data = await api.denial.appeal({ denialText, analysis: denialResult });
      setAppealResult(data);
    } catch (e) {
      setAppealError(e instanceof Error ? e.message : "Appeal generation failed.");
    } finally { setAppealBusy(false); }
  };

  const copyLetter = async () => {
    if (!appealResult?.letter_text) return;
    await navigator.clipboard.writeText(appealResult.letter_text);
    setLetterCopied(true);
    setTimeout(() => setLetterCopied(false), 2000);
  };

  const field = (k: keyof CoverageForm) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const analyze = async () => {
    const hasInput = Object.values(form).some((v) => typeof v === "string" && v.trim());
    if (!hasInput) {
      setError("Fill in at least one field about your coverage situation.");
      return;
    }
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const data = await api.coverage.analyze(form);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coverage analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setForm(EMPTY_FORM); setResult(null); setError(null); };

  return (
    <>
      <PageHeader
        backTo="/tools"
        eyebrow="Insurance Navigator"
        title="Find the right insurance path"
        subtitle="Tell us your situation and AI will identify your best coverage options, risk alerts, and what to ask next."
        actions={
          <>
            <button onClick={reset} disabled={busy} className="btn-secondary">Reset</button>
            <button onClick={analyze} disabled={busy} className="btn-primary">
              <ShieldIcon className="w-4 h-4" />
              {busy ? "Analyzing…" : "Analyze Coverage"}
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
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-blush-50 border-blush-100 space-y-3">
            <p className="section-title">Your situation</p>

            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Coverage type</label>
              <select {...field("coverageType")} className="input w-full text-sm">
                <option value="individual">Individual</option>
                <option value="family">Family</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-ink-600 block mb-1">Age</label>
                <input {...field("age")} type="number" min="0" max="120" className="input w-full text-sm" placeholder="35" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-ink-600 block mb-1">State</label>
                <select {...field("state")} className="input w-full text-sm">
                  <option value="">— State —</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-ink-600 block mb-1">ZIP code</label>
                <input {...field("zip")} className="input w-full text-sm" placeholder="90210" maxLength={10} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-ink-600 block mb-1">Household size</label>
                <input {...field("householdSize")} type="number" min="1" className="input w-full text-sm" placeholder="1" />
              </div>
            </div>
          </div>

          <div className="card bg-mint-50 border-mint-200 space-y-3">
            <p className="section-title">Income &amp; employment</p>

            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Employment status</label>
              <select {...field("employmentStatus")} className="input w-full text-sm">
                <option value="">— Select —</option>
                <option value="Full-time employed">Full-time employed</option>
                <option value="Part-time employed">Part-time employed</option>
                <option value="Self-employed">Self-employed</option>
                <option value="Unemployed">Unemployed</option>
                <option value="Student">Student</option>
                <option value="Retired">Retired</option>
                <option value="Disabled">Disabled / on leave</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-ink-600 block mb-1">Annual income</label>
                <select {...field("income")} className="input w-full text-sm">
                  <option value="">— Select —</option>
                  <option value="Under $15,000">Under $15,000</option>
                  <option value="$15,000–$30,000">$15,000–$30,000</option>
                  <option value="$30,000–$45,000">$30,000–$45,000</option>
                  <option value="$45,000–$60,000">$45,000–$60,000</option>
                  <option value="$60,000–$80,000">$60,000–$80,000</option>
                  <option value="$80,000–$100,000">$80,000–$100,000</option>
                  <option value="$100,000–$150,000">$100,000–$150,000</option>
                  <option value="Over $150,000">Over $150,000</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-ink-600 block mb-1">Monthly budget</label>
                <select {...field("monthlyBudget")} className="input w-full text-sm">
                  <option value="">— Select —</option>
                  <option value="Under $50/mo">Under $50/mo</option>
                  <option value="$50–$100/mo">$50–$100/mo</option>
                  <option value="$100–$200/mo">$100–$200/mo</option>
                  <option value="$200–$350/mo">$200–$350/mo</option>
                  <option value="$350–$500/mo">$350–$500/mo</option>
                  <option value="Over $500/mo">Over $500/mo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card bg-butter-50 border-butter-200 space-y-3">
            <p className="section-title">Current coverage</p>

            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Insurance status</label>
              <select {...field("insuranceStatus")} className="input w-full text-sm">
                <option value="">— Select —</option>
                <option value="uninsured">Uninsured</option>
                <option value="employer">Employer plan</option>
                <option value="marketplace">Marketplace/ACA plan</option>
                <option value="medicaid">Medicaid/CHIP</option>
                <option value="medicare">Medicare</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Current plan details (optional)</label>
              <input {...field("currentPlan")} className="input w-full text-sm" placeholder="e.g. BlueCross Silver, $1,500 deductible" />
            </div>
          </div>

          <div className="card bg-lavender-50 border-lavender-100 space-y-3">
            <p className="section-title">Care needs</p>
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Expected care needs</label>
              <textarea {...field("careNeeds")} rows={2} className="input w-full text-sm resize-none" placeholder="e.g. Diabetes management, annual checkup, mental health…" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Prescriptions</label>
              <input {...field("prescriptions")} className="input w-full text-sm" placeholder="e.g. Metformin, Lisinopril, insulin" />
            </div>
          </div>

          <button
            onClick={analyze}
            disabled={busy}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            <ShieldIcon className="w-4 h-4" />
            {busy ? "Analyzing…" : "Analyze my coverage options"}
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {!result ? (
            <div className="card bg-cream-50 border-cream-200 text-center py-16">
              <ShieldIcon className="w-10 h-10 mx-auto text-ink-300" />
              <p className="mt-3 text-ink-500 font-medium">Fill in your situation and click Analyze</p>
              <p className="text-sm text-ink-400 mt-1">AI will map out your best insurance paths and risk areas.</p>
              {busy && (
                <div className="mt-6 flex items-center justify-center gap-2 text-brand-700">
                  <div className="w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-700 animate-spin" />
                  <span className="text-sm font-medium">Analyzing your situation…</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Headline + score */}
              <div className="card bg-gradient-to-br from-brand-50 to-mint-50 border-brand-100">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <SparklesIcon className="w-4 h-4 text-brand-700" />
                      <p className="section-title">Coverage Analysis</p>
                    </div>
                    <h2 className="text-xl font-extrabold text-charcoal-900 leading-tight">{result.headline}</h2>
                    <p className="text-sm text-ink-700 mt-2 leading-relaxed">{result.summary}</p>
                  </div>
                  <div className="shrink-0 text-center">
                    <p className={`text-4xl font-extrabold tabular-nums ${SCORE_COLOR(result.plan_fit_score)}`}>
                      {result.plan_fit_score}
                    </p>
                    <p className="text-[10px] text-ink-400 font-semibold">/100</p>
                    <p className={`text-xs font-bold mt-1 ${SCORE_COLOR(result.plan_fit_score)}`}>
                      {result.plan_fit_label || SCORE_LABEL(result.plan_fit_score)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Risk alerts */}
              {result.risk_alerts?.length > 0 && (
                <div className="card bg-cream-50 border-cream-200">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertIcon className="w-4 h-4 text-coral-500" />
                    <p className="section-title">Risk Alerts</p>
                  </div>
                  <div className="space-y-2">
                    {result.risk_alerts.map((alert: CoverageAlert, i: number) => (
                      <div key={i} className={`rounded-xl border p-3 ${SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.low}`}>
                        <div className="flex items-start gap-2">
                          <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-sm">{alert.title}</p>
                            <p className="text-sm mt-0.5">{alert.detail}</p>
                            {alert.question_to_ask && (
                              <p className="text-xs mt-1.5 italic opacity-80">Ask: "{alert.question_to_ask}"</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coverage paths */}
              {result.coverage_paths?.length > 0 && (
                <div className="card bg-cream-50 border-cream-200">
                  <p className="section-title mb-3">Your coverage options</p>
                  <div className="space-y-3">
                    {result.coverage_paths.map((path: CoveragePath, i: number) => (
                      <div key={i} className="rounded-2xl bg-white ring-1 ring-ink-100 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-ink-900">{path.name}</p>
                              <span className="pill bg-brand-50 text-brand-700 ring-1 ring-brand-100 text-[10px] font-bold">
                                {path.match_score}% match
                              </span>
                              <span className="pill bg-ink-50 text-ink-600 ring-1 ring-ink-100 text-[10px]">{path.best_for}</span>
                            </div>
                          </div>
                          {path.website && (
                            <a
                              href={path.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-xs font-semibold text-brand-700 hover:underline flex items-center gap-1"
                            >
                              Visit <ArrowRightIcon className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* Score bar */}
                        <div className="mt-2 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-gradient"
                            style={{ width: `${path.match_score}%` }}
                          />
                        </div>

                        <div className="mt-3 grid sm:grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl bg-mint-50 p-2.5">
                            <p className="font-semibold text-mint-600 mb-1">Why it fits</p>
                            <p className="text-ink-700 leading-relaxed">{path.why_it_fits}</p>
                          </div>
                          <div className="rounded-xl bg-sun-50 p-2.5">
                            <p className="font-semibold text-sun-600 mb-1">Watch out for</p>
                            <p className="text-ink-700 leading-relaxed">{path.watch_out}</p>
                          </div>
                          <div className="rounded-xl bg-brand-50 p-2.5">
                            <p className="font-semibold text-brand-700 mb-1">Next step</p>
                            <p className="text-ink-700 leading-relaxed">{path.next_step}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Yearly scenarios */}
              {result.estimated_yearly_scenarios?.length > 0 && (
                <div className="card bg-butter-50 border-butter-200">
                  <p className="section-title mb-3">Estimated yearly costs (scenarios)</p>
                  <div className="space-y-2">
                    {result.estimated_yearly_scenarios.map((sc, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white ring-1 ring-ink-100">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-ink-900">{sc.scenario}</p>
                          {sc.note && <p className="text-xs text-ink-500 mt-0.5">{sc.note}</p>}
                        </div>
                        <span className="shrink-0 text-base font-extrabold text-brand-700">{sc.likely_cost}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions */}
              {result.questions_to_ask?.length > 0 && (
                <div className="card bg-gradient-to-br from-butter-50 to-blush-50 border-butter-200">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="w-4 h-4 text-brand-700" />
                    <p className="section-title">Questions to ask your insurer or HR</p>
                  </div>
                  <ul className="space-y-2">
                    {result.questions_to_ask.map((q: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-ink-100">
                        <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-ink-800">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Community angle */}
              {result.community_angle && (
                <div className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-600 flex items-start gap-3">
                  <CheckIcon className="w-5 h-5 text-mint-500 shrink-0 mt-0.5" />
                  <p>{result.community_angle}</p>
                </div>
              )}

              <div className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-500 flex items-start gap-3">
                <XIcon className="w-4 h-4 text-ink-300 shrink-0 mt-0.5" />
                <p>
                  This is general guidance, not legal or financial advice. Use "may qualify" and "worth checking"
                  as your guide. Always verify eligibility directly with the program or insurer.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Claim Denial Analyzer ─────────────────────────────────────── */}
      <div className="mt-8 card bg-coral-50 border-coral-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-coral-600 flex items-center justify-center">
            <ShieldIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-ink-900">Claim Denial Analyzer</p>
            <p className="text-xs text-ink-500">Paste your denial letter or upload a photo — AI will explain it and draft your appeal</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Paste denial text or EOB</label>
              <textarea
                value={denialText}
                onChange={(e) => setDenialText(e.target.value)}
                rows={5}
                className="input w-full resize-none text-sm"
                placeholder="Paste the denial reason, EOB text, or the relevant part of your denial letter here…"
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="text-[10px] font-semibold text-ink-600 block mb-1">Or upload a photo of the letter</label>
              {denialImgPreview ? (
                <div className="relative rounded-xl overflow-hidden ring-1 ring-ink-200">
                  <img src={denialImgPreview} alt="Denial letter" className="w-full max-h-40 object-cover" />
                  <button onClick={removeDenialFile}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white transition">
                    <XIcon className="w-3.5 h-3.5 text-ink-600" />
                  </button>
                  <p className="text-xs text-ink-500 p-2">{denialFileName}</p>
                </div>
              ) : denialFileName ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white ring-1 ring-ink-100">
                  <UploadIcon className="w-4 h-4 text-ink-400" />
                  <span className="text-sm text-ink-700 flex-1 truncate">{denialFileName}</span>
                  <button onClick={removeDenialFile}><XIcon className="w-4 h-4 text-ink-400" /></button>
                </div>
              ) : (
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white ring-1 ring-dashed ring-ink-200 cursor-pointer hover:ring-brand-300 hover:bg-brand-50 transition">
                  <UploadIcon className="w-5 h-5 text-ink-400" />
                  <span className="text-sm text-ink-500">Click to upload JPG or PNG</span>
                  <input
                    ref={denialFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDenialFile(f); }}
                  />
                </label>
              )}
            </div>

            {denialError && (
              <div className="flex items-start gap-2 text-coral-600 text-sm bg-coral-100 rounded-xl p-3">
                <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" /><span>{denialError}</span>
              </div>
            )}

            <button
              onClick={analyzeDenial}
              disabled={denialBusy || (!denialText.trim() && !denialImgData)}
              className="btn-primary w-full justify-center disabled:opacity-60"
            >
              <SparklesIcon className="w-4 h-4" />
              {denialBusy ? "Analyzing…" : "Analyze My Denial"}
            </button>
          </div>

          {/* Result */}
          <div>
            {!denialResult && !denialBusy && (
              <div className="rounded-2xl bg-white ring-1 ring-ink-100 p-6 text-center h-full flex flex-col items-center justify-center">
                <ShieldIcon className="w-10 h-10 text-ink-200 mb-3" />
                <p className="text-sm font-semibold text-ink-500">Paste or upload your denial to get started</p>
                <p className="text-xs text-ink-400 mt-1">AI will explain the denial in plain English and help you appeal</p>
              </div>
            )}

            {denialBusy && (
              <div className="rounded-2xl bg-white ring-1 ring-ink-100 p-6 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-brand-200 border-t-brand-700 animate-spin" />
                <p className="text-sm font-medium text-ink-600">Analyzing your denial…</p>
              </div>
            )}

            {denialResult && (
              <div className="space-y-3">
                {/* Success likelihood */}
                <div className={`rounded-xl border p-3 ${SUCCESS_STYLE[denialResult.success_likelihood]?.color ?? SUCCESS_STYLE.medium.color}`}>
                  <p className="font-bold text-sm">Appeal odds: {SUCCESS_STYLE[denialResult.success_likelihood]?.label}</p>
                </div>

                {/* Denial reason */}
                <div className="rounded-xl bg-white ring-1 ring-ink-100 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 mb-1">Denial reason</p>
                  <p className="text-sm font-semibold text-ink-900">{denialResult.denial_reason}</p>
                  <p className="text-sm text-ink-700 mt-1 leading-relaxed">{denialResult.plain_english}</p>
                </div>

                {/* Your rights */}
                <div className="rounded-xl bg-sky2-50 border border-sky2-100 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky2-600 mb-1">Your rights</p>
                  <p className="text-sm text-ink-800 leading-relaxed">{denialResult.your_rights}</p>
                </div>

                {/* Appeal steps */}
                {denialResult.appeal_steps?.length > 0 && (
                  <div className="rounded-xl bg-white ring-1 ring-ink-100 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 mb-2">Appeal steps</p>
                    <ol className="space-y-1.5">
                      {denialResult.appeal_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink-800">
                          <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          {step.replace(/^Step \d+:\s*/i, "")}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Documents needed */}
                {denialResult.documents_needed?.length > 0 && (
                  <div className="rounded-xl bg-butter-50 border border-butter-200 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-butter-600 mb-2">Documents to gather</p>
                    <ul className="space-y-1">
                      {denialResult.documents_needed.map((doc, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink-800">
                          <CheckIcon className="w-4 h-4 text-butter-500 shrink-0 mt-0.5" />{doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Phone script */}
                {denialResult.call_script?.length > 0 && (
                  <div className="rounded-xl bg-lavender-50 border border-lavender-100 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-lavender-600 mb-2">Phone script</p>
                    <ul className="space-y-1.5">
                      {denialResult.call_script.map((line, i) => (
                        <li key={i} className="text-sm text-ink-800 leading-relaxed">{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Generate appeal letter */}
                {!appealResult && (
                  <div className="space-y-2">
                    {appealError && (
                      <div className="flex items-start gap-2 text-coral-600 text-sm bg-coral-50 rounded-xl p-3 border border-coral-100">
                        <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" /><span>{appealError}</span>
                      </div>
                    )}
                    <button
                      onClick={generateAppeal}
                      disabled={appealBusy}
                      className="btn-primary w-full justify-center disabled:opacity-60"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      {appealBusy ? "Generating appeal letter…" : "Generate Appeal Letter"}
                    </button>
                  </div>
                )}

                {/* Appeal letter */}
                {appealResult && (
                  <div className="rounded-xl bg-white ring-1 ring-coral-200 overflow-hidden">
                    <div className="bg-coral-600 px-4 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white/80 uppercase tracking-wide">Appeal Letter</p>
                        <p className="text-sm font-bold text-white">{appealResult.subject_line}</p>
                      </div>
                      <button onClick={copyLetter}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition text-white text-xs font-semibold">
                        <CopyIcon className="w-3.5 h-3.5" />
                        {letterCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <pre className="p-4 text-xs text-ink-700 whitespace-pre-wrap leading-relaxed font-sans max-h-64 overflow-y-auto">
                      {appealResult.letter_text}
                    </pre>
                    <div className="px-4 py-3 bg-ink-50 border-t border-ink-100 flex gap-2">
                      <button onClick={copyLetter} className="btn-primary text-xs px-4 py-2">
                        <CopyIcon className="w-3.5 h-3.5" />
                        {letterCopied ? "Copied!" : "Copy letter"}
                      </button>
                      <button onClick={() => { setAppealResult(null); setAppealError(null); }} className="btn-secondary text-xs px-4 py-2">
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
