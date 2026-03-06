import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Platform,
  PanResponder,
  useWindowDimensions,
  Pressable,
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
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { trackEvent } from "@/lib/analytics";
import { soundManager } from "@/lib/sounds";
import AmbientParticles from "@/components/AmbientParticles";
import ScreenFlash from "@/components/ScreenFlash";
import ParticleBurst from "@/components/ParticleBurst";
import {
  getVelocityPowerUps,
  saveVelocityPowerUps,
  useVelocityPowerUp,
  earnVelocityPowerUp,
  type VelocityPowerUpInventory,
  type VelocityDifficulty,
} from "@/lib/velocity-storage";

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

const DIRECTION_ICON: Record<Direction, string> = {
  top: "arrow-down",
  bottom: "arrow-up",
  left: "arrow-forward",
  right: "arrow-back",
};

interface DifficultyConfig {
  initialSpawn: number;
  lives: number;
  rampInterval: number;
  rampAmount: number;
  spawnFloor: number;
}

const DIFFICULTY_SETTINGS: Record<VelocityDifficulty, DifficultyConfig> = {
  easy:   { initialSpawn: 2800, lives: 5, rampInterval: 25000, rampAmount: 80,  spawnFloor: 900 },
  normal: { initialSpawn: 1800, lives: 3, rampInterval: 20000, rampAmount: 100, spawnFloor: 600 },
  hard:   { initialSpawn: 1100, lives: 2, rampInterval: 12000, rampAmount: 150, spawnFloor: 450 },
};

const FRENZY_THRESHOLD = 10;

interface Obstacle {
  id: string;
  direction: Direction;
}

