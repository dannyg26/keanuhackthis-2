import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Html, RoundedBox } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type CompanionMood = "happy" | "concerned" | "excited" | "thoughtful";

export interface ARMed {
  name: string;
  /** "pill" capsule or "vial" of liquid */
  kind?: "pill" | "vial";
  baseColor?: string;
  capColor?: string;
  liquidColor?: string;
}

interface CompanionProps {
  mood: CompanionMood;
  hovered: boolean;
  speaking: boolean;
  listening: boolean;
  mouthAmpRef?: React.RefObject<number>;
}

const MOOD_TINT: Record<CompanionMood, string> = {
  happy:      "#10b981",
  concerned:  "#facc15",
  excited:    "#34d399",
  thoughtful: "#0d9488",
};

function CompanionModel({ mood, hovered, speaking, listening, mouthAmpRef }: CompanionProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef  = useRef<THREE.Group>(null);
  const armRef   = useRef<THREE.Group>(null);
  const heartRef = useRef<THREE.Group>(null);
  const leftEye  = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  const eyeColor = listening ? "#0ea5e9" : MOOD_TINT[mood];

  // Random idle "personality" offsets so movement isn't perfectly periodic
  const seed = useMemo(() => Math.random() * 100, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (groupRef.current) {
      // Floating + sway
      groupRef.current.position.y = Math.sin(t * 1.3 + seed) * 0.06 - 0.08;
      groupRef.current.rotation.y = Math.sin(t * 0.4 + seed) * 0.16;
      // Breathing
      const breath = 1 + Math.sin(t * 0.95) * 0.018;
      groupRef.current.scale.set(breath, breath, breath);
    }

    if (headRef.current) {
      // Head follows mouse + tiny micro-drift
      const microX = Math.sin(t * 0.7 + seed) * 0.04;
      const microY = Math.cos(t * 0.55 + seed) * 0.03;
      const targetY = state.pointer.x * 0.3 + microX;
      const targetX = -state.pointer.y * 0.16 + microY;
      headRef.current.rotation.y += (targetY - headRef.current.rotation.y) * 0.07;
      headRef.current.rotation.x += (targetX - headRef.current.rotation.x) * 0.07;
    }

    if (armRef.current) {
      const amp = hovered ? 0.95 : listening ? 0.55 : 0.22;
      const speed = hovered ? 5 : listening ? 3 : 1.3;
      armRef.current.rotation.z = -0.3 + Math.sin(t * speed) * amp;
    }

    if (heartRef.current) {
      const beat = mood === "concerned" ? 1.6 : mood === "excited" ? 2.8 : 2.2;
      const scale = 1 + Math.sin(t * beat) * 0.16;
      heartRef.current.scale.setScalar(scale);
    }

    // Blink + occasional saccade
    const blinkPhase = (t * 0.55 + seed * 0.1) % 1;
    const blink = blinkPhase < 0.05 ? 0.1 : 1;
    const saccadeX = Math.sin(t * 0.35 + seed) * 0.025;
    if (leftEye.current && rightEye.current) {
      leftEye.current.scale.y  = blink;
      rightEye.current.scale.y = blink;
      leftEye.current.position.x  = -0.22 + saccadeX;
      rightEye.current.position.x =  0.22 + saccadeX;
    }

    // Lip sync: prefer real word-boundary amp from synth, fall back to sine while speaking
    if (mouthRef.current) {
      let amp = 0;
      if (mouthAmpRef && mouthAmpRef.current > 0) {
        amp = mouthAmpRef.current;
        mouthAmpRef.current *= 0.85;             // decay
      } else if (speaking) {
        amp = (Math.abs(Math.sin(t * 9)) + Math.abs(Math.sin(t * 13))) * 0.45;
      }
      mouthRef.current.scale.x = 0.7 + amp * 1.4;
      mouthRef.current.scale.y = 1   + amp * 1.6;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {/* Body */}
      <RoundedBox args={[1.55, 1.6, 1.05]} radius={0.42} smoothness={4}>
        <meshStandardMaterial color="#ffffff" roughness={0.45} metalness={0.05} />
      </RoundedBox>

      {/* Suspenders */}
      <mesh position={[-0.35, 0.55, 0.5]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.08, 0.6, 0.04]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>
      <mesh position={[0.35, 0.55, 0.5]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.08, 0.6, 0.04]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>

      {/* Cross on chest */}
      <mesh position={[0, 0.05, 0.535]}>
        <boxGeometry args={[0.5, 0.14, 0.03]} />
        <meshStandardMaterial color="#0f766e" emissive="#10b981" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.05, 0.535]}>
        <boxGeometry args={[0.14, 0.5, 0.03]} />
        <meshStandardMaterial color="#0f766e" emissive="#10b981" emissiveIntensity={0.25} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0, 1.25, 0]}>
        <RoundedBox args={[1.3, 1.1, 1.05]} radius={0.5} smoothness={4}>
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </RoundedBox>

        {/* Ear pods */}
        <mesh position={[-0.7, 0.05, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#0f766e" />
        </mesh>
        <mesh position={[0.7, 0.05, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#0f766e" />
        </mesh>
        {/* Listening pulse on ear pods */}
        {listening && (
          <>
            <mesh position={[-0.7, 0.05, 0]}>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshBasicMaterial color="#0ea5e9" transparent opacity={0.35} />
            </mesh>
            <mesh position={[0.7, 0.05, 0]}>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshBasicMaterial color="#0ea5e9" transparent opacity={0.35} />
            </mesh>
          </>
        )}

        {/* Visor */}
        <RoundedBox args={[1.05, 0.6, 0.05]} radius={0.18} smoothness={4} position={[0, 0.05, 0.49]}>
          <meshStandardMaterial color="#0a1f1d" roughness={0.15} metalness={0.6} />
        </RoundedBox>

        {/* Eyes (glowing) */}
        <mesh ref={leftEye} position={[-0.22, 0.1, 0.535]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
        <mesh ref={rightEye} position={[0.22, 0.1, 0.535]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={2.4} toneMapped={false} />
        </mesh>

        {/* Cheeks */}
        <mesh position={[-0.42, -0.05, 0.5]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#fda4af" emissive="#fda4af" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.42, -0.05, 0.5]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#fda4af" emissive="#fda4af" emissiveIntensity={0.3} />
        </mesh>

        {/* Mouth (lip sync) */}
        <mesh ref={mouthRef} position={[0, -0.18, 0.535]}>
          <boxGeometry args={[0.18, 0.04, 0.02]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>

      {/* Antenna */}
      <mesh position={[0, 1.95, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 12]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>

      {/* Heart */}
      <group ref={heartRef} position={[0, 2.32, 0]}>
        <mesh position={[-0.09, 0.04, 0]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#0f766e" emissive="#10b981" emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
        <mesh position={[0.09, 0.04, 0]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#0f766e" emissive="#10b981" emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.10, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#0f766e" emissive="#10b981" emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </group>

      {/* Waving arm */}
      <group ref={armRef} position={[-0.85, 0.55, 0]}>
        <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.13, 0.45, 6, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.55, 0.05, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Bag arm */}
      <group position={[0.9, 0.05, 0]}>
        <mesh>
          <capsuleGeometry args={[0.13, 0.5, 6, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[0.34, 0.32, 0.28]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, -0.5, 0.145]}>
          <boxGeometry args={[0.2, 0.07, 0.02]} />
          <meshStandardMaterial color="#0f766e" />
        </mesh>
        <mesh position={[0, -0.5, 0.145]}>
          <boxGeometry args={[0.07, 0.2, 0.02]} />
          <meshStandardMaterial color="#0f766e" />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <boxGeometry args={[0.18, 0.04, 0.04]} />
          <meshStandardMaterial color="#0f766e" />
        </mesh>
      </group>

      {/* Legs */}
      <mesh position={[-0.32, -1.0, 0]}>
        <capsuleGeometry args={[0.18, 0.32, 6, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.32, -1.0, 0]}>
        <capsuleGeometry args={[0.18, 0.32, 6, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

/* ───────── Floating AR pills + lab vials ───────── */

function PillCapsule({
  position, baseColor, capColor, label, onSelect,
}: {
  position: [number, number, number];
  baseColor: string;
  capColor: string;
  label: string;
  onSelect?: (label: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const seed = useMemo(() => position[0] * 1.7 + position[2] * 0.6, [position]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.4 + seed) * 0.12;
    ref.current.rotation.x = t * 0.45 + seed;
    ref.current.rotation.z = Math.sin(t * 0.6 + seed) * 0.4;
  });

  const scale = hover ? 1.25 : 1;

  return (
    <group
      ref={ref}
      position={position}
      scale={scale}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "default"; }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(label); }}
    >
      {/* Bottom rounded cap */}
      <mesh position={[0, -0.13, 0]}>
        <sphereGeometry args={[0.16, 24, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={baseColor} roughness={0.35} />
      </mesh>
      {/* Bottom barrel */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.14, 24]} />
        <meshStandardMaterial color={baseColor} roughness={0.35} />
      </mesh>
      {/* Top barrel */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.161, 0.161, 0.14, 24]} />
        <meshStandardMaterial color={capColor} roughness={0.3} />
      </mesh>
      {/* Top rounded cap */}
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.16, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={capColor} roughness={0.3} />
      </mesh>

      {hover && (
        <Html position={[0, 0.5, 0]} center distanceFactor={6} zIndexRange={[10, 0]}>
          <div className="bg-white/95 backdrop-blur shadow-soft border border-ink-100 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 whitespace-nowrap pointer-events-none">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

function LabVial({
  position, liquidColor, label, onSelect,
}: {
  position: [number, number, number];
  liquidColor: string;
  label: string;
  onSelect?: (label: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const seed = useMemo(() => position[0] * 0.9 + position[2] * 1.3, [position]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.1 + seed) * 0.1;
    ref.current.rotation.y = t * 0.35 + seed;
    ref.current.rotation.z = Math.sin(t * 0.5 + seed) * 0.18;
  });

  const scale = hover ? 1.25 : 1;

  return (
    <group
      ref={ref}
      position={position}
      scale={scale}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "default"; }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(label); }}
    >
      {/* Glass tube */}
      <mesh>
        <cylinderGeometry args={[0.11, 0.11, 0.46, 18]} />
        <meshPhysicalMaterial
          color="#ffffff" transparent opacity={0.25} roughness={0.05}
          transmission={0.85} thickness={0.25}
        />
      </mesh>
      {/* Liquid inside */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.28, 18]} />
        <meshStandardMaterial color={liquidColor} emissive={liquidColor} emissiveIntensity={0.25} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.07, 18]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>
      {/* Rounded bottom */}
      <mesh position={[0, -0.23, 0]}>
        <sphereGeometry args={[0.11, 18, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#ffffff" transparent opacity={0.25} roughness={0.05}
          transmission={0.85} thickness={0.25}
        />
      </mesh>

      {hover && (
        <Html position={[0, 0.45, 0]} center distanceFactor={6} zIndexRange={[10, 0]}>
          <div className="bg-white/95 backdrop-blur shadow-soft border border-ink-100 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-coral-600 whitespace-nowrap pointer-events-none">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

function ARMedSwarm({
  meds, show, onSelect,
}: {
  meds: ARMed[];
  show: boolean;
  onSelect?: (label: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetScale = show ? 1 : 0.001;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.18;
    const cur = groupRef.current.scale.x;
    const next = cur + (targetScale - cur) * 0.12;
    groupRef.current.scale.setScalar(next);
    groupRef.current.visible = next > 0.02;
  });

  if (meds.length === 0) return null;

  return (
    <group ref={groupRef} position={[0, 0.5, 0]} scale={0.001}>
      {meds.map((m, i) => {
        const angle = (i / meds.length) * Math.PI * 2;
        const radius = 2.5;
        const yOffset = (i % 2 === 0 ? 0.4 : -0.2);
        const pos: [number, number, number] = [Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius];
        if (m.kind === "vial") {
          return (
            <LabVial
              key={m.name}
              position={pos}
              liquidColor={m.liquidColor ?? "#dc2626"}
              label={m.name}
              onSelect={onSelect}
            />
          );
        }
        return (
          <PillCapsule
            key={m.name}
            position={pos}
            baseColor={m.baseColor ?? "#ffffff"}
            capColor={m.capColor ?? "#0f766e"}
            label={m.name}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

interface HealthCompanionProps {
  mood?: CompanionMood;
  message?: string;
  speaking?: boolean;
  listening?: boolean;
  onClick?: () => void;
  className?: string;
  mouthAmpRef?: React.RefObject<number>;
  meds?: ARMed[];
  showMeds?: boolean;
  onSelectMed?: (label: string) => void;
}

export default function HealthCompanion({
  mood = "happy",
  message,
  speaking = false,
  listening = false,
  onClick,
  className,
  mouthAmpRef,
  meds = [],
  showMeds = false,
  onSelectMed,
}: HealthCompanionProps) {
  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const accent = useMemo(() => MOOD_TINT[mood], [mood]);

  return (
    <div
      className={`relative w-full h-full select-none ${className ?? ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Halo */}
      <div
        className="absolute inset-6 rounded-full blur-3xl opacity-50 transition-colors duration-500"
        style={{ background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)` }}
        aria-hidden
      />

      {/* Listening ring */}
      {listening && (
        <div className="absolute inset-4 rounded-full border-2 border-sky2-500 animate-pulseSoft pointer-events-none" aria-hidden />
      )}

      {mounted && (
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0.3, 5.6], fov: 38 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.65} />
            <directionalLight position={[3, 4, 5]} intensity={1.5} />
            <directionalLight position={[-4, 2, -3]} intensity={0.55} color={accent} />
            <pointLight position={[0, 2.5, 2]} intensity={0.6} color={accent} />
            <Environment preset="apartment" />
            <CompanionModel
              mood={mood}
              hovered={hovered}
              speaking={speaking}
              listening={listening}
              mouthAmpRef={mouthAmpRef}
            />
            <ARMedSwarm meds={meds} show={showMeds} onSelect={onSelectMed} />
            <ContactShadows
              position={[0, -1.55, 0]}
              opacity={0.45}
              blur={2.4}
              far={4}
              resolution={512}
              color="#0c3a37"
            />
          </Suspense>
        </Canvas>
      )}

      {message && (
        <div className="absolute top-[25%] right-2 sm:right-3 max-w-[38%] animate-slideUp pointer-events-none">
          <div className="relative bg-white rounded-2xl rounded-l-lg shadow-soft border border-ink-100 px-3 py-2.5">
            {/* Voice waveform — animated bars while Dose is speaking */}
            {speaking && (
              <>
                <style>{`@keyframes voiceBar{from{transform:scaleY(0.2);}to{transform:scaleY(1);}}`}</style>
                <div className="flex items-end gap-[3px] h-4 mb-1.5">
                  {[0, 0.1, 0.22, 0.14, 0.06].map((delay, i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-brand-400"
                      style={{
                        height: "100%",
                        transformOrigin: "bottom",
                        transform: "scaleY(0.2)",
                        animation: `voiceBar 0.5s ease-in-out ${delay}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
            <p className="text-xs sm:text-sm text-ink-800 leading-snug">{message}</p>
            {/* Arrow pointing LEFT toward the avatar's mouth */}
            <svg
              className="absolute left-0 top-4 -translate-x-full"
              width="10" height="16" viewBox="0 0 10 16"
              aria-hidden="true"
            >
              <path d="M10,0 L10,16 L1,8 Z" fill="white" />
              <path d="M10,0.5 L1.5,8 L10,15.5" stroke="#e5e7eb" strokeWidth="1" fill="none" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
