import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Mesh, Group } from "three";

export interface Drone { id: string; position: [number, number, number]; }

// Pseudo-random noise for Atlas-like mountains
function terrainHeight(x: number, z: number) {
  const n =
    Math.sin(x * 0.35) * Math.cos(z * 0.35) * 1.4 +
    Math.sin(x * 0.8 + 1.2) * Math.cos(z * 0.7 + 0.5) * 0.6 +
    Math.sin(x * 1.6 + 3.1) * Math.cos(z * 1.4 + 2.2) * 0.25;
  // ridge along +x to mimic Atlas range
  const ridge = Math.exp(-Math.pow((z - 1.5) / 2.2, 2)) * 1.8;
  // flatten near origin (patient zone / valley)
  const valley = 1 - Math.exp(-(x * x + z * z) / 4);
  return (n + ridge) * valley;
}

function Terrain() {
  const geom = useMemo(() => {
    const size = 30;
    const seg = 120;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors: number[] = [];
    const cLow = new THREE.Color("#3d5a3a");   // valley green
    const cMid = new THREE.Color("#8a6a4a");   // earth/clay
    const cHigh = new THREE.Color("#d8c9a8");  // sandstone
    const cSnow = new THREE.Color("#f5f3ee");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const c = new THREE.Color();
      if (h < 0.2) c.copy(cLow);
      else if (h < 0.9) c.copy(cLow).lerp(cMid, (h - 0.2) / 0.7);
      else if (h < 1.8) c.copy(cMid).lerp(cHigh, (h - 0.9) / 0.9);
      else c.copy(cHigh).lerp(cSnow, Math.min(1, (h - 1.8) / 0.6));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} flatShading />
    </mesh>
  );
}

function PatientMarker() {
  const ringRef = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = (clock.elapsedTime % 2) / 2;
      ringRef.current.scale.setScalar(0.6 + t * 2.5);
      (ringRef.current.material as any).opacity = 0.9 - t * 0.9;
    }
  });
  return (
    <group position={[0, 0.02, 0]}>
      {/* pin */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <coneGeometry args={[0.18, 0.5, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function DroneMesh({ drone, target, dispatched }: { drone: Drone; target?: boolean; dispatched: boolean }) {
  const groupRef = useRef<Group>(null);
  const rotor1 = useRef<Mesh>(null);
  const rotor2 = useRef<Mesh>(null);
  const rotor3 = useRef<Mesh>(null);
  const rotor4 = useRef<Mesh>(null);

  // ground altitude at drone xz
  const groundY = useMemo(() => terrainHeight(drone.position[0], drone.position[2]), [drone.position]);
  const cruiseY = groundY + 1.3;

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;

    if (dispatched && target) {
      // Take off then fly to patient
      const targetY = 0.4 + Math.sin(clock.elapsedTime * 4) * 0.05;
      g.position.y += (cruiseY + 0.3 - g.position.y) * delta * 1.2;
      g.position.x += (0 - g.position.x) * delta * 0.5;
      g.position.z += (0 - g.position.z) * delta * 0.5;
      // descend when close
      const distXZ = Math.hypot(g.position.x, g.position.z);
      if (distXZ < 0.8) {
        g.position.y += (targetY - g.position.y) * delta * 1.5;
      }
      const spin = delta * 40;
      [rotor1, rotor2, rotor3, rotor4].forEach((r) => { if (r.current) r.current.rotation.y += spin; });
    } else {
      // Parked on ground, idle rotors slow
      g.position.y = groundY + 0.08;
      const spin = delta * 2;
      [rotor1, rotor2, rotor3, rotor4].forEach((r) => { if (r.current) r.current.rotation.y += spin; });
    }
  });

  const color = target ? "#22c55e" : "#f97316";

  return (
    <group ref={groupRef} position={[drone.position[0], groundY + 0.08, drone.position[2]]}>
      {/* landing skids */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.32, 0.02, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, -0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.32, 0.02, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* body */}
      <mesh castShadow>
        <boxGeometry args={[0.28, 0.1, 0.28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* arms + rotors */}
      {[[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]].map(([x, z], i) => (
        <group key={i} position={[x, 0.02, z]}>
          <mesh ref={i === 0 ? rotor1 : i === 1 ? rotor2 : i === 2 ? rotor3 : rotor4} position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.01, 16]} />
            <meshStandardMaterial color="#0f172a" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
      <pointLight color={color} intensity={0.5} distance={1.6} />
    </group>
  );
}

function Sky() {
  return (
    <>
      <color attach="background" args={["#bcd6e8"]} />
      <fog attach="fog" args={["#d9e6ef", 12, 30]} />
    </>
  );
}

export default function DroneMap3D({ drones, closestId, dispatched }: { drones: Drone[]; closestId?: string; dispatched: boolean }) {
  return (
    <Canvas shadows camera={{ position: [6, 5, 6], fov: 55 }} dpr={[1, 2]}>
      <Sky />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 12, 4]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight args={["#cfe6f5", "#6b5a3a", 0.4]} />
      <Terrain />
      <PatientMarker />
      {drones.map((d) => (
        <DroneMesh key={d.id} drone={d} target={d.id === closestId} dispatched={dispatched} />
      ))}
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
