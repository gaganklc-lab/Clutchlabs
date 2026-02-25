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
const CONFETTI_COUNT = 40;
const CONFETTI_DURATION = 2500;

const CONFETTI_COLORS = [
  "#FF2D6F", "#00E5FF", "#FFD600", "#00E676",
  "#AA00FF", "#FF9100", "#2979FF", "#FF1744",
];

interface ConfettiPiece {
  id: number;
  x: number;
  targetY: number;
  rotation: number;
  width: number;
  height: number;
  color: string;
  delay: number;
  drift: number;
}

function SingleConfetti({ piece, onDone }: { piece: ConfettiPiece; onDone: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: CONFETTI_DURATION,
        easing: Easing.out(Easing.quad),
      }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, piece.delay);
    return () => clearTimeout(timer);
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const y = -20 + piece.targetY * progress.value;
    const x = piece.x + piece.drift * progress.value * Math.sin(progress.value * 6);
    const rotate = piece.rotation * progress.value;
    const opacity = progress.value < 0.8 ? 1 : 1 - (progress.value - 0.8) / 0.2;

    return {
      position: "absolute" as const,
      left: x,
      top: y,
      width: piece.width,
      height: piece.height,
      borderRadius: piece.width < 6 ? piece.width / 2 : 2,
      backgroundColor: piece.color,
      opacity,
      transform: [
        { rotate: `${rotate}deg` },
        { scaleX: Math.sin(progress.value * 8) * 0.5 + 0.5 },
      ],
    };
  });

  return <Animated.View style={animStyle} />;
}

interface ConfettiProps {
  active: boolean;
}

export default function Confetti({ active }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) return;

    const newPieces: ConfettiPiece[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        targetY: SCREEN_HEIGHT + 50,
        rotation: (Math.random() - 0.5) * 720,
        width: 4 + Math.random() * 8,
        height: 6 + Math.random() * 12,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 600,
        drift: (Math.random() - 0.5) * 80,
      });
    }
    setPieces(newPieces);
  }, [active]);

  const handleDone = (id: number) => {
    setPieces((prev) => prev.filter((p) => p.id !== id));
  };

  if (pieces.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => (
        <SingleConfetti
          key={piece.id}
          piece={piece}
          onDone={() => handleDone(piece.id)}
        />
      ))}
    </View>
  );
}
