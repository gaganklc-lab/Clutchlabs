import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COUNT = 18;

interface ParticleConfig {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
}

function FloatingParticle({ config }: { config: ParticleConfig }) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: config.x + interpolate(anim.value, [0, 0.5, 1], [0, config.driftX, 0]),
    top: config.y + interpolate(anim.value, [0, 0.5, 1], [0, config.driftY, 0]),
    width: config.size,
    height: config.size,
    borderRadius: config.size / 2,
    backgroundColor: config.color,
    opacity: interpolate(anim.value, [0, 0.3, 0.7, 1], [0.06, 0.15, 0.15, 0.06]),
  }));

  return <Animated.View style={animStyle} />;
}

interface AmbientParticlesProps {
  color?: string;
  count?: number;
}

export default function AmbientParticles({ color = "#00E5FF", count = PARTICLE_COUNT }: AmbientParticlesProps) {
  const particles = useMemo(() => {
    const configs: ParticleConfig[] = [];
    const colors = [
      color,
      color + "80",
      "#FFFFFF20",
      "#7B61FF30",
    ];
    for (let i = 0; i < count; i++) {
      configs.push({
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 3000,
        duration: 4000 + Math.random() * 4000,
        driftX: (Math.random() - 0.5) * 40,
        driftY: (Math.random() - 0.5) * 60,
      });
    }
    return configs;
  }, [color, count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <FloatingParticle key={i} config={p} />
      ))}
    </View>
  );
}
