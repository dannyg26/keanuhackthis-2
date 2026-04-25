/**
 * Stylized brand-mark for each pharmacy. Not actual trademarks — generic
 * recognizable text/colors so users can spot which store at a glance.
 */

interface PharmacyLogoProps {
  pharmacy: string;
  size?: number;
  className?: string;
}

interface MarkSpec {
  letters: string;
  bg: string;
  fg: string;
  shape: "pill" | "circle" | "square";
}

const MARKS: Array<{ match: RegExp; spec: MarkSpec }> = [
  { match: /cvs/i,                   spec: { letters: "CVS",  bg: "#dc2626", fg: "#ffffff", shape: "square" } },
  { match: /walgreen/i,              spec: { letters: "Wg",   bg: "#e11d48", fg: "#ffffff", shape: "circle" } },
  { match: /costco/i,                spec: { letters: "Co",   bg: "#1d4ed8", fg: "#ffffff", shape: "pill" } },
  { match: /rite\s?aid/i,            spec: { letters: "RA",   bg: "#1e40af", fg: "#ffffff", shape: "square" } },
  { match: /walmart/i,               spec: { letters: "W",    bg: "#0284c7", fg: "#facc15", shape: "circle" } },
  { match: /target/i,                spec: { letters: "T",    bg: "#dc2626", fg: "#ffffff", shape: "circle" } },
  { match: /local|independent/i,     spec: { letters: "Rx",   bg: "#0f766e", fg: "#ffffff", shape: "pill" } },
];

const FALLBACK: MarkSpec = { letters: "Rx", bg: "#475569", fg: "#ffffff", shape: "square" };

export default function PharmacyLogo({ pharmacy, size = 36, className = "" }: PharmacyLogoProps) {
  const spec = MARKS.find(m => m.match.test(pharmacy))?.spec ?? FALLBACK;

  const radius =
    spec.shape === "circle" ? size / 2 :
    spec.shape === "pill"   ? size / 3 :
    size * 0.22;

  const fontSize = size * (spec.letters.length >= 3 ? 0.32 : 0.42);

  return (
    <div
      className={`shrink-0 flex items-center justify-center font-extrabold tracking-tighter shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        background: spec.bg,
        color: spec.fg,
        borderRadius: radius,
        fontSize,
        letterSpacing: "-0.02em",
      }}
      aria-label={pharmacy}
    >
      {spec.letters}
    </div>
  );
}
