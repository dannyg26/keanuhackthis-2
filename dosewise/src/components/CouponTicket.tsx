import { useMemo } from "react";
import { CheckIcon, CopyIcon, PlusIcon, XIcon, ClockIcon } from "./Icon";
import PharmacyLogo from "./PharmacyLogo";
import type { Coupon, CouponSource } from "../lib/api";

interface CouponTicketProps {
  coupon: Coupon;
  saved: boolean;
  copied: boolean;
  busy: boolean;
  onToggleSaved: () => void;
  onCopy: () => void;
  onRemove?: () => void;
}

const PALETTE: Record<CouponSource, { bg: string; accent: string; text: string }> = {
  GoodRx:       { bg: "linear-gradient(135deg, #e9d5ff 0%, #fbcfe8 100%)", accent: "#7e22ce", text: "#581c87" },
  Manufacturer: { bg: "linear-gradient(135deg, #fed7aa 0%, #fbcfe8 100%)", accent: "#c2410c", text: "#9a3412" },
  Insurance:    { bg: "linear-gradient(135deg, #bae6fd 0%, #bbf7d2 100%)", accent: "#0369a1", text: "#075985" },
  Local:        { bg: "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)", accent: "#b45309", text: "#92400e" },
  Custom:       { bg: "linear-gradient(135deg, #fbcfe8 0%, #e9d5ff 100%)", accent: "#a21caf", text: "#831843" },
};

function pctOff(original: number, couponPrice: number) {
  if (original <= 0) return 0;
  return Math.round(((original - couponPrice) / original) * 100);
}

function daysUntil(date: string): number {
  const target = new Date(date + "T12:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Deterministic barcode-style striping derived from a code string. */
function Barcode({ code, color }: { code: string; color: string }) {
  const bars = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < code.length; i++) {
      out.push((code.charCodeAt(i) % 3) + 1, ((code.charCodeAt(i) * 7) % 3) + 1);
    }
    return out;
  }, [code]);

  return (
    <div className="flex items-end gap-[1.5px] h-7" aria-label={`Barcode for ${code}`}>
      {bars.map((w, i) => (
        <span
          key={i}
          style={{
            background: color,
            width: w,
            height: i % 2 === 0 ? "100%" : "85%",
          }}
        />
      ))}
    </div>
  );
}

export default function CouponTicket({
  coupon, saved, copied, busy, onToggleSaved, onCopy, onRemove,
}: CouponTicketProps) {
  const off = pctOff(coupon.originalPrice, coupon.couponPrice);
  const days = daysUntil(coupon.expiresOn);
  const palette = PALETTE[coupon.source];
  const savings = coupon.originalPrice - coupon.couponPrice;

  return (
    <li className="relative">
      {/* Outer ticket — gradient background with rounded corners */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-card"
        style={{ background: palette.bg, color: palette.text }}
      >
        {/* Side notches — match page bg color so they "punch through" the ticket */}
        <div
          className="absolute -left-3 top-1/2 w-6 h-6 rounded-full bg-cream-50 -translate-y-1/2 z-10"
          aria-hidden
        />
        <div
          className="absolute -right-3 top-1/2 w-6 h-6 rounded-full bg-cream-50 -translate-y-1/2 z-10"
          aria-hidden
        />

        <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[110px_1fr] min-h-[180px]">
          {/* Stub: logo + DISCOUNT spine */}
          <div className="relative flex flex-col items-center justify-between py-4 border-r-2 border-dashed" style={{ borderColor: `${palette.text}33` }}>
            <PharmacyLogo pharmacy={coupon.pharmacy} size={42} />
            <span
              className="font-extrabold tracking-[0.35em] text-[10px] sm:text-xs select-none"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: palette.text, opacity: 0.85 }}
            >
              DISCOUNT
            </span>
            <span className="text-[9px] uppercase tracking-wider font-bold opacity-65">
              {coupon.source}
            </span>
          </div>

          {/* Main body */}
          <div className="px-4 sm:px-5 py-4 flex flex-col gap-3 min-w-0">
            {/* Top: % off + medication */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-4xl sm:text-5xl font-extrabold leading-none tabular-nums" style={{ color: palette.text }}>
                  {off}<span className="text-2xl sm:text-3xl">%</span>
                  <span className="text-base sm:text-lg ml-1 opacity-75">off</span>
                </p>
                <p className="mt-2 font-bold text-sm sm:text-base truncate" style={{ color: palette.text }}>
                  {coupon.medication}
                </p>
                <p className="text-xs opacity-75 truncate">
                  at {coupon.pharmacy}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <div
                  className="rounded-xl px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm"
                  style={{ background: "rgba(255,255,255,0.65)", color: palette.text }}
                >
                  Save ${savings.toFixed(2)}
                </div>
                <div
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                    days <= 14 ? "bg-white/80" : "bg-white/55"
                  }`}
                  style={{ color: days <= 14 ? "#dc2626" : palette.text }}
                >
                  <ClockIcon className="w-3 h-3" />
                  {days <= 0 ? "Expired" : `${days}d`}
                </div>
              </div>
            </div>

            {/* Barcode + code */}
            <div className="flex items-end gap-3 min-w-0">
              <Barcode code={coupon.code} color={palette.text} />
              <p
                className="font-mono text-[11px] sm:text-xs tracking-widest mb-0.5 truncate"
                style={{ color: palette.text, opacity: 0.85 }}
              >
                {coupon.code}
              </p>
            </div>

            {/* Optional note */}
            {coupon.note && (
              <p className="text-[11px] leading-snug opacity-75 line-clamp-2">
                {coupon.note}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-auto pt-1">
              <button
                onClick={onCopy}
                disabled={busy}
                className="flex-1 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.75)",
                  color: palette.text,
                }}
              >
                {copied
                  ? <><CheckIcon className="w-4 h-4" /> Copied</>
                  : <><CopyIcon className="w-4 h-4" /> View code</>}
              </button>
              <button
                onClick={onToggleSaved}
                disabled={busy}
                className="flex-1 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50 text-white shadow-sm"
                style={{ background: palette.accent }}
              >
                {saved
                  ? <><CheckIcon className="w-4 h-4" /> Redeemed</>
                  : <><PlusIcon className="w-4 h-4" /> Redeem</>}
              </button>
              {onRemove && coupon.source === "Custom" && (
                <button
                  onClick={onRemove}
                  disabled={busy}
                  className="rounded-xl py-2 px-2.5 hover:bg-white/40 transition"
                  style={{ color: palette.text }}
                  aria-label="Remove coupon"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
