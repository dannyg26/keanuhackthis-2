import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { ShieldIcon, TagIcon, MapPinIcon, InsuranceIcon } from "../components/Icon";

const TOOLS = [
  {
    to: "/find-care",
    label: "Find Care",
    subtitle: "Triage symptoms & navigate to nearby clinics with live maps",
    icon: MapPinIcon,
    bg: "bg-brand-600",
    glow: "shadow-[0_8px_28px_rgba(13,148,136,0.35)]",
    badge: "GPS + AI",
    badgeColor: "bg-white/20 text-white",
  },
  {
    to: "/insurance",
    label: "Insurance",
    subtitle: "Find the right coverage & analyze claim denials with AI",
    icon: InsuranceIcon,
    bg: "bg-sky2-600",
    glow: "shadow-[0_8px_28px_rgba(37,99,235,0.35)]",
    badge: "Denial help",
    badgeColor: "bg-white/20 text-white",
  },
  {
    to: "/risk",
    label: "Risk Engine",
    subtitle: "Assess your medication risk score and get personalized tips",
    icon: ShieldIcon,
    bg: "bg-coral-500",
    glow: "shadow-[0_8px_28px_rgba(239,68,68,0.30)]",
    badge: "Score",
    badgeColor: "bg-white/20 text-white",
  },
  {
    to: "/savings",
    label: "Savings",
    subtitle: "Find coupons & discounts on your prescriptions",
    icon: TagIcon,
    bg: "bg-mint-600",
    glow: "shadow-[0_8px_28px_rgba(5,150,105,0.30)]",
    badge: "Coupons",
    badgeColor: "bg-white/20 text-white",
  },
];

export default function Tools() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        eyebrow="Tools"
        title="Your health toolkit"
        subtitle="AI-powered tools to help you navigate care, coverage, and costs."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TOOLS.map(({ to, label, subtitle, icon: Icon, bg, glow, badge, badgeColor }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`${bg} ${glow} relative overflow-hidden rounded-3xl p-6 text-left active:scale-[0.98] transition-all duration-150 hover:opacity-95`}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-black/10 translate-y-6 -translate-x-6" />

            <div className="relative">
              {/* Badge */}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${badgeColor} mb-4`}>
                {badge}
              </span>

              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Text */}
              <p className="text-xl font-extrabold text-white leading-tight">{label}</p>
              <p className="text-sm text-white/75 mt-1.5 leading-relaxed">{subtitle}</p>

              {/* Arrow */}
              <div className="mt-5 flex items-center gap-1.5 text-white/80 text-sm font-semibold">
                Open {label}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-ink-400">
        More tools coming soon — Body Map and Risk Engine are also in the sidebar on desktop.
      </p>
    </>
  );
}
