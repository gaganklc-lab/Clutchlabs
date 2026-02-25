import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

export type FlashType = "correct" | "wrong" | null;

interface ScreenFlashProps {
  flashType: FlashType;
  flashKey: number;
}

export default function ScreenFlash({ flashType, flashKey }: ScreenFlashProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (flashType) {
      opacity.value = withSequence(
        withTiming(0.35, { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })
      );
    }
  }, [flashType, flashKey]);

  const animStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  if (!flashType) return null;

  const backgroundColor = flashType === "correct" ? Colors.success : Colors.error;

  return (
    <Animated.View
      style={[styles.overlay, animStyle, { backgroundColor }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
});
