'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type OrbStatus =
  | 'active'
  | 'awaiting_human_input'
  | 'awaiting_spend_approval'
  | 'verifying'
  | 'settled'
  | 'failed'
  | 'idle';

const STATUS_COLOR: Record<OrbStatus, [number, number, number]> = {
  active: [0.92, 0.66, 0.22],
  awaiting_human_input: [0.86, 0.60, 0.18],
  awaiting_spend_approval: [0.88, 0.62, 0.20],
  verifying: [0.78, 0.56, 0.22],
  settled: [0.96, 0.78, 0.34],
  failed: [0.66, 0.22, 0.18],
  idle: [0.52, 0.40, 0.24],
};

const orbFragment = /* glsl */ `
precision mediump float;
varying vec2 vUv;
varying vec3 vNormal;
uniform float uTime;
uniform float uPulse;
uniform float uWire;
uniform vec3 uColor;
uniform float uGlow;

void main() {
  float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
  float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
  vec3 base = uColor * (0.55 + 0.45 * vNormal.z);
  base += uColor * fresnel * 0.7 * uGlow;
  base += uColor * pulse * uPulse * 0.55;
  if (uWire > 0.5) {
    float grid = step(0.96, max(abs(sin(vUv.x * 28.0 + uTime * 1.4)), abs(sin(vUv.y * 28.0))));
    base = mix(base, vec3(1.0, 0.92, 0.55), grid * 0.4);
  }
  gl_FragColor = vec4(base, 1.0);
}
`;

const orbVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function Orb({ status }: { status: OrbStatus }) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const [r, g, b] = STATUS_COLOR[status] ?? STATUS_COLOR.idle;
  const pulse = status === 'active' ? 1 : 0;
  const wire = status === 'verifying' ? 1 : 0;
  const glow = status === 'settled' ? 1.5 : 1;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: pulse },
      uWire: { value: wire },
      uColor: { value: new THREE.Vector3(r, g, b) },
      uGlow: { value: glow },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (matRef.current) {
      const u = matRef.current.uniforms;
      (u.uTime as { value: number }).value = t;
      (u.uPulse as { value: number }).value = pulse;
      (u.uWire as { value: number }).value = wire;
      (u.uGlow as { value: number }).value = glow;
      (u.uColor as { value: THREE.Vector3 }).value.set(r, g, b);
    }
    if (meshRef.current) {
      const wireSpin = wire ? t * 1.6 : t * 0.5;
      meshRef.current.rotation.y = wireSpin;
      meshRef.current.rotation.x = Math.sin(t * 0.4) * 0.18;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 1.2;
    }
  });

  const showRing = status === 'awaiting_human_input' || status === 'awaiting_spend_approval';

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.7, 48, 48]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={orbVertex}
          fragmentShader={orbFragment}
          uniforms={uniforms}
        />
      </mesh>
      {showRing && (
        <mesh ref={ringRef} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.95, 0.04, 12, 64]} />
          <meshBasicMaterial color={`rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`} />
        </mesh>
      )}
    </group>
  );
}

export default function MissionOrb({
  status,
  size = 36,
  showCheckmark = false,
}: {
  status: OrbStatus;
  size?: number;
  showCheckmark?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 2.4], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.7} />
        <Orb status={status} />
      </Canvas>
      {showCheckmark && (
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          style={{
            position: 'absolute',
            inset: 0,
            margin: 'auto',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 6px rgba(255, 220, 140, 0.55))',
          }}
        >
          <path
            d="M5 12.5 L10 17 L19 7"
            fill="none"
            stroke="oklch(0.96 0.07 90)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="32"
            strokeDashoffset="32"
            style={{ animation: 'draw-check 0.6s var(--ease) forwards' }}
          />
        </svg>
      )}
    </span>
  );
}
