import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { HomeIcon, ShieldIcon, PillIcon, ReceiptIcon, BookIcon, SparklesIcon, TagIcon, BodyIcon, XIcon } from "./Icon";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard",      icon: HomeIcon,    short: "Home" },
  { to: "/risk",      label: "Risk Engine",    icon: ShieldIcon,  short: "Risk" },
  { to: "/adherence", label: "Adherence",      icon: PillIcon,    short: "Doses" },
  { to: "/bills",     label: "Bill Breakdown", icon: ReceiptIcon, short: "Bills" },
  { to: "/body",      label: "Body Map",       icon: BodyIcon,    short: "Body" },
  { to: "/savings",   label: "Savings",        icon: TagIcon,     short: "Save" },
  { to: "/medguide",  label: "MedGuide",       icon: BookIcon,    short: "Guide" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };
  const initials = user?.name?.split(/\s/).map(n => n[0]).join("").slice(0, 2).toUpperCase() ?? "DW";

  return (
    <div className="min-h-screen bg-mesh bg-cream-50">
      {/* Sidebar (desktop) — dark charcoal */}
      <aside className="hidden lg:flex fixed inset-y-3 left-3 w-60 flex-col bg-charcoal-800 text-white rounded-3xl shadow-soft z-30 overflow-hidden">
        <div className="px-5 py-5 border-b border-white/10">
          <Link to="/" className="inline-block">
            <Logo size={42} inverted />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
            General
          </p>
          {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-white text-charcoal-800 shadow-soft"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{label}</span>
            </NavLink>
          ))}

          <p className="px-3 pt-5 pb-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
            Tools
          </p>
          {navItems.slice(5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-white text-charcoal-800 shadow-soft"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="m-3 p-3 rounded-2xl bg-white/5 text-white border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blush-200 text-charcoal-900 flex items-center justify-center font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user?.name ?? "Guest"}</p>
              <p className="text-[11px] text-white/60 truncate">{user?.email ?? "—"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" /> Log out
          </button>
        </div>
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-2xl bg-blush-200 text-charcoal-900 text-[11px] leading-snug flex items-center gap-2">
          <SparklesIcon className="w-3.5 h-3.5 text-blush-500 shrink-0" />
          Sample data is loaded — feel free to explore.
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-cream-50/85 backdrop-blur border-b border-blush-100 px-4 py-3 flex items-center justify-between">
        <Link to="/"><Logo size={36} /></Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex w-8 h-8 rounded-xl bg-charcoal-800 text-white items-center justify-center text-xs font-bold">
            {initials}
          </span>
          <button onClick={handleLogout} className="btn-secondary px-3 py-1.5 text-xs">
            Log out
          </button>
        </div>
      </header>

      {/* Mobile bottom nav — dark pill */}
      <nav className="lg:hidden fixed bottom-3 inset-x-3 z-30 bg-charcoal-800 text-white rounded-3xl shadow-soft grid grid-cols-7 overflow-hidden">
        {navItems.map(({ to, icon: Icon, short }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-semibold transition-colors ${
                isActive ? "bg-white text-charcoal-800" : "text-white/65 hover:text-white"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{short}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main content area */}
      <main className="lg:pl-64 pb-24 lg:pb-3">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10 animate-slideUp">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
