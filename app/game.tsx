import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  TILE_COUNT,
  GRID_COLS,
  FLASH_INTERVAL,
  COMBO_MULTIPLIER_STEP,
  MAX_COMBO_MULTIPLIER,
  POWER_UPS,
  generateRule,
  generateTileColors,
  isTapCorrect,
  getDifficultyConfig,
  generateDailyRules,
  getDailySeed,
  type GameRule,
  type TileColor,
  type Difficulty,
  type DifficultyConfig,
  type GameMode,
  type PowerUpType,
} from "@/constants/game";
import { getSettings, getPowerUps, usePowerUp, earnPowerUp, type GameSettings, type PowerUpInventory } from "@/lib/storage";
import { trackEvent } from "@/lib/analytics";
import { soundManager } from "@/lib/sounds";
import ParticleBurst, { type BurstEvent } from "@/components/ParticleBurst";
import ScreenFlash, { type FlashType } from "@/components/ScreenFlash";
import TapRipple, { type RippleEvent } from "@/components/TapRipple";
import AmbientParticles from "@/components/AmbientParticles";

const TILE_GAP = 10;
const GRID_PADDING = 16;
const FRENZY_THRESHOLD = 10;

interface GameState {
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  timeLeft: number;
  isPlaying: boolean;
  isCountdown: boolean;
  countdownValue: number;
  rule: GameRule;
  tiles: TileColor[];
  flashingIndex: number | null;
  reactionTimes: number[];
  mistakes: number;
  elapsedSec: number;
}

