import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import {
  ShieldIcon, PillIcon, ReceiptIcon, BookIcon, TagIcon, BodyIcon, SparklesIcon,
  ArrowRightIcon, ChartIcon, DollarIcon,
} from "../components/Icon";
import PharmacyScene, { type PharmacyHotspotId } from "../components/PharmacyScene";

// Reveal helper — fades + slides children in once they scroll into view.
function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || visible) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, visible]);
  return { ref, visible };
}

interface FeatureMeta {
  title: string;
  desc: string;
  route: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  tone: string;
  toneSolid: string;
}

const FEATURES: Partial<Record<PharmacyHotspotId, FeatureMeta>> = {
  risk: {
    title: "Risk Engine",
    desc: "Personalized 0–100 score with explainable factors.",
    route: "/risk",
    Icon: ShieldIcon,
    tone: "from-butter-100 to-butter-200 ring-butter-300",
    toneSolid: "bg-butter-300 text-charcoal-900",
  },
  adherence: {
    title: "Adherence",
    desc: "Log doses, build streaks, see weekly patterns.",
    route: "/adherence",
    Icon: PillIcon,
    tone: "from-blush-100 to-blush-200 ring-blush-300",
    toneSolid: "bg-blush-300 text-charcoal-900",
  },
  bills: {
    title: "Bill Breakdown",
    desc: "Decode bills with plain-English explanations.",
    route: "/bills",
    Icon: ReceiptIcon,
    tone: "from-lavender-100 to-lavender-200 ring-lavender-300",
    toneSolid: "bg-lavender-300 text-charcoal-900",
  },
  medguide: {
    title: "MedGuide",
    desc: "Visual schedules and side effects, in human language.",
    route: "/medguide",
    Icon: BookIcon,
    tone: "from-mint-100 to-mint-200 ring-mint-300",
    toneSolid: "bg-mint-300 text-charcoal-900",
  },
  savings: {
    title: "Savings",
    desc: "Compare pharmacies and stack coupons.",
    route: "/savings",
    Icon: TagIcon,
    tone: "from-butter-100 to-blush-100 ring-butter-300",
    toneSolid: "bg-butter-300 text-charcoal-900",
  },
  body: {
    title: "Body Map",
    desc: "Tap a body system to see which meds affect it.",
    route: "/body",
    Icon: BodyIcon,
    tone: "from-sky2-100 to-mint-100 ring-sky2-100",
    toneSolid: "bg-sky2-100 text-charcoal-900",
  },
  companion: {
    title: "AI Companion",
    desc: "Talk to Dose. Calm second opinions on your meds.",
    route: "/dashboard",
    Icon: SparklesIcon,
    tone: "from-brand-100 to-mint-100 ring-brand-200",
    toneSolid: "bg-brand-500 text-white",
  },
};

const HOTSPOT_ORDER: PharmacyHotspotId[] = [
  "risk", "adherence", "bills", "medguide", "savings", "body", "companion",
];

