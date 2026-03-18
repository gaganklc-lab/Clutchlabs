import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Platform,
  Pressable,
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
import ScreenFlash from "@/components/ScreenFlash";
import ParticleBurst, { type BurstEvent } from "@/components/ParticleBurst";
import ScorePopup, { type PopupEvent } from "@/components/ScorePopup";
import AmbientParticles from "@/components/AmbientParticles";
import {
  getEquippedRingTheme,
  getRingTheme,
  type RingThemeId,
} from "@/lib/surge-cosmetics";

type SurgeGameMode = "classic" | "endless";
type HitQuality = "perfect" | "good" | "miss";

const TARGET_PROGRESS = 0.5;
const PERFECT_WINDOW = 0.07;
const GOOD_WINDOW = 0.15;
const INITIAL_CYCLE_MS = 1300;
const MIN_CYCLE_MS = 520;
const RAMP_EVERY_N_HITS = 3;
const RAMP_AMOUNT_MS = 35;
const ORB_RADIUS = 44;
const MAX_RING_RADIUS = 130;
const TARGET_RADIUS = ORB_RADIUS + (MAX_RING_RADIUS - ORB_RADIUS) * TARGET_PROGRESS;

export default function SurgeScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode: string }>();
  const mode = (modeParam ?? "classic") as SurgeGameMode;

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | string | null>(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [perfectHits, setPerfectHits] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [showFlash, setShowFlash] = useState<"success" | "error" | "near_miss" | null>(null);
  const [bursts, setBursts] = useState<BurstEvent[]>([]);
  const [popups, setPopups] = useState<PopupEvent[]>([]);
  const [hitLabel, setHitLabel] = useState<string | null>(null);
  const [hitLabelColor, setHitLabelColor] = useState(Colors.success);
  const [equippedThemeId, setEquippedThemeId] = useState<RingThemeId>("neon_purple");

  const isPlayingRef = useRef(false);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const livesRef = useRef(3);
  const perfectHitsRef = useRef(0);
  const totalHitsRef = useRef(0);
  const gameOverRef = useRef(false);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hitsSinceRampRef = useRef(0);
  const cycleDurationRef = useRef(INITIAL_CYCLE_MS);
  const hitLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tappedThisCycleRef = useRef(false);

  const ringProgress = useSharedValue(0);
  const orbPulse = useSharedValue(0);
  const orbScale = useSharedValue(1);
  const shockwaveScale = useSharedValue(0);
  const shockwaveOpacity = useSharedValue(0);
  const targetRingPulse = useSharedValue(0);
  const hitFlashOpacity = useSharedValue(0);
  const hitFlashColor = useSharedValue(0);

  const theme = getRingTheme(equippedThemeId);

  const screenCenterX = width / 2;
  const screenCenterY = (height - topInset - bottomInset) / 2;

  useEffect(() => {
    getEquippedRingTheme().then((id) => setEquippedThemeId(id));
  }, []);

  useEffect(() => {
    orbPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    targetRingPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const cleanup = useCallback(() => {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (hitLabelTimerRef.current) clearTimeout(hitLabelTimerRef.current);
    cancelAnimation(ringProgress);
    cancelAnimation(shockwaveScale);
    cancelAnimation(shockwaveOpacity);
  }, []);

  const endGame = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    cleanup();
    trackEvent("surge_game_end", {
      score: scoreRef.current,
      maxCombo: maxComboRef.current,
      perfectHits: perfectHitsRef.current,
      totalHits: totalHitsRef.current,
      mode,
      timeSurvived: elapsedRef.current,
    });
    router.replace({
      pathname: "/surge-results",
      params: {
        score: scoreRef.current,
        maxCombo: maxComboRef.current,
        perfectHits: perfectHitsRef.current,
        totalHits: totalHitsRef.current,
        timeSurvived: elapsedRef.current,
        mode,
      },
    });
  }, [cleanup, mode]);

  const showHitLabel = useCallback((label: string, color: string) => {
    setHitLabel(label);
    setHitLabelColor(color);
    if (hitLabelTimerRef.current) clearTimeout(hitLabelTimerRef.current);
    hitLabelTimerRef.current = setTimeout(() => setHitLabel(null), 700);
  }, []);

  const startCycle = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    tappedThisCycleRef.current = false;
    ringProgress.value = 0;
    ringProgress.value = withTiming(1, {
      duration: cycleDurationRef.current,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) {
        runOnJS(handleMissOnComplete)();
      }
    });
  }, []);

  const handleMissOnComplete = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    if (tappedThisCycleRef.current) return;

    cancelAnimation(ringProgress);
    ringProgress.value = 0;

    comboRef.current = 0;
    setCombo(0);
    livesRef.current -= 1;
    setLives(livesRef.current);

    setShowFlash("error");
    setTimeout(() => setShowFlash(null), 300);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    soundManager.play("wrong");

    orbScale.value = withSequence(
      withTiming(1.35, { duration: 80 }),
      withSpring(1, { damping: 6, stiffness: 180 })
    );

    showHitLabel("MISS", Colors.secondary);

    if (livesRef.current <= 0) {
      endGame();
      return;
    }

    cycleTimerRef.current = setTimeout(startCycle, 450);
  }, [endGame, startCycle, showHitLabel]);

  const handleTap = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    if (tappedThisCycleRef.current) return;
    tappedThisCycleRef.current = true;

    const progress = ringProgress.value;
    const diff = Math.abs(progress - TARGET_PROGRESS);
    cancelAnimation(ringProgress);
    ringProgress.value = withTiming(0, { duration: 150 });

    let quality: HitQuality;
    if (diff <= PERFECT_WINDOW) {
      quality = "perfect";
    } else if (diff <= GOOD_WINDOW) {
      quality = "good";
    } else {
      quality = "miss";
    }

    if (quality === "miss") {
      comboRef.current = 0;
      setCombo(0);
      livesRef.current -= 1;
      setLives(livesRef.current);

      setShowFlash("error");
      setTimeout(() => setShowFlash(null), 300);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      soundManager.play("wrong");

      orbScale.value = withSequence(
        withTiming(1.35, { duration: 80 }),
        withSpring(1, { damping: 6, stiffness: 180 })
      );

      showHitLabel(progress < TARGET_PROGRESS - GOOD_WINDOW ? "EARLY!" : "LATE!", Colors.warning);

      if (livesRef.current <= 0) {
        endGame();
        return;
      }
    } else {
      totalHitsRef.current += 1;
      setTotalHits(totalHitsRef.current);

      if (quality === "perfect") {
        perfectHitsRef.current += 1;
        setPerfectHits(perfectHitsRef.current);
      }

      comboRef.current += 1;
      setCombo(comboRef.current);
      if (comboRef.current > maxComboRef.current) {
        maxComboRef.current = comboRef.current;
        setMaxCombo(maxComboRef.current);
      }

      const multiplier = Math.min(1 + (comboRef.current - 1) * 0.4, 5);
      const base = quality === "perfect" ? 15 : 8;
      const gained = Math.round(base * multiplier);
      scoreRef.current += gained;
      setScore(scoreRef.current);

      hitsSinceRampRef.current += 1;
      if (hitsSinceRampRef.current >= RAMP_EVERY_N_HITS) {
        hitsSinceRampRef.current = 0;
        cycleDurationRef.current = Math.max(
          MIN_CYCLE_MS,
          cycleDurationRef.current - RAMP_AMOUNT_MS
        );
      }

      shockwaveScale.value = 1;
      shockwaveOpacity.value = quality === "perfect" ? 0.9 : 0.55;
      shockwaveScale.value = withTiming(3.5, { duration: 350, easing: Easing.out(Easing.ease) });
      shockwaveOpacity.value = withTiming(0, { duration: 350, easing: Easing.in(Easing.ease) });

      orbScale.value = withSequence(
        withTiming(1.25, { duration: 80 }),
        withSpring(1, { damping: 7, stiffness: 200 })
      );

      const burstId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      setBursts((prev) => [
        ...prev,
        { x: screenCenterX, y: screenCenterY, color: theme.ringColor, id: burstId },
      ]);

      const popupId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const isMilestone = comboRef.current === 5 || comboRef.current === 10 || comboRef.current === 20;
      if (isMilestone) {
        const label = comboRef.current >= 20 ? "SURGE!" : comboRef.current >= 10 ? "ON FIRE!" : "COMBO!";
        const color = comboRef.current >= 20 ? Colors.warning : theme.glowColor;
        setPopups((prev) => [...prev, { id: popupId, label, color, x: screenCenterX, y: screenCenterY - 40 }]);
      } else {
        setPopups((prev) => [
          ...prev,
          { id: popupId, label: `+${gained}`, color: quality === "perfect" ? Colors.warning : theme.ringColor, x: screenCenterX, y: screenCenterY - 30 },
        ]);
      }

      const label = quality === "perfect" ? "PERFECT!" : "GOOD";
      const labelColor = quality === "perfect" ? Colors.warning : Colors.success;
      showHitLabel(label, labelColor);

      setShowFlash("success");
      setTimeout(() => setShowFlash(null), 180);
      Haptics.impactAsync(quality === "perfect" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
      soundManager.play("tap");
    }

    cycleTimerRef.current = setTimeout(startCycle, 300);
  }, [endGame, startCycle, showHitLabel, screenCenterX, screenCenterY, theme]);

  const startGame = useCallback(() => {
    isPlayingRef.current = true;
    gameOverRef.current = false;
    setIsPlaying(true);

    if (mode === "classic") {
      gameTimerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          const next = t - 1;
          if (next <= 0) {
            runOnJS(endGame)();
            return 0;
          }
          return next;
        });
      }, 1000);
    }

    elapsedTimerRef.current = setInterval(() => {
      elapsedRef.current += 1;
    }, 1000);

    startCycle();
  }, [mode, endGame, startCycle]);

  useEffect(() => {
    let cd = 3;
    setCountdown(3);
    const tick = setInterval(() => {
      cd -= 1;
      if (cd <= 0) {
        clearInterval(tick);
        setCountdown("GO!");
        setTimeout(() => {
          setCountdown(null);
          startGame();
        }, 500);
      } else {
        setCountdown(cd);
      }
    }, 1000);
    return () => {
      clearInterval(tick);
      cleanup();
    };
  }, []);

  const ringAnimStyle = useAnimatedStyle(() => {
    const r = ORB_RADIUS + (MAX_RING_RADIUS - ORB_RADIUS) * ringProgress.value;
    const size = r * 2;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity: interpolate(ringProgress.value, [0, 0.3, 0.85, 1], [0.2, 0.85, 0.85, 0.2]),
      transform: [],
    };
  });

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value * (1 + orbPulse.value * 0.06) }],
  }));

  const shockwaveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shockwaveScale.value }],
    opacity: shockwaveOpacity.value,
  }));

  const targetRingOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(targetRingPulse.value, [0, 1], [0.45, 0.85]),
  }));

  const pipCount = mode === "classic" ? 3 : 3;

  return (
    <Pressable style={{ flex: 1 }} onPress={handleTap}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
        style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
      >
        <AmbientParticles count={8} />

        {showFlash && <ScreenFlash type={showFlash} />}
        <ParticleBurst events={bursts} onComplete={(id) => setBursts((p) => p.filter((b) => b.id !== id))} />
        <ScorePopup events={popups} onComplete={(id) => setPopups((p) => p.filter((e) => e.id !== id))} />

        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => { cleanup(); router.replace("/"); }}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={16}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.scoreBlock}>
            <Text style={[styles.scoreText, { color: theme.ringColor }]}>{score}</Text>
            {combo >= 2 && (
              <Text style={[styles.comboText, { color: theme.glowColor }]}>{combo}x</Text>
            )}
          </View>

          {mode === "classic" ? (
            <View style={styles.timerBlock}>
              <Ionicons name="timer" size={14} color={Colors.textMuted} />
              <Text style={[styles.timerText, timeLeft <= 5 && { color: Colors.secondary }]}>{timeLeft}s</Text>
            </View>
          ) : (
            <View style={styles.livesRow}>
              {Array.from({ length: pipCount }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    { backgroundColor: i < lives ? theme.ringColor : Colors.border },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {mode === "classic" && (
          <View style={styles.livesRowBottom}>
            {Array.from({ length: pipCount }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pip,
                  { backgroundColor: i < lives ? theme.ringColor : Colors.border },
                ]}
              />
            ))}
          </View>
        )}

        {/* Game area */}
        <View style={styles.gameArea}>
          {/* Shockwave */}
          <Animated.View
            style={[
              styles.shockwave,
              {
                borderColor: theme.ringColor,
                width: ORB_RADIUS * 2,
                height: ORB_RADIUS * 2,
                borderRadius: ORB_RADIUS,
              },
              shockwaveStyle,
            ]}
          />

          {/* Target ring (fixed) */}
          <Animated.View
            style={[
              styles.targetRing,
              {
                width: TARGET_RADIUS * 2,
                height: TARGET_RADIUS * 2,
                borderRadius: TARGET_RADIUS,
                borderColor: theme.targetColor,
              },
              targetRingOpacityStyle,
            ]}
          />

          {/* Expanding ring */}
          <Animated.View
            style={[
              styles.expandingRing,
              { borderColor: theme.ringColor },
              ringAnimStyle,
            ]}
          />

          {/* Orb */}
          <Animated.View style={[styles.orbContainer, orbAnimStyle]}>
            <View style={[styles.orbAura, { backgroundColor: theme.glowColor + "28", width: ORB_RADIUS * 2 + 24, height: ORB_RADIUS * 2 + 24, borderRadius: ORB_RADIUS + 12 }]} />
            <View style={[styles.orbMid, { backgroundColor: theme.glowColor + "55", width: ORB_RADIUS * 2 + 10, height: ORB_RADIUS * 2 + 10, borderRadius: ORB_RADIUS + 5 }]} />
            <LinearGradient
              colors={[theme.ringColor, theme.glowColor]}
              style={[styles.orbCore, { width: ORB_RADIUS * 2, height: ORB_RADIUS * 2, borderRadius: ORB_RADIUS }]}
            />
          </Animated.View>

          {/* Hit label */}
          {hitLabel && (
            <View style={styles.hitLabelContainer} pointerEvents="none">
              <Text style={[styles.hitLabel, { color: hitLabelColor }]}>{hitLabel}</Text>
            </View>
          )}
        </View>

        {/* Countdown overlay */}
        {countdown !== null && (
          <View style={styles.countdownOverlay} pointerEvents="none">
            <Text style={[styles.countdownText, { color: theme.ringColor }]}>
              {countdown}
            </Text>
            <Text style={styles.countdownSubtitle}>TAP WHEN RINGS ALIGN</Text>
          </View>
        )}

        {/* Bottom hint */}
        {isPlaying && (
          <View style={styles.bottomHint} pointerEvents="none">
            <Text style={styles.hintText}>TAP ANYWHERE</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBlock: {
    alignItems: "center",
    minWidth: 80,
  },
  scoreText: {
    fontSize: 32,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1,
  },
  comboText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 1,
    marginTop: -4,
  },
  timerBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 50,
    justifyContent: "flex-end",
  },
  timerText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.textSecondary,
  },
  livesRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    minWidth: 50,
    justifyContent: "flex-end",
  },
  livesRowBottom: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gameArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shockwave: {
    position: "absolute",
    borderWidth: 2,
  },
  targetRing: {
    position: "absolute",
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  expandingRing: {
    position: "absolute",
    borderWidth: 3,
  },
  orbContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  orbAura: {
    position: "absolute",
  },
  orbMid: {
    position: "absolute",
  },
  orbCore: {
    shadowColor: "#A78BFA",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 8,
  },
  hitLabelContainer: {
    position: "absolute",
    bottom: -60,
    alignItems: "center",
  },
  hitLabel: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 3,
  },
  countdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,26,0.7)",
  },
  countdownText: {
    fontSize: 64,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 4,
  },
  countdownSubtitle: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 3,
    marginTop: 12,
  },
  bottomHint: {
    alignItems: "center",
    paddingBottom: 12,
  },
  hintText: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 3,
  },
});
