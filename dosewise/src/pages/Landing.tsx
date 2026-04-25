import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import {
  ShieldIcon, PillIcon, ReceiptIcon, BookIcon, TagIcon, BodyIcon, SparklesIcon,
  ArrowRightIcon, ChartIcon, DollarIcon,
} from "../components/Icon";
import PharmacyScene, { type PharmacyHotspotId } from "../components/PharmacyScene";

interface FeatureMeta {
  title: string;
  desc: string;
  route: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  tone: string;
  toneSolid: string;
}

const FEATURES: Record<PharmacyHotspotId, FeatureMeta> = {
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
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<PharmacyHotspotId | null>(null);
  const [pinned, setPinned] = useState<PharmacyHotspotId>("risk");

  const activeId = hovered ?? pinned;

  const handleSelect = (id: PharmacyHotspotId) => {
    setPinned(id);
    navigate(FEATURES[id].route);
  };

  return (
    <div className="min-h-screen flex flex-col bg-mesh bg-cream-50">
      {/* Top Nav — transparent, floats above scene */}
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between">
          <Logo size={40} />
          <Link to="/dashboard" className="btn-primary">
            Open App <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Full-screen pharmacy hero */}
      <main className="relative flex-1 flex flex-col">
        <div className="relative flex-1 flex items-center justify-center pt-20 pb-4 px-4 sm:px-6 lg:px-10">
          {/* Scene + overlays */}
          <div className="relative w-full max-w-[1400px]">
            <PharmacyScene
              activeId={activeId}
              onHover={setHovered}
              onSelect={handleSelect}
            />

            {/* Headline overlay — top-left of scene, on its own card so it sits cleanly over the shelves */}
            <div className="absolute top-3 left-3 sm:top-6 sm:left-6 max-w-[260px] sm:max-w-[300px] rounded-2xl bg-white/90 backdrop-blur shadow-soft ring-1 ring-blush-100 px-4 py-3 animate-slideUp">
              <span className="inline-flex items-center gap-1.5 pill bg-brand-50 text-brand-700 ring-1 ring-brand-100 text-[10px]">
                <SparklesIcon className="w-3 h-3" />
                Step inside your healthcare pharmacy
              </span>
              <h1 className="mt-2 text-base sm:text-xl font-extrabold leading-tight text-charcoal-900">
                Understand your meds.{" "}
                <span className="bg-clip-text text-transparent bg-brand-gradient">
                  Decode your bills.
                </span>
              </h1>
            </div>

            {/* Floating feature callouts — positioned around the scene */}
            <FloatingCallout
              className="absolute top-3 right-3 sm:top-6 sm:right-6"
              Icon={TagIcon}
              title="Savings & Coupons"
              desc="Compare pharmacies, stack coupons"
              tone="bg-butter-100 text-butter-500 ring-butter-200"
              onClick={() => handleSelect("savings")}
              onMouseEnter={() => setHovered("savings")}
              onMouseLeave={() => setHovered(null)}
            />
            <FloatingCallout
              className="absolute top-1/3 left-3 -translate-y-1/2 sm:left-6 hidden md:flex"
              Icon={BookIcon}
              title="MedGuide"
              desc="Visual schedules + plain-English info"
              tone="bg-mint-100 text-mint-500 ring-mint-200"
              onClick={() => handleSelect("medguide")}
              onMouseEnter={() => setHovered("medguide")}
              onMouseLeave={() => setHovered(null)}
            />
            <FloatingCallout
              className="absolute top-1/2 right-3 -translate-y-1/2 sm:right-6 hidden md:flex"
              Icon={BodyIcon}
              title="Body Map"
              desc="See how meds affect each system"
              tone="bg-sky2-100 text-sky2-500 ring-sky2-100"
              onClick={() => handleSelect("body")}
              onMouseEnter={() => setHovered("body")}
              onMouseLeave={() => setHovered(null)}
            />
            <FloatingCallout
              className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6"
              Icon={ReceiptIcon}
              title="Bill Breakdown"
              desc="Decode bills + flag red flags"
              tone="bg-lavender-100 text-lavender-500 ring-lavender-200"
              onClick={() => handleSelect("bills")}
              onMouseEnter={() => setHovered("bills")}
              onMouseLeave={() => setHovered(null)}
            />

            {/* Your Health at a Glance — overlay card bottom-left of scene */}
            <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 w-56 sm:w-64 rounded-2xl bg-white/95 backdrop-blur shadow-soft ring-1 ring-blush-100 p-4 animate-slideUp">
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
            </div>
          </div>
        </div>

        {/* Bottom feature row — always visible at viewport bottom */}
        <div className="relative z-10 px-4 sm:px-6 lg:px-10 pb-4 sm:pb-6">
          <div className="max-w-7xl mx-auto grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {HOTSPOT_ORDER.map(id => {
              const f = FEATURES[id];
              return (
                <Link
                  key={id}
                  to={f.route}
                  className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${f.tone} ring-1 p-3 shadow-card card-hover`}
                >
                  <div className={`w-9 h-9 rounded-xl ${f.toneSolid} shadow-soft flex items-center justify-center`}>
                    <f.Icon className="w-4 h-4" />
                  </div>
                  <h3 className="mt-2 text-xs sm:text-sm font-bold text-charcoal-900 leading-tight">{f.title}</h3>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] text-charcoal-800/70 leading-snug line-clamp-2">{f.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

interface FloatingCalloutProps {
  Icon: (p: { className?: string }) => React.ReactElement;
  title: string;
  desc: string;
  tone: string;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function FloatingCallout({ Icon, title, desc, tone, className, onClick, onMouseEnter, onMouseLeave }: FloatingCalloutProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group flex items-start gap-2.5 max-w-[180px] rounded-2xl bg-white/95 backdrop-blur shadow-soft ring-1 ring-blush-100 px-3 py-2.5 text-left hover:-translate-y-0.5 hover:shadow-lg transition ${className ?? ""}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ring-1 ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-charcoal-900 leading-tight">{title}</p>
        <p className="text-[10px] text-ink-600 leading-snug mt-0.5">{desc}</p>
      </div>
    </button>
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
