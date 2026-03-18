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
import { getSurgeSettings, useSurgePowerUp, type SurgePowerUpType } from "@/lib/surge-storage";
import { useSurgeSubscription } from "@/lib/surge-subscription";
import { useRewardedAd } from "@/lib/surge-ads";

type SurgeGameMode = "classic" | "endless" | "rush";
type HitQuality = "perfect" | "good" | "miss";

const TARGET_PROGRESS = 0.5;
const PERFECT_WINDOW_MS = 80;
const GOOD_WINDOW_MS = 160;
const INITIAL_CYCLE_MS = 1300;
const RUSH_INITIAL_CYCLE_MS = 700;
const MIN_CYCLE_MS = 520;
const SLOW_RING_FLOOR_MS = 700;
const RAMP_EVERY_N_HITS = 3;
const RUSH_RAMP_EVERY_N_HITS = 2;
const RAMP_AMOUNT_MS = 35;
const RUSH_COLOR = "#FF6D00";
const ORB_RADIUS = 44;
const MAX_RING_RADIUS = 130;
const TARGET_RADIUS = ORB_RADIUS + (MAX_RING_RADIUS - ORB_RADIUS) * TARGET_PROGRESS;

export default function SurgeScreen() {
  const { mode: modeParam, powerUp: powerUpParam } = useLocalSearchParams<{ mode: string; powerUp: string }>();
  const mode = (modeParam ?? "classic") as SurgeGameMode;
  const pendingPowerUp = (powerUpParam ?? null) as SurgePowerUpType | null;

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
  const [flashType, setFlashType] = useState<"correct" | "wrong" | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [bursts, setBursts] = useState<BurstEvent[]>([]);
  const [popups, setPopups] = useState<PopupEvent[]>([]);
  const [hitLabel, setHitLabel] = useState<string | null>(null);
  const [hitLabelColor, setHitLabelColor] = useState(Colors.success);
  const [equippedThemeId, setEquippedThemeId] = useState<RingThemeId>("neon_purple");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [showRevivePrompt, setShowRevivePrompt] = useState(false);
  const hasRevivedRef = useRef(false);
  const [activePowerUp, setActivePowerUp] = useState<SurgePowerUpType | null>(null);
  const [powerUpSecsLeft, setPowerUpSecsLeft] = useState(0);
  const slowRingActiveRef = useRef(false);
  const doubleScoreActiveRef = useRef(false);
  const powerUpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { isPro } = useSurgeSubscription();
  const { isAdReady, watchAd } = useRewardedAd();

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
  const cycleDurationRef = useRef(mode === "rush" ? RUSH_INITIAL_CYCLE_MS : INITIAL_CYCLE_MS);
  const hitLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tappedThisCycleRef = useRef(false);
  const cycleStartTimeRef = useRef(0);

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
    Promise.all([getEquippedRingTheme(), getSurgeSettings()]).then(([id, s]) => {
      setEquippedThemeId(id);
      setSoundEnabled(s.soundEnabled);
      setHapticsEnabled(s.hapticsEnabled);
    });
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
    if (powerUpTimerRef.current) clearInterval(powerUpTimerRef.current);
    cancelAnimation(ringProgress);
    cancelAnimation(shockwaveScale);
    cancelAnimation(shockwaveOpacity);
  }, []);

  const goToResults = useCallback(() => {
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
  }, [mode]);

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

    if (!isPro && !hasRevivedRef.current && scoreRef.current > 0) {
      setShowRevivePrompt(true);
    } else {
      goToResults();
    }
  }, [cleanup, mode, isPro, goToResults]);

  const handleRevive = useCallback(async () => {
    setShowRevivePrompt(false);
    let granted = false;
    try {
      const result = await watchAd();
      granted = result.granted;
    } catch {
      granted = false;
    }
    if (!granted) {
      goToResults();
      return;
    }
    hasRevivedRef.current = true;
    gameOverRef.current = false;
    setLives(1);
    livesRef.current = 1;
    setTimeout(() => {
      startCountdown();
    }, 300);
  }, [watchAd, goToResults]);

  const showHitLabel = useCallback((label: string, color: string) => {
    setHitLabel(label);
    setHitLabelColor(color);
    if (hitLabelTimerRef.current) clearTimeout(hitLabelTimerRef.current);
    hitLabelTimerRef.current = setTimeout(() => setHitLabel(null), 700);
  }, []);

  const startCycle = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    tappedThisCycleRef.current = false;
    cycleStartTimeRef.current = Date.now();
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

    setFlashType("wrong");
    setFlashKey((k) => k + 1);
    setTimeout(() => setFlashType(null), 300);
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (soundEnabled) soundManager.play("wrong");

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
  }, [endGame, startCycle, showHitLabel, hapticsEnabled, soundEnabled]);

  const handleTap = useCallback(() => {
    if (!isPlayingRef.current || gameOverRef.current) return;
    if (tappedThisCycleRef.current) return;
    tappedThisCycleRef.current = true;

    const elapsed = Date.now() - cycleStartTimeRef.current;
    const targetMs = cycleDurationRef.current * TARGET_PROGRESS;
    const diffMs = Math.abs(elapsed - targetMs);
    cancelAnimation(ringProgress);
    ringProgress.value = withTiming(0, { duration: 150 });

    let quality: HitQuality;
    if (diffMs <= PERFECT_WINDOW_MS) {
      quality = "perfect";
    } else if (diffMs <= GOOD_WINDOW_MS) {
      quality = "good";
    } else {
      quality = "miss";
    }

    if (quality === "miss") {
      comboRef.current = 0;
      setCombo(0);
      livesRef.current -= 1;
      setLives(livesRef.current);

      setFlashType("wrong");
      setFlashKey((k) => k + 1);
      setTimeout(() => setFlashType(null), 300);
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (soundEnabled) soundManager.play("wrong");

      orbScale.value = withSequence(
        withTiming(1.35, { duration: 80 }),
        withSpring(1, { damping: 6, stiffness: 180 })
      );

      showHitLabel(elapsed < targetMs ? "EARLY!" : "LATE!", Colors.warning);

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
      const rawGained = Math.round(base * multiplier);
      const gained = doubleScoreActiveRef.current ? rawGained * 2 : rawGained;
      scoreRef.current += gained;
      setScore(scoreRef.current);

      const rampThreshold = mode === "rush" ? RUSH_RAMP_EVERY_N_HITS : RAMP_EVERY_N_HITS;
      const minFloor = slowRingActiveRef.current ? SLOW_RING_FLOOR_MS : MIN_CYCLE_MS;
      hitsSinceRampRef.current += 1;
      if (hitsSinceRampRef.current >= rampThreshold) {
        hitsSinceRampRef.current = 0;
        cycleDurationRef.current = Math.max(
          minFloor,
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

      setFlashType("correct");
      setFlashKey((k) => k + 1);
      setTimeout(() => setFlashType(null), 180);
      if (hapticsEnabled) Haptics.impactAsync(quality === "perfect" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
      if (soundEnabled) soundManager.play("tap");
    }

    cycleTimerRef.current = setTimeout(startCycle, 300);
  }, [endGame, startCycle, showHitLabel, screenCenterX, screenCenterY, theme, hapticsEnabled, soundEnabled]);

  const applyPowerUp = useCallback(async (type: SurgePowerUpType) => {
    const result = await useSurgePowerUp(type);
    if (!result.success) return;

    if (type === "extra_life") {
      const newLives = Math.min(livesRef.current + 1, 4);
      livesRef.current = newLives;
      setLives(newLives);
      return;
    }

    const duration = type === "slow_ring" ? 15 : 20;
    setActivePowerUp(type);
    setPowerUpSecsLeft(duration);

    if (type === "slow_ring") slowRingActiveRef.current = true;
    if (type === "double_score") doubleScoreActiveRef.current = true;

    let remaining = duration;
    powerUpTimerRef.current = setInterval(() => {
      remaining -= 1;
      setPowerUpSecsLeft(remaining);
      if (remaining <= 0) {
        if (powerUpTimerRef.current) clearInterval(powerUpTimerRef.current);
        slowRingActiveRef.current = false;
        doubleScoreActiveRef.current = false;
        setActivePowerUp(null);
      }
    }, 1000);
  }, []);

  const startGame = useCallback(() => {
    isPlayingRef.current = true;
    gameOverRef.current = false;
    setIsPlaying(true);

    if (mode === "classic") {
      gameTimerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          const next = t - 1;
          if (next <= 0) {
            endGame();
            return 0;
          }
          return next;
        });
      }, 1000);
    }

    elapsedTimerRef.current = setInterval(() => {
      elapsedRef.current += 1;
    }, 1000);

    if (pendingPowerUp) {
      applyPowerUp(pendingPowerUp);
    }

    startCycle();
  }, [mode, endGame, startCycle, pendingPowerUp, applyPowerUp]);

  const startCountdown = useCallback(() => {
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
    return tick;
  }, [startGame]);

  useEffect(() => {
    const tick = startCountdown();
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

  const pipCount = 3;

  return (
    <Pressable style={{ flex: 1 }} onPress={handleTap}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
        style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
      >
        <AmbientParticles count={8} />

        <ScreenFlash flashType={flashType} flashKey={flashKey} />
        <ParticleBurst bursts={bursts} onBurstComplete={(id) => setBursts((p) => p.filter((b) => b.id !== id))} />
        <ScorePopup popups={popups} onComplete={(id) => setPopups((p) => p.filter((e) => e.id !== id))} />

        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => { cleanup(); router.replace("/"); }}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={16}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>

          <View testID="surge-game-score-block" style={styles.scoreBlock}>
            {mode === "rush" && (
              <Text style={[styles.modeLabel, { color: RUSH_COLOR }]}>RUSH</Text>
            )}
            <Text testID="surge-game-score-text" style={[styles.scoreText, { color: theme.ringColor }]}>{score}</Text>
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

        {activePowerUp && (
          <View style={styles.powerUpBadge} pointerEvents="none">
            <Ionicons
              name={activePowerUp === "slow_ring" ? "hourglass-outline" : activePowerUp === "double_score" ? "flash" : "heart"}
              size={13}
              color={activePowerUp === "slow_ring" ? "#00B0FF" : activePowerUp === "double_score" ? Colors.warning : "#FF4081"}
            />
            <Text style={[styles.powerUpBadgeText, { color: activePowerUp === "slow_ring" ? "#00B0FF" : activePowerUp === "double_score" ? Colors.warning : "#FF4081" }]}>
              {activePowerUp === "slow_ring" ? "SLOW" : activePowerUp === "double_score" ? "2× SCORE" : ""} — {powerUpSecsLeft}s
            </Text>
          </View>
        )}

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
          <View testID="surge-countdown-overlay" style={styles.countdownOverlay} pointerEvents="none">
            <Text testID="surge-countdown-text" style={[styles.countdownText, { color: theme.ringColor }]}>
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

        {/* Revive prompt */}
        {showRevivePrompt && (
          <View testID="surge-revive-overlay" style={styles.reviveOverlay}>
            <View testID="surge-revive-card" style={styles.reviveCard}>
              <Text style={styles.reviveTitle}>GAME OVER</Text>
              <Text style={styles.reviveScore}>Score: {scoreRef.current}</Text>
              <Text style={styles.reviveSubtitle}>Watch an ad to revive with 1 life</Text>
              <Pressable
                testID="surge-revive-watch-ad"
                style={({ pressed }) => [styles.reviveBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={handleRevive}
              >
                <Ionicons name="play-circle" size={20} color="#fff" />
                <Text style={styles.reviveBtnText}>WATCH AD & REVIVE</Text>
              </Pressable>
              <Pressable
                testID="surge-revive-skip"
                style={({ pressed }) => [styles.reviveSkipBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => { setShowRevivePrompt(false); goToResults(); }}
              >
                <Text style={styles.reviveSkipText}>Skip</Text>
              </Pressable>
            </View>
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
  modeLabel: {
    fontSize: 10,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 3,
    marginBottom: -2,
  },
  powerUpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  powerUpBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 1,
  },
  reviveOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,26,0.85)",
  },
  reviveCard: {
    width: 300,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    padding: 28,
    gap: 12,
  },
  reviveTitle: {
    fontSize: 26,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 3,
  },
  reviveScore: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.textSecondary,
  },
  reviveSubtitle: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 4,
  },
  reviveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    justifyContent: "center",
  },
  reviveBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  reviveSkipBtn: {
    paddingVertical: 8,
  },
  reviveSkipText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
  },
});