export default function Landing() {
  const [hovered, setHovered] = useState<PharmacyHotspotId | null>(null);
  const [pinned, setPinned] = useState<PharmacyHotspotId | null>(null);

  const activeId = hovered ?? pinned;

  const handleSelect = (id: PharmacyHotspotId) => {
    // Clicking the same hotspot toggles its popup off — useful on mobile to dismiss.
    // Also clear the hover state so it can't keep activeId stuck (on touch devices
    // mouseenter fires on tap but mouseleave never does).
    setHovered(null);
    setPinned((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        // Original pastel page gradient — silky white highlights are layered on top for texture.
        background: "linear-gradient(to bottom, #fdf2f8 0%, #fefce8 45%, #fff1c2 70%, #f3e8ff 90%, #fde68a 100%)",
      }}
    >
      {/* Page-wide animation keyframes — scoped to this component */}
      <style>{`
        @keyframes landing-headline-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes landing-eyebrow-in {
          from { opacity: 0; letter-spacing: 0.4em; }
          to   { opacity: 1; letter-spacing: 0.28em; }
        }
        /* Silky highlight — drifts gently so the satin folds appear to shift. */
        @keyframes landing-silk-a {
          0%, 100% { transform: translate3d(0,0,0)   scale(1);    opacity: 0.85; }
          50%      { transform: translate3d(40px,-30px,0) scale(1.1); opacity: 1; }
        }
        @keyframes landing-silk-b {
          0%, 100% { transform: translate3d(0,0,0)     scale(1);    opacity: 0.75; }
          50%      { transform: translate3d(-50px,40px,0) scale(1.15); opacity: 1; }
        }
      `}</style>

      {/* Silky satin glow — large, heavily-blurred bright white highlights drift across the base */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-0 overflow-hidden">
        <SilkHighlight className="top-[-15%] left-[10%]"  width={680} height={960} rotate={-22} animation="landing-silk-a 18s ease-in-out 0s   infinite" />
        <SilkHighlight className="top-[20%]  right-[-8%]" width={560} height={820} rotate={18}  animation="landing-silk-b 22s ease-in-out 2s   infinite" />
        <SilkHighlight className="top-[45%]  left-[-6%]"  width={620} height={880} rotate={28}  animation="landing-silk-a 24s ease-in-out 1.2s infinite" />
        <SilkHighlight className="bottom-[5%] right-[15%]" width={580} height={820} rotate={-12} animation="landing-silk-b 20s ease-in-out 3s   infinite" />
        <SilkHighlight className="bottom-[-15%] left-[30%]" width={640} height={820} rotate={6}   animation="landing-silk-a 26s ease-in-out 0.8s infinite" />
        <SilkHighlight className="top-[5%]  left-[40%]"   width={520} height={720} rotate={-8}  animation="landing-silk-b 19s ease-in-out 1.6s infinite" />
        <SilkHighlight className="top-[60%] right-[35%]"  width={500} height={700} rotate={14}  animation="landing-silk-a 21s ease-in-out 2.4s infinite" />
      </div>

      {/* Bright gel sheen — strong top gloss + ambient white wash to push the glow up */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none -z-0"
        style={{
          background: [
            // Strong top gloss
            "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 22%, transparent 50%)",
            // Subtle bottom darken for gel thickness
            "linear-gradient(0deg, rgba(15,23,42,0.04) 0%, transparent 25%)",
            // Side rim highlights
            "radial-gradient(ellipse 70% 90% at 0% 40%, rgba(255,255,255,0.3), transparent 60%)",
            "radial-gradient(ellipse 70% 90% at 100% 40%, rgba(255,255,255,0.3), transparent 60%)",
            // Ambient overall lighten — pushes the whole page brighter
            "radial-gradient(ellipse 100% 100% at 50% 30%, rgba(255,255,255,0.35), transparent 70%)",
          ].join(", "),
        }}
      />

      {/* Gel bubble droplets — scattered translucent bubbles with highlight dots */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-0 overflow-hidden">
        <Bubble className="top-[12%] left-[18%]" size={28} />
        <Bubble className="top-[8%]  right-[28%]" size={20} />
        <Bubble className="top-[24%] left-[42%]" size={14} />
        <Bubble className="top-[34%] right-[12%]" size={26} />
        <Bubble className="top-[42%] left-[8%]"  size={18} />
        <Bubble className="top-[54%] left-[55%]" size={22} />
        <Bubble className="top-[60%] right-[40%]" size={12} />
        <Bubble className="top-[70%] left-[24%]" size={30} />
        <Bubble className="top-[78%] right-[20%]" size={16} />
        <Bubble className="top-[86%] left-[60%]" size={20} />
        <Bubble className="top-[92%] left-[32%]" size={14} />
        <Bubble className="bottom-[6%] right-[10%]" size={24} />
      </div>

      {/* Subtle grain — kept light so the glow stays bright */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none -z-0 opacity-15 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 1   0 0 0 0 1   0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Top Nav — transparent, floats above scene */}
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between">
          <Logo size={40} />
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-charcoal-900 text-white font-semibold shadow-soft hover:bg-charcoal-800 hover:scale-105 transition-transform"
          >
            Open App <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Pharmacy hero — sized to fit naturally, page can scroll */}
      <main className="relative z-10">
        {/* Headline — clean, all black, sits cleanly above the scene */}
        <div className="px-4 sm:px-6 lg:px-10 pt-24 sm:pt-28 pb-2 text-center">
          <p
            className="text-[11px] sm:text-xs uppercase tracking-[0.28em] font-semibold text-charcoal-900/70"
            style={{ animation: "landing-eyebrow-in 0.9s ease-out both" }}
          >
            Step inside your healthcare pharmacy
          </p>
          <h1
            className="mt-3 font-display font-extrabold text-charcoal-900 tracking-tight leading-[1.05] text-3xl sm:text-5xl lg:text-6xl"
            style={{ animation: "landing-headline-in 0.8s 0.1s ease-out both" }}
          >
            Understand your meds.<br className="hidden sm:inline" /> Decode your bills.
          </h1>
        </div>

        <div className="relative pt-6 pb-6 px-4 sm:px-6 lg:px-10">
          {/* Scene wrapper — uses aspect ratio so it stays proportional and doesn't overflow */}
          <div className="relative w-full max-w-[1500px] mx-auto" style={{ aspectRatio: "900 / 620" }}>
            <PharmacyScene
              activeId={activeId}
              onHover={setHovered}
              onSelect={handleSelect}
            />

            {/* Desktop popup — positioned around the scene */}
            {activeId && popupFor[activeId] && (() => {
              const meta = FEATURES[activeId];
              const content =
                activeId === "health" ? <HealthAtAGlanceContent />
                : meta ? <FeaturePopupContent meta={meta} />
                : null;
              if (!content) return null;
              return (
                <div
                  key={`d-${activeId}`}
                  className={`hidden md:block absolute ${popupFor[activeId]!.position} max-w-[260px] rounded-2xl bg-white/95 backdrop-blur shadow-soft ring-1 ring-blush-100 p-4 animate-slideUp z-20`}
                >
                  {content}
                </div>
              );
            })()}
          </div>

          {/* Mobile popup — sits BELOW the scene in normal flow so it never overlaps the pharmacy elements */}
          {activeId && popupFor[activeId] && (() => {
            const meta = FEATURES[activeId];
            const content =
              activeId === "health" ? <HealthAtAGlanceContent />
              : meta ? <FeaturePopupContent meta={meta} />
              : null;
            if (!content) return null;
            return (
              <div
                key={`m-${activeId}`}
                className="md:hidden relative mt-3 max-w-[600px] mx-auto rounded-2xl bg-white/95 backdrop-blur shadow-soft ring-1 ring-blush-100 p-4 animate-slideUp"
              >
                <button
                  onClick={() => { setPinned(null); setHovered(null); }}
                  aria-label="Close popup"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-soft ring-1 ring-blush-100 flex items-center justify-center text-ink-600"
                >
                  <span className="text-base leading-none">×</span>
                </button>
                <div className="pr-8">{content}</div>
              </div>
            );
          })()}

          {/* Hint — different copy for desktop vs touch */}
          <p className="hidden md:block text-center text-xs text-ink-400 mt-4">
            <SparklesIcon className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-brand-500" />
            Hover any shelf, screen, poster, or robot to peek inside that feature.
          </p>
          <p className="md:hidden text-center text-xs text-ink-400 mt-4">
            <SparklesIcon className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-brand-500" />
            Tap any shelf, screen, poster, or robot to see that feature.
          </p>
        </div>

        {/* Floor zone — features as a vertical timeline, top to bottom */}
        <div className="relative z-10 px-4 sm:px-6 lg:px-10 pb-16 pt-6">
          {/* Floor tile texture (subtle) */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 28px)",
            }}
          />

          <div className="relative max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-[11px] uppercase tracking-[0.28em] font-semibold text-charcoal-900/70">
                What we offer
              </p>
              <h2 className="mt-2 font-display font-extrabold text-charcoal-900 text-2xl sm:text-3xl tracking-tight">
                Every part of your healthcare, in one place
              </h2>
            </div>

            <ol className="relative">
              {/* Vertical timeline rail */}
              <div className="absolute left-5 sm:left-7 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blush-200 via-lavender-200 to-butter-200" />

              {HOTSPOT_ORDER.map((id, i) => {
                const f = FEATURES[id];
                if (!f) return null;
                return <TimelineItem key={id} f={f} index={i} />;
              })}
            </ol>
          </div>
        </div>

        {/* Final CTA — invite the user into the app */}
        <div className="px-4 sm:px-6 lg:px-10 pb-20 pt-8 text-center">
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] font-semibold text-charcoal-900/70">
            Ready when you are
          </p>
          <h2 className="mt-3 font-display font-extrabold text-charcoal-900 tracking-tight leading-[1.05] text-2xl sm:text-4xl">
            Step inside Clarity.
          </h2>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-charcoal-900 text-white font-semibold shadow-soft hover:bg-charcoal-800 hover:scale-105 transition-transform text-base"
          >
            Try it now <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}