function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function AnimatedTile({
  tile,
  index,
  isFlashing,
  onPress,
  disabled,
  isFrenzy,
  comboLevel,
  tileSize,
}: {
  tile: TileColor;
  index: number;
  isFlashing: boolean;
  onPress: (index: number, pageX: number, pageY: number) => void;
  disabled: boolean;
  isFrenzy: boolean;
  comboLevel: number;
  tileSize: number;
}) {
  const scale = useSharedValue(1);
  const flashOpacity = useSharedValue(1);
  const entranceScale = useSharedValue(0.7);
  const tileRef = useRef<View>(null);

  useEffect(() => {
    entranceScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, [tile.key]);

  useEffect(() => {
    if (isFlashing) {
      flashOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: FLASH_INTERVAL }),
          withTiming(1, { duration: FLASH_INTERVAL })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(flashOpacity);
      flashOpacity.value = withTiming(1, { duration: 100 });
    }
  }, [isFlashing]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * entranceScale.value }],
    opacity: flashOpacity.value,
  }));

  const glowIntensity = Math.min(comboLevel * 0.15, 0.8);
  const tileGlowColor = isFrenzy ? Colors.error : tile.color;
  const gradientTop = lightenHex(tile.color, 40);
  const gradientBottom = darkenHex(tile.color, 30);

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.85, { damping: 10, stiffness: 500 }),
      withSpring(1, { damping: 10, stiffness: 300 })
    );
    if (tileRef.current) {
      tileRef.current.measure((_x, _y, _w, _h, pageX, pageY) => {
        onPress(index, pageX + tileSize / 2, pageY + tileSize / 2);
      });
    } else {
      onPress(index, 0, 0);
    }
  };

  return (
    <Animated.View style={animStyle}>
      <View ref={tileRef} collapsable={false}>
        <Pressable
          onPress={handlePress}
          disabled={disabled}
          style={[
            styles.tile,
            {
              width: tileSize,
              height: tileSize,
              shadowColor: tileGlowColor,
              shadowOpacity: 0.3 + glowIntensity,
              shadowRadius: 6 + comboLevel * 2,
              overflow: "hidden",
            },
            isFrenzy && styles.tileFrenzy,
          ]}
        >
          <LinearGradient
            colors={[gradientTop, tile.color, gradientBottom]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.tileHighlight} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function AnimatedHeart({ filled, index, total }: { filled: boolean; index: number; total: number }) {
  const scale = useSharedValue(1);
  const prevFilledRef = useRef(filled);

  useEffect(() => {
    if (prevFilledRef.current && !filled) {
      scale.value = withSequence(
        withTiming(1.4, { duration: 100 }),
        withSequence(
          withTiming(0.8, { duration: 60 }),
          withTiming(1.1, { duration: 60 }),
          withTiming(0.9, { duration: 60 }),
          withTiming(1, { duration: 60 })
        ),
        withTiming(1, { duration: 100 })
      );
    }
    prevFilledRef.current = filled;
  }, [filled]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Ionicons
        name={filled ? "heart" : "heart-outline"}
        size={22}
        color={filled ? Colors.secondary : Colors.textMuted}
      />
    </Animated.View>
  );
}

function LivesDisplay({ lives, total }: { lives: number; total: number }) {
  return (
    <View style={styles.livesRow}>
      {Array.from({ length: total }).map((_, i) => (
        <AnimatedHeart key={i} filled={i < lives} index={i} total={total} />
      ))}
    </View>
  );
}

function TimerBar({ timeLeft, total, isFrenzy, mode }: { timeLeft: number; total: number; isFrenzy: boolean; mode: GameMode }) {
  if (mode === "endless" || mode === "zen") {
    return (
      <View style={styles.timerContainer}>
        <View style={[styles.timerTrack, { backgroundColor: mode === "zen" ? Colors.success + "20" : Colors.accent + "20" }]}>
          <View style={[styles.timerFill, { width: "100%", backgroundColor: mode === "zen" ? Colors.success : Colors.accent, opacity: 0.5 }]} />
        </View>
        <Text style={[styles.timerText, { color: mode === "zen" ? Colors.success : Colors.accent }]}>
          {mode === "zen" ? "ZEN" : "∞"}
        </Text>
      </View>
    );
  }

  const progress = timeLeft / total;
  const barColor = isFrenzy ? Colors.error : progress > 0.3 ? Colors.primary : progress > 0.15 ? Colors.warning : Colors.error;

  return (
    <View style={styles.timerContainer}>
      <View style={[styles.timerTrack, isFrenzy && styles.timerTrackFrenzy]}>
        <View style={[styles.timerFill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.timerText, { color: barColor }]}>{timeLeft}s</Text>
    </View>
  );
}

function ComboStreak({ combo }: { combo: number }) {
  const fireScale = useSharedValue(1);

  useEffect(() => {
    if (combo > 0) {
      fireScale.value = withSequence(
        withSpring(1.4, { damping: 6, stiffness: 300 }),
        withSpring(1, { damping: 8, stiffness: 200 })
      );
    }
  }, [combo]);

  const fireStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));

  if (combo < 2) return null;

  const multiplier = Math.min(1 + combo * COMBO_MULTIPLIER_STEP, MAX_COMBO_MULTIPLIER);
  const fireCount = Math.min(Math.floor(combo / 2), 4);
  const fireColors = ["#FF6B35", "#FF2D6F", "#FFD600", "#FF9100"];
  const comboProgress = (combo % Math.ceil(1 / COMBO_MULTIPLIER_STEP)) / Math.ceil(1 / COMBO_MULTIPLIER_STEP);

  return (
    <Animated.View style={[styles.comboContainer, fireStyle]}>
      <View style={styles.comboFireRow}>
        {Array.from({ length: fireCount }).map((_, i) => (
          <Ionicons key={i} name="flame" size={14 + i * 2} color={fireColors[i % fireColors.length]} />
        ))}
      </View>
      <View style={styles.comboBadge}>
        <Text style={styles.comboText}>{multiplier.toFixed(1)}x</Text>
      </View>
      <View style={styles.comboProgressTrack}>
        <View style={[styles.comboProgressFill, { width: `${comboProgress * 100}%` }]} />
      </View>
      <Text style={styles.comboLabel}>{combo} STREAK</Text>
    </Animated.View>
  );
}

function PointPopup({ points }: { points: number }) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(-40, { duration: 600, easing: Easing.out(Easing.quad) });
    opacity.value = withTiming(0, { duration: 600 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.pointPopup, animStyle]}>
      <Text style={styles.pointPopupText}>+{points}</Text>
    </Animated.View>
  );
}

