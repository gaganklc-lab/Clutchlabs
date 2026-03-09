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
  withDelay,
  withSpring,
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
import ParticleBurst, { type BurstEvent } from "@/components/ParticleBurst";
import EdgeWarning from "@/components/EdgeWarning";
import OrbTrail, { TrailSegment } from "@/components/OrbTrail";
import VelocityBackgroundFX from "@/components/VelocityBackgroundFX";
import {
  getVelocityPowerUps,
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

const DODGE_LABEL: Record<Direction, string> = {
  top: "UP",
  bottom: "DOWN",
  left: "LEFT",
  right: "RIGHT",
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
  const [showFlash, setShowFlash] = useState<"success" | "error" | "near_miss" | null>(null);
  const [bursts, setBursts] = useState<BurstEvent[]>([]);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [isFrenzy, setIsFrenzy] = useState(false);
  const frenzyStartedRef = useRef(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [powerUpInventory, setPowerUpInventory] = useState<VelocityPowerUpInventory>({ shield: 0, slow_mo: 0 });
  const [powerUpMessage, setPowerUpMessage] = useState<string | null>(null);
  const [warningDirection, setWarningDirection] = useState<Direction | null>(null);
  const [trailSegments, setTrailSegments] = useState<TrailSegment[]>([]);
  const [showNearMiss, setShowNearMiss] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

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
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearMissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tutorialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tutorialDismissedRef = useRef(false);

  const obstacleProgress = useSharedValue(0);
  const orbShake = useSharedValue(0);
  const orbScale = useSharedValue(1);
  const orbDashX = useSharedValue(0);
  const orbDashY = useSharedValue(0);
  const comboGlow = useSharedValue(0);
  const shockwaveScale = useSharedValue(0);
  const shockwaveOpacity = useSharedValue(0);
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
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (nearMissTimerRef.current) clearTimeout(nearMissTimerRef.current);
    if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
    cancelAnimation(obstacleProgress);
    cancelAnimation(frenzyPulse);
    cancelAnimation(orbDashX);
    cancelAnimation(orbDashY);
    cancelAnimation(comboGlow);
    cancelAnimation(shockwaveScale);
    cancelAnimation(shockwaveOpacity);
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

    setWarningDirection(dir);

    warningTimerRef.current = setTimeout(() => {
      if (!isPlayingRef.current || gameOverRef.current) {
        setWarningDirection(null);
        return;
      }
      setWarningDirection(null);
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
    }, 350);
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
    comboGlow.value = withTiming(0, { duration: 200 });

    if (livesRef.current <= 0 && mode !== "zen") {
      endGame();
      return;
    }

    spawnTimerRef.current = setTimeout(spawnObstacle, 400);
  }, [mode, endGame, spawnObstacle, showPowerUpMessage]);

  const handleSuccessInternal = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;

    const lastDir = activeObstacleRef.current?.direction;
    const nearMiss = obstacleProgress.value >= 0.72;

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
    let gained = Math.round(10 * multiplier);
    if (nearMiss) gained += 5;
    scoreRef.current += gained;
    setScore(scoreRef.current);

    if (nearMiss) {
      if (nearMissTimerRef.current) clearTimeout(nearMissTimerRef.current);
      setShowNearMiss(true);
      nearMissTimerRef.current = setTimeout(() => setShowNearMiss(false), 900);
    }

    if (!tutorialDismissedRef.current) {
      tutorialDismissedRef.current = true;
      setShowTutorial(false);
    }

    comboGlow.value = withTiming(Math.min(comboRef.current * 5, 36), { duration: 200 });

    const DASH = 44;
    if (lastDir) {
      const OPPOSITE_DIR = OPPOSITE[lastDir];
      if (OPPOSITE_DIR === "right") {
        orbDashX.value = withSequence(withTiming(DASH, { duration: 90 }), withDelay(50, withSpring(0, { damping: 8, stiffness: 220 })));
      } else if (OPPOSITE_DIR === "left") {
        orbDashX.value = withSequence(withTiming(-DASH, { duration: 90 }), withDelay(50, withSpring(0, { damping: 8, stiffness: 220 })));
      } else if (OPPOSITE_DIR === "bottom") {
        orbDashY.value = withSequence(withTiming(DASH, { duration: 90 }), withDelay(50, withSpring(0, { damping: 8, stiffness: 220 })));
      } else if (OPPOSITE_DIR === "top") {
        orbDashY.value = withSequence(withTiming(-DASH, { duration: 90 }), withDelay(50, withSpring(0, { damping: 8, stiffness: 220 })));
      }

      const trailOffX = OPPOSITE_DIR === "right" ? 22 : OPPOSITE_DIR === "left" ? -22 : 0;
      const trailOffY = OPPOSITE_DIR === "bottom" ? 22 : OPPOSITE_DIR === "top" ? -22 : 0;
      const trailColor = OBSTACLE_COLOR[lastDir];
      const segId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      setTrailSegments(prev => [...prev, { id: segId, offsetX: trailOffX, offsetY: trailOffY, color: trailColor, size: 26 }].slice(-6));
      setTimeout(() => setTrailSegments(prev => prev.filter(s => s.id !== segId)), 500);
    }

    shockwaveScale.value = 1;
    shockwaveOpacity.value = nearMiss ? 0.9 : 0.55;
    shockwaveScale.value = withTiming(3.8, { duration: 380, easing: Easing.out(Easing.ease) });
    shockwaveOpacity.value = withTiming(0, { duration: 380, easing: Easing.in(Easing.ease) });

    setShowFlash(nearMiss ? "near_miss" : "success");
    setTimeout(() => setShowFlash(null), nearMiss ? 280 : 200);

    const burstId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    setBursts(prev => [...prev, { x: screenCenterX, y: screenCenterY, color: Colors.primary, id: burstId }]);

    Haptics.impactAsync(nearMiss ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
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

    setShowTutorial(true);
    tutorialTimerRef.current = setTimeout(() => {
      if (!tutorialDismissedRef.current) setShowTutorial(false);
    }, 3000);

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

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const KEY_TO_DIR: Record<string, Direction> = {
      ArrowUp: "top", ArrowDown: "bottom", ArrowLeft: "left", ArrowRight: "right",
      w: "top", a: "left", s: "bottom", d: "right",
      W: "top", A: "left", S: "bottom", D: "right",
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      const obs = activeObstacleRef.current;
      if (!obs || !isPlayingRef.current || gameOverRef.current) return;
      const correct = OPPOSITE[obs.direction];
      if (dir === correct) {
        handleSuccessInternal();
      } else {
        handleMissInternal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSuccessInternal, handleMissInternal]);

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
      { translateX: orbShake.value + orbDashX.value },
      { translateY: orbDashY.value },
      { scale: orbScale.value },
    ],
    shadowRadius: 20 + comboGlow.value,
    shadowOpacity: 0.85 + Math.min(comboGlow.value / 80, 0.15),
  }));

  const shockwaveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shockwaveScale.value }],
    opacity: shockwaveOpacity.value,
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
        <VelocityBackgroundFX isFrenzy={isFrenzy} />
        <AmbientParticles count={8} />

        {(['top', 'bottom', 'left', 'right'] as Direction[]).map((dir) => (
          <EdgeWarning
            key={dir}
            direction={dir}
            visible={warningDirection === dir}
            color={OBSTACLE_COLOR[dir]}
          />
        ))}

        {shieldActive && <View style={styles.shieldOverlay} />}
        {slowMoActive && <View style={styles.slowMoOverlay} />}
        {isFrenzy && mode === "regular" && <View style={styles.frenzyOverlay} />}

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
                  <Text style={[
                    styles.comboText,
                    combo >= 10 && { color: Colors.secondary, fontSize: 14, letterSpacing: 2 },
                    combo >= 5 && combo < 10 && { color: Colors.warning, fontSize: 12 },
                  ]}>
                    {combo >= 10 ? `🔥 ${combo}× COMBO` : `${combo}× COMBO`}
                  </Text>
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
              <Animated.View style={[styles.frenzyBanner, frenzyBorderStyle]}>
                <Text style={styles.frenzyText}>🔥 FRENZY MODE 🔥</Text>
              </Animated.View>
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

              {/* Shockwave ring */}
              <Animated.View style={[styles.shockwaveRing, shockwaveStyle]} pointerEvents="none" />

              {/* Orb trail */}
              <OrbTrail segments={trailSegments} />

              {/* Player orb */}
              <Animated.View style={[styles.orb, orbAnimStyle]} />

              {/* Near-miss label */}
              {showNearMiss && (
                <View style={styles.nearMissContainer} pointerEvents="none">
                  <Text style={styles.nearMissText}>NEAR MISS +5</Text>
                </View>
              )}

              {/* First-time tutorial overlay */}
              {showTutorial && isPlaying && (
                <View style={styles.tutorialOverlay} pointerEvents="none">
                  <Text style={styles.tutorialLine1}>Dodge away from the incoming line</Text>
                  <Text style={styles.tutorialLine2}>
                    {Platform.OS === "web" ? "Arrow keys or WASD" : "Swipe in the safe direction"}
                  </Text>
                </View>
              )}

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
                <Text style={styles.hintLabel}>
                  {Platform.OS === "web"
                    ? `DODGE ${DODGE_LABEL[OPPOSITE[activeObstacle.direction]]}`
                    : `SWIPE ${DODGE_LABEL[OPPOSITE[activeObstacle.direction]]}`}
                </Text>
              ) : (
                <Text style={styles.hintLabel}>
                  {Platform.OS === "web" ? "ARROW KEYS / WASD" : "SWIPE TO DODGE"}
                </Text>
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
        {showFlash === "near_miss" && <ScreenFlash color={"#ffffff55"} />}
        {showFlash === "error" && <ScreenFlash color={Colors.secondary + "50"} />}
        <ParticleBurst
          bursts={bursts}
          onBurstComplete={(id) => setBursts(prev => prev.filter(b => b.id !== id))}
        />
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
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondary + "60",
    backgroundColor: Colors.secondary + "10",
  },
  frenzyText: {
    fontSize: 14,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.secondary,
    letterSpacing: 3,
  },
  frenzyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 45, 111, 0.07)",
    zIndex: 1,
    pointerEvents: "none" as any,
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
  shockwaveRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 5,
  },
  nearMissContainer: {
    position: "absolute",
    top: "25%",
    alignSelf: "center",
    backgroundColor: Colors.warning + "25",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.warning + "80",
    zIndex: 20,
  },
  nearMissText: {
    fontSize: 13,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.warning,
    letterSpacing: 2,
  },
  tutorialOverlay: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    gap: 3,
    zIndex: 30,
    maxWidth: "90%",
  },
  tutorialLine1: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  tutorialLine2: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
