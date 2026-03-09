import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

export interface TrailSegment {
  id: string;
  offsetX: number;
  offsetY: number;
  color: string;
  size: number;
}

function TrailDot({ segment }: { segment: TrailSegment }) {
  const opacity = useSharedValue(0.75);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.ease) });
    scale.value = withTiming(0.2, { duration: 420, easing: Easing.out(Easing.ease) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        animStyle,
        {
          width: segment.size,
          height: segment.size,
          borderRadius: segment.size / 2,
          backgroundColor: segment.color,
          shadowColor: segment.color,
          left: -segment.size / 2 + segment.offsetX,
          top: -segment.size / 2 + segment.offsetY,
        },
      ]}
      pointerEvents="none"
    />
  );
}

interface OrbTrailProps {
  segments: TrailSegment[];
}

export default function OrbTrail({ segments }: OrbTrailProps) {
  if (segments.length === 0) return null;
  return (
    <View style={styles.container} pointerEvents="none">
      {segments.map((seg) => (
        <TrailDot key={seg.id} segment={seg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    position: "absolute",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
});
