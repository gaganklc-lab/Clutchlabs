import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

type GameMode = "regular" | "endless" | "zen";

interface VelocityBackgroundFXProps {
  isFrenzy: boolean;
  mode?: GameMode;
  speedLevel?: number;
}

const COLS = 7;
const ROWS = 11;
const CELL_SIZE = 50;

const MODE_COLOR: Record<GameMode, string> = {
  regular: "#00E5FF",
  endless: "#7B61FF",
  zen: "#00BCD4",
};

function getGridColor(isFrenzy: boolean, mode: GameMode, speedLevel: number): string {
  if (isFrenzy) return "#FF2D6F";
  if (mode === "endless" && speedLevel >= 5) return "#FF6B35";
  if (mode === "endless" && speedLevel >= 3) return "#FF9F43";
  return MODE_COLOR[mode];
}

function getGridOpacity(isFrenzy: boolean, mode: GameMode, speedLevel: number): number {
  if (isFrenzy) return 0.14;
  if (mode === "endless") return 0.065 + Math.min(speedLevel * 0.006, 0.04);
  if (mode === "zen") return 0.04;
  return 0.06;
}

function getGridSpeed(isFrenzy: boolean, mode: GameMode, speedLevel: number): number {
  if (isFrenzy) return 900;
  if (mode === "endless") return Math.max(800, 2800 - speedLevel * 220);
  if (mode === "zen") return 4000;
  return 2800;
}

export default function VelocityBackgroundFX({
  isFrenzy,
  mode = "regular",
  speedLevel = 1,
}: VelocityBackgroundFXProps) {
  const drift = useSharedValue(0);
  const opacityBase = useSharedValue(getGridOpacity(isFrenzy, mode, speedLevel));
  const ringPulse = useSharedValue(0);
  const laneDrift = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const intensityScale = useSharedValue(1);

  useEffect(() => {
    const speed = getGridSpeed(isFrenzy, mode, speedLevel);
    drift.value = withRepeat(
      withTiming(CELL_SIZE, { duration: speed, easing: Easing.linear }),
      -1,
      false
    );
  }, [isFrenzy, mode, speedLevel]);

  useEffect(() => {
    opacityBase.value = withTiming(getGridOpacity(isFrenzy, mode, speedLevel), { duration: 600 });
  }, [isFrenzy, mode, speedLevel]);

  useEffect(() => {
    const ringSpeed = isFrenzy ? 600 : mode === "endless" ? Math.max(700, 1800 - speedLevel * 120) : 2200;
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: ringSpeed, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: ringSpeed, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    ringOpacity.value = withTiming(isFrenzy ? 0.18 : mode === "zen" ? 0.06 : 0.1, { duration: 600 });
  }, [isFrenzy, mode, speedLevel]);

  useEffect(() => {
    const laneSpeed = isFrenzy ? 1400 : mode === "endless" ? Math.max(900, 3000 - speedLevel * 200) : 3600;
    laneDrift.value = withRepeat(
      withTiming(300, { duration: laneSpeed, easing: Easing.linear }),
      -1,
      false
    );
  }, [isFrenzy, mode, speedLevel]);

  useEffect(() => {
    intensityScale.value = withTiming(
      isFrenzy ? 1.4 : 1 + Math.min(speedLevel * 0.04, 0.3),
      { duration: 800 }
    );
  }, [isFrenzy, speedLevel]);

  const gridColor = getGridColor(isFrenzy, mode, speedLevel);

  const gridAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value % CELL_SIZE }],
    opacity: opacityBase.value,
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(ringPulse.value, [0, 1], [1, 1.06]) * intensityScale.value },
      { scaleY: interpolate(ringPulse.value, [0, 1], [1, 1.06]) * intensityScale.value },
    ],
    opacity: interpolate(ringPulse.value, [0, 1], [ringOpacity.value * 0.5, ringOpacity.value]),
    borderColor: gridColor,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(ringPulse.value, [0, 1], [1.06, 1]) * intensityScale.value },
      { scaleY: interpolate(ringPulse.value, [0, 1], [1.06, 1]) * intensityScale.value },
    ],
    opacity: interpolate(ringPulse.value, [0, 1], [ringOpacity.value, ringOpacity.value * 0.4]),
    borderColor: gridColor,
  }));

  const ring3Style = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(ringPulse.value, [0, 1], [0.96, 1.02]) * intensityScale.value },
      { scaleY: interpolate(ringPulse.value, [0, 1], [0.96, 1.02]) * intensityScale.value },
    ],
    opacity: interpolate(ringPulse.value, [0, 1], [ringOpacity.value * 0.3, ringOpacity.value * 0.7]),
    borderColor: gridColor,
  }));

  const laneAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -(laneDrift.value % 300) },
      { translateY: -(laneDrift.value % 300) },
    ],
    opacity: isFrenzy ? 0.12 : mode === "zen" ? 0.04 : 0.065,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Scrolling neon grid */}
      <Animated.View style={[StyleSheet.absoluteFill, gridAnimStyle]}>
        {Array.from({ length: ROWS + 1 }).map((_, row) => (
          <View
            key={`h${row}`}
            style={[styles.hLine, { top: row * CELL_SIZE - CELL_SIZE, borderColor: gridColor }]}
          />
        ))}
        {Array.from({ length: COLS + 1 }).map((_, col) => (
          <View
            key={`v${col}`}
            style={[styles.vLine, { left: col * CELL_SIZE, borderColor: gridColor }]}
          />
        ))}
      </Animated.View>

      {/* Diagonal lane energy lines */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.laneContainer, laneAnimStyle]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={`lane${i}`}
            style={[
              styles.laneLine,
              {
                left: i * 80 - 40,
                borderColor: gridColor,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Arena rings */}
      <View style={styles.ringContainer} pointerEvents="none">
        <Animated.View style={[styles.arenaRing, styles.ring1, ring1Style]} />
        <Animated.View style={[styles.arenaRing, styles.ring2, ring2Style]} />
        <Animated.View style={[styles.arenaRing, styles.ring3, ring3Style]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
  hLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
  },
  vLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 0,
    borderLeftWidth: 1,
  },
  laneContainer: {
    overflow: "hidden",
  },
  laneLine: {
    position: "absolute",
    top: -200,
    bottom: -200,
    width: 0,
    borderLeftWidth: 1,
    transform: [{ rotate: "30deg" }],
  },
  ringContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  arenaRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
  },
  ring1: {
    width: "55%",
    aspectRatio: 1,
  },
  ring2: {
    width: "78%",
    aspectRatio: 1,
  },
  ring3: {
    width: "95%",
    aspectRatio: 1,
  },
});
