import { useEffect, useRef, useState } from "react";
import { ScanIcon, CameraIcon, XIcon, AlertIcon, CheckIcon, PillIcon, SparklesIcon } from "./Icon";
import type { Medication } from "../lib/api";
import { loadJSON, saveJSON } from "../utils/storage";

interface MedScannerProps {
  meds: Medication[];
  onClose: () => void;
  onMatch: (medId: string) => void;
}

const CACHE_KEY = "dosewise.scanCache";

interface MinimalBarcode { rawValue: string; format?: string; }
interface MinimalDetector {
  detect: (source: HTMLVideoElement | ImageBitmap) => Promise<MinimalBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): MinimalDetector;
}
declare global {
  interface Window { BarcodeDetector?: BarcodeDetectorCtor; }
}

const FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "code_39", "data_matrix", "qr_code"];

export default function MedScanner({ meds, onClose, onMatch }: MedScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (supported === null) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let frameId: number | null = null;
    let detector: MinimalDetector | null = null;

    const cache = loadJSON<Record<string, string>>(CACHE_KEY, {});

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera access not available in this browser. Use the manual picker below.");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled || !videoRef.current) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);

        if (supported && window.BarcodeDetector) {
          try {
            detector = new window.BarcodeDetector({ formats: FORMATS });
            setScanning(true);
            loop();
          } catch {
            // Some platforms throw if no formats are supported — silent fall-through to manual.
          }
        }
      } catch (e) {
        const message =
          e instanceof Error && e.name === "NotAllowedError"
            ? "Camera permission was denied. Allow access and try again, or pick the medication manually."
            : "Couldn't access the camera. Use the manual picker below.";
        setError(message);
      }
    }

    async function loop() {
      if (cancelled || !videoRef.current || !detector) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes && codes.length > 0) {
          handleDetected(codes[0].rawValue);
          return;
        }
      } catch { /* ignore — keep looping */ }
      frameId = requestAnimationFrame(loop);
    }

    function handleDetected(code: string) {
      setLastCode(code);
      setScanning(false);
      const cachedId = cache[code];
      if (cachedId) {
        const med = meds.find((m) => m.id === cachedId);
        if (med) {
          onMatch(med.id);
          return;
        }
      }
      setShowPicker(true);
    }

    void start();

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const confirmMatch = (medId: string) => {
    if (lastCode) {
      const cache = loadJSON<Record<string, string>>(CACHE_KEY, {});
      cache[lastCode] = medId;
      saveJSON(CACHE_KEY, cache);
    }
    onMatch(medId);
  };

  const tryAgain = () => {
    setShowPicker(false);
    setLastCode(null);
    setScanning(true);
    // Re-mount the detection loop by tweaking a key — simpler to just rely on next animation frame
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
                    className="absolute left-2 right-2 h-0.5 bg-brand-400 animate-scanline"
                    style={{ boxShadow: "0 0 12px 2px rgba(15,118,110,0.7)" }}
                  />
                )}
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

          {/* Unsupported overlay (camera works but no BarcodeDetector) */}
          {cameraReady && supported === false && !showPicker && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="bg-white/95 backdrop-blur rounded-xl p-2.5 shadow-soft border border-ink-100 text-center">
                <p className="text-[11px] text-ink-700 leading-snug">
                  Live barcode detection isn't available in this browser. Pick the medication manually below.
                </p>
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
                  <p className="text-xs text-ink-600 mt-1.5">Which medication is this? We'll remember it next time.</p>
                </div>
              </div>
              <ManualMedPicker meds={meds} onPick={confirmMatch} />
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
