import React, { useEffect, useState } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COUNT = 12;
const PARTICLE_DURATION = 500;

interface ParticleData {
  id: string;
  x: number;
  y: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

interface BurstEvent {
  x: number;
  y: number;
  color: string;
  id: string;
}

function SingleParticle({ particle, onDone }: { particle: ParticleData; onDone: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: PARTICLE_DURATION,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) {
        runOnJS(onDone)();
      }
    });
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const dx = Math.cos(particle.angle) * particle.distance * progress.value;
    const dy = Math.sin(particle.angle) * particle.distance * progress.value;
    const scale = 1 - progress.value * 0.8;
    const opacity = 1 - progress.value;

    return {
      position: "absolute" as const,
      left: particle.x + dx - particle.size / 2,
      top: particle.y + dy - particle.size / 2,
      width: particle.size,
      height: particle.size,
      borderRadius: particle.size / 2,
      backgroundColor: particle.color,
      opacity,
      transform: [{ scale }],
    };
  });

  return <Animated.View style={animStyle} />;
}

interface ParticleBurstProps {
  bursts: BurstEvent[];
  onBurstComplete: (id: string) => void;
}

export type { BurstEvent };

export default function ParticleBurst({ bursts, onBurstComplete }: ParticleBurstProps) {
  const [activeParticles, setActiveParticles] = useState<ParticleData[]>([]);

  useEffect(() => {
    if (bursts.length === 0) return;

    const latest = bursts[bursts.length - 1];
    const newParticles: ParticleData[] = [];

    const colors = [
      latest.color,
      lightenColor(latest.color, 40),
      lightenColor(latest.color, 80),
      "#FFFFFF",
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      newParticles.push({
        id: `${latest.id}_${i}`,
        x: latest.x,
        y: latest.y,
        angle,
        distance: 40 + Math.random() * 60,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    setActiveParticles((prev) => [...prev, ...newParticles]);
  }, [bursts]);

  const handleParticleDone = (particleId: string) => {
    setActiveParticles((prev) => {
      const next = prev.filter((p) => p.id !== particleId);
      const burstId = particleId.split("_").slice(0, -1).join("_");
      const remaining = next.filter((p) => p.id.startsWith(burstId));
      if (remaining.length === 0) {
        onBurstComplete(burstId);
      }
      return next;
    });
  };

  if (activeParticles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {activeParticles.map((particle) => (
        <SingleParticle
          key={particle.id}
          particle={particle}
          onDone={() => handleParticleDone(particle.id)}
        />
      ))}
    </View>
  );
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
