import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { ScanIcon, CameraIcon, XIcon, AlertIcon, CheckIcon, PillIcon, SparklesIcon } from "./Icon";
import { api, type Medication } from "../lib/api";
import { loadJSON, saveJSON } from "../utils/storage";

const COMMON_CATEGORIES = [
  "Pain relief",
  "Blood pressure",
  "Cholesterol",
  "Diabetes",
  "Antibiotic",
  "Allergy",
  "Heart",
  "Mental health",
  "Vitamin / supplement",
  "Other",
];

interface MedScannerProps {
  meds: Medication[];
  onClose: () => void;
  onMatch: (medId: string) => void;
}

const CACHE_KEY = "dosewise.scanCache";

interface DrugInfo {
  brandName?: string;
  genericName?: string;
  dosageForm?: string;
  route?: string;
  activeIngredients?: Array<{ name: string; strength: string }>;
  labelerName?: string;
  ndc?: string;
}

// Convert a 12-digit UPC-A to candidate NDC formats and query openFDA.
async function lookupBarcode(code: string): Promise<DrugInfo | null> {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 12 && digits.length !== 11 && digits.length !== 10) return null;

  // For 12-digit UPC-A, drop the leading FDA indicator digit. The remaining 10
  // digits are the NDC body. NDCs come in 5-4-1, 5-3-2, or 4-4-2 formats.
  const body = digits.length === 12 ? digits.slice(1, 11) : digits.slice(0, 10);
  const candidates = new Set<string>([
    `${body.slice(0, 5)}-${body.slice(5, 9)}-${body.slice(9, 10)}`, // 5-4-1
    `${body.slice(0, 5)}-${body.slice(5, 8)}-${body.slice(8, 10)}`, // 5-3-2
    `${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 10)}`, // 4-4-2
    // Also try without package suffix (product_ndc only)
    `${body.slice(0, 5)}-${body.slice(5, 9)}`,
    `${body.slice(0, 5)}-${body.slice(5, 8)}`,
    `${body.slice(0, 4)}-${body.slice(4, 8)}`,
  ]);

  for (const candidate of candidates) {
    try {
      const isProductOnly = candidate.split("-").length === 2;
      const field = isProductOnly ? "product_ndc" : "package_ndc";
      const url = `https://api.fda.gov/drug/ndc.json?search=${field}:%22${candidate}%22&limit=1`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const r = data.results?.[0];
      if (!r) continue;
      return {
        brandName: Array.isArray(r.brand_name) ? r.brand_name[0] : r.brand_name,
        genericName: Array.isArray(r.generic_name) ? r.generic_name[0] : r.generic_name,
        dosageForm: r.dosage_form,
        route: Array.isArray(r.route) ? r.route[0] : r.route,
        activeIngredients: r.active_ingredients,
        labelerName: r.labeler_name,
        ndc: r.product_ndc,
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export default function MedScanner({ meds, onClose, onMatch }: MedScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("init");
  const [drugInfo, setDrugInfo] = useState<DrugInfo | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [manualName, setManualName] = useState("");
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<{ purpose: string; sideEffects: string[]; callDoctor: string[]; provider: "claude" | "fallback" } | null>(null);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let zxingControls: { stop: () => void } | null = null;

    async function handleDetected(code: string) {
      if (detectedRef.current) return;
      detectedRef.current = true;
      setLastCode(code);
      setScanning(false);
      setShowPicker(true);
      setLookingUp(true);
      let info: DrugInfo | null = null;
      try {
        info = await lookupBarcode(code);
        if (!cancelled) setDrugInfo(info);
      } finally {
        if (!cancelled) setLookingUp(false);
      }
      // If FDA gave us a name, immediately ask Claude for patient-friendly info.
      const enrichName = info?.brandName || info?.genericName;
      if (enrichName && !cancelled) {
        setEnriching(true);
        try {
          const { enrichment: e } = await api.medications.enrich({
            name: enrichName,
            genericName: info?.genericName,
            dosageForm: info?.dosageForm,
            route: info?.route,
            activeIngredients: info?.activeIngredients,
          });
          if (!cancelled) setEnrichment(e);
        } catch {
          /* enrichment is best-effort; saving still works without it */
        } finally {
          if (!cancelled) setEnriching(false);
        }
      }
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera access not available in this browser. Use the manual picker below.");
          setDebugInfo("no getUserMedia");
          return;
        }
        if (!videoRef.current) return;

        setDebugInfo("requesting camera…");
        const reader = new BrowserMultiFormatReader();
        let attempts = 0;

        zxingControls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
          videoRef.current,
          (result, err) => {
            if (cancelled) return;
            attempts++;
            if (result) {
              setDebugInfo(`hit on frame ${attempts}: ${result.getText().slice(0, 20)}`);
              handleDetected(result.getText());
            } else if (attempts % 5 === 0) {
              const v = videoRef.current;
              const dims = v ? `${v.videoWidth}x${v.videoHeight}` : "no-video";
              const errName = err ? err.name : "—";
              setDebugInfo(`${attempts}f · ${dims} · ${errName}`);
            }
          },
        );
        setCameraReady(true);
        setScanning(true);
        setDebugInfo("camera live, scanning…");
      } catch (e) {
        const name = e instanceof Error ? e.name : "Error";
        const msg = e instanceof Error ? e.message : String(e);
        setDebugInfo(`fail: ${name} — ${msg.slice(0, 60)}`);
        const message =
          e instanceof Error && e.name === "NotAllowedError"
            ? "Camera permission was denied. Allow access and try again, or pick the medication manually."
            : `Couldn't access the camera (${name}). Use the manual picker below.`;
        setError(message);
      }
    }

    void start();

    return () => {
      cancelled = true;
      zxingControls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmMatch = (medId: string) => {
    if (lastCode) {
      const cache = loadJSON<Record<string, string>>(CACHE_KEY, {});
      cache[lastCode] = medId;
      saveJSON(CACHE_KEY, cache);
    }
    onMatch(medId);
  };

  const saveAsNewMed = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const name = drugInfo?.brandName || drugInfo?.genericName || manualName.trim();
      if (!name) {
        setSaveError("Please enter a name for this medication.");
        setSaving(false);
        return;
      }
      const dosage = drugInfo?.activeIngredients?.[0]?.strength || "";

      // For the manual path (no FDA hit, no auto-enrichment yet), enrich now.
      let final = enrichment;
      if (!final) {
        try {
          const { enrichment: e } = await api.medications.enrich({
            name,
            genericName: drugInfo?.genericName,
            dosageForm: drugInfo?.dosageForm,
            route: drugInfo?.route,
            activeIngredients: drugInfo?.activeIngredients,
          });
          final = e;
          setEnrichment(e);
        } catch {
          /* still save without it */
        }
      }

      const { medication } = await api.medications.create({
        name,
        dosage,
        frequency: "As prescribed",
        purpose: final?.purpose || (drugInfo?.genericName ? `Contains ${drugInfo.genericName.toLowerCase()}` : "Recently scanned medication"),
        category,
        sideEffects: final?.sideEffects ?? [],
        callDoctor: final?.callDoctor ?? [],
        schedule: [],
        refillsLeft: null,
      });

      // Cache the barcode → med ID so future scans jump straight here.
      if (lastCode) {
        const cache = loadJSON<Record<string, string>>(CACHE_KEY, {});
        cache[lastCode] = medication.id;
        saveJSON(CACHE_KEY, cache);
      }
      onMatch(medication.id);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save medication.");
    } finally {
      setSaving(false);
    }
  };

  const tryAgain = () => {
    detectedRef.current = false;
    setShowPicker(false);
    setLastCode(null);
    setDrugInfo(null);
    setLookingUp(false);
    setScanning(true);
    setManualName("");
    setCategory(COMMON_CATEGORIES[0]);
    setSaveError(null);
    setEnrichment(null);
    setEnriching(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-slideUp"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-cream-50 rounded-3xl overflow-hidden shadow-soft border border-blush-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blush-100 bg-blush-50">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-800/65">Scan</p>
            <h3 className="font-extrabold text-charcoal-900 leading-tight">Point camera at a barcode</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center hover:bg-ink-100 transition"
            aria-label="Close scanner"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Camera viewfinder */}
        <div className="relative aspect-[4/3] bg-charcoal-900">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Scanner frame overlay */}
          {cameraReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-3/4 h-3/4 max-w-[280px]">
                {/* corner brackets */}
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
                {/* scan line */}
                {scanning && (
                  <span
                    className="absolute left-2 right-2 h-0.5 bg-brand-400"
                    style={{
                      boxShadow: "0 0 12px 2px rgba(15,118,110,0.7)",
                      animation: "medscan-line 2s ease-in-out infinite",
                    }}
                  />
                )}
                <style>{`
                  @keyframes medscan-line {
                    0%, 100% { top: 8%; }
                    50%      { top: 88%; }
                  }
                `}</style>
              </div>
            </div>
          )}

          {/* Loading state */}
          {!cameraReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80">
              <CameraIcon className="w-8 h-8" />
              <p className="text-sm mt-2 font-semibold">Starting camera…</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-4 shadow-soft text-center max-w-xs">
                <AlertIcon className="w-6 h-6 text-coral-600 mx-auto" />
                <p className="text-sm font-bold mt-2 text-charcoal-900">Camera unavailable</p>
                <p className="text-xs text-ink-600 mt-1 leading-snug">{error}</p>
              </div>
            </div>
          )}

        </div>

        {/* Status / picker / manual */}
        <div className="p-4 space-y-3 max-h-[42vh] overflow-y-auto">
          {showPicker && lastCode ? (
            <>
              <div className="rounded-xl bg-mint-50 border border-mint-200 p-3 flex items-start gap-2">
                <CheckIcon className="w-5 h-5 text-mint-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal-900">Caught a barcode</p>
                  <code className="block mt-0.5 px-1.5 py-0.5 rounded bg-white border border-mint-200 font-mono text-[11px] text-ink-700 break-all">
                    {lastCode}
                  </code>
                </div>
              </div>

              {/* Drug info lookup result */}
              {lookingUp && (
                <div className="rounded-xl bg-blush-50 border border-blush-100 p-3 text-center">
                  <p className="text-xs text-ink-600">Looking up this medication…</p>
                </div>
              )}
              {!lookingUp && drugInfo && (
                <div className="rounded-xl bg-brand-50 border border-brand-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-brand-700">FDA match</p>
                  <p className="text-base font-extrabold text-charcoal-900 mt-0.5 leading-tight">
                    {drugInfo.brandName || drugInfo.genericName || "Unknown"}
                  </p>
                  {drugInfo.brandName && drugInfo.genericName && drugInfo.brandName !== drugInfo.genericName && (
                    <p className="text-xs text-ink-600 italic mt-0.5 capitalize">
                      {drugInfo.genericName.toLowerCase()}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {drugInfo.dosageForm && (
                      <span className="pill bg-white text-ink-700 ring-1 ring-ink-100 text-[10px] capitalize">
                        {drugInfo.dosageForm.toLowerCase()}
                      </span>
                    )}
                    {drugInfo.route && (
                      <span className="pill bg-white text-ink-700 ring-1 ring-ink-100 text-[10px] capitalize">
                        {drugInfo.route.toLowerCase()}
                      </span>
                    )}
                    {drugInfo.ndc && (
                      <span className="pill bg-white text-ink-500 ring-1 ring-ink-100 text-[10px] font-mono">
                        NDC {drugInfo.ndc}
                      </span>
                    )}
                  </div>
                  {drugInfo.activeIngredients && drugInfo.activeIngredients.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {drugInfo.activeIngredients.slice(0, 4).map((ing) => (
                        <li key={ing.name} className="text-xs text-ink-700 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-brand-500 shrink-0" />
                          <span className="capitalize">{ing.name.toLowerCase()}</span>
                          {ing.strength && <span className="text-ink-500">— {ing.strength}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {drugInfo.labelerName && (
                    <p className="mt-2 text-[10px] text-ink-400 capitalize">
                      by {drugInfo.labelerName.toLowerCase()}
                    </p>
                  )}
                </div>
              )}
              {!lookingUp && !drugInfo && (
                <div className="rounded-xl bg-sun-50 border border-sun-100 p-3">
                  <p className="text-xs text-ink-600">
                    Couldn't auto-identify this barcode. Enter the medication's name below and pick a category to add it.
                  </p>
                </div>
              )}

              {/* AI-generated patient info */}
              {enriching && (
                <div className="rounded-xl bg-lavender-50 border border-lavender-100 p-3 text-center">
                  <p className="text-xs text-ink-600 inline-flex items-center gap-1.5">
                    <SparklesIcon className="w-3.5 h-3.5 text-lavender-500" />
                    Asking AI for patient-friendly info…
                  </p>
                </div>
              )}
              {!enriching && enrichment && (
                <div className="rounded-xl bg-lavender-50 border border-lavender-100 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-lavender-500 inline-flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" />
                    AI summary {enrichment.provider === "fallback" && <span className="font-normal text-ink-400 ml-1">(generic)</span>}
                  </p>
                  {enrichment.purpose && (
                    <p className="text-sm text-charcoal-900 leading-snug">{enrichment.purpose}</p>
                  )}
                  {enrichment.sideEffects.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Common side effects</p>
                      <ul className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
                        {enrichment.sideEffects.slice(0, 4).map((s) => (
                          <li key={s} className="text-xs text-ink-700 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-sun-400 shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichment.callDoctor.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-coral-600">Call a doctor if</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {enrichment.callDoctor.slice(0, 4).map((s) => (
                          <li key={s} className="text-xs text-ink-700 flex items-start gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-coral-500 mt-1.5 shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Save as new med form (shown for both identified and unidentified scans) */}
              {!lookingUp && (
                <div className="rounded-xl bg-white border border-blush-100 p-3 space-y-2.5">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-charcoal-800/60">
                    Add to my medications
                  </p>
                  {!drugInfo && (
                    <div>
                      <label className="text-[10px] font-semibold text-ink-600 block mb-1">Medication name</label>
                      <input
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="e.g. Tylenol Extra Strength"
                        className="input w-full text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-semibold text-ink-600 block mb-1">Type</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input w-full text-sm"
                    >
                      {COMMON_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {saveError && (
                    <p className="text-xs text-coral-600">{saveError}</p>
                  )}
                  <button
                    onClick={saveAsNewMed}
                    disabled={saving || (!drugInfo && !manualName.trim())}
                    className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving…" : drugInfo ? `Save ${drugInfo.brandName || drugInfo.genericName}` : "Add to my meds"}
                  </button>
                </div>
              )}

              {meds.length > 0 && (
                <div className="border-t border-ink-100 pt-3">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-charcoal-800/60 mb-2">
                    Or match to existing
                  </p>
                  <ManualMedPicker meds={meds} onPick={confirmMatch} />
                </div>
              )}

              <button onClick={tryAgain} className="btn-secondary w-full justify-center">
                <ScanIcon className="w-4 h-4" /> Scan a different barcode
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-500 text-center flex items-center justify-center gap-1.5">
                <SparklesIcon className="w-3.5 h-3.5" />
                {scanning ? "Looking for a barcode…" : cameraReady ? "Hold still and align the barcode" : ""}
              </p>
              <p className="text-[10px] text-ink-400 text-center font-mono">
                zxing · camera: {cameraReady ? "ready" : "—"} · {debugInfo}
              </p>
              <div className="border-t border-ink-100 pt-3">
                <p className="text-[11px] uppercase tracking-wider font-bold text-charcoal-800/60 mb-2">
                  Or pick manually
                </p>
                <ManualMedPicker meds={meds} onPick={onMatch} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ManualMedPicker({ meds, onPick }: { meds: Medication[]; onPick: (id: string) => void }) {
  if (meds.length === 0) {
    return (
      <p className="text-xs text-ink-400 text-center py-4">
        No medications on file yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {meds.map((m) => (
        <li key={m.id}>
          <button
            onClick={() => onPick(m.id)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white border border-ink-100 hover:border-blush-300 transition text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-blush-100 flex items-center justify-center shrink-0">
              <PillIcon className="w-4 h-4 text-blush-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ink-900 truncate">{m.name}</p>
              <p className="text-xs text-ink-500 truncate">{m.dosage} · {m.frequency}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
