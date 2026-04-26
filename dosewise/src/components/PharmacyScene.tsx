import { useState } from "react";
import logoSrc from "../assets/logo.jpg";

export type PharmacyHotspotId =
  | "risk" | "adherence" | "bills" | "medguide" | "savings" | "body" | "companion" | "health";

interface PharmacySceneProps {
  activeId: PharmacyHotspotId | null;
  onHover: (id: PharmacyHotspotId | null) => void;
  onSelect: (id: PharmacyHotspotId) => void;
}

interface BottleProps {
  x: number; y: number;
  capColor: string; bodyColor: string; labelColor?: string;
  hotspotId?: PharmacyHotspotId;
  active?: boolean;
  onHover?: (id: PharmacyHotspotId | null) => void;
  onSelect?: (id: PharmacyHotspotId) => void;
}

function Bottle({ x, y, capColor, bodyColor, labelColor = "#fff", hotspotId, active, onHover, onSelect }: BottleProps) {
  const interactive = !!hotspotId;
  return (
    // Outer group ONLY positions the bottle in the SVG. No CSS transform here so
    // the SVG translate attribute isn't fighting with a CSS transform.
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: interactive ? "pointer" : "default" }}
      onMouseEnter={() => hotspotId && onHover?.(hotspotId)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => hotspotId && onSelect?.(hotspotId)}
    >
      {/* Inner group handles the hover lift + scale, using a LOCAL transform-origin
          so it scales around the bottle's own center instead of the SVG origin. */}
      <g
        style={{
          transition: "transform 250ms ease",
          transformBox: "fill-box",
          transformOrigin: "center center",
          transform: active ? "translateY(-8px) scale(1.15)" : "none",
        }}
      >
        {/* Bottle body */}
        <rect x="0" y="14" width="28" height="42" rx="3" fill={bodyColor} stroke="#0f172a" strokeWidth="1" strokeOpacity="0.18" />
        {/* Label */}
        <rect x="2" y="24" width="24" height="16" fill={labelColor} opacity="0.95" />
        <rect x="4" y="28" width="20" height="2" fill="#0f172a" opacity="0.4" />
        <rect x="4" y="33" width="14" height="1.5" fill="#0f172a" opacity="0.3" />
        {/* Cap */}
        <rect x="-2" y="6" width="32" height="10" rx="2" fill={capColor} stroke="#0f172a" strokeWidth="1" strokeOpacity="0.22" />
        <rect x="-2" y="6" width="32" height="2" fill={capColor} opacity="0.6" />
        {/* Hover glow */}
        {active && (
          <rect x="-4" y="2" width="36" height="58" rx="6" fill="none" stroke={capColor} strokeWidth="2" opacity="0.7" />
        )}
      </g>
    </g>
  );
}