function CountdownOverlay({ value, diffConfig, mode }: { value: number; diffConfig: DifficultyConfig; mode: GameMode }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 200 }),
      withTiming(1, { duration: 300 })
    );
    opacity.value = withTiming(1, { duration: 200 });
  }, [value]);

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const isGo = value <= 0;
  const modeColor = mode === "endless" ? Colors.accent : mode === "zen" ? Colors.success : diffConfig.color;
  const modeLabel = mode === "endless" ? "ENDLESS" : mode === "zen" ? "ZEN" : diffConfig.label.toUpperCase();

  return (
    <View style={styles.countdownCenter}>
      <View style={styles.countdownRing}>
        <Animated.View style={textStyle}>
          <Text style={[styles.countdownText, isGo && styles.countdownGo]}>
            {isGo ? "GO!" : value}
          </Text>
        </Animated.View>
      </View>
      {!isGo && <Text style={styles.countdownLabel}>GET READY</Text>}
      <View style={styles.difficultyTag}>
        <Ionicons name={diffConfig.icon as any} size={14} color={modeColor} />
        <Text style={[styles.difficultyTagText, { color: modeColor }]}>
          {modeLabel}
        </Text>
      </View>
    </View>
  );
}

function PowerUpBar({
  inventory,
  activeEffects,
  onActivate,
  mode,
}: {
  inventory: PowerUpInventory;
  activeEffects: Set<PowerUpType>;
  onActivate: (type: PowerUpType) => void;
  mode: GameMode;
}) {
  if (mode === "zen") return null;

  return (
    <View style={styles.powerUpBar}>
      {POWER_UPS.map((pu) => {
        const count = inventory[pu.type];
        const isActive = activeEffects.has(pu.type);
        const disabled = count <= 0 || isActive;
        return (
          <Pressable
            key={pu.type}
            onPress={() => !disabled && onActivate(pu.type)}
            style={[
              styles.powerUpBtn,
              isActive && { borderColor: pu.color, backgroundColor: pu.color + "30" },
              disabled && !isActive && { opacity: 0.4 },
            ]}
          >
            <Ionicons name={pu.icon as any} size={20} color={isActive ? pu.color : Colors.textSecondary} />
            {count > 0 && <View style={[styles.powerUpCount, { backgroundColor: pu.color }]}><Text style={styles.powerUpCountText}>{count}</Text></View>}
            {isActive && <View style={[styles.powerUpActive, { backgroundColor: pu.color }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;
  const gridWidth = contentMaxWidth ? Math.min(width, contentMaxWidth) - contentHorizontalPadding * 2 : width - GRID_PADDING * 2;
  const tileSize = (gridWidth - TILE_GAP * (GRID_COLS - 1)) / GRID_COLS;

  const params = useLocalSearchParams<{ difficulty?: string; daily?: string; mode?: string; theme?: string }>();
  const difficulty = (params.difficulty as Difficulty) || "normal";
  const isDaily = params.daily === "true";
  const mode = (params.mode as GameMode) || "regular";
  const themeId = params.theme || "default";
  const diffConfig = getDifficultyConfig(difficulty);

  const [settings, setSettings] = useState<GameSettings>({ soundEnabled: true, hapticsEnabled: true });
  const [powerUpInventory, setPowerUpInventory] = useState<PowerUpInventory>({ shield: 0, time_freeze: 0, double_points: 0 });
  const [activeEffects, setActiveEffects] = useState<Set<PowerUpType>>(new Set());
  const [usedThisGame, setUsedThisGame] = useState<Set<PowerUpType>>(new Set());
  const [shieldActive, setShieldActive] = useState(false);
  const [freezeActive, setFreezeActive] = useState(false);
  const [doubleActive, setDoubleActive] = useState(false);

  const [gameState, setGameState] = useState<GameState>(() => {
    const rule = isDaily ? generateDailyRules(getDailySeed())[0] : generateRule();
    const lives = mode === "zen" ? 999 : diffConfig.lives;
    return {
      score: 0,
      lives,
      combo: 0,
      maxCombo: 0,
      timeLeft: mode === "endless" || mode === "zen" ? 9999 : diffConfig.duration,
      isPlaying: false,
      isCountdown: true,
      countdownValue: 3,
      rule,
      tiles: generateTileColors(themeId),
      flashingIndex: null,
      reactionTimes: [],
      mistakes: 0,
      elapsedSec: 0,
    };
  });

  const [bursts, setBursts] = useState<BurstEvent[]>([]);
  const [ripples, setRipples] = useState<RippleEvent[]>([]);
  const [flashType, setFlashType] = useState<FlashType>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [pointPopups, setPointPopups] = useState<{ id: string; points: number }[]>([]);
  const [showGo, setShowGo] = useState(false);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const diffConfigRef = useRef(diffConfig);
  diffConfigRef.current = diffConfig;
  const dailyRuleIndex = useRef(0);
  const activeEffectsRef = useRef(activeEffects);
  activeEffectsRef.current = activeEffects;
  const shieldActiveRef = useRef(false);
  shieldActiveRef.current = shieldActive;
  const doubleActiveRef = useRef(false);
  doubleActiveRef.current = doubleActive;
  const freezeActiveRef = useRef(false);
  freezeActiveRef.current = freezeActive;

  const lastTapTime = useRef(Date.now());
  const ruleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endlessSpeedRef = useRef(0);
  const endlessRampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  const ruleAnim = useSharedValue(1);
  const scorePopAnim = useSharedValue(0);
  const shakeAnim = useSharedValue(0);
  const frenzyPulse = useSharedValue(0);

  const ruleAnimStyle = useAnimatedStyle(() => ({
    opacity: ruleAnim.value,
    transform: [{ translateY: interpolate(ruleAnim.value, [0, 1], [-10, 0]) }],
  }));

  const scorePopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scorePopAnim.value, [0, 0.5, 1], [1, 1.3, 1]) }],
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  const frenzyBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 61, 61, ${interpolate(frenzyPulse.value, [0, 1], [0.3, 0.8])})`,
    borderWidth: interpolate(frenzyPulse.value, [0, 1], [1, 3]),
  }));

  const isFrenzy = mode === "regular" && gameState.timeLeft <= FRENZY_THRESHOLD && gameState.isPlaying;

  useEffect(() => {
    if (isFrenzy) {
      frenzyPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(frenzyPulse);
      frenzyPulse.value = 0;
    }
  }, [isFrenzy]);

  useEffect(() => {
    mountedRef.current = true;
    loadSettings();
    startCountdown();
    return () => {
      mountedRef.current = false;
      popupTimers.current.forEach(clearTimeout);
      cleanup();
    };
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    soundManager.setEnabled(s.soundEnabled);
    const pu = await getPowerUps();
    setPowerUpInventory(pu);
  };

  const cleanup = () => {
    if (ruleTimerRef.current) clearTimeout(ruleTimerRef.current);
    if (tileTimerRef.current) clearTimeout(tileTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (endlessRampRef.current) clearInterval(endlessRampRef.current);
  };

  const startCountdown = () => {
    let count = 3;

    countdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        soundManager.play("countdown");
        setShowGo(true);
        setTimeout(() => {
          if (!mountedRef.current) return;
          setShowGo(false);
          setGameState((prev) => ({ ...prev, isCountdown: false, isPlaying: true }));
          startGame();
        }, 600);
      } else {
        soundManager.play("countdown");
        setGameState((prev) => ({ ...prev, countdownValue: count }));
      }
    }, 1000);
  };

  const startGame = () => {
    trackEvent("game_started", { difficulty, daily: isDaily, mode });
    lastTapTime.current = Date.now();

    elapsedTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setGameState((prev) => ({ ...prev, elapsedSec: prev.elapsedSec + 1 }));
    }, 1000);

    if (mode === "regular") {
      gameTimerRef.current = setInterval(() => {
        if (freezeActiveRef.current) return;
        setGameState((prev) => {
          if (prev.timeLeft <= 1) {
            soundManager.play("gameOver");
            endGame({ ...prev, timeLeft: 0 });
            return { ...prev, timeLeft: 0, isPlaying: false };
          }
          if (prev.timeLeft <= FRENZY_THRESHOLD + 1 && prev.timeLeft > 1) {
            soundManager.play("countdown");
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }

    if (mode === "endless") {
      endlessSpeedRef.current = 0;
      endlessRampRef.current = setInterval(() => {
        if (!mountedRef.current || !gameStateRef.current.isPlaying) {
          if (endlessRampRef.current) clearInterval(endlessRampRef.current);
          return;
        }
        endlessSpeedRef.current++;
      }, 30000);
    }

    scheduleRuleChange();
    scheduleTileChange();
    scheduleFlashing();
  };

  const getEndlessSpeedMultiplier = () => {
    return 1 + endlessSpeedRef.current * 0.2;
  };

  const scheduleRuleChange = () => {
    const baseInterval = diffConfigRef.current.ruleChangeInterval;
    const interval = mode === "endless"
      ? Math.max(1500, baseInterval / getEndlessSpeedMultiplier())
      : baseInterval;

    ruleTimerRef.current = setTimeout(() => {
      if (!gameStateRef.current.isPlaying) return;

      ruleAnim.value = withSequence(
        withTiming(0, { duration: 150 }),
        withTiming(1, { duration: 300 })
      );

      setGameState((prev) => {
        let newRule: GameRule;
        if (isDaily) {
          const dailyRules = generateDailyRules(getDailySeed());
          dailyRuleIndex.current = (dailyRuleIndex.current + 1) % dailyRules.length;
          newRule = dailyRules[dailyRuleIndex.current];
        } else {
          newRule = generateRule(prev.rule);
        }
        return {
          ...prev,
          rule: newRule,
          tiles: generateTileColors(themeId),
          flashingIndex: newRule.type === "tap_flashing"
            ? Math.floor(Math.random() * TILE_COUNT)
            : null,
        };
      });

      scheduleRuleChange();
    }, interval);
  };

  const scheduleTileChange = () => {
    const current = gameStateRef.current;
    const cfg = diffConfigRef.current;
    let interval: number;

    if (mode === "endless") {
      const speedMult = getEndlessSpeedMultiplier();
      interval = Math.max(600, cfg.tileChangeIntervalStart / speedMult);
    } else if (mode === "zen") {
      interval = cfg.tileChangeIntervalStart;
    } else {
      const elapsed = cfg.duration - current.timeLeft;
      const progress = elapsed / cfg.duration;
      const range = cfg.tileChangeIntervalStart - cfg.tileChangeIntervalMin;
      interval = Math.max(cfg.tileChangeIntervalMin, cfg.tileChangeIntervalStart - progress * range);
    }

    tileTimerRef.current = setTimeout(() => {
      if (!gameStateRef.current.isPlaying) return;

      setGameState((prev) => {
        const newTiles = generateTileColors(themeId);
        return {
          ...prev,
          tiles: newTiles,
          flashingIndex: prev.rule.type === "tap_flashing"
            ? Math.floor(Math.random() * TILE_COUNT)
            : prev.flashingIndex,
        };
      });

      scheduleTileChange();
    }, interval);
  };

  const scheduleFlashing = () => {
    const checkFlashing = () => {
      setTimeout(() => {
        if (!gameStateRef.current.isPlaying) return;

        if (gameStateRef.current.rule.type === "tap_flashing" && gameStateRef.current.flashingIndex === null) {
          setGameState((prev) => ({
            ...prev,
            flashingIndex: Math.floor(Math.random() * TILE_COUNT),
          }));
        }
        checkFlashing();
      }, 2000);
    };
    checkFlashing();
  };

  const handleActivatePowerUp = useCallback(async (type: PowerUpType) => {
    if (usedThisGame.has(type)) return;
    const success = await usePowerUp(type);
    if (!success) return;

    if (settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setUsedThisGame((prev) => new Set(prev).add(type));
    setActiveEffects((prev) => new Set(prev).add(type));
    const inv = await getPowerUps();
    setPowerUpInventory(inv);

    if (type === "shield") {
      setShieldActive(true);
    } else if (type === "time_freeze") {
      setFreezeActive(true);
      setTimeout(() => {
        if (mountedRef.current) {
          setFreezeActive(false);
          setActiveEffects((prev) => {
            const n = new Set(prev);
            n.delete("time_freeze");
            return n;
          });
        }
      }, 3000);
    } else if (type === "double_points") {
      setDoubleActive(true);
      setTimeout(() => {
        if (mountedRef.current) {
          setDoubleActive(false);
          setActiveEffects((prev) => {
            const n = new Set(prev);
            n.delete("double_points");
            return n;
          });
        }
      }, 5000);
    }
  }, [settings.hapticsEnabled, usedThisGame]);

  const endGame = (finalState: GameState) => {
    cleanup();
    const avgReaction =
      finalState.reactionTimes.length > 0
        ? Math.round(
            finalState.reactionTimes.reduce((a, b) => a + b, 0) /
              finalState.reactionTimes.length
          )
        : 0;

    trackEvent("game_ended", {
      score: finalState.score,
      maxCombo: finalState.maxCombo,
      avgReaction,
      mistakes: finalState.mistakes,
      difficulty,
      daily: isDaily,
      mode,
    });

    setTimeout(() => {
      router.replace({
        pathname: "/results",
        params: {
          score: finalState.score.toString(),
          maxCombo: finalState.maxCombo.toString(),
          avgReaction: avgReaction.toString(),
          correctTaps: finalState.reactionTimes.length.toString(),
          mistakes: finalState.mistakes.toString(),
          livesLeft: finalState.lives.toString(),
          difficulty,
          daily: isDaily ? "true" : "false",
          mode,
          elapsed: finalState.elapsedSec.toString(),
        },
      });
    }, 500);
  };

  const handleQuitZen = useCallback(() => {
    const current = gameStateRef.current;
    soundManager.play("gameOver");
    setGameState((prev) => ({ ...prev, isPlaying: false }));
    endGame(current);
  }, []);

  const handleTileTap = useCallback((index: number, pageX: number, pageY: number) => {
    const current = gameStateRef.current;
    if (!current.isPlaying) return;

    const now = Date.now();
    const reactionTime = now - lastTapTime.current;
    lastTapTime.current = now;

    const correct = isTapCorrect(current.rule, index, current.tiles, current.flashingIndex);

    if (pageX > 0 && pageY > 0) {
      const rippleId = `ripple_${now}_${index}`;
      setRipples((prev) => [...prev, {
        x: pageX,
        y: pageY,
        color: correct ? current.tiles[index].color : Colors.error,
        id: rippleId,
      }]);
    }

    if (correct) {
      soundManager.play("tap");
      if (settings.hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      setFlashType("correct");
      setFlashKey((k) => k + 1);

      if (pageX > 0 && pageY > 0) {
        const burstId = `burst_${now}_${index}`;
        setBursts((prev) => [...prev, { x: pageX, y: pageY, color: current.tiles[index].color, id: burstId }]);
      }

      scorePopAnim.value = withSequence(
        withTiming(0.5, { duration: 80 }),
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 100 })
      );

      setGameState((prev) => {
        if (mode === "zen") {
          return { ...prev, combo: prev.combo + 1, maxCombo: Math.max(prev.maxCombo, prev.combo + 1), reactionTimes: [...prev.reactionTimes, reactionTime] };
        }

        const newCombo = prev.combo + 1;
        const multiplier = Math.min(1 + newCombo * COMBO_MULTIPLIER_STEP, MAX_COMBO_MULTIPLIER);
        const basePoints = Math.round(10 * multiplier);
        const points = doubleActiveRef.current ? basePoints * 2 : basePoints;

        if (newCombo > 0 && newCombo % 5 === 0) {
          soundManager.play("combo");
        }

        setPointPopups((pp) => [...pp, { id: `pp_${now}`, points }]);
        const timer = setTimeout(() => {
          if (mountedRef.current) {
            setPointPopups((pp) => pp.filter((p) => p.id !== `pp_${now}`));
          }
        }, 700);
        popupTimers.current.push(timer);

        return {
          ...prev,
          score: prev.score + points,
          combo: newCombo,
          maxCombo: Math.max(prev.maxCombo, newCombo),
          reactionTimes: [...prev.reactionTimes, reactionTime],
        };
      });
    } else {
      if (mode === "zen") {
        setFlashType("wrong");
        setFlashKey((k) => k + 1);
        if (settings.hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        soundManager.play("wrong");
        setGameState((prev) => ({ ...prev, combo: 0, mistakes: prev.mistakes + 1 }));
        return;
      }

      if (shieldActiveRef.current) {
        setShieldActive(false);
        setActiveEffects((prev) => {
          const n = new Set(prev);
          n.delete("shield");
          return n;
        });
        setFlashType("correct");
        setFlashKey((k) => k + 1);
        if (settings.hapticsEnabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        soundManager.play("tap");
        setGameState((prev) => ({ ...prev, combo: 0, mistakes: prev.mistakes + 1 }));
        return;
      }

      soundManager.play("wrong");
      if (settings.hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      setFlashType("wrong");
      setFlashKey((k) => k + 1);

      shakeAnim.value = withSequence(
        withTiming(-10, { duration: 40 }),
        withTiming(10, { duration: 40 }),
        withTiming(-8, { duration: 40 }),
        withTiming(8, { duration: 40 }),
        withTiming(-4, { duration: 40 }),
        withTiming(0, { duration: 40 })
      );

      setGameState((prev) => {
        const newLives = prev.lives - 1;
        if (newLives <= 0) {
          soundManager.play("gameOver");
          endGame({ ...prev, lives: 0, combo: 0, mistakes: prev.mistakes + 1 });
          return { ...prev, lives: 0, isPlaying: false, combo: 0, mistakes: prev.mistakes + 1 };
        }
        return { ...prev, lives: newLives, combo: 0, mistakes: prev.mistakes + 1 };
      });
    }
  }, [settings.hapticsEnabled, mode]);

  const handleBurstComplete = useCallback((id: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handleRippleComplete = useCallback((id: string) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const comboLevel = Math.min(gameState.combo, 10);

  if (gameState.isCountdown || showGo) {
    return (
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
        style={[styles.container, { paddingTop: topInset }]}
      >
        <AmbientParticles count={10} />
        <CountdownOverlay
          value={showGo ? 0 : gameState.countdownValue}
          diffConfig={diffConfig}
          mode={mode}
        />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[styles.container, { paddingTop: topInset }]}
    >
      <AmbientParticles count={12} />
      <ScreenFlash flashType={flashType} flashKey={flashKey} />
      <ParticleBurst bursts={bursts} onBurstComplete={handleBurstComplete} />
      <TapRipple ripples={ripples} onRippleComplete={handleRippleComplete} />

      {shieldActive && <View style={styles.shieldOverlay} />}
      {freezeActive && <View style={styles.freezeOverlay} />}
      {doubleActive && <View style={styles.doubleOverlay} />}

      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          <View style={styles.gameHeader}>
            <TimerBar timeLeft={gameState.timeLeft} total={diffConfig.duration} isFrenzy={isFrenzy} mode={mode} />

            {isFrenzy && (
              <View style={styles.frenzyBanner}>
                <Ionicons name="flame" size={16} color={Colors.error} />
                <Text style={styles.frenzyText}>FRENZY</Text>
                <Ionicons name="flame" size={16} color={Colors.error} />
              </View>
            )}

            {isDaily && (
              <View style={styles.dailyBanner}>
                <Ionicons name="calendar" size={14} color={Colors.warning} />
                <Text style={styles.dailyText}>DAILY CHALLENGE</Text>
              </View>
            )}

            {mode !== "regular" && !isDaily && (
              <View style={styles.dailyBanner}>
                <Ionicons name={mode === "endless" ? "infinite" : "leaf"} size={14} color={mode === "endless" ? Colors.accent : Colors.success} />
                <Text style={[styles.dailyText, { color: mode === "endless" ? Colors.accent : Colors.success }]}>
                  {mode === "endless" ? "ENDLESS MODE" : "ZEN MODE"}
                </Text>
                {mode === "zen" && (
                  <Pressable onPress={handleQuitZen} style={styles.quitZenBtn}>
                    <Text style={styles.quitZenText}>EXIT</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.statsRow}>
              {mode !== "zen" && <LivesDisplay lives={gameState.lives} total={mode === "endless" ? diffConfig.lives : diffConfig.lives} />}
              {mode === "zen" && <View style={styles.livesRow}><Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: Colors.success }}>PRACTICE</Text></View>}
              <View style={styles.scoreArea}>
                <Animated.View style={scorePopStyle}>
                  <Text style={styles.scoreText}>{mode === "zen" ? gameState.combo : gameState.score}</Text>
                </Animated.View>
                {pointPopups.map((pp) => (
                  <PointPopup key={pp.id} points={pp.points} />
                ))}
              </View>
              {mode !== "zen" && <ComboStreak combo={gameState.combo} />}
              {mode === "zen" && <View style={styles.comboContainer}><Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: Colors.textMuted }}>STREAK</Text></View>}
            </View>

            <Animated.View style={[
              styles.ruleBanner,
              ruleAnimStyle,
              isFrenzy && frenzyBorderStyle,
            ]}>
              <Text style={styles.ruleText}>{gameState.rule.displayText}</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.gridContainer, shakeStyle]}>
            <View style={styles.grid}>
              {gameState.tiles.map((tile, index) => (
                <AnimatedTile
                  key={index}
                  tile={tile}
                  index={index}
                  isFlashing={gameState.flashingIndex === index}
                  onPress={handleTileTap}
                  disabled={!gameState.isPlaying}
                  isFrenzy={isFrenzy}
                  comboLevel={comboLevel}
                  tileSize={tileSize}
                />
              ))}
            </View>
          </Animated.View>

          {mode !== "zen" && (
            <PowerUpBar
              inventory={powerUpInventory}
              activeEffects={activeEffects}
              onActivate={handleActivatePowerUp}
              mode={mode}
            />
          )}

          {mode === "endless" && (
            <View style={styles.endlessLevel}>
              <Text style={styles.endlessLevelText}>Speed Lv.{endlessSpeedRef.current + 1}</Text>
            </View>
          )}

        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  countdownCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: Colors.primary + "40",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface + "60",
  },
  countdownText: {
    fontSize: 72,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.primary,
  },
  countdownGo: {
    fontSize: 48,
    color: Colors.success,
  },
  countdownLabel: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 6,
    marginTop: 16,
  },
  difficultyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  difficultyTagText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 2,
  },
  gameHeader: {
    paddingHorizontal: GRID_PADDING,
    gap: 8,
    paddingTop: 8,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timerTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceLight,
    overflow: "hidden",
  },
  timerTrackFrenzy: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255, 61, 61, 0.15)",
  },
  timerFill: {
    height: "100%",
    borderRadius: 4,
  },
  timerText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    minWidth: 36,
    textAlign: "right",
  },
  frenzyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  frenzyText: {
    fontSize: 14,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.error,
    letterSpacing: 4,
  },
  dailyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 3,
  },
  dailyText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
    letterSpacing: 2,
  },
  quitZenBtn: {
    marginLeft: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quitZenText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  livesRow: {
    flexDirection: "row",
    gap: 4,
  },
  scoreArea: {
    position: "relative",
    alignItems: "center",
  },
  scoreText: {
    fontSize: 32,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
  },
  pointPopup: {
    position: "absolute",
    top: -10,
  },
  pointPopupText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.success,
  },
  comboContainer: {
    alignItems: "center",
    gap: 2,
  },
  comboFireRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 20,
  },
  comboBadge: {
    backgroundColor: Colors.secondaryDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  comboText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.secondary,
  },
  comboProgressTrack: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.surfaceLight,
    overflow: "hidden",
    marginTop: 2,
  },
  comboProgressFill: {
    height: "100%",
    backgroundColor: Colors.secondary,
    borderRadius: 1.5,
  },
  comboLabel: {
    fontSize: 9,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  ruleBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ruleText: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: 1,
  },
  gridContainer: {
    flex: 1,
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
    justifyContent: "center",
  },
  tile: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tileHighlight: {
    position: "absolute",
    top: 4,
    left: 6,
    width: "40%",
    height: "25%",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  tileFrenzy: {
    borderWidth: 1,
    borderColor: "rgba(255, 61, 61, 0.3)",
  },
  powerUpBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  powerUpBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: "relative",
  },
  powerUpCount: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  powerUpCountText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: Colors.background,
  },
  powerUpActive: {
    position: "absolute",
    bottom: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shieldOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: "#FFD70060",
    borderRadius: 0,
    pointerEvents: "none",
  },
  freezeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00BFFF10",
    pointerEvents: "none",
  },
  doubleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00E67610",
    pointerEvents: "none",
  },
  endlessLevel: {
    alignItems: "center",
    paddingBottom: 8,
  },
  endlessLevelText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.accent,
    letterSpacing: 2,
  },
});
