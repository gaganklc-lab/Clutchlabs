import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Platform,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { trackEvent } from "@/lib/analytics";
import { soundManager } from "@/lib/sounds";
import AmbientParticles from "@/components/AmbientParticles";
import ScreenFlash from "@/components/ScreenFlash";
import ParticleBurst from "@/components/ParticleBurst";

type Direction = "top" | "bottom" | "left" | "right";
type GameMode = "regular" | "endless" | "zen";

const OPPOSITE: Record<Direction, Direction> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const OBSTACLE_COLOR: Record<Direction, string> = {
  top: Colors.secondary,
  bottom: Colors.primary,
  left: Colors.accent,
  right: "#FFD700",
};

interface Obstacle {
  id: string;
  direction: Direction;
}

export default function VelocityScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode: string }>();
  const mode = (modeParam ?? "regular") as GameMode;

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | string | null>(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(mode === "zen" ? 999 : 3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalDodges, setTotalDodges] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [activeObstacle, setActiveObstacle] = useState<Obstacle | null>(null);
  const [showFlash, setShowFlash] = useState<"success" | "error" | null>(null);
  const [burstPos, setBurstPos] = useState<{ x: number; y: number } | null>(null);

  const isPlayingRef = useRef(false);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const totalDodgesRef = useRef(0);
  const mistakesRef = useRef(0);
  const livesRef = useRef(mode === "zen" ? 999 : 3);
  const gameOverRef = useRef(false);
  const activeObstacleRef = useRef<Obstacle | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnDurationRef = useRef(1800);
  const rampTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const obstacleProgress = useSharedValue(0);
  const orbShake = useSharedValue(0);
  const orbScale = useSharedValue(1);

  const screenCenterX = contentMaxWidth ? Math.min(width, contentMaxWidth) / 2 : width / 2;
  const screenCenterY = (height - topInset - bottomInset) / 2;

  const cleanup = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (rampTimerRef.current) clearInterval(rampTimerRef.current);
    cancelAnimation(obstacleProgress);
  }, []);

  const endGame = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    cleanup();
    trackEvent("velocity_game_end", {
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      mistakes: mistakesRef.current,
      totalDodges: totalDodgesRef.current,
      mode,
    });
    router.replace({
      pathname: "/velocity-results",
      params: {
        score: scoreRef.current,
        maxCombo: maxComboRef.current,
        mistakes: mistakesRef.current,
        totalDodges: totalDodgesRef.current,
        timeSurvived: elapsedRef.current,
        mode,
      },
    });
  }, [cleanup, mode]);

  const spawnObstacle = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    const dirs: Direction[] = ["top", "bottom", "left", "right"];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const obs: Obstacle = { id, direction: dir };
    activeObstacleRef.current = obs;
    setActiveObstacle(obs);

    obstacleProgress.value = 0;
    obstacleProgress.value = withTiming(1, {
      duration: spawnDurationRef.current,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) {
        runOnJS(handleMissInternal)();
      }
    });
  }, []);

  const handleMissInternal = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    cancelAnimation(obstacleProgress);
    obstacleProgress.value = 0;
    activeObstacleRef.current = null;
    setActiveObstacle(null);

    mistakesRef.current += 1;
    setMistakes(mistakesRef.current);
    comboRef.current = 0;
    setCombo(0);

    if (mode !== "zen") {
      livesRef.current -= 1;
      setLives(livesRef.current);
    }

    setShowFlash("error");
    setTimeout(() => setShowFlash(null), 300);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    soundManager.play("wrong");

    orbShake.value = withSequence(
      withTiming(-14, { duration: 50 }),
      withTiming(14, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );

    if (livesRef.current <= 0 && mode !== "zen") {
      endGame();
      return;
    }

    spawnTimerRef.current = setTimeout(spawnObstacle, 400);
  }, [mode, endGame, spawnObstacle]);

  const handleSuccessInternal = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    cancelAnimation(obstacleProgress);
    obstacleProgress.value = 0;
    activeObstacleRef.current = null;
    setActiveObstacle(null);

    totalDodgesRef.current += 1;
    setTotalDodges(totalDodgesRef.current);
    comboRef.current += 1;
    setCombo(comboRef.current);
    if (comboRef.current > maxComboRef.current) {
      maxComboRef.current = comboRef.current;
      setMaxCombo(maxComboRef.current);
    }

    const multiplier = Math.min(1 + (comboRef.current - 1) * 0.5, 5);
    const gained = Math.round(10 * multiplier);
    scoreRef.current += gained;
    setScore(scoreRef.current);

    setShowFlash("success");
    setTimeout(() => setShowFlash(null), 200);

    setBurstPos({ x: screenCenterX, y: screenCenterY });
    setTimeout(() => setBurstPos(null), 600);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    soundManager.play("tap");

    spawnTimerRef.current = setTimeout(spawnObstacle, 300);
  }, [spawnObstacle, screenCenterX, screenCenterY]);

  const startGame = useCallback(() => {
    isPlayingRef.current = true;
    gameOverRef.current = false;
    setIsPlaying(true);

    if (mode === "regular") {
      gameTimerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            endGame();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }

    elapsedTimerRef.current = setInterval(() => {
      elapsedRef.current += 1;
    }, 1000);

    if (mode === "endless") {
      rampTimerRef.current = setInterval(() => {
        spawnDurationRef.current = Math.max(600, spawnDurationRef.current - 100);
      }, 20000);
    }

    spawnTimerRef.current = setTimeout(spawnObstacle, 500);
  }, [mode, endGame, spawnObstacle]);

  useEffect(() => {
    trackEvent("velocity_game_start", { mode });
    let val = 3;
    const tick = () => {
      setCountdown(val);
      if (val === 0) {
        setCountdown("GO!");
        setTimeout(() => {
          setCountdown(null);
          startGame();
        }, 600);
        return;
      }
      val -= 1;
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 400);

    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    return cleanup;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, { dx, dy }) => {
        const obs = activeObstacleRef.current;
        if (!obs || !isPlayingRef.current || gameOverRef.current) return;
        let swipe: Direction;
        if (Math.abs(dx) >= Math.abs(dy)) {
          swipe = dx > 0 ? "right" : "left";
        } else {
          swipe = dy > 0 ? "bottom" : "top";
        }
        const correct = OPPOSITE[obs.direction];
        if ((swipe as string) === correct) {
          isPlayingRef.current && handleSuccessInternal();
        } else {
          isPlayingRef.current && handleMissInternal();
        }
      },
    })
  ).current;

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: orbShake.value },
      { scale: orbScale.value },
    ],
  }));

  const heartColor = (i: number) => lives > i ? Colors.secondary : Colors.border;

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[s.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
    >
      <AmbientParticles count={8} />

      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          {/* HUD */}
          <View style={s.hud}>
            <View style={s.hudLeft}>
              {mode !== "zen" && [0, 1, 2].map((i) => (
                <Text key={i} style={[s.heart, { color: heartColor(i) }]}>♥</Text>
              ))}
              {mode === "zen" && (
                <Text style={[s.heart, { color: Colors.success }]}>∞</Text>
              )}
            </View>

            <View style={s.hudCenter}>
              <Text style={s.scoreText}>{score}</Text>
              {combo >= 2 && (
                <Text style={s.comboText}>{combo}x</Text>
              )}
            </View>

            <View style={s.hudRight}>
              {mode === "regular" ? (
                <Text style={[s.timerText, timeLeft <= 10 && { color: Colors.secondary }]}>{timeLeft}s</Text>
              ) : (
                <Text style={s.timerText}>{totalDodges}</Text>
              )}
            </View>
          </View>

          {/* Direction hint */}
          {activeObstacle && (
            <View style={s.hintRow}>
              <Text style={s.hintLabel}>
                Swipe {OPPOSITE[activeObstacle.direction].toUpperCase()}
              </Text>
              <Text style={s.hintArrow}>
                {activeObstacle.direction === "top" ? "↓" :
                  activeObstacle.direction === "bottom" ? "↑" :
                  activeObstacle.direction === "left" ? "→" : "←"}
              </Text>
            </View>
          )}

          {/* Play area */}
          <View style={s.playArea} {...panResponder.panHandlers}>
            {/* Obstacles */}
            {activeObstacle && <ObstacleView obstacle={activeObstacle} progress={obstacleProgress} contentWidth={contentMaxWidth ? Math.min(width, contentMaxWidth) - contentHorizontalPadding * 2 : width} areaHeight={(height - topInset - bottomInset - 200)} />}

            {/* Player orb */}
            <Animated.View style={[s.orb, orbAnimStyle]} />

            {/* Swipe hint when no obstacle */}
            {!activeObstacle && isPlaying && (
              <Text style={s.waitText}>Incoming...</Text>
            )}
          </View>

        </View>
      </View>

      {/* Countdown overlay */}
      {countdown !== null && (
        <View style={s.countdownOverlay}>
          <Text style={[s.countdownText, countdown === "GO!" && { color: Colors.success, fontSize: 56 }]}>
            {countdown}
          </Text>
        </View>
      )}

      {/* Flash and particles */}
      {showFlash === "success" && <ScreenFlash color={Colors.success + "40"} />}
      {showFlash === "error" && <ScreenFlash color={Colors.secondary + "50"} />}
      {burstPos && <ParticleBurst x={burstPos.x} y={burstPos.y} color={Colors.primary} />}
    </LinearGradient>
  );
}

