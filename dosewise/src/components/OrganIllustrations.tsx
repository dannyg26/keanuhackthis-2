import type { BodySystem } from "../data/bodyMap";

interface Props { className?: string; }

/**
 * Stylized anatomical illustrations for the detail panel.
 * Each is its own self-contained SVG.
 */

export function HeartSVG({ className }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Heart with vessels">
      <defs>
        <radialGradient id="heartFill" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="60%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <linearGradient id="heartShine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Heart body */}
      <path
        d="M100 165 C70 145 30 120 30 80 C30 55 50 40 70 40 C85 40 95 50 100 60 C105 50 115 40 130 40 C150 40 170 55 170 80 C170 120 130 145 100 165 Z"
        fill="url(#heartFill)" stroke="#7a1d1d" strokeWidth="2"
      />
      {/* Highlight */}
      <path d="M55 65 Q70 55 85 65" stroke="url(#heartShine)" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Coronary arteries */}
      <path d="M100 50 Q115 70 122 95 Q125 115 110 130" stroke="#fde68a" strokeWidth="3" fill="none" opacity="0.85" />
      <path d="M100 50 Q88 70 78 95 Q72 115 88 130" stroke="#fde68a" strokeWidth="3" fill="none" opacity="0.85" />
      <path d="M122 95 Q132 95 138 88" stroke="#fde68a" strokeWidth="2" fill="none" opacity="0.7" />
      <path d="M78 95 Q68 95 62 88" stroke="#fde68a" strokeWidth="2" fill="none" opacity="0.7" />
      {/* Aorta */}
      <path d="M105 40 Q115 25 130 28" stroke="#dc2626" strokeWidth="6" fill="none" />
      {/* Pulmonary trunk */}
      <path d="M95 40 Q88 25 80 28" stroke="#0ea5e9" strokeWidth="5" fill="none" />
    </svg>
  );
}

export function BrainSVG({ className }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Brain">
      <defs>
        <radialGradient id="brainFill" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="100%" stopColor="#a855f7" />
        </radialGradient>
      </defs>
      <path
        d="M60 80 Q40 80 35 100 Q30 125 50 140 Q55 160 80 165 Q100 175 120 165 Q145 160 150 140 Q170 125 165 100 Q160 80 140 80 Q140 50 110 50 Q90 50 100 70 Q90 50 60 80 Z"
        fill="url(#brainFill)" stroke="#7e22ce" strokeWidth="2"
      />
      {/* Folds */}
      <path d="M55 100 Q70 90 80 105 Q90 95 100 110 Q110 95 120 110 Q130 90 145 100"
            stroke="#86198f" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M50 130 Q70 120 90 135 Q110 120 130 135 Q145 125 155 130"
            stroke="#86198f" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M75 80 Q80 70 90 75" stroke="#86198f" strokeWidth="1.5" fill="none" opacity="0.5" />
      <path d="M125 80 Q120 70 110 75" stroke="#86198f" strokeWidth="1.5" fill="none" opacity="0.5" />
      {/* Brainstem */}
      <path d="M95 165 Q100 180 105 165" fill="#9d4edd" stroke="#7e22ce" strokeWidth="1.5" />
    </svg>
  );
}

export function LungsSVG({ className }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Lungs">
      <defs>
        <linearGradient id="lungFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {/* Trachea */}
      <rect x="95" y="30" width="10" height="35" rx="3" fill="#94a3b8" />
      {/* Bronchi */}
      <path d="M100 60 L75 80" stroke="#94a3b8" strokeWidth="6" />
      <path d="M100 60 L125 80" stroke="#94a3b8" strokeWidth="6" />
      {/* Left lung */}
      <path d="M75 80 Q40 90 35 130 Q35 165 60 175 Q80 175 85 155 Q88 120 85 90 Z"
            fill="url(#lungFill)" stroke="#0369a1" strokeWidth="2" />
      {/* Right lung */}
      <path d="M125 80 Q160 90 165 130 Q165 165 140 175 Q120 175 115 155 Q112 120 115 90 Z"
            fill="url(#lungFill)" stroke="#0369a1" strokeWidth="2" />
      {/* Bronchial branches */}
      <path d="M75 90 Q65 110 60 140 M75 90 Q70 120 75 145 M75 90 Q80 115 78 140"
            stroke="#0369a1" strokeWidth="1.5" fill="none" opacity="0.65" />
      <path d="M125 90 Q135 110 140 140 M125 90 Q130 120 125 145 M125 90 Q120 115 122 140"
            stroke="#0369a1" strokeWidth="1.5" fill="none" opacity="0.65" />
    </svg>
  );
}

