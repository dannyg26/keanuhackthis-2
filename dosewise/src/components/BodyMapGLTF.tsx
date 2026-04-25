import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, ContactShadows, Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BODY_REGIONS, HOTSPOT_FRACTIONS, type BodyRegion, type BodySystem } from "../data/bodyMap";

interface BodyMapGLTFProps {
  modelUrl: string;
  autoRotateInitial?: boolean;
  /** World-space size to normalize the visible model into. */
  targetSize?: number;
  activeId: BodySystem | null;
  onSelectZone: (id: BodySystem) => void;
}

interface ModelProps {
  url: string;
  paused: boolean;
  targetSize: number;
  activeId: BodySystem | null;
  onSelectZone: (id: BodySystem) => void;
}

/** Compute a Box3 that includes only visible meshes. */
function computeVisibleBounds(root: THREE.Object3D): { center: THREE.Vector3; size: THREE.Vector3 } {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let found = false;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const geomBox = mesh.geometry.boundingBox;
    if (!geomBox) return;
    const meshBox = geomBox.clone().applyMatrix4(mesh.matrixWorld);
    if (!found) { box.copy(meshBox); found = true; } else { box.union(meshBox); }
  });
  if (!found) {
    return { center: new THREE.Vector3(), size: new THREE.Vector3(1, 1, 1) };
  }
  return {
    center: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3()),
  };
}

/* ───────── Glowing hotspot ───────── */

function Hotspot({
  region, position, active, onSelect,
}: {
  region: BodyRegion;
  position: [number, number, number];
  active: boolean;
  onSelect: (id: BodySystem) => void;
}) {
  const [hover, setHover] = useState(false);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 2.2) * 0.18;
    const base = active ? 1.6 : hover ? 1.3 : 1;
    ringRef.current.scale.setScalar(base * pulse);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = active ? 0.95 : hover ? 0.8 : 0.55;
  });

  const dotR = active ? 0.045 : hover ? 0.04 : 0.03;
  const ringInner = dotR * 1.6;
  const ringOuter = dotR * 2.4;

  return (
    <group position={position}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Pulsing ring */}
        <mesh ref={ringRef}>
          <ringGeometry args={[ringInner, ringOuter, 32]} />
          <meshBasicMaterial
            color={region.color}
            transparent
            opacity={0.55}
            depthTest={false}
          />
        </mesh>
        {/* Solid colored dot */}
        <mesh
          renderOrder={2}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = "default"; }}
          onClick={(e) => { e.stopPropagation(); onSelect(region.id); }}
        >
          <circleGeometry args={[dotR, 28]} />
          <meshBasicMaterial color={region.color} depthTest={false} transparent />
        </mesh>
        {/* White center highlight */}
        <mesh position={[-dotR / 4, dotR / 4, 0.0001]} renderOrder={3}>
          <circleGeometry args={[dotR / 3, 16]} />
          <meshBasicMaterial color="white" transparent opacity={0.9} depthTest={false} />
        </mesh>

        {(hover || active) && (
          <Html
            position={[0, dotR * 3, 0]}
            center
            distanceFactor={1.6}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className="bg-white shadow-soft border border-ink-100 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
              style={{ color: region.color }}
            >
              {region.name}
            </div>
          </Html>
        )}
      </Billboard>
    </group>
  );
}

/* ───────── Model + hotspots ───────── */

function Model({ url, paused, targetSize, activeId, onSelectZone }: ModelProps) {
  const gltf = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  const { scene, scale, offsetTuple, scaledSize } = useMemo(() => {
    const s = gltf.scene;
    s.position.set(0, 0, 0);
    s.rotation.set(0, 0, 0);
    s.scale.set(1, 1, 1);
    s.updateMatrixWorld(true);

    const { center, size } = computeVisibleBounds(s);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const factor = targetSize / maxDim;
    const offset = center.clone().multiplyScalar(-factor);

    return {
      scene: s,
      scale: factor,
      // R3F's position prop accepts [x,y,z] tuples; passing a Vector3 trips
      // its applyProps because Object3D.position is non-writable.
      offsetTuple: [offset.x, offset.y, offset.z] as [number, number, number],
      scaledSize: size.clone().multiplyScalar(factor),
    };
  }, [gltf, targetSize]);

  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
    });
  }, [scene]);

  useFrame((_, dt) => {
    if (!groupRef.current || paused) return;
    groupRef.current.rotation.y += dt * 0.3;
  });

  // Hotspot world positions (in the rotating group's local space, which is the
  // already-centered, already-scaled body space).
  const hotspots = useMemo(() => {
    return BODY_REGIONS.map((r) => {
      const f = HOTSPOT_FRACTIONS[r.id];
      return {
        region: r,
        position: [
          f.x * scaledSize.x,
          f.y * scaledSize.y,
          f.z * scaledSize.z,
        ] as [number, number, number],
      };
    });
  }, [scaledSize]);

  return (
    <group ref={groupRef}>
      <group scale={scale} position={offsetTuple}>
        <primitive object={scene} />
      </group>
      {/* Hotspots live in the same rotating group so they travel with the body */}
      {hotspots.map(({ region, position }) => (
        <Hotspot
          key={region.id}
          region={region}
          position={position}
          active={activeId === region.id}
          onSelect={onSelectZone}
        />
      ))}
    </group>
  );
}

export default function BodyMapGLTF({
  modelUrl, autoRotateInitial = true, targetSize = 3, activeId, onSelectZone,
}: BodyMapGLTFProps) {
  const [paused, setPaused] = useState(!autoRotateInitial);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cameraZ = targetSize * 1.7;

  return (
    <div
      className="relative w-full h-full bg-gradient-to-br from-cream-50 via-white to-blush-50 rounded-2xl overflow-hidden"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setTimeout(() => setPaused(false), 3500)}
    >
      {mounted && (
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, cameraZ], fov: 38 }}
          shadows
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[3, 6, 4]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#fde7d3" />
          <Environment preset="apartment" />

          <Suspense fallback={null}>
            <Model
              url={modelUrl}
              paused={paused}
              targetSize={targetSize}
              activeId={activeId}
              onSelectZone={onSelectZone}
            />
          </Suspense>

          <ContactShadows
            position={[0, -targetSize / 2 - 0.05, 0]}
            opacity={0.4}
            blur={2.4}
            far={targetSize}
            resolution={1024}
            color="#0c3a37"
          />

          <OrbitControls
            enableZoom
            enablePan={false}
            minDistance={cameraZ * 0.5}
            maxDistance={cameraZ * 2.5}
            target={[0, 0, 0]}
          />
        </Canvas>
      )}

      <div className="absolute top-3 left-3 max-w-[60%] pointer-events-none">
        <div className="bg-white/95 backdrop-blur shadow-soft border border-ink-100 rounded-2xl px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-charcoal-800/65">
            Tap a glowing point · drag to rotate · scroll to zoom
          </p>
        </div>
      </div>
    </div>
  );
}