function ObstacleView({
  obstacle,
  progress,
  contentWidth,
  areaHeight,
}: {
  obstacle: Obstacle;
  progress: Animated.SharedValue<number>;
  contentWidth: number;
  areaHeight: number;
}) {
  const THICK = 22;
  const halfW = contentWidth / 2;
  const halfH = areaHeight / 2;
  const color = OBSTACLE_COLOR[obstacle.direction];

  const topStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    right: 0,
    height: THICK,
    top: progress.value * halfH - THICK / 2,
    borderRadius: 6,
    backgroundColor: color,
    shadowColor: color,
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 8,
  }));

  const bottomStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    right: 0,
    height: THICK,
    bottom: progress.value * halfH - THICK / 2,
    borderRadius: 6,
    backgroundColor: color,
    shadowColor: color,
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 8,
  }));

  const leftStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: THICK,
    left: progress.value * halfW - THICK / 2,
    borderRadius: 6,
    backgroundColor: color,
    shadowColor: color,
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 8,
  }));

  const rightStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: THICK,
    right: progress.value * halfW - THICK / 2,
    borderRadius: 6,
    backgroundColor: color,
    shadowColor: color,
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 8,
  }));

  if (obstacle.direction === "top") return <Animated.View style={topStyle} />;
  if (obstacle.direction === "bottom") return <Animated.View style={bottomStyle} />;
  if (obstacle.direction === "left") return <Animated.View style={leftStyle} />;
  return <Animated.View style={rightStyle} />;
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  hudLeft: {
    flexDirection: "row",
    gap: 4,
    minWidth: 80,
  },
  hudCenter: {
    alignItems: "center",
  },
  hudRight: {
    minWidth: 80,
    alignItems: "flex-end",
  },
  heart: {
    fontSize: 20,
  },
  scoreText: {
    fontSize: 28,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 1,
  },
  comboText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.textSecondary,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
    height: 28,
  },
  hintLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  hintArrow: {
    fontSize: 22,
    color: Colors.primary,
  },
  playArea: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface + "30",
    overflow: "hidden",
  },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + "E0",
    shadowColor: Colors.primary,
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 2,
    borderColor: "#fff",
  },
  waitText: {
    position: "absolute",
    bottom: 20,
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 100,
  },
  countdownText: {
    fontSize: 80,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.primary,
    letterSpacing: 2,
  },
});