// Where each scene element's popup card appears (relative to the scene container).
const popupFor: Partial<Record<PharmacyHotspotId | "health", { position: string }>> = {
  medguide:  { position: "top-1/3 left-4 -translate-y-1/2" },
  body:      { position: "top-1/2 right-4 -translate-y-1/2" },
  bills:     { position: "bottom-4 right-4" },
  savings:   { position: "top-4 right-4" },
  companion: { position: "bottom-4 left-1/2 -translate-x-1/2" },
  risk:      { position: "top-4 right-1/3" },
  adherence: { position: "top-4 left-1/3" },
  health:    { position: "bottom-4 left-4" },
};

function FeaturePopupContent({ meta }: { meta: FeatureMeta }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl ${meta.toneSolid} shadow-soft flex items-center justify-center shrink-0`}>
        <meta.Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-charcoal-900 leading-tight">{meta.title}</p>
        <p className="mt-1 text-xs text-ink-600 leading-snug">{meta.desc}</p>
      </div>
    </div>
  );
}

function HealthAtAGlanceContent() {
  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-charcoal-800/65">
        Your Health at a Glance
      </p>
      <ul className="mt-3 space-y-2.5">
        <StatRow
          Icon={ShieldIcon}
          label="Risk Score"
          value="28"
          suffix="/100"
          badge="Low Risk"
          badgeTone="bg-mint-100 text-brand-700"
          iconTone="bg-mint-100 text-brand-500"
        />
        <StatRow
          Icon={ChartIcon}
          label="Adherence"
          value="86%"
          badge="On track"
          badgeTone="bg-sky2-100 text-sky2-600"
          iconTone="bg-sky2-100 text-sky2-500"
        />
        <StatRow
          Icon={DollarIcon}
          label="Recent Bill"
          value="$410"
          badge="Total"
          badgeTone="bg-lavender-100 text-lavender-500"
          iconTone="bg-lavender-100 text-lavender-500"
        />
      </ul>
    </>
  );
}


interface StatRowProps {
  Icon: (p: { className?: string }) => React.ReactElement;
  label: string;
  value: string;
  suffix?: string;
  badge: string;
  badgeTone: string;
  iconTone: string;
}

function StatRow({ Icon, label, value, suffix, badge, badgeTone, iconTone }: StatRowProps) {
  return (
    <li className="flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconTone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">{label}</p>
        <p className="text-base font-extrabold text-charcoal-900 leading-tight">
          {value}
          {suffix && <span className="text-[10px] font-medium text-ink-400 ml-0.5">{suffix}</span>}
        </p>
      </div>
      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeTone}`}>
        {badge}
      </span>
    </li>
  );
}

