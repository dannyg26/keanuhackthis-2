import { lazy, Suspense, useEffect, useState } from "react";
import { CubeIcon, BookIcon, AlertIcon } from "./Icon";
import type { BodySystem } from "../data/bodyMap";

const BodyMapGLTF = lazy(() => import("./BodyMapGLTF"));

interface Props {
  activeId: BodySystem | null;
  onSelectZone: (id: BodySystem) => void;
}

const CANDIDATE_URLS = [
  "/anatomy.glb",
  "/models/anatomy.glb",
];

/** GLB magic bytes: ASCII "glTF" = 0x46546C67 (little-endian uint32). */
async function isValidGLB(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-11" } });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 4) return false;
    const view = new DataView(buf);
    return view.getUint32(0, true) === 0x46546C67;
  } catch {
    return false;
  }
}

type Status = "checking" | "found" | "missing";

export default function BodyMapAnatomy({ activeId, onSelectZone }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of CANDIDATE_URLS) {
        if (await isValidGLB(url)) {
          if (!cancelled) {
            setModelUrl(url);
            setStatus("found");
          }
          return;
        }
      }
      if (!cancelled) setStatus("missing");
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === "checking") {
    return (
      <div className="w-full h-full flex items-center justify-center text-ink-400 text-sm">
        Checking for anatomy model…
      </div>
    );
  }

  if (status === "found" && modelUrl) {
    return (
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center text-ink-400 text-sm">
            Loading model…
          </div>
        }
      >
        <BodyMapGLTF
          modelUrl={modelUrl}
          activeId={activeId}
          onSelectZone={onSelectZone}
        />
      </Suspense>
    );
  }

  // Missing — show download instructions
  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-cream-50 rounded-2xl">
      <div className="max-w-lg text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-charcoal-800 text-white flex items-center justify-center">
          <CubeIcon className="w-7 h-7" />
        </div>
        <div>
          <p className="section-title">No anatomy model loaded</p>
          <h3 className="mt-1 text-lg font-extrabold text-charcoal-900">
            Drop a free <code className="px-1.5 py-0.5 rounded bg-ink-100 text-sm">.glb</code> file at{" "}
            <code className="px-1.5 py-0.5 rounded bg-ink-100 text-sm">public/anatomy.glb</code>
          </h3>
        </div>
        <p className="text-sm text-ink-600 leading-relaxed">
          The viewer auto-detects the file on next page load and renders it with pan, zoom, and orbit controls.
        </p>

        <div className="rounded-2xl bg-white border border-ink-100 p-4 text-left space-y-3">
          <div className="flex items-center gap-2">
            <BookIcon className="w-4 h-4 text-brand-700" />
            <p className="text-[10px] uppercase tracking-wider font-bold text-brand-700">Free open-source models</p>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-brand-700 font-bold">·</span>
              <div className="min-w-0">
                <a
                  href="https://anatomytool.org/open3dmodel"
                  target="_blank" rel="noreferrer"
                  className="font-semibold text-brand-700 hover:underline"
                >
                  AnatomyTool.org — open 3D models
                </a>
                <p className="text-xs text-ink-600">CC-licensed anatomical models. Register for free, browse, and download <code className="bg-ink-100 px-1 rounded">.glb</code>.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-700 font-bold">·</span>
              <div className="min-w-0">
                <a
                  href="https://sketchfab.com/search?features=downloadable&licenses=322a749bcfa841b29dff1e8a1bb74b0b&q=anatomy&type=models"
                  target="_blank" rel="noreferrer"
                  className="font-semibold text-brand-700 hover:underline"
                >
                  Sketchfab — anatomy (CC-BY, downloadable)
                </a>
                <p className="text-xs text-ink-600">Filter by Downloadable + CC-BY license. Pick "GLB" on the download dialog.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-700 font-bold">·</span>
              <div className="min-w-0">
                <a
                  href="https://poly.pizza/search/anatomy"
                  target="_blank" rel="noreferrer"
                  className="font-semibold text-brand-700 hover:underline"
                >
                  Poly.pizza — anatomy
                </a>
                <p className="text-xs text-ink-600">CC0 + CC-BY models. Direct .glb downloads.</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-700 font-bold">·</span>
              <div className="min-w-0">
                <a
                  href="https://github.com/Z-Anatomy/Z-Anatomy"
                  target="_blank" rel="noreferrer"
                  className="font-semibold text-brand-700 hover:underline"
                >
                  Z-Anatomy (GitHub)
                </a>
                <p className="text-xs text-ink-600">Open-source full-body anatomy project. Export from Blender to GLB.</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl bg-white border border-ink-100 p-4 text-left">
          <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-800/70 mb-2">Quick steps</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs text-ink-700 leading-relaxed">
            <li>Download a model from one of the sources above (look for <code className="bg-ink-100 px-1 rounded">.glb</code> or convert <code className="bg-ink-100 px-1 rounded">.gltf</code>/<code className="bg-ink-100 px-1 rounded">.fbx</code> to <code className="bg-ink-100 px-1 rounded">.glb</code> in Blender).</li>
            <li>Save it as <code className="bg-ink-100 px-1 rounded">dosewise/public/anatomy.glb</code>.</li>
            <li>Refresh this page.</li>
          </ol>
        </div>

        <div className="rounded-xl bg-sun-50 border border-sun-100 text-sun-500 text-xs p-3 flex items-start gap-2">
          <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-left">
            Keep models under ~20 MB for smooth web performance. Use Blender's "Decimate" modifier to reduce polygon count if needed.
          </p>
        </div>
      </div>
    </div>
  );
}
