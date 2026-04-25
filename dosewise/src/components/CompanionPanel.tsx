import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ARMed, CompanionMood } from "./HealthCompanion";
import { SparklesIcon, MicIcon, MicOffIcon, VolumeIcon, CubeIcon, XIcon } from "./Icon";
import { useVoice } from "../hooks/useVoice";
import { api } from "../lib/api";

const HealthCompanion = lazy(() => import("./HealthCompanion"));

interface CompanionPanelProps {
  riskScore: number;
  adherencePct: number;
  streakDays?: number;
  userName?: string;
  /** Optional list of user medication names — passed to the AI as context. */
  medicationNames?: string[];
  /** Risk level label, e.g. "Low" | "Moderate" | "High" — passed as context. */
  riskLevel?: string | null;
}

const TIPS_BY_MOOD: Record<CompanionMood, string[]> = {
  happy: [
    "You're cruising. Keep this rhythm going for one more week and your streak crosses 14.",
    "Hydration tip: a full glass of water with each pill helps absorption and reduces stomach upset.",
    "Consistency wins. Same time, same place beats willpower every time.",
    "Bring this app to your next visit — your provider will love how prepared you are.",
  ],
  excited: [
    "Look at you go. Want me to log today's doses for the demo?",
    "Streaks compound. Every consistent day makes the next one easier.",
    "If you tell me your meds, I can flag possible interactions before you fill them.",
  ],
  thoughtful: [
    "Want me to walk you through a quick risk check?",
    "Pop open MedGuide if you ever wonder what a pill actually does in plain English.",
    "Got a confusing bill? Paste it on the Bill page — I'll break it down line by line.",
  ],
  concerned: [
    "Your risk score is on the higher side. Let's review what's driving it.",
    "If you're missing doses regularly, a 7-day pill organizer can be a game-changer.",
    "Mixing alcohol with sedating meds is the most common avoidable risk — worth a chat with your pharmacist.",
  ],
};

function moodFromMetrics(risk: number, adherence: number, streak: number): CompanionMood {
  if (risk >= 60) return "concerned";
  if (streak >= 5 && adherence >= 90) return "excited";
  if (adherence < 70) return "thoughtful";
  return "happy";
}

const SAMPLE_AR_MEDS: ARMed[] = [
  { name: "Lisinopril",   kind: "pill", baseColor: "#fda4af", capColor: "#ffffff" },
  { name: "Metformin",    kind: "pill", baseColor: "#ffffff", capColor: "#dc2626" },
  { name: "Atorvastatin", kind: "pill", baseColor: "#fde68a", capColor: "#ffffff" },
  { name: "Sertraline",   kind: "pill", baseColor: "#ffffff", capColor: "#0ea5e9" },
  { name: "Blood Panel",  kind: "vial", liquidColor: "#dc2626" },
  { name: "Lipid Lab",    kind: "vial", liquidColor: "#facc15" },
];

