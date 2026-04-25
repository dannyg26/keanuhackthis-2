import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "brand" | "mint" | "sky" | "coral" | "sun" | "butter" | "blush" | "lavender" | "charcoal";
  className?: string;
}

const tones: Record<NonNullable<StatCardProps["tone"]>, { bg: string; iconBg: string; ring: string; text: string }> = {
  brand:    { bg: "bg-brand-100",    iconBg: "bg-white",       ring: "ring-brand-200",    text: "text-brand-700" },
  mint:     { bg: "bg-mint-100",     iconBg: "bg-white",       ring: "ring-mint-200",     text: "text-mint-500" },
  sky:      { bg: "bg-sky2-100",     iconBg: "bg-white",       ring: "ring-sky2-100",     text: "text-sky2-600" },
  coral:    { bg: "bg-coral-100",    iconBg: "bg-white",       ring: "ring-coral-100",    text: "text-coral-600" },
  sun:      { bg: "bg-sun-100",      iconBg: "bg-white",       ring: "ring-sun-100",      text: "text-sun-500" },
  butter:   { bg: "bg-butter-200",   iconBg: "bg-white",       ring: "ring-butter-300",   text: "text-charcoal-800" },
  blush:    { bg: "bg-blush-200",    iconBg: "bg-white",       ring: "ring-blush-300",    text: "text-charcoal-800" },
  lavender: { bg: "bg-lavender-200", iconBg: "bg-white",       ring: "ring-lavender-300", text: "text-charcoal-800" },
  charcoal: { bg: "bg-charcoal-800", iconBg: "bg-white/10",    ring: "ring-charcoal-700", text: "text-white" },
};

export default function StatCard({ icon, label, value, hint, tone = "brand", className }: StatCardProps) {
  const t = tones[tone];
  const isDark = tone === "charcoal";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${t.bg} ring-1 ${t.ring} p-5 shadow-card card-hover ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white/70" : "text-charcoal-800/65"}`}>
            {label}
          </p>
          <p className={`text-2xl sm:text-3xl font-extrabold leading-none tabular-nums tracking-tight truncate ${isDark ? "text-white" : "text-charcoal-900"}`}>
            {value}
          </p>
          {hint && (
            <p className={`text-xs mt-1 leading-snug ${isDark ? "text-white/70" : "text-charcoal-800/70"}`}>
              {hint}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl ${t.iconBg} shadow-soft flex items-center justify-center shrink-0 ${isDark ? t.text : ""}`}>
          {icon}
        </div>
      </div>

      {/* Decorative blob */}
      <div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-30 ${isDark ? "bg-white/10" : "bg-white/40"}`} aria-hidden />
    </div>
  );
}
