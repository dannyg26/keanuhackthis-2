import { levelColor, scoreLevel } from "../utils/risk";

interface RiskGaugeProps {
  score: number;
  size?: number;
}

export default function RiskGauge({ score, size = 180 }: RiskGaugeProps) {
  const pct = Math.max(0, Math.min(100, score));
  const level = scoreLevel(pct);
  const tone = levelColor(level);

  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  const stroke =
    level === "High" ? "#f25c4a" :
    level === "Moderate" ? "#facc15" :
    "#22c55e";

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e2e8f0"
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-5xl font-extrabold text-ink-900 leading-none">{pct}</p>
        <p className="text-xs uppercase tracking-wider text-ink-400 mt-1">/ 100</p>
        <span className={`mt-2 pill ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}>{level} Risk</span>
      </div>
    </div>
  );
}
