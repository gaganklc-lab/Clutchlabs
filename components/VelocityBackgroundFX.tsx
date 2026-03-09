import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface VelocityBackgroundFXProps {
  isFrenzy: boolean;
}

const COLS = 7;
const ROWS = 11;
const CELL_SIZE = 50;

export default function VelocityBackgroundFX({ isFrenzy }: VelocityBackgroundFXProps) {
  const drift = useSharedValue(0);
  const opacityBase = useSharedValue(isFrenzy ? 0.12 : 0.055);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(CELL_SIZE, {
        duration: isFrenzy ? 1200 : 2800,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [isFrenzy]);

  useEffect(() => {
    opacityBase.value = withTiming(isFrenzy ? 0.13 : 0.055, { duration: 400 });
  }, [isFrenzy]);

  const gridAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value % CELL_SIZE }],
    opacity: opacityBase.value,
  }));

  const gridColor = isFrenzy ? "#FF2D6F" : "#00E5FF";

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, gridAnimStyle]}>
        {Array.from({ length: ROWS + 1 }).map((_, row) => (
          <View
            key={`h${row}`}
            style={[
              styles.hLine,
              { top: row * CELL_SIZE - CELL_SIZE, borderColor: gridColor },
            ]}
          />
        ))}
        {Array.from({ length: COLS + 1 }).map((_, col) => (
          <View
            key={`v${col}`}
            style={[
              styles.vLine,
              { left: col * CELL_SIZE, borderColor: gridColor },
            ]}
          />
        ))}
      </Animated.View>
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
});