export default function VelocityScreen() {
  const { mode: modeParam, difficulty: diffParam } = useLocalSearchParams<{ mode: string; difficulty: string }>();
  const mode = (modeParam ?? "regular") as GameMode;
  const difficulty = ((diffParam ?? "normal") as VelocityDifficulty);
  const diffCfg = DIFFICULTY_SETTINGS[difficulty] ?? DIFFICULTY_SETTINGS.normal;

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
  const [lives, setLives] = useState(mode === "zen" ? 999 : diffCfg.lives);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalDodges, setTotalDodges] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [activeObstacle, setActiveObstacle] = useState<Obstacle | null>(null);
  const [showFlash, setShowFlash] = useState<"success" | "error" | null>(null);
  const [burstPos, setBurstPos] = useState<{ x: number; y: number } | null>(null);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [isFrenzy, setIsFrenzy] = useState(false);
  const frenzyStartedRef = useRef(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [powerUpInventory, setPowerUpInventory] = useState<VelocityPowerUpInventory>({ shield: 0, slow_mo: 0 });
  const [powerUpMessage, setPowerUpMessage] = useState<string | null>(null);

  const isPlayingRef = useRef(false);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const totalDodgesRef = useRef(0);
  const mistakesRef = useRef(0);
  const livesRef = useRef(mode === "zen" ? 999 : diffCfg.lives);
  const gameOverRef = useRef(false);
  const activeObstacleRef = useRef<Obstacle | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnDurationRef = useRef(diffCfg.initialSpawn);
  const baseSpawnDurationRef = useRef(diffCfg.initialSpawn);
  const rampTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedLevelRef = useRef(1);
  const shieldActiveRef = useRef(false);
  const slowMoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dodgesSinceRewardRef = useRef(0);
  const powerUpMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const obstacleProgress = useSharedValue(0);
  const orbShake = useSharedValue(0);
  const orbScale = useSharedValue(1);
  const directionPulse = useSharedValue(0);
  const frenzyPulse = useSharedValue(0);

  const screenCenterX = contentMaxWidth ? Math.min(width, contentMaxWidth) / 2 : width / 2;
  const screenCenterY = (height - topInset - bottomInset) / 2;

  useEffect(() => {
    getVelocityPowerUps().then(setPowerUpInventory);
  }, []);

  const cleanup = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (rampTimerRef.current) clearInterval(rampTimerRef.current);
    if (slowMoTimerRef.current) clearTimeout(slowMoTimerRef.current);
    if (powerUpMsgTimerRef.current) clearTimeout(powerUpMsgTimerRef.current);
    cancelAnimation(obstacleProgress);
    cancelAnimation(frenzyPulse);
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
      difficulty,
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
        difficulty,
      },
    });
  }, [cleanup, mode, difficulty]);

  const showPowerUpMessage = useCallback((msg: string) => {
    setPowerUpMessage(msg);
    if (powerUpMsgTimerRef.current) clearTimeout(powerUpMsgTimerRef.current);
    powerUpMsgTimerRef.current = setTimeout(() => setPowerUpMessage(null), 1800);
  }, []);

  const tryEarnPowerUp = useCallback(async () => {
    dodgesSinceRewardRef.current += 1;
    if (dodgesSinceRewardRef.current >= 5) {
      dodgesSinceRewardRef.current = 0;
      const type = Math.random() < 0.5 ? "shield" : "slow_mo";
      await earnVelocityPowerUp(type);
      const inv = await getVelocityPowerUps();
      setPowerUpInventory({ ...inv });
      showPowerUpMessage(type === "shield" ? "Shield earned!" : "Slow-Mo earned!");
    }
  }, [showPowerUpMessage]);

  const spawnObstacle = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    const dirs: Direction[] = ["top", "bottom", "left", "right"];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const obs: Obstacle = { id, direction: dir };
    activeObstacleRef.current = obs;
    setActiveObstacle(obs);

    directionPulse.value = 0;
    directionPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

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

    if (shieldActiveRef.current) {
      shieldActiveRef.current = false;
      setShieldActive(false);
      cancelAnimation(obstacleProgress);
      obstacleProgress.value = 0;
      cancelAnimation(directionPulse);
      activeObstacleRef.current = null;
      setActiveObstacle(null);
      showPowerUpMessage("Shield absorbed the hit!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      spawnTimerRef.current = setTimeout(spawnObstacle, 400);
      return;
    }

    cancelAnimation(obstacleProgress);
    obstacleProgress.value = 0;
    cancelAnimation(directionPulse);
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
  }, [mode, endGame, spawnObstacle, showPowerUpMessage]);

  const handleSuccessInternal = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    cancelAnimation(obstacleProgress);
    obstacleProgress.value = 0;
    cancelAnimation(directionPulse);
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

    tryEarnPowerUp();

    spawnTimerRef.current = setTimeout(spawnObstacle, 300);
  }, [spawnObstacle, screenCenterX, screenCenterY, tryEarnPowerUp]);

  const startFrenzy = useCallback(() => {
    setIsFrenzy(true);
    spawnDurationRef.current = Math.round(baseSpawnDurationRef.current * 0.7);
    frenzyPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const startGame = useCallback(() => {
    isPlayingRef.current = true;
    gameOverRef.current = false;
    setIsPlaying(true);

    if (mode === "regular") {
      gameTimerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          const next = t - 1;
          if (next <= FRENZY_THRESHOLD && !frenzyStartedRef.current) {
            frenzyStartedRef.current = true;
            setTimeout(startFrenzy, 0);
          }
          if (next <= 0) {
            setTimeout(endGame, 0);
            return 0;
          }
          return next;
        });
      }, 1000);
    }

    elapsedTimerRef.current = setInterval(() => {
      elapsedRef.current += 1;
    }, 1000);

    if (mode === "endless") {
      rampTimerRef.current = setInterval(() => {
        spawnDurationRef.current = Math.max(diffCfg.spawnFloor, spawnDurationRef.current - diffCfg.rampAmount);
        baseSpawnDurationRef.current = spawnDurationRef.current;
        speedLevelRef.current += 1;
        setSpeedLevel(speedLevelRef.current);
      }, diffCfg.rampInterval);
    }

    spawnTimerRef.current = setTimeout(spawnObstacle, 500);
  }, [mode, endGame, spawnObstacle, startFrenzy, diffCfg]);

  useEffect(() => {
    trackEvent("velocity_game_start", { mode, difficulty });
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

  const handleActivateShield = useCallback(async () => {
    if (!isPlayingRef.current || shieldActiveRef.current) return;
    const success = await useVelocityPowerUp("shield");
    if (!success) return;
    shieldActiveRef.current = true;
    setShieldActive(true);
    const inv = await getVelocityPowerUps();
    setPowerUpInventory({ ...inv });
    showPowerUpMessage("Shield activated!");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [showPowerUpMessage]);

  const handleActivateSlowMo = useCallback(async () => {
    if (!isPlayingRef.current || slowMoActive) return;
    const success = await useVelocityPowerUp("slow_mo");
    if (!success) return;
    const originalDuration = spawnDurationRef.current;
    spawnDurationRef.current = Math.round(spawnDurationRef.current * 2);
    setSlowMoActive(true);
    showPowerUpMessage("Slow-Mo activated!");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const inv = await getVelocityPowerUps();
    setPowerUpInventory({ ...inv });

    slowMoTimerRef.current = setTimeout(() => {
      spawnDurationRef.current = originalDuration;
      setSlowMoActive(false);
    }, 5000);
  }, [slowMoActive, showPowerUpMessage]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, { dx, dy }) => {
        const obs = activeObstacleRef.current;
        if (!obs || !isPlayingRef.current || gameOverRef.current) return;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < 15) return;
        let swipe: Direction;
        if (absDx >= absDy) {
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

  const directionArrowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(directionPulse.value, [0, 1], [0.9, 1.18]) }],
    opacity: interpolate(directionPulse.value, [0, 1], [0.7, 1]),
  }));

  const frenzyBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 61, 61, ${interpolate(frenzyPulse.value, [0, 1], [0.3, 0.85])})`,
    borderWidth: interpolate(frenzyPulse.value, [0, 1], [1, 3]),
  }));

  const heartColor = (i: number) => lives > i ? Colors.secondary : Colors.border;
  const maxLivesDisplay = mode === "zen" ? 1 : diffCfg.lives;

  return (
    <View style={styles.fullScreen} {...panResponder.panHandlers}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
        style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
      >
        <AmbientParticles count={8} />

        {shieldActive && <View style={styles.shieldOverlay} />}
        {slowMoActive && <View style={styles.slowMoOverlay} />}

        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

            {/* HUD */}
            <View style={styles.hud}>
              <View style={styles.hudLeft}>
                {mode !== "zen" && Array.from({ length: maxLivesDisplay }).map((_, i) => (
                  <Text key={i} style={[styles.heart, { color: heartColor(i) }]}>♥</Text>
                ))}
                {mode === "zen" && (
                  <Text style={[styles.heart, { color: Colors.success }]}>∞</Text>
                )}
              </View>

              <View style={styles.hudCenter}>
                <Text style={styles.scoreText}>{score}</Text>
                {combo >= 2 && (
                  <Text style={styles.comboText}>{combo}x COMBO</Text>
                )}
              </View>

              <View style={styles.hudRight}>
                {mode === "regular" ? (
                  <Text style={[styles.timerText, timeLeft <= FRENZY_THRESHOLD && { color: Colors.secondary }]}>{timeLeft}s</Text>
                ) : mode === "endless" ? (
                  <>
                    <Text style={[styles.timerText, { color: DIFFICULTY_SETTINGS[difficulty]?.lives ? Colors.accent : Colors.accent }]}>LV{speedLevel}</Text>
                    <Text style={[styles.timerText, { fontSize: 12, color: Colors.textMuted }]}>{totalDodges} dodges</Text>
                  </>
                ) : (
                  <Text style={styles.timerText}>{totalDodges}</Text>
                )}
              </View>
            </View>

            {/* Frenzy banner */}
            {isFrenzy && mode === "regular" && (
              <View style={styles.frenzyBanner}>
                <Text style={styles.frenzyText}>⚡ FRENZY ⚡</Text>
              </View>
            )}

            {/* Power-up bar */}
            <View style={styles.powerUpBar}>
              <Pressable
                onPress={handleActivateShield}
                style={[
                  styles.powerUpBtn,
                  shieldActive && { borderColor: "#2196F3", backgroundColor: "#2196F320" },
                  powerUpInventory.shield === 0 && { opacity: 0.4 },
                ]}
              >
                <Ionicons name="shield-outline" size={18} color={shieldActive ? "#2196F3" : Colors.textSecondary} />
                {powerUpInventory.shield > 0 && (
                  <View style={[styles.powerUpCount, { backgroundColor: "#2196F3" }]}>
                    <Text style={styles.powerUpCountText}>{powerUpInventory.shield}</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.powerUpSpacer} />

              {powerUpMessage && (
                <Text style={styles.powerUpMsg}>{powerUpMessage}</Text>
              )}

              <View style={styles.powerUpSpacer} />

              <Pressable
                onPress={handleActivateSlowMo}
                style={[
                  styles.powerUpBtn,
                  slowMoActive && { borderColor: Colors.accent, backgroundColor: Colors.accent + "20" },
                  powerUpInventory.slow_mo === 0 && { opacity: 0.4 },
                ]}
              >
                <Ionicons name="hourglass-outline" size={18} color={slowMoActive ? Colors.accent : Colors.textSecondary} />
                {powerUpInventory.slow_mo > 0 && (
                  <View style={[styles.powerUpCount, { backgroundColor: Colors.accent }]}>
                    <Text style={styles.powerUpCountText}>{powerUpInventory.slow_mo}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Play area */}
            <Animated.View style={[styles.playArea, isFrenzy && frenzyBorderStyle]}>
              {/* Obstacles */}
              {activeObstacle && (
                <ObstacleView
                  obstacle={activeObstacle}
                  progress={obstacleProgress}
                  contentWidth={contentMaxWidth ? Math.min(width, contentMaxWidth) - contentHorizontalPadding * 2 : width}
                  areaHeight={(height - topInset - bottomInset - 200)}
                  slowMo={slowMoActive}
                />
              )}

              {/* Large direction arrow cue */}
              {activeObstacle && (
                <Animated.View style={[styles.directionArrowContainer, directionArrowStyle]}>
                  <Ionicons
                    name={DIRECTION_ICON[activeObstacle.direction] as any}
                    size={56}
                    color={OBSTACLE_COLOR[activeObstacle.direction]}
                  />
                </Animated.View>
              )}

              {/* Player orb */}
              <Animated.View style={[styles.orb, orbAnimStyle]} />

              {/* Slow-mo label */}
              {slowMoActive && (
                <View style={styles.slowMoLabel}>
                  <Text style={styles.slowMoText}>SLO</Text>
                </View>
              )}

              {/* Waiting text */}
              {!activeObstacle && isPlaying && (
                <Text style={styles.waitText}>Incoming...</Text>
              )}
            </Animated.View>

            {/* Swipe hint below play area */}
            <View style={styles.hintRow}>
              {activeObstacle ? (
                <>
                  <Text style={styles.hintLabel}>SWIPE {OPPOSITE[activeObstacle.direction].toUpperCase()}</Text>
                </>
              ) : (
                <Text style={styles.hintLabel}>SWIPE ANYWHERE</Text>
              )}
            </View>

          </View>
        </View>

        {/* Countdown overlay */}
        {countdown !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={[styles.countdownText, countdown === "GO!" && { color: Colors.success, fontSize: 56 }]}>
              {countdown}
            </Text>
            {countdown === 3 && (
              <Text style={styles.countdownSub}>
                {mode === "regular" ? "Regular" : mode === "endless" ? "Endless" : "Zen"} · {difficulty !== "normal" ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : ""}
              </Text>
            )}
          </View>
        )}

        {/* Flash and particles */}
        {showFlash === "success" && <ScreenFlash color={Colors.success + "40"} />}
        {showFlash === "error" && <ScreenFlash color={Colors.secondary + "50"} />}
        {burstPos && <ParticleBurst x={burstPos.x} y={burstPos.y} color={Colors.primary} />}
      </LinearGradient>
    </View>
  );
}

function ObstacleView({
  obstacle,
  progress,
  contentWidth,
  areaHeight,
  slowMo,
}: {
  obstacle: Obstacle;
  progress: Animated.SharedValue<number>;
  contentWidth: number;
  areaHeight: number;
  slowMo: boolean;
}) {
  const THICK = 22;
  const halfW = contentWidth / 2;
  const halfH = areaHeight / 2;
  const color = OBSTACLE_COLOR[obstacle.direction];
  const glowColor = slowMo ? Colors.accent : color;

  const topStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    right: 0,
    height: THICK,
    top: progress.value * halfH - THICK / 2,
    borderRadius: 6,
    backgroundColor: color,
    shadowColor: glowColor,
    shadowOpacity: interpolate(progress.value, [0, 0.5, 1], [0.6, 1, 1]),
    shadowRadius: interpolate(progress.value, [0, 0.5, 1], [8, 18, 22]),
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
    shadowColor: glowColor,
    shadowOpacity: interpolate(progress.value, [0, 0.5, 1], [0.6, 1, 1]),
    shadowRadius: interpolate(progress.value, [0, 0.5, 1], [8, 18, 22]),
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
    shadowColor: glowColor,
    shadowOpacity: interpolate(progress.value, [0, 0.5, 1], [0.6, 1, 1]),
    shadowRadius: interpolate(progress.value, [0, 0.5, 1], [8, 18, 22]),
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
    shadowColor: glowColor,
    shadowOpacity: interpolate(progress.value, [0, 0.5, 1], [0.6, 1, 1]),
    shadowRadius: interpolate(progress.value, [0, 0.5, 1], [8, 18, 22]),
    elevation: 8,
  }));

  if (obstacle.direction === "top") return <Animated.View style={topStyle} />;
  if (obstacle.direction === "bottom") return <Animated.View style={bottomStyle} />;
  if (obstacle.direction === "left") return <Animated.View style={leftStyle} />;
  return <Animated.View style={rightStyle} />;
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  hudLeft: {
    flexDirection: "row",
    gap: 3,
    minWidth: 80,
    flexWrap: "wrap",
  },
  hudCenter: {
    alignItems: "center",
  },
  hudRight: {
    minWidth: 80,
    alignItems: "flex-end",
  },
  heart: {
    fontSize: 18,
  },
  scoreText: {
    fontSize: 28,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 1,
  },
  comboText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.textSecondary,
  },
  frenzyBanner: {
    alignItems: "center",
    marginBottom: 4,
  },
  frenzyText: {
    fontSize: 13,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.secondary,
    letterSpacing: 4,
  },
  powerUpBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    height: 36,
  },
  powerUpBtn: {
    width: 40,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  powerUpCount: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  powerUpCountText: {
    fontSize: 9,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  powerUpSpacer: {
    flex: 1,
  },
  powerUpMsg: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.accent,
    letterSpacing: 0.5,
    textAlign: "center",
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
  directionArrowContainer: {
    position: "absolute",
    alignSelf: "center",
    opacity: 0.85,
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
    zIndex: 10,
  },
  slowMoLabel: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: Colors.accent + "30",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  slowMoText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
    letterSpacing: 2,
  },
  waitText: {
    position: "absolute",
    bottom: 20,
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    marginTop: 6,
  },
  hintLabel: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 3,
  },
  shieldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(33, 150, 243, 0.08)",
    zIndex: 1,
    pointerEvents: "none" as any,
  },
  slowMoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 229, 255, 0.05)",
    zIndex: 1,
    pointerEvents: "none" as any,
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
  countdownSub: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 3,
    marginTop: 8,
    textTransform: "uppercase",
  },
});
