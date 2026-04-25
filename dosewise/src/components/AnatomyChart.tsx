import { useState } from "react";
import { BODY_REGIONS, type BodyRegion, type BodySystem } from "../data/bodyMap";

interface AnatomyChartProps {
  activeId: BodySystem | null;
  highlightedIds?: BodySystem[];
  systemFilter?: AnatomySystem | "all";
  onSelect: (id: BodySystem) => void;
}

export type AnatomySystem = "muscular" | "cardiovascular" | "respiratory" | "digestive" | "nervous" | "integumentary";

const REGION_TO_SYSTEM: Record<BodySystem, AnatomySystem> = {
  head: "nervous",
  heart: "cardiovascular",
  lungs: "respiratory",
  liver: "digestive",
  stomach: "digestive",
  skin: "integumentary",
};

// Hotspot positions in the 0..400 / 0..800 SVG viewport.
const HOTSPOT_2D: Record<BodySystem, { x: number; y: number }> = {
  head:    { x: 200, y: 90  },
  heart:   { x: 175, y: 245 },
  lungs:   { x: 230, y: 235 },
  liver:   { x: 230, y: 320 },
  stomach: { x: 200, y: 345 },
  skin:    { x: 130, y: 605 },
};

const HIGHLIGHT_RADIUS = 58;     // big highlight circle (active / hover)
const PIN_RADIUS       = 7;      // tiny resting indicator

/* ────────────────── SVG variant — monochrome muscular figure ────────────────── */

