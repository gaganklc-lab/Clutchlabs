import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const RIPPLE_DURATION = 400;

export interface RippleEvent {
  x: number;
  y: number;
  color: string;
  id: string;
}

function SingleRipple({ ripple, onDone }: { ripple: RippleEvent; onDone: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: RIPPLE_DURATION,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const size = 20 + progress.value * 60;
    return {
      position: "absolute" as const,
      left: ripple.x - size / 2,
      top: ripple.y - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: ripple.color,
      opacity: 1 - progress.value,
    };
  });

  return <Animated.View style={animStyle} />;
}

interface TapRippleProps {
  ripples: RippleEvent[];
  onRippleComplete: (id: string) => void;
}

export default function TapRipple({ ripples, onRippleComplete }: TapRippleProps) {
  if (ripples.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ripples.map((r) => (
        <SingleRipple
          key={r.id}
          ripple={r}
          onDone={() => onRippleComplete(r.id)}
        />
      ))}
    </View>
  );
}