export default function CompanionPanel({
  riskScore,
  adherencePct,
  streakDays = 0,
  userName = "friend",
  medicationNames,
  riskLevel,
}: CompanionPanelProps) {
  const mood = useMemo(
    () => moodFromMetrics(riskScore, adherencePct, streakDays),
    [riskScore, adherencePct, streakDays],
  );

  const [tipIndex, setTipIndex] = useState(0);
  const [message, setMessage] = useState<string>(`Hi ${userName}, I'm Dose. Tap the mic and talk to me.`);
  const [showMeds, setShowMeds] = useState(false);
  const mouthAmpRef = useRef(0);

  const handleFinal = async (text: string) => {
    if (!text) return;
    const lower = text.toLowerCase();
    if (/(show|see|view|all).*?(pill|med|vial|lab)/.test(lower) || /show me/.test(lower)) setShowMeds(true);
    if (/(hide|close|stop).*?(pill|med|vial)/.test(lower)) setShowMeds(false);

    setMessage("…");
    try {
      const { reply } = await api.companion.chat(text, {
        riskScore,
        riskLevel: riskLevel ?? null,
        adherencePct,
        streakDays,
        medications: medicationNames ?? [],
      });
      setMessage(reply);
      voice.speak(reply);
    } catch {
      const fallback = `I couldn't reach the server. You're at risk score ${riskScore} and ${adherencePct}% adherence — try again in a moment.`;
      setMessage(fallback);
      voice.speak(fallback);
    }
  };

  const voice = useVoice({ onFinalTranscript: handleFinal, mouthAmpRef });

  // Replace greeting with mood tip after a few seconds
  useEffect(() => {
    const t1 = setTimeout(() => setMessage(TIPS_BY_MOOD[mood][0]), 4000);
    return () => clearTimeout(t1);
  }, [mood]);

  // Rotate tips while idle
  useEffect(() => {
    if (voice.speaking || voice.listening) return;
    const id = setInterval(() => {
      setTipIndex(i => {
        const next = (i + 1) % TIPS_BY_MOOD[mood].length;
        setMessage(TIPS_BY_MOOD[mood][next]);
        return next;
      });
    }, 9000);
    return () => clearInterval(id);
  }, [mood, voice.speaking, voice.listening]);

  const newTip = () => {
    const list = TIPS_BY_MOOD[mood];
    const next = (tipIndex + 1) % list.length;
    setTipIndex(next);
    setMessage(list[next]);
    voice.speak(list[next]);
  };

  const toggleMic = () => {
    if (voice.listening) voice.stop();
    else {
      voice.cancel();
      voice.start();
    }
  };

  const handleSelectMed = (label: string) => {
    const reply = `That's ${label}. Open MedGuide for full details and your visual schedule.`;
    setMessage(reply);
    voice.speak(reply);
  };

  return (
    <div className="card relative overflow-hidden p-0 bg-blush-100 border-blush-200">
      <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-butter-200/60 blur-3xl" aria-hidden />
      <div className="absolute -bottom-20 -left-10 w-60 h-60 rounded-full bg-lavender-200/50 blur-3xl" aria-hidden />

      <div className="relative grid sm:grid-cols-5 gap-4 p-6">
        {/* Companion canvas */}
        <div className="sm:col-span-3 relative h-80 sm:h-96">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-ink-400 text-sm">
                Loading companion…
              </div>
            }
          >
            <HealthCompanion
              mood={mood}
              message={message}
              speaking={voice.speaking}
              listening={voice.listening}
              mouthAmpRef={mouthAmpRef}
              meds={SAMPLE_AR_MEDS}
              showMeds={showMeds}
              onSelectMed={handleSelectMed}
              onClick={newTip}
            />
          </Suspense>

          {/* Live transcript chip while listening */}
          {(voice.listening || voice.transcript) && (
            <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur shadow-soft border border-ink-100 rounded-2xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${voice.listening ? "bg-coral-500 animate-pulseSoft" : "bg-ink-200"}`} />
                <p className="text-xs uppercase tracking-wider font-semibold text-ink-400">
                  {voice.listening ? "Listening…" : "You said"}
                </p>
              </div>
              <p className="text-sm text-ink-800 leading-snug mt-0.5 line-clamp-2">
                {voice.transcript || "say something like \"what's my risk?\""}
              </p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="sm:col-span-2 flex flex-col justify-center space-y-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-brand-700" />
            <p className="section-title">Your AI Companion</p>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-ink-900 leading-tight">Meet Dose</h2>
            <p className="text-sm text-ink-600 mt-1 leading-relaxed">
              Talk to me, tap me, or have me show your meds floating in 3D.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`pill ring-1 ${MOOD_PILL[mood]}`}>{MOOD_LABEL[mood]}</span>
            {voice.speaking && (
              <span className="pill bg-mint-50 text-mint-500 ring-1 ring-mint-200">
                <VolumeIcon className="w-3 h-3" /> Speaking
              </span>
            )}
            {voice.listening && (
              <span className="pill bg-sky2-50 text-sky2-600 ring-1 ring-sky2-100">
                <MicIcon className="w-3 h-3" /> Listening
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={toggleMic}
              disabled={!voice.supported.recognition}
              className={`btn justify-center ${
                voice.listening
                  ? "bg-coral-500 text-white shadow-soft hover:brightness-105"
                  : "bg-brand-gradient text-white shadow-soft hover:brightness-105"
              }`}
              title={voice.supported.recognition ? "Talk to Dose" : "Voice input not supported in this browser"}
            >
              {voice.listening ? <MicOffIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
              {voice.listening ? "Stop" : "Talk to Dose"}
            </button>
            <button
              onClick={() => setShowMeds(s => !s)}
              className={`btn justify-center ${
                showMeds
                  ? "bg-white border-2 border-brand-400 text-brand-700"
                  : "bg-white border border-ink-200 text-ink-800 hover:border-brand-400 hover:text-brand-700"
              }`}
            >
              {showMeds ? <XIcon className="w-4 h-4" /> : <CubeIcon className="w-4 h-4" />}
              {showMeds ? "Hide pills" : "Show pills"}
            </button>
          </div>

          <button onClick={newTip} className="btn-secondary w-full justify-center">
            <SparklesIcon className="w-4 h-4" /> Give me a tip
          </button>

          {!voice.supported.recognition && (
            <p className="text-[11px] text-coral-600 leading-snug">
              Voice input requires Chrome on desktop or Safari on iOS. Tap-to-talk works elsewhere by reading the tip aloud.
            </p>
          )}
          <p className="text-[11px] text-ink-400 leading-snug">
            Try asking: <span className="font-semibold">"what's my risk?"</span>, <span className="font-semibold">"show me my pills"</span>, or <span className="font-semibold">"how's my adherence?"</span>
          </p>
        </div>
      </div>
    </div>
  );
}

const MOOD_LABEL: Record<CompanionMood, string> = {
  happy: "Mood · Happy",
  excited: "Mood · Excited",
  thoughtful: "Mood · Thoughtful",
  concerned: "Mood · Concerned",
};

const MOOD_PILL: Record<CompanionMood, string> = {
  happy:      "bg-mint-50 text-mint-500 ring-mint-200",
  excited:    "bg-brand-50 text-brand-700 ring-brand-100",
  thoughtful: "bg-sky2-50 text-sky2-600 ring-sky2-100",
  concerned:  "bg-sun-50 text-sun-500 ring-sun-100",
};
