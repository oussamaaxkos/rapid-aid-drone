import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh, Group } from "three";

export interface Drone { id: string; position: [number, number, number]; }

function UserMarker() {
  const ringRef = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = (clock.elapsedTime % 2) / 2;
      ringRef.current.scale.setScalar(0.5 + t * 2);
      (ringRef.current.material as any).opacity = 0.8 - t * 0.8;
    }
  });
  return (
    <group position={[0, 0.05, 0]}>
      <mesh>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 32]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.4, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
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

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    g.position.y = drone.position[1] + Math.sin(clock.elapsedTime * 2 + drone.position[0]) * 0.1;

    if (dispatched && target) {
      // animate toward user
      g.position.x += (0 - g.position.x) * delta * 0.6;
      g.position.z += (0 - g.position.z) * delta * 0.6;
      g.position.y += (0.3 - g.position.y) * delta * 0.6;
    }

    const spin = delta * 30;
    [rotor1, rotor2, rotor3, rotor4].forEach((r) => { if (r.current) r.current.rotation.y += spin; });
  });

  const color = target ? "#22c55e" : "#f97316";

  return (
    <group ref={groupRef} position={drone.position}>
      {/* body */}
      <mesh castShadow>
        <boxGeometry args={[0.25, 0.08, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* arms */}
      {[[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[-x * 0.5, 0, -z * 0.5]}>
            <boxGeometry args={[Math.abs(x) * 1.2, 0.03, 0.04]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh ref={i === 0 ? rotor1 : i === 1 ? rotor2 : i === 2 ? rotor3 : rotor4} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.01, 16]} />
            <meshStandardMaterial color="#0f172a" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
      {/* indicator light */}
      <pointLight color={color} intensity={0.6} distance={1.5} />
      {/* shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -drone.position[1] + 0.01, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function Buildings() {
  const blocks = [
    [2.5, 0.6, 1.8, 1.2], [-2.8, 0.4, -2, 0.8], [1.5, 0.8, -2.5, 1.6],
    [-2, 0.5, 2.3, 1.0], [3.2, 0.3, -1, 0.7], [-1.5, 0.7, -1.2, 1.4],
  ] as const;
  return (
    <>
      {blocks.map(([x, h, z, w], i) => (
        <mesh key={i} position={[x, h, z]} castShadow>
          <boxGeometry args={[w, h * 2, w]} />
          <meshStandardMaterial color="#1e293b" emissive="#0ea5e9" emissiveIntensity={0.05} />
        </mesh>
      ))}
    </>
  );
}

export default function DroneMap3D({ drones, closestId, dispatched }: { drones: Drone[]; closestId?: string; dispatched: boolean }) {
  return (
    <Canvas shadows camera={{ position: [4, 4, 4], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#0b1220"]} />
      <fog attach="fog" args={["#0b1220", 6, 14]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 3]} intensity={1} castShadow />
      <Grid
        args={[20, 20]}
        cellColor="#1e3a5f"
        sectionColor="#22d3ee"
        sectionThickness={1.2}
        cellThickness={0.6}
        fadeDistance={12}
        infiniteGrid
      />
      <UserMarker />
      <Buildings />
      {drones.map((d) => (
        <DroneMesh key={d.id} drone={d} target={d.id === closestId} dispatched={dispatched} />
      ))}
      <OrbitControls enablePan={false} minDistance={3} maxDistance={9} maxPolarAngle={Math.PI / 2.2} autoRotate autoRotateSpeed={0.6} />
    </Canvas>
  );
}