function TimelineItem({ f, index }: { f: FeatureMeta; index: number }) {
  const { ref, visible } = useReveal<HTMLLIElement>();
  return (
    <li
      ref={ref}
      className={`relative pl-14 sm:pl-20 pb-10 last:pb-0 transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: visible ? `${index * 90}ms` : "0ms" }}
    >
      <span className="absolute left-0 top-0 w-10 sm:w-14 text-center text-[10px] font-bold tracking-widest text-charcoal-800/50">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        className={`absolute left-2 sm:left-4 top-5 w-7 h-7 rounded-full ${f.toneSolid} shadow-soft ring-4 ring-white/80 flex items-center justify-center transition-transform duration-700 ${
          visible ? "scale-100" : "scale-0"
        }`}
        style={{ transitionDelay: visible ? `${index * 90 + 200}ms` : "0ms" }}
      >
        <f.Icon className="w-3.5 h-3.5" />
      </span>
      <div className={`rounded-2xl bg-gradient-to-br ${f.tone} ring-1 p-4 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.25)]`}>
        <h3 className="text-base font-extrabold text-charcoal-900 leading-tight">{f.title}</h3>
        <p className="mt-1 text-sm text-charcoal-800/75 leading-snug">{f.desc}</p>
      </div>
    </li>
  );
}

// Soft silky white highlight — a long, soft elliptical glow that suggests a satin fold.
// Layer several at different angles + sizes for the silk look.
function SilkHighlight({
  className,
  width,
  height,
  rotate = 0,
  animation,
}: {
  className: string;
  width: number;
  height: number;
  rotate?: number;
  animation: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`absolute pointer-events-none ${className}`}
      style={{
        width,
        height,
        transform: `rotate(${rotate}deg)`,
        animation,
        background:
          // Bright white core fading off through soft cream to transparent at the edges.
          "radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,253,247,0.55) 30%, rgba(255,250,240,0.15) 60%, transparent 80%)",
        filter: "blur(70px)",
        mixBlendMode: "screen",
        borderRadius: "50%",
      }}
    />
  );
}

// Tiny gel bubble — a translucent dot with a bright top-left highlight, like a droplet.
function Bubble({ className, size = 18 }: { className: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute pointer-events-none rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 35%, rgba(255,255,255,0.15) 70%, transparent 100%)",
        boxShadow:
          "inset -2px -3px 5px rgba(15,23,42,0.08), 0 0 12px rgba(255,255,255,0.6)",
      }}
    />
  );
}