function SvgVariant({
  activeId, highlightedIds = [], systemFilter = "all", onSelect,
}: AnatomyChartProps) {
  const [hoverId, setHoverId] = useState<BodySystem | null>(null);

  const isVisible = (r: BodyRegion) =>
    systemFilter === "all" || REGION_TO_SYSTEM[r.id] === systemFilter;

  return (
    <svg viewBox="0 0 400 800" className="w-full h-full" role="img" aria-label="Anatomical body chart">
      <defs>
        {/* Cool gray skin */}
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        {/* Slightly darker muscle */}
        <linearGradient id="muscle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="muscleHighlight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="bodyShade" cx="50%" cy="35%" r="65%">
          <stop offset="0%"  stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </radialGradient>

        {/* Soft drop shadow */}
        <filter id="bodyShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
          <feOffset dx="0" dy="4" result="offsetblur" />
          <feFlood floodColor="#0f172a" floodOpacity="0.12" />
          <feComposite in2="offsetblur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g filter="url(#bodyShadow)">
        {/* Head */}
        <ellipse cx="200" cy="80" rx="44" ry="56" fill="url(#bodyShade)" />
        {/* Eye sockets, nose ridge — minimal */}
        <ellipse cx="186" cy="74" rx="4" ry="3" fill="#94a3b8" opacity="0.55" />
        <ellipse cx="214" cy="74" rx="4" ry="3" fill="#94a3b8" opacity="0.55" />
        <path d="M200 80 Q198 92 200 100" stroke="#94a3b8" strokeWidth="0.8" fill="none" opacity="0.5" />
        <path d="M192 108 Q200 112 208 108" stroke="#94a3b8" strokeWidth="0.8" fill="none" opacity="0.5" />

        {/* Neck */}
        <path d="M178 130 L172 158 Q200 168 228 158 L222 130 Z" fill="url(#bodyShade)" />
        {/* SCM lines */}
        <path d="M180 132 Q175 158 192 165" stroke="#64748b" strokeWidth="1" fill="none" opacity="0.45" />
        <path d="M220 132 Q225 158 208 165" stroke="#64748b" strokeWidth="1" fill="none" opacity="0.45" />
        {/* Clavicles */}
        <path d="M148 178 Q175 168 198 178" stroke="#64748b" strokeWidth="1.4" fill="none" opacity="0.6" />
        <path d="M252 178 Q225 168 202 178" stroke="#64748b" strokeWidth="1.4" fill="none" opacity="0.6" />

        {/* Torso outline */}
        <path
          d="M148 170 Q126 190 120 220 Q116 250 126 290 Q132 330 140 380 Q146 430 152 470 Q160 520 168 550
             L166 600 Q172 612 184 612 L184 555 Q190 510 195 470 Q205 420 215 470 Q220 510 226 555 L226 612
             Q238 612 244 600 L242 550 Q250 520 258 470 Q264 430 270 380 Q278 330 284 290 Q294 250 290 220
             Q284 190 262 170 Q230 158 200 158 Q170 158 148 170 Z"
          fill="url(#skin)" stroke="#64748b" strokeWidth="1.2"
        />

        {/* Trapezius */}
        <path d="M153 168 Q175 192 200 192 Q225 192 247 168 Q220 158 200 158 Q180 158 153 168 Z"
              fill="url(#muscle)" opacity="0.65" />

        {/* Pecs */}
        <path d="M152 205 Q175 195 198 200 L198 255 Q175 260 148 240 Q145 220 152 205 Z" fill="url(#muscle)" opacity="0.85" />
        <path d="M248 205 Q225 195 202 200 L202 255 Q225 260 252 240 Q255 220 248 205 Z" fill="url(#muscle)" opacity="0.85" />
        <path d="M152 207 Q175 198 198 200" stroke="#475569" strokeWidth="0.8" fill="none" opacity="0.55" />
        <path d="M248 207 Q225 198 202 200" stroke="#475569" strokeWidth="0.8" fill="none" opacity="0.55" />
        <path d="M165 215 Q180 210 195 220 L195 240" stroke="url(#muscleHighlight)" strokeWidth="3" fill="none" />
        <path d="M235 215 Q220 210 205 220 L205 240" stroke="url(#muscleHighlight)" strokeWidth="3" fill="none" />

        {/* Sternum */}
        <path d="M200 195 L200 260" stroke="#475569" strokeWidth="0.8" opacity="0.6" />
        {/* Ribcage hint */}
        <path d="M154 222 Q175 226 195 224" stroke="#94a3b8" strokeWidth="0.6" fill="none" opacity="0.5" />
        <path d="M246 222 Q225 226 205 224" stroke="#94a3b8" strokeWidth="0.6" fill="none" opacity="0.5" />
        <path d="M152 240 Q175 244 195 242" stroke="#94a3b8" strokeWidth="0.6" fill="none" opacity="0.4" />
        <path d="M248 240 Q225 244 205 242" stroke="#94a3b8" strokeWidth="0.6" fill="none" opacity="0.4" />

        {/* Serratus teeth */}
        <path d="M148 260 L152 258 L154 263 L158 261 L160 266 L164 264"
              stroke="#475569" strokeWidth="1" fill="none" opacity="0.55" />
        <path d="M252 260 L248 258 L246 263 L242 261 L240 266 L236 264"
              stroke="#475569" strokeWidth="1" fill="none" opacity="0.55" />

        {/* Abs */}
        <g opacity="0.9">
          <rect x="178" y="270" width="20" height="18" rx="4" fill="url(#muscle)" />
          <rect x="202" y="270" width="20" height="18" rx="4" fill="url(#muscle)" />
          <rect x="178" y="294" width="20" height="18" rx="4" fill="url(#muscle)" />
          <rect x="202" y="294" width="20" height="18" rx="4" fill="url(#muscle)" />
          <rect x="178" y="318" width="20" height="18" rx="4" fill="url(#muscle)" />
          <rect x="202" y="318" width="20" height="18" rx="4" fill="url(#muscle)" />
          <rect x="180" y="342" width="18" height="14" rx="3" fill="url(#muscle)" />
          <rect x="202" y="342" width="18" height="14" rx="3" fill="url(#muscle)" />
        </g>
        <path d="M200 270 L200 358" stroke="#475569" strokeWidth="0.9" opacity="0.7" />

        {/* Obliques */}
        <path d="M148 272 Q140 312 150 352 Q158 352 166 342 Q163 312 168 274 Q158 270 148 272 Z" fill="url(#muscle)" opacity="0.65" />
        <path d="M252 272 Q260 312 250 352 Q242 352 234 342 Q237 312 232 274 Q242 270 252 272 Z" fill="url(#muscle)" opacity="0.65" />

        {/* Lat sweep */}
        <path d="M132 230 Q124 270 130 330 Q138 330 143 320 Q143 280 146 235 Z" fill="url(#muscle)" opacity="0.55" />
        <path d="M268 230 Q276 270 270 330 Q262 330 257 320 Q257 280 254 235 Z" fill="url(#muscle)" opacity="0.55" />

        {/* Iliac / lower abs */}
        <path d="M163 372 Q200 385 237 372 Q237 402 224 417 Q200 424 176 417 Q163 402 163 372 Z" fill="url(#muscle)" opacity="0.65" />
        <path d="M178 372 Q176 402 195 412" stroke="#475569" strokeWidth="0.9" fill="none" opacity="0.55" />
        <path d="M222 372 Q224 402 205 412" stroke="#475569" strokeWidth="0.9" fill="none" opacity="0.55" />
        <path d="M200 395 L200 422" stroke="#475569" strokeWidth="0.7" opacity="0.5" />

        {/* Deltoids */}
        <path d="M118 185 Q102 205 108 240 Q120 252 138 242 Q148 215 145 192 Q132 178 118 185 Z" fill="url(#muscle)" opacity="0.92" />
        <path d="M282 185 Q298 205 292 240 Q280 252 262 242 Q252 215 255 192 Q268 178 282 185 Z" fill="url(#muscle)" opacity="0.92" />
        <path d="M116 200 Q118 220 128 240" stroke="#475569" strokeWidth="0.7" fill="none" opacity="0.55" />
        <path d="M124 195 Q128 220 138 240" stroke="#475569" strokeWidth="0.7" fill="none" opacity="0.5" />
        <path d="M284 200 Q282 220 272 240" stroke="#475569" strokeWidth="0.7" fill="none" opacity="0.55" />
        <path d="M276 195 Q272 220 262 240" stroke="#475569" strokeWidth="0.7" fill="none" opacity="0.5" />

        {/* Upper arms */}
        <path d="M103 230 Q88 270 90 320 Q96 330 113 325 Q123 280 120 235 Z" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <path d="M297 230 Q312 270 310 320 Q304 330 287 325 Q277 280 280 235 Z" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <path d="M102 245 Q96 270 103 305" stroke="url(#muscleHighlight)" strokeWidth="6" fill="none" />
        <path d="M298 245 Q304 270 297 305" stroke="url(#muscleHighlight)" strokeWidth="6" fill="none" />
        <path d="M116 250 Q114 280 120 315" stroke="#64748b" strokeWidth="0.7" fill="none" opacity="0.45" />
        <path d="M284 250 Q286 280 280 315" stroke="#64748b" strokeWidth="0.7" fill="none" opacity="0.45" />

        {/* Forearms */}
        <path d="M90 320 Q84 370 88 420 Q96 428 110 420 Q114 370 113 325 Z" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <path d="M310 320 Q316 370 312 420 Q304 428 290 420 Q286 370 287 325 Z" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <path d="M92 335 Q88 375 94 410" stroke="url(#muscleHighlight)" strokeWidth="4" fill="none" opacity="0.7" />
        <path d="M308 335 Q312 375 306 410" stroke="url(#muscleHighlight)" strokeWidth="4" fill="none" opacity="0.7" />

        {/* Hands */}
        <ellipse cx="98" cy="445" rx="13" ry="20" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <ellipse cx="302" cy="445" rx="13" ry="20" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <path d="M91 438 L91 450 M97 436 L97 450 M103 436 L103 450 M109 438 L109 450" stroke="#64748b" strokeWidth="0.6" />
        <path d="M291 438 L291 450 M297 436 L297 450 M303 436 L303 450 M309 438 L309 450" stroke="#64748b" strokeWidth="0.6" />

        {/* Quads */}
        <path d="M168 415 Q160 480 165 555 Q175 565 185 555 Q188 490 192 420 Z" fill="url(#muscle)" opacity="0.7" />
        <path d="M232 415 Q240 480 235 555 Q225 565 215 555 Q212 490 208 420 Z" fill="url(#muscle)" opacity="0.7" />
        <path d="M170 435 Q170 490 178 540" stroke="url(#muscleHighlight)" strokeWidth="6" fill="none" />
        <path d="M230 435 Q230 490 222 540" stroke="url(#muscleHighlight)" strokeWidth="6" fill="none" />
        <path d="M180 425 Q178 480 175 545" stroke="#475569" strokeWidth="0.7" fill="none" opacity="0.45" />
        <path d="M220 425 Q222 480 225 545" stroke="#475569" strokeWidth="0.7" fill="none" opacity="0.45" />

        {/* Knees */}
        <ellipse cx="180" cy="615" rx="14" ry="9" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
        <ellipse cx="220" cy="615" rx="14" ry="9" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />

        {/* Calves */}
        <path d="M170 625 Q160 690 168 745 Q175 752 185 745 Q188 690 188 625 Z" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <path d="M230 625 Q240 690 232 745 Q225 752 215 745 Q212 690 212 625 Z" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <path d="M173 640 Q165 690 175 730" stroke="url(#muscleHighlight)" strokeWidth="5" fill="none" />
        <path d="M227 640 Q235 690 225 730" stroke="url(#muscleHighlight)" strokeWidth="5" fill="none" />
        <path d="M180 640 Q183 690 182 730" stroke="#64748b" strokeWidth="0.7" fill="none" opacity="0.45" />
        <path d="M220 640 Q217 690 218 730" stroke="#64748b" strokeWidth="0.7" fill="none" opacity="0.45" />

        {/* Feet */}
        <ellipse cx="178" cy="760" rx="16" ry="9" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
        <ellipse cx="222" cy="760" rx="16" ry="9" fill="url(#bodyShade)" stroke="#64748b" strokeWidth="1" />
      </g>

      {/* Highlight overlays */}
      <g>
        {BODY_REGIONS.map(r => {
          if (!isVisible(r)) return null;
          const pos = HOTSPOT_2D[r.id];
          const isActive = activeId === r.id;
          const isHigh = highlightedIds.includes(r.id);
          const isHover = hoverId === r.id;
          const showBig = isActive || isHigh || isHover;

          return (
            <g
              key={r.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onMouseEnter={() => setHoverId(r.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onSelect(r.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Big colored highlight when active/hover */}
              <circle
                r={showBig ? HIGHLIGHT_RADIUS : PIN_RADIUS}
                fill={r.color}
                fillOpacity={showBig ? 0.85 : 1}
                stroke={r.color}
                strokeWidth={showBig ? 1.5 : 2}
                style={{ transition: "all 250ms ease-out" }}
              />
              {showBig && (
                <circle
                  r={HIGHLIGHT_RADIUS + 1}
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  opacity="0.9"
                />
              )}
              {/* Tooltip */}
              {(isHover || isActive) && (
                <g
                  transform={`translate(${pos.x > 200 ? HIGHLIGHT_RADIUS + 10 : -HIGHLIGHT_RADIUS - 130}, -8)`}
                  style={{ pointerEvents: "none" }}
                >
                  <rect x="0" y="-12" width="120" height="22" rx="11" fill="white" stroke="#e2e8f0" />
                  <text x="60" y="3" textAnchor="middle" fontSize="11" fontWeight="600" fill={r.color}>
                    {r.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ────────────────── Public ────────────────── */

export default function AnatomyChart(props: AnatomyChartProps) {
  return <SvgVariant {...props} />;
}
