"use client";

import { useEffect, useState, useRef } from "react";

interface DynamicBackgroundProps {
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  visualMood: string;
}

interface Orb {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  offsetX: number;
  offsetY: number;
}

function lerpColor(c1: string, c2: string, t: number) {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

export default function DynamicBackground({
  colorPalette,
  visualMood,
}: DynamicBackgroundProps) {
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const lastPalette = useRef(colorPalette);

  useEffect(() => {
    const items: Orb[] = [];
    for (let i = 0; i < 5; i++) {
      items.push({
        id: i,
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60,
        size: 120 + Math.random() * 200,
        color: i % 3 === 0 ? colorPalette.accent : i % 3 === 1 ? colorPalette.secondary : colorPalette.primary,
        speed: 0.2 + Math.random() * 0.5,
        offsetX: Math.random() * Math.PI * 2,
        offsetY: Math.random() * Math.PI * 2,
      });
    }
    setOrbs(items);
  }, []);

  useEffect(() => {
    lastPalette.current = colorPalette;
  }, [colorPalette]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 transition-all duration-[2000ms] ease-in-out"
        style={{
          backgroundImage: `linear-gradient(160deg, ${colorPalette.primary} 0%, ${colorPalette.secondary} 40%, ${colorPalette.primary} 70%, ${colorPalette.secondary} 100%)`,
          backgroundSize: "400% 400%",
          backgroundPosition: `${(Math.sin(elapsed * 0.01) + 1) * 25}% ${(Math.cos(elapsed * 0.013) + 1) * 25}%`,
        }}
      />

      {orbs.map((orb, i) => (
        <div
          key={orb.id}
          className="absolute rounded-full blur-[80px] transition-colors duration-[3000ms]"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x + Math.sin(elapsed * orb.speed * 0.1 + orb.offsetX) * 15}%`,
            top: `${orb.y + Math.cos(elapsed * orb.speed * 0.1 + orb.offsetY) * 15}%`,
            backgroundColor: lerpColor(
              lastPalette.current.accent,
              i % 2 === 0 ? lastPalette.current.secondary : lastPalette.current.accent,
              0.5
            ),
            opacity: 0.25,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            `radial-gradient(ellipse at 30% 20%, ${colorPalette.accent}15 0%, transparent 60%), ` +
            `radial-gradient(ellipse at 70% 80%, ${colorPalette.accent}08 0%, transparent 50%)`,
        }}
      />

      <div className="absolute bottom-8 left-8 text-white/10 text-xs font-light tracking-[0.3em] uppercase">
        {visualMood}
      </div>
    </div>
  );
}