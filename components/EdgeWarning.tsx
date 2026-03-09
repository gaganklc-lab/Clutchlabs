import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

type Direction = "left" | "right" | "top" | "bottom";

interface EdgeWarningProps {
  direction: Direction;
  visible: boolean;
  color: string;
}

export default function EdgeWarning({ direction, visible, color }: EdgeWarningProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(opacity);
    if (visible) {
      opacity.value = 0;
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 120, easing: Easing.out(Easing.ease) }),
          withTiming(0.45, { duration: 100, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.85, { duration: 100, easing: Easing.out(Easing.ease) }),
          withTiming(0.3, { duration: 180, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const posStyle = getPositionStyle(direction);

  return (
    <Animated.View
      style={[styles.base, posStyle, animStyle]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.bar,
          getBarSize(direction),
          {
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
      />
    </Animated.View>
  );
}

function getPositionStyle(direction: Direction) {
  switch (direction) {
    case "top":    return styles.posTop;
    case "bottom": return styles.posBottom;
    case "left":   return styles.posLeft;
    case "right":  return styles.posRight;
  }
}

function getBarSize(direction: Direction) {
  if (direction === "top" || direction === "bottom") return styles.barHorizontal;
  return styles.barVertical;
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    zIndex: 50,
  },
  posTop: {
    top: 0,
    left: 0,
    right: 0,
    alignItems: "stretch",
  },
  posBottom: {
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "stretch",
  },
  posLeft: {
    top: 0,
    bottom: 0,
    left: 0,
    alignItems: "flex-start",
  },
  posRight: {
    top: 0,
    bottom: 0,
    right: 0,
    alignItems: "flex-end",
  },
  bar: {
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
  barHorizontal: {
    height: 5,
    borderRadius: 3,
  },
  barVertical: {
    width: 5,
    flex: 1,
    borderRadius: 3,
  },
});
