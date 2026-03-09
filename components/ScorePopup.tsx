import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";

export interface PopupEvent {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
}

interface PopupItemProps {
  event: PopupEvent;
  onComplete: (id: string) => void;
}

function PopupItem({ event, onComplete }: PopupItemProps) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.back(1.5)) });
    translateY.value = withTiming(-70, { duration: 900, easing: Easing.out(Easing.ease) });
    opacity.value = withTiming(0, { duration: 900, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) runOnJS(onComplete)(event.id);
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.Text
      style={[
        styles.label,
        {
          color: event.color,
          left: event.x - 40,
          top: event.y - 20,
          shadowColor: event.color,
          textShadowColor: event.color,
        },
        animStyle,
      ]}
    >
      {event.label}
    </Animated.Text>
  );
}

interface ScorePopupProps {
  popups: PopupEvent[];
  onComplete: (id: string) => void;
}

export default function ScorePopup({ popups, onComplete }: ScorePopupProps) {
  if (popups.length === 0) return null;
  return (
    <View style={styles.container} pointerEvents="none">
      {popups.map((p) => (
        <PopupItem key={p.id} event={p} onComplete={onComplete} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
  },
  label: {
    position: "absolute",
    fontSize: 16,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1.5,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
    width: 80,
    textAlign: "center",
  },
});