interface CapsuleProps {
  x: number; y: number; rotate?: number;
  leftColor: string; rightColor: string;
}
function Capsule({ x, y, rotate = 0, leftColor, rightColor }: CapsuleProps) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotate})`}>
      <rect x="-12" y="-4" width="12" height="8" rx="4" fill={leftColor} stroke="#0f172a" strokeWidth="0.6" strokeOpacity="0.2" />
      <rect x="0" y="-4" width="12" height="8" rx="4" fill={rightColor} stroke="#0f172a" strokeWidth="0.6" strokeOpacity="0.2" />
      <rect x="-10" y="-3" width="2" height="3" fill="white" opacity="0.5" />
    </g>
  );
}

export default function PharmacyScene({ activeId, onHover, onSelect }: PharmacySceneProps) {
  const isActive = (id: PharmacyHotspotId) => activeId === id;
  // Robot arm has its own local "is bent" state — purely decorative, doesn't open the
  // AI Companion popup. Tap toggles the bend.
  const [armPick, setArmPick] = useState(false);

  return (
    <svg viewBox="0 0 900 620" className="w-full h-auto" role="img" aria-label="Interactive pharmacy">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf2f8" />
          <stop offset="100%" stopColor="#fefce8" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#134e4a" />
        </linearGradient>
        <radialGradient id="screenGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
        <pattern id="circuits" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="2" fill="#cbd5e1" opacity="0.6" />
          <path d="M6 6 L30 6 L30 30 L54 30" stroke="#cbd5e1" strokeWidth="0.8" fill="none" opacity="0.5" />
          <circle cx="54" cy="30" r="2" fill="#cbd5e1" opacity="0.6" />
          <path d="M30 30 L30 54" stroke="#cbd5e1" strokeWidth="0.8" fill="none" opacity="0.5" />
          <circle cx="30" cy="54" r="2" fill="#cbd5e1" opacity="0.6" />
        </pattern>
        <pattern id="hexagons" width="40" height="46" patternUnits="userSpaceOnUse">
          <polygon points="20,1 38,11 38,33 20,43 2,33 2,11"
                   fill="none" stroke="#cbd5e1" strokeWidth="0.6" opacity="0.5" />
        </pattern>
      </defs>

      {/* Decorative wall patterns only — wall + floor colors come from the page background. */}
      <rect x="0" y="0" width="80" height="500" fill="url(#circuits)" opacity="0.5" />
      <rect x="700" y="100" width="180" height="280" fill="url(#hexagons)" opacity="0.5" />
      {/* Subtle floor line where the wall meets the floor */}
      <line x1="0" y1="500" x2="900" y2="500" stroke="#94a3b8" strokeWidth="1" opacity="0.35" />

      {/* ─────────────── Pharmacy shelves (left) ─────────────── */}
      <g>
        {/* Shelf cabinet frame */}
        <rect x="80" y="60" width="380" height="380" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="80" y="60" width="380" height="380" rx="8" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.4" />
        {/* Glass shine */}
        <path d="M85 65 L150 65 L120 200 L85 200 Z" fill="white" opacity="0.5" />
        <path d="M250 65 L320 65 L290 200 L250 200 Z" fill="white" opacity="0.4" />

        {/* Vertical dividers */}
        <line x1="205" y1="65" x2="205" y2="435" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="335" y1="65" x2="335" y2="435" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Horizontal shelves */}
        {[150, 240, 330, 420].map(y => (
          <line key={y} x1="85" y1={y} x2="455" y2={y} stroke="#94a3b8" strokeWidth="2" opacity="0.6" />
        ))}

        {/* ─── Top shelf — decorative bottles, evenly spaced inside each section ─── */}
        {/* Section 1 (x=85–205): 3 bottles centered, ~9px gaps */}
        <Bottle x={94}  y={90} capColor="#ec4899" bodyColor="#fbcfe8" />
        <Bottle x={131} y={90} capColor="#fb923c" bodyColor="#fed7aa" />
        <Bottle x={168} y={90} capColor="#0ea5e9" bodyColor="#bae6fd" />
        {/* Section 2 (x=205–335): 3 bottles centered */}
        <Bottle x={214} y={90} capColor="#22c55e" bodyColor="#bbf7d2" />
        <Bottle x={251} y={90} capColor="#a855f7" bodyColor="#e9d5ff" />
        <Bottle x={288} y={90} capColor="#fbbf24" bodyColor="#fef3c7" />
        {/* Section 3 (x=335–455): 3 bottles centered */}
        <Bottle x={344} y={90} capColor="#ec4899" bodyColor="#fbcfe8" />
        <Bottle x={381} y={90} capColor="#0f766e" bodyColor="#a7f3d0" />
        <Bottle x={418} y={90} capColor="#fb923c" bodyColor="#fed7aa" />

        {/* ─── Second shelf — INTERACTIVE feature bottles, 2-3-2 layout ─── */}
        {/* Section 1 — risk, adherence */}
        <Bottle
          x={110} y={180} capColor="#fb923c" bodyColor="#fed7aa"
          hotspotId="risk" active={isActive("risk")} onHover={onHover} onSelect={onSelect}
        />
        <Bottle
          x={162} y={180} capColor="#ec4899" bodyColor="#fbcfe8"
          hotspotId="adherence" active={isActive("adherence")} onHover={onHover} onSelect={onSelect}
        />
        {/* Section 2 — bills, medguide, savings */}
        <Bottle
          x={215} y={180} capColor="#a855f7" bodyColor="#e9d5ff"
          hotspotId="bills" active={isActive("bills")} onHover={onHover} onSelect={onSelect}
        />
        <Bottle
          x={255} y={180} capColor="#22c55e" bodyColor="#bbf7d2"
          hotspotId="medguide" active={isActive("medguide")} onHover={onHover} onSelect={onSelect}
        />
        <Bottle
          x={295} y={180} capColor="#fbbf24" bodyColor="#fef3c7"
          hotspotId="savings" active={isActive("savings")} onHover={onHover} onSelect={onSelect}
        />
        {/* Section 3 — body, companion */}
        <Bottle
          x={355} y={180} capColor="#0ea5e9" bodyColor="#bae6fd"
          hotspotId="body" active={isActive("body")} onHover={onHover} onSelect={onSelect}
        />
        <Bottle
          x={407} y={180} capColor="#0f766e" bodyColor="#a7f3d0"
          hotspotId="companion" active={isActive("companion")} onHover={onHover} onSelect={onSelect}
        />

        {/* ─── Third shelf — capsule strips and packs ─── */}
        <g transform="translate(95, 285)">
          <rect x="0" y="0" width="34" height="34" fill="#fbcfe8" stroke="#ec4899" strokeWidth="1" rx="2" />
          <Capsule x={9}  y={10} leftColor="#ec4899" rightColor="#fff" />
          <Capsule x={26} y={10} leftColor="#fff" rightColor="#ec4899" />
          <Capsule x={9}  y={22} leftColor="#fff" rightColor="#ec4899" />
          <Capsule x={26} y={22} leftColor="#ec4899" rightColor="#fff" />
        </g>
        <g transform="translate(140, 280)">
          <rect x="0" y="0" width="50" height="40" fill="#bae6fd" stroke="#0ea5e9" strokeWidth="1" rx="2" />
          <text x="25" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#0369a1">RX-12</text>
          <text x="25" y="30" textAnchor="middle" fontSize="6" fill="#0369a1">120 mg</text>
        </g>
        {/* Section 2 — 3 bottles, evenly spaced */}
        <Bottle x={217} y={275} capColor="#22c55e" bodyColor="#bbf7d2" />
        <Bottle x={257} y={275} capColor="#a855f7" bodyColor="#e9d5ff" />
        <Bottle x={297} y={275} capColor="#fbbf24" bodyColor="#fef3c7" />
        {/* Section 3 — 2 bottles, centered */}
        <Bottle x={356} y={275} capColor="#ec4899" bodyColor="#fbcfe8" />
        <Bottle x={405} y={275} capColor="#0ea5e9" bodyColor="#bae6fd" />

        {/* ─── Bottom shelf — horizontal rectangle boxes (3 rows × 2 cols) ─── */}
        {[
          { row: 0, col: 0, fill: "#fed7aa", stroke: "#fb923c", text: "#9a3412", label: "DOSE" },
          { row: 0, col: 1, fill: "#e9d5ff", stroke: "#a855f7", text: "#581c87", label: "CARE" },
          { row: 1, col: 0, fill: "#bbf7d2", stroke: "#22c55e", text: "#15803d", label: "WISE" },
          { row: 1, col: 1, fill: "#fbcfe8", stroke: "#ec4899", text: "#831843", label: "PILL" },
          { row: 2, col: 0, fill: "#fef3c7", stroke: "#fbbf24", text: "#92400e", label: "CARE" },
          { row: 2, col: 1, fill: "#bae6fd", stroke: "#0ea5e9", text: "#0369a1", label: "RX"   },
        ].map(b => {
          const x = 95 + b.col * 175;     // two columns
          const y = 338 + b.row * 25;     // three rows, ~25px tall each
          return (
            <g key={`${b.row}-${b.col}`} transform={`translate(${x}, ${y})`}>
              <rect width="170" height="22" rx="2" fill={b.fill} stroke={b.stroke} strokeWidth="1" />
              <rect x="0" y="0" width="6" height="22" fill={b.stroke} opacity="0.85" />
              <text x="14" y="15" fontSize="7" fontWeight="700" fill={b.text}>{b.label}</text>
            </g>
          );
        })}
      </g>

      {/* ─────────────── Robot arm (interactive — companion) ─────────────── */}
      {/* Each rotating segment is wrapped: outer <g> translates the pivot to (0,0)
          (via SVG transform attr), inner <g> rotates around (0,0) (via CSS).
          That keeps SVG and CSS transforms from fighting each other. */}
      <g
        style={{ cursor: "pointer" }}
        onClick={() => setArmPick((p) => !p)}
      >
        {/* Mounting bracket — fixed */}
        <rect x="475" y="80" width="40" height="20" rx="3" fill="#475569" />

        {/* Upper arm — pivot at (495, 100). Animate via SVG transform attribute
            (NOT CSS) so transform-origin / box quirks can't kick in. We also
            CSS-transition the SVG `transform` attribute for smoothness. */}
        <g transform={`translate(495 100) rotate(${armPick ? 15 : -5})`} style={{ transition: "transform 600ms ease" }}>
          <rect x="-9" y="-5" width="18" height="100" rx="6" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="10" fill="#475569" />

          {/* Elbow + forearm — pivot at elbow (0, 90) relative to upper arm */}
          <g transform={`translate(0 90) rotate(${armPick ? 40 : 20})`} style={{ transition: "transform 600ms ease" }}>
            <circle cx="0" cy="0" r="8" fill="#475569" />
            <rect x="-7" y="0" width="14" height="80" rx="5" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
            <circle cx="0" cy="80" r="6" fill="#475569" />
            {/* Gripper holding a pill bottle */}
            <g transform="translate(-15 80)">
              <rect x="0" y="0" width="6" height="20" fill="#475569" />
              <rect x="24" y="0" width="6" height="20" fill="#475569" />
              <Bottle x={3} y={4} capColor={isActive("companion") ? "#10b981" : "#0f766e"} bodyColor="#a7f3d0" />
            </g>
          </g>
        </g>

        {isActive("companion") && (
          <circle cx="495" cy="200" r="80" fill="none" stroke="#0f766e" strokeWidth="2" opacity="0.4">
            <animate attributeName="r" values="60;90;60" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
      </g>

      {/* ─────────────── Counter ─────────────── */}
      <g>
        <rect x="0" y="450" width="900" height="50" fill="url(#counter)" stroke="#94a3b8" strokeWidth="1" />
        <line x1="0" y1="455" x2="900" y2="455" stroke="#94a3b8" strokeWidth="0.8" opacity="0.4" />
        {/* Conveyor belt details */}
        {[160, 220, 280, 340, 400].map(x => (
          <circle key={x} cx={x} cy="475" r="3" fill="#94a3b8" opacity="0.6" />
        ))}
        {/* Boxes on belt */}
        <g transform="translate(170, 463)">
          <rect width="22" height="14" fill="#fde68a" stroke="#92400e" strokeWidth="0.8" />
          <text x="11" y="10" textAnchor="middle" fontSize="6" fontWeight="700" fill="#92400e">RX</text>
        </g>
        <g transform="translate(310, 463)">
          <rect width="22" height="14" fill="#fbcfe8" stroke="#831843" strokeWidth="0.8" />
        </g>
        <g transform="translate(380, 463)">
          <rect width="22" height="14" fill="#bae6fd" stroke="#0369a1" strokeWidth="0.8" />
        </g>
      </g>

      {/* ─────────────── Computer (interactive — Health at a Glance) ─────────────── */}
      <g
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHover("health")}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect("health")}
      >
        {/* Stand */}
        <rect x="725" y="430" width="60" height="20" fill="#475569" />
        <rect x="715" y="448" width="80" height="6" fill="#334155" />
        {/* Monitor frame */}
        <rect x="640" y="190" width="220" height="240" rx="8" fill="#0f172a" />
        {/* Screen */}
        <rect x="650" y="200" width="200" height="220" rx="4" fill="url(#screen)" />
        {/* Glow when active */}
        {(isActive("health") || activeId === null) && (
          <rect x="640" y="190" width="220" height="240" rx="8" fill="url(#screenGlow)" />
        )}

        {/* Dashboard preview on screen */}
        <g transform="translate(660, 215)">
          {/* Title bar */}
          <rect width="180" height="14" rx="3" fill="rgba(255,255,255,0.15)" />
          <circle cx="8" cy="7" r="2.5" fill="#10b981" />
          <text x="16" y="10" fontSize="7" fontWeight="700" fill="white">Clarity</text>

          {/* KPI cards */}
          <rect x="0"  y="22" width="55" height="38" rx="3" fill="#fde68a" />
          <text x="27" y="35" textAnchor="middle" fontSize="13" fontWeight="800" fill="#92400e">28</text>
          <text x="27" y="48" textAnchor="middle" fontSize="5" fontWeight="700" fill="#92400e">RISK</text>

          <rect x="62" y="22" width="55" height="38" rx="3" fill="#fbcfe8" />
          <text x="89" y="35" textAnchor="middle" fontSize="13" fontWeight="800" fill="#831843">86%</text>
          <text x="89" y="48" textAnchor="middle" fontSize="5" fontWeight="700" fill="#831843">DOSE</text>

          <rect x="124" y="22" width="55" height="38" rx="3" fill="#e9d5ff" />
          <text x="151" y="35" textAnchor="middle" fontSize="11" fontWeight="800" fill="#581c87">$2.4k</text>
          <text x="151" y="48" textAnchor="middle" fontSize="5" fontWeight="700" fill="#581c87">BILL</text>

          {/* Chart area */}
          <rect x="0" y="68" width="180" height="60" rx="3" fill="rgba(255,255,255,0.08)" />
          <polyline
            points="6,118 24,108 42,114 60,96 78,86 96,90 114,80 132,70 150,84 168,62 174,58"
            fill="none" stroke="#10b981" strokeWidth="1.6"
          />
          <polyline
            points="6,118 24,108 42,114 60,96 78,86 96,90 114,80 132,70 150,84 168,62 174,58 174,128 6,128"
            fill="#10b981" fillOpacity="0.2" stroke="none"
          />

          {/* Status row */}
          <rect x="0" y="138" width="180" height="14" rx="2" fill="rgba(255,255,255,0.08)" />
          <text x="6" y="148" fontSize="5.5" fill="white" fontWeight="600">Sample data ready</text>
        </g>

        {/* Power LED */}
        <circle cx="755" cy="425" r="2" fill="#10b981">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>


      {/* ─────────────── Anatomy poster (interactive — body) ─────────────── */}
      <g
        style={{ cursor: "pointer", transformOrigin: "615px 220px",
                 transform: isActive("body") ? "scale(1.05)" : "scale(1)",
                 transition: "transform 250ms ease" }}
        onMouseEnter={() => onHover("body")}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect("body")}
      >
        <rect x="555" y="160" width="65" height="120" rx="3" fill="white" stroke="#475569" strokeWidth="1.5" />
        <text x="588" y="173" textAnchor="middle" fontSize="6" fontWeight="800" fill="#0f172a">ANATOMY</text>
        {/* Tiny figure */}
        <ellipse cx="588" cy="190" rx="6" ry="7" fill="#cbd5e1" />
        <rect x="582" y="195" width="12" height="22" rx="3" fill="#cbd5e1" />
        <rect x="580" y="217" width="6" height="20" fill="#cbd5e1" />
        <rect x="590" y="217" width="6" height="20" fill="#cbd5e1" />
        <rect x="575" y="200" width="4" height="18" fill="#cbd5e1" />
        <rect x="597" y="200" width="4" height="18" fill="#cbd5e1" />
        {/* Hotspots */}
        <circle cx="588" cy="200" r="2.5" fill="#ec4899">
          <animate attributeName="r" values="2.5;3.5;2.5" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="588" cy="225" r="2.5" fill="#fbbf24">
          <animate attributeName="r" values="2.5;3.5;2.5" dur="1.6s" repeatCount="indefinite" begin="0.5s" />
        </circle>
        <text x="588" y="255" textAnchor="middle" fontSize="5" fontWeight="700" fill="#475569">SYSTEMS</text>
      </g>

      {/* ─────────────── Mascot in foreground ─────────────── */}
      <g style={{ animation: "floaty 4s ease-in-out infinite" }}>
        <foreignObject x="60" y="490" width="80" height="80">
          <div
            style={{ width: 70, height: 70, borderRadius: 16, overflow: "hidden",
                     background: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                     border: "2px solid #d1fae5" }}
          >
            <img src={logoSrc} alt="Clarity mascot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </foreignObject>
      </g>

      {/* ─────────────── Floating capsules ─────────────── */}
      <g opacity="0.85">
        <Capsule x={520} y={50}  rotate={-20} leftColor="#ec4899" rightColor="#fff" />
        <Capsule x={870} y={50}  rotate={30}  leftColor="#fff" rightColor="#fb923c" />
        <Capsule x={620} y={420} rotate={-15} leftColor="#0ea5e9" rightColor="#fff" />
      </g>
    </svg>
  );
}
