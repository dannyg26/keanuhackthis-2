import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import { ArrowRightIcon, SparklesIcon, AlertIcon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";

type Mode = "login" | "signup";

interface AuthProps { mode: Mode; }

export default function Auth({ mode }: AuthProps) {
  const auth = useAuth();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.user) {
    const next = (location.state as { from?: string } | null)?.from ?? "/dashboard";
    return <Navigate to={next} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await auth.login(email, password);
      else await auth.signup(name, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail("demo@clarity.app");
    setPassword("clarity123");
  };

  return (
    <div className="min-h-screen bg-mesh bg-cream-50 flex flex-col">
      <header className="px-4 sm:px-8 py-4">
        <Link to="/"><Logo size={42} /></Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="card bg-white border-blush-100">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-4 h-4 text-brand-700" />
              <p className="section-title">{mode === "login" ? "Welcome back" : "Create your account"}</p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-charcoal-900 leading-tight">
              {mode === "login" ? "Log in to Clarity" : "Make a calmer healthcare day"}
            </h1>
            <p className="text-sm text-ink-600 mt-2 leading-relaxed">
              {mode === "login"
                ? "Pick up your meds, adherence, and savings right where you left off."
                : "It only takes a moment. Everything is private and lives on our server."}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === "signup" && (
                <div>
                  <label className="label">Your name</label>
                  <input
                    className="input"
                    autoComplete="name"
                    required
                    placeholder="Jane Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl bg-coral-50 border border-coral-100 text-coral-600 text-sm p-3 flex items-start gap-2">
                  <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full justify-center text-base py-3"
              >
                {busy ? "Working…" : mode === "login" ? "Log in" : "Create account"}
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-ink-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {mode === "login" ? (
                <p className="text-sm text-ink-600">
                  No account? <Link to="/signup" className="font-semibold text-brand-700 hover:underline">Sign up</Link>
                </p>
              ) : (
                <p className="text-sm text-ink-600">
                  Already have one? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
                </p>
              )}
              {mode === "login" && (
                <button onClick={fillDemo} type="button" className="btn-ghost text-xs">
                  Use demo account
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-ink-400 text-center mt-4 leading-relaxed">
            Clarity is informational only and does not replace medical advice.
          </p>
        </div>
      </main>
    </div>
  );
}
