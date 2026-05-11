'use client';

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";

const fragmentShader = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform float uTime;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.04;
  float n1 = snoise(uv * 1.4 + vec2(t, t * 0.7));
  float n2 = snoise(uv * 2.1 - vec2(t * 0.4, t * 0.9));
  vec3 dim    = vec3(0.06, 0.05, 0.04);
  vec3 amber  = vec3(0.42, 0.30, 0.10);
  vec3 ember  = vec3(0.62, 0.36, 0.10);
  float blob1 = smoothstep(-0.5, 0.7, n1);
  float blob2 = smoothstep(-0.4, 0.6, n2);
  vec3 col = mix(dim, amber, blob1 * 0.6);
  col = mix(col, ember, blob2 * 0.28);
  col -= 0.06 * pow(1.0 - uv.y, 2.5);
  gl_FragColor = vec4(col, 1.0);
}
`;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function GradientPlane({ paused }: { paused: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const accumRef = useRef(0);
  const lastRef = useRef(performance.now() / 1000);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(() => {
    const now = performance.now() / 1000;
    const dt = now - lastRef.current;
    lastRef.current = now;
    if (!paused) {
      accumRef.current += dt;
      if (matRef.current) {
        (matRef.current.uniforms.uTime as { value: number }).value = accumRef.current;
      }
    }
  });

  return (
    <mesh position={[0, 0, -3]}>
      <planeGeometry args={[24, 14, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={false}
      />
    </mesh>
  );
}

export default function AmbientCanvas() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onMq);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const readTheme = () => {
      const t = document.documentElement.getAttribute('data-theme');
      setIsDark(t !== 'light');
    };
    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      observer.disconnect();
    };
  }, []);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: isDark ? 0.18 : 0.3,
        mixBlendMode: isDark ? 'soft-light' : 'screen',
      }}
    >
      <Canvas
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 6], fov: 35 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        frameloop={paused ? "demand" : "always"}
      >
        <GradientPlane paused={paused} />
      </Canvas>
    </div>
  );
}