export function LiverSVG({ className }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Liver">
      <defs>
        <linearGradient id="liverFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <path
        d="M30 80 Q35 65 60 60 Q120 50 165 70 Q175 95 165 125 Q140 145 100 145 Q60 145 40 130 Q25 110 30 80 Z"
        fill="url(#liverFill)" stroke="#7c2d12" strokeWidth="2"
      />
      {/* Lobe division */}
      <path d="M115 60 Q115 100 115 140" stroke="#7c2d12" strokeWidth="1.5" opacity="0.55" fill="none" />
      {/* Surface highlights */}
      <path d="M50 75 Q90 70 130 78" stroke="#fde68a" strokeWidth="3" opacity="0.5" fill="none" />
      <path d="M55 95 Q100 90 145 100" stroke="#fde68a" strokeWidth="2" opacity="0.4" fill="none" />
      {/* Gallbladder */}
      <ellipse cx="135" cy="135" rx="9" ry="14" fill="#84cc16" stroke="#3f6212" strokeWidth="1" />
    </svg>
  );
}

export function StomachSVG({ className }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Stomach">
      <defs>
        <linearGradient id="stomachFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
      </defs>
      {/* Esophagus */}
      <path d="M85 30 Q80 50 78 65" stroke="#a16207" strokeWidth="6" fill="none" />
      {/* Stomach body */}
      <path
        d="M80 65 Q60 80 55 110 Q50 145 80 160 Q120 168 145 145 Q150 120 140 95 Q125 75 100 70 Z"
        fill="url(#stomachFill)" stroke="#7f1d1d" strokeWidth="2"
      />
      {/* Pyloric exit */}
      <path d="M145 145 Q160 150 165 160" stroke="#a16207" strokeWidth="6" fill="none" />
      {/* Rugae (folds) */}
      <path d="M70 100 Q90 105 110 100 M68 120 Q92 125 115 120 M75 140 Q100 145 125 140"
            stroke="#7f1d1d" strokeWidth="1.5" opacity="0.5" fill="none" />
    </svg>
  );
}

export function SkinSVG({ className }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Skin cross-section">
      <defs>
        <linearGradient id="epidermis" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde7d3" />
          <stop offset="100%" stopColor="#f4c89f" />
        </linearGradient>
        <linearGradient id="dermis" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      {/* Epidermis (top layer) */}
      <rect x="20" y="40" width="160" height="30" fill="url(#epidermis)" stroke="#a86a3f" />
      {/* Dermis */}
      <rect x="20" y="70" width="160" height="60" fill="url(#dermis)" stroke="#7c2d12" />
      {/* Subcutaneous fat */}
      <rect x="20" y="130" width="160" height="40" fill="#fde68a" stroke="#92400e" />

      {/* Hair follicle */}
      <path d="M60 40 L60 25" stroke="#3b2618" strokeWidth="2" />
      <path d="M58 100 Q60 80 62 60" stroke="#3b2618" strokeWidth="1.5" fill="none" />
      <ellipse cx="60" cy="105" rx="5" ry="7" fill="#3b2618" />

      {/* Sweat gland */}
      <path d="M120 40 L120 50 Q130 60 130 90 Q132 120 145 130" stroke="#0ea5e9" strokeWidth="1.5" fill="none" />
      <circle cx="145" cy="130" r="4" fill="#bae6fd" stroke="#0ea5e9" />

      {/* Blood vessel */}
      <path d="M30 110 Q60 105 90 115 Q120 120 170 110"
            stroke="#dc2626" strokeWidth="2" fill="none" />

      {/* Nerve */}
      <path d="M30 150 Q90 145 170 152" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />

      {/* Labels */}
      <text x="183" y="58" fontSize="9" fill="#475569" fontWeight="600">Epidermis</text>
      <text x="183" y="103" fontSize="9" fill="#475569" fontWeight="600">Dermis</text>
      <text x="183" y="153" fontSize="9" fill="#475569" fontWeight="600">Subcutis</text>
    </svg>
  );
}

export const ORGAN_BY_REGION: Record<BodySystem, (p: Props) => React.ReactElement> = {
  head:    BrainSVG,
  heart:   HeartSVG,
  lungs:   LungsSVG,
  liver:   LiverSVG,
  stomach: StomachSVG,
  skin:    SkinSVG,
};
