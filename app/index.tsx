import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  type Difficulty,
  type GameMode,
  DIFFICULTY_CONFIGS,
  MODE_CONFIGS,
  TILE_THEMES,
  DAILY_REWARDS,
  getLevelInfo,
} from "@/constants/game";
import {
  getBestScore,
  getSettings,
  getDifficulty,
  saveDifficulty,
  getTotalXP,
  getDailyBest,
  getGameMode,
  saveGameMode,
  getTileTheme,
  saveTileTheme,
  checkAndUpdateLoginStreak,
  getLoginStreak,
  getPowerUps,
  type PowerUpInventory,
} from "@/lib/storage";
import { trackEvent } from "@/lib/analytics";
import AmbientParticles from "@/components/AmbientParticles";

function FloatingTile({ delay, x, y, color, size }: { delay: number; x: number; y: number; color: string; size: number }) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(anim.value, [0, 1], [0, -15]) },
      { rotate: `${interpolate(anim.value, [0, 1], [-3, 3])}deg` },
    ],
    opacity: interpolate(anim.value, [0, 0.5, 1], [0.15, 0.25, 0.15]),
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size * 0.2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

function DailyRewardModal({
  visible,
  onClose,
  rewardXP,
  streak,
  milestoneBonus,
  milestoneLabel,
}: {
  visible: boolean;
  onClose: () => void;
  rewardXP: number;
  streak: number;
  milestoneBonus: number;
  milestoneLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.rewardModal, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20 }, animStyle]}>
          <View style={styles.rewardHeader}>
            <Ionicons name="gift" size={40} color={Colors.warning} />
            <Text style={styles.rewardTitle}>Daily Reward!</Text>
          </View>

          <View style={styles.rewardStreak}>
            <Ionicons name="flame" size={20} color={Colors.secondary} />
            <Text style={styles.rewardStreakText}>{streak} Day Streak</Text>
          </View>

          <View style={styles.rewardDays}>
            {DAILY_REWARDS.map((xp, i) => {
              const dayNum = i + 1;
              const currentDay = ((streak - 1) % DAILY_REWARDS.length) + 1;
              const isCurrent = dayNum === currentDay;
              const isPast = dayNum < currentDay;
              return (
                <View key={i} style={[styles.rewardDay, isCurrent && styles.rewardDayCurrent, isPast && styles.rewardDayPast]}>
                  <Text style={[styles.rewardDayNum, (isCurrent || isPast) && { color: Colors.text }]}>D{dayNum}</Text>
                  <Ionicons name="star" size={14} color={isCurrent ? Colors.warning : isPast ? Colors.textMuted : Colors.textMuted} />
                  <Text style={[styles.rewardDayXP, isCurrent && { color: Colors.warning }]}>{xp}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.rewardAmount}>
            <Ionicons name="star" size={28} color={Colors.accent} />
            <Text style={styles.rewardAmountText}>+{rewardXP} XP</Text>
          </View>

          {milestoneBonus > 0 && (
            <View style={styles.milestoneBonus}>
              <Ionicons name="trophy" size={18} color={Colors.warning} />
              <Text style={styles.milestoneBonusText}>{milestoneLabel}: +{milestoneBonus} XP</Text>
            </View>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.rewardClaimBtn, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          >
            <LinearGradient
              colors={[Colors.warning, "#FFB300"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rewardClaimGradient}
            >
              <Text style={styles.rewardClaimText}>CLAIM</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;

  const [bestScore, setBestScore] = useState(0);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ soundEnabled: true, hapticsEnabled: true });
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [mode, setMode] = useState<GameMode>("regular");
  const [selectedGame, setSelectedGame] = useState<"clutchtap" | "velocity">("clutchtap");
  const [velocityMode, setVelocityMode] = useState<GameMode>("regular");
  const [levelInfo, setLevelInfo] = useState({ level: 1, currentXP: 0, xpForNext: 100, progress: 0, title: "Beginner" });
  const [dailyBest, setDailyBest] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [loginStreak, setLoginStreak] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [rewardData, setRewardData] = useState({ rewardXP: 0, streak: 0, milestoneBonus: 0, milestoneLabel: "" });
  const [powerUps, setPowerUps] = useState<PowerUpInventory>({ shield: 0, time_freeze: 0, double_points: 0 });

  const pulseAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    trackEvent("screen_viewed", { screen: "home" });
    loadData();
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const loadData = async () => {
    const [score, s, d, xp, daily, m, theme, login, pu] = await Promise.all([
      getBestScore(),
      getSettings(),
      getDifficulty(),
      getTotalXP(),
      getDailyBest(),
      getGameMode(),
      getTileTheme(),
      getLoginStreak(),
      getPowerUps(),
    ]);
    setBestScore(score);
    setSettings(s);
    setDifficulty(d);
    setLevelInfo(getLevelInfo(xp));
    setDailyBest(daily.score);
    setMode(m);
    setSelectedTheme(theme);
    setLoginStreak(login.streak);
    setPowerUps(pu);

    const reward = await checkAndUpdateLoginStreak();
    if (reward.isNewDay && reward.rewardXP > 0) {
      setRewardData(reward);
      setLoginStreak(reward.streak);
      setShowReward(true);
      const updatedXP = await getTotalXP();
      setLevelInfo(getLevelInfo(updatedXP));
    }
  };

  const handleDifficultyChange = async (d: Difficulty) => {
    setDifficulty(d);
    await saveDifficulty(d);
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleModeChange = async (m: GameMode) => {
    setMode(m);
    await saveGameMode(m);
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const playButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.03]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.9, 1.1]) }],
  }));

  const handlePlay = async () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push({ pathname: "/game", params: { difficulty, mode, theme: selectedTheme } });
  };

  const handleDailyChallenge = () => {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push({ pathname: "/game", params: { difficulty: "normal", daily: "true", mode: "regular", theme: selectedTheme } });
  };

  const floatingTiles = [
    { delay: 0, x: width * 0.08, y: 120, color: Colors.tileBlue, size: 40 },
    { delay: 400, x: width * 0.75, y: 80, color: Colors.tileRed, size: 35 },
    { delay: 800, x: width * 0.5, y: 200, color: Colors.tileGreen, size: 30 },
    { delay: 200, x: width * 0.2, y: 350, color: Colors.tileYellow, size: 45 },
    { delay: 600, x: width * 0.65, y: 400, color: Colors.tilePurple, size: 32 },
    { delay: 1000, x: width * 0.1, y: 500, color: Colors.tileOrange, size: 38 },
    { delay: 300, x: width * 0.8, y: 550, color: Colors.tileBlue, size: 28 },
    { delay: 700, x: width * 0.4, y: 650, color: Colors.tileRed, size: 36 },
  ];

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const modeColor = MODE_CONFIGS[mode].color;

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
    >
      <AmbientParticles count={14} />
      {floatingTiles.map((tile, i) => (
        <FloatingTile key={i} {...tile} />
      ))}

      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          <View style={styles.topBar}>
            <View style={styles.levelBadge}>
              <Ionicons name="star" size={14} color={Colors.accent} />
              <Text style={styles.levelText}>Lv.{levelInfo.level}</Text>
              <View style={styles.levelProgressTrack}>
                <View style={[styles.levelProgressFill, { width: `${levelInfo.progress * 100}%` }]} />
              </View>
            </View>

            {loginStreak > 0 && (
              <View style={styles.streakBadge}>
                <Ionicons name="flame" size={14} color={Colors.secondary} />
                <Text style={styles.streakText}>{loginStreak}</Text>
              </View>
            )}

            <View style={styles.topBarRight}>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/stats");
                }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="stats-chart" size={22} color={Colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/leaderboard");
                }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="podium-outline" size={24} color={Colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/badges");
                }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="ribbon-outline" size={24} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Game Picker */}
          <View style={styles.gamePicker}>
            {([
              { id: "clutchtap" as const, name: "ClutchTap", tagline: "Reflex Challenge", icon: "flash", color: Colors.primary },
              { id: "velocity" as const, name: "Velocity", tagline: "Swipe to Dodge", icon: "speedometer", color: Colors.accent },
            ]).map((g) => {
              const isActive = selectedGame === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    setSelectedGame(g.id);
                    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.gameCard,
                    isActive && { borderColor: g.color, backgroundColor: g.color + "18" },
                    { opacity: pressed ? 0.8 : isActive ? 1 : 0.5 },
                  ]}
                >
                  <Ionicons name={g.icon as any} size={22} color={isActive ? g.color : Colors.textMuted} />
                  <Text style={[styles.gameCardName, isActive && { color: g.color }]}>{g.name}</Text>
                  <Text style={styles.gameCardTagline}>{g.tagline}</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedGame === "clutchtap" ? (
          <View style={styles.center}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>CLUTCH</Text>
              <Text style={styles.titleAccent}>TAP</Text>
            </View>
            <Text style={styles.subtitle}>REFLEX CHALLENGE</Text>
            <Text style={styles.levelTitle}>{levelInfo.title}</Text>

            {bestScore > 0 && (
              <View style={styles.bestScoreContainer}>
                <Ionicons name="trophy" size={16} color={Colors.warning} />
                <Text style={styles.bestScoreText}>Best: {bestScore}</Text>
              </View>
            )}

            <View style={styles.modePicker}>
              {(["regular", "endless", "zen"] as GameMode[]).map((m) => {
                const cfg = MODE_CONFIGS[m];
                const isSelected = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => handleModeChange(m)}
                    style={({ pressed }) => [
                      styles.modeOption,
                      isSelected && { borderColor: cfg.color, backgroundColor: cfg.color + "18" },
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Ionicons name={cfg.icon as any} size={16} color={isSelected ? cfg.color : Colors.textMuted} />
                    <Text style={[styles.modeLabel, isSelected && { color: cfg.color }]}>{cfg.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === "regular" && (
              <View style={styles.difficultyPicker}>
                {(["easy", "normal", "hard"] as Difficulty[]).map((d) => {
                  const config = DIFFICULTY_CONFIGS[d];
                  const isSelected = difficulty === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => handleDifficultyChange(d)}
                      style={({ pressed }) => [
                        styles.difficultyOption,
                        isSelected && { borderColor: config.color, backgroundColor: config.color + "18" },
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={config.icon as any}
                        size={18}
                        color={isSelected ? config.color : Colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.difficultyLabel,
                          isSelected && { color: config.color },
                        ]}
                      >
                        {config.label}
                      </Text>
                      {isSelected && (
                        <Text style={[styles.difficultyDetail, { color: config.color }]}>
                          {config.duration}s
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {mode !== "regular" && (
              <Text style={[styles.modeDesc, { color: MODE_CONFIGS[mode].color }]}>
                {MODE_CONFIGS[mode].description}
              </Text>
            )}

            {(powerUps.shield > 0 || powerUps.time_freeze > 0 || powerUps.double_points > 0) && (
              <View style={styles.powerUpPreview}>
                {powerUps.shield > 0 && (
                  <View style={styles.puBadge}>
                    <Ionicons name="shield" size={14} color="#FFD700" />
                    <Text style={styles.puBadgeText}>{powerUps.shield}</Text>
                  </View>
                )}
                {powerUps.time_freeze > 0 && (
                  <View style={styles.puBadge}>
                    <Ionicons name="snow" size={14} color="#00BFFF" />
                    <Text style={styles.puBadgeText}>{powerUps.time_freeze}</Text>
                  </View>
                )}
                {powerUps.double_points > 0 && (
                  <View style={styles.puBadge}>
                    <Ionicons name="flash" size={14} color="#00E676" />
                    <Text style={styles.puBadgeText}>{powerUps.double_points}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          ) : (
          <View style={styles.center}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: Colors.accent }]}>VELO</Text>
              <Text style={[styles.titleAccent, { color: "#A78BFA" }]}>CITY</Text>
            </View>
            <Text style={styles.subtitle}>SWIPE TO DODGE</Text>
            <Text style={[styles.levelTitle, { color: Colors.accent }]}>{levelInfo.title}</Text>

            <View style={styles.modePicker}>
              {(["regular", "endless", "zen"] as GameMode[]).map((m) => {
                const cfg = MODE_CONFIGS[m];
                const isSelected = velocityMode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setVelocityMode(m);
                      if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={({ pressed }) => [
                      styles.modeOption,
                      isSelected && { borderColor: cfg.color, backgroundColor: cfg.color + "18" },
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Ionicons name={cfg.icon as any} size={16} color={isSelected ? cfg.color : Colors.textMuted} />
                    <Text style={[styles.modeLabel, isSelected && { color: cfg.color }]}>{cfg.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.modeDesc, { color: Colors.textSecondary, marginTop: 4 }]}>
              {velocityMode === "regular" ? "Dodge obstacles for 30 seconds"
                : velocityMode === "endless" ? "Survive as long as you can"
                : "Practice dodging, no pressure"}
            </Text>
          </View>
          )}

          <View style={styles.actions}>
            {selectedGame === "clutchtap" ? (
            <>
            <Animated.View style={playButtonStyle}>
              <Pressable
                onPress={handlePlay}
                style={({ pressed }) => [styles.playBtn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
              >
                <Animated.View style={[styles.playGlow, glowStyle]} />
                <LinearGradient
                  colors={mode === "zen" ? [Colors.success, "#00C853"] : mode === "endless" ? [Colors.accent, "#5E35B1"] : [Colors.primary, "#00B8D4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playGradient}
                >
                  <Ionicons name="play" size={32} color={Colors.background} />
                  <Text style={styles.playText}>PLAY</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={handleDailyChallenge}
              style={({ pressed }) => [styles.dailyBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <LinearGradient
                colors={[Colors.warning + "30", Colors.warning + "10"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dailyGradient}
              >
                <Ionicons name="calendar" size={22} color={Colors.warning} />
                <View>
                  <Text style={styles.dailyBtnText}>DAILY CHALLENGE</Text>
                  {dailyBest > 0 && (
                    <Text style={styles.dailyBestText}>Best today: {dailyBest}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
              </LinearGradient>
            </Pressable>
            </>
            ) : (
            <Animated.View style={playButtonStyle}>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: "/velocity", params: { mode: velocityMode } });
                }}
                style={({ pressed }) => [styles.playBtn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
              >
                <Animated.View style={[styles.playGlow, { ...glowStyle, backgroundColor: Colors.accent + "40" }]} />
                <LinearGradient
                  colors={velocityMode === "zen" ? [Colors.success, "#00C853"] : velocityMode === "endless" ? [Colors.accent, "#5E35B1"] : ["#7B61FF", "#5E35B1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playGradient}
                >
                  <Ionicons name="play" size={32} color="#fff" />
                  <Text style={styles.playText}>PLAY</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
            )}

            <View style={styles.secondaryRow}>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowHowToPlay(true);
                }}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="help-circle" size={20} color={Colors.primary} />
                <Text style={styles.secondaryText}>How to Play</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSettings(true);
                }}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="settings-outline" size={20} color={Colors.primary} />
                <Text style={styles.secondaryText}>Settings</Text>
              </Pressable>
            </View>
          </View>

        </View>
      </View>

      <HowToPlayModal visible={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={(s) => {
          setSettings(s);
          import("@/lib/storage").then((mod) => mod.saveSettings(s));
        }}
        selectedTheme={selectedTheme}
        onThemeChange={async (t) => {
          setSelectedTheme(t);
          await saveTileTheme(t);
        }}
        playerLevel={levelInfo.level}
      />
      <DailyRewardModal
        visible={showReward}
        onClose={() => setShowReward(false)}
        rewardXP={rewardData.rewardXP}
        streak={rewardData.streak}
        milestoneBonus={rewardData.milestoneBonus}
        milestoneLabel={rewardData.milestoneLabel}
      />
    </LinearGradient>
  );
}

function HowToPlayModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const rules = [
    { icon: "color-palette" as const, title: "Tap the Right Color", desc: "Follow the rule at the top. When it says 'Tap BLUE', only tap blue tiles." },
    { icon: "close-circle" as const, title: "Avoid Wrong Colors", desc: "'Tap NOT RED' means tap any color except red. Think fast!" },
    { icon: "flash" as const, title: "Catch the Flash", desc: "When a tile flashes, that's your target. Tap it before it stops!" },
    { icon: "heart" as const, title: "Lives System", desc: "Each wrong tap costs a life. Lose all your lives and it's game over." },
    { icon: "timer" as const, title: "Race the Clock", desc: "Race against the clock. Rules change every few seconds and speed increases!" },
    { icon: "trending-up" as const, title: "Build Combos", desc: "Consecutive correct taps multiply your score. Keep the streak going!" },
    { icon: "calendar" as const, title: "Daily Challenge", desc: "Play the daily challenge for a unique rule set that changes every day!" },
    { icon: "star" as const, title: "Earn XP", desc: "Every game earns XP. Level up and unlock titles as you improve!" },
    { icon: "infinite" as const, title: "Endless Mode", desc: "No timer — survive as long as you can while speed ramps up!" },
    { icon: "leaf" as const, title: "Zen Mode", desc: "Relax and practice with no pressure. No timer, no score, no lives." },
    { icon: "shield" as const, title: "Power-ups", desc: "Earn Shield, Time Freeze, and 2x Points by playing. Use them in-game!" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>How to Play</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {rules.map((rule, i) => (
              <View key={i} style={styles.ruleItem}>
                <View style={styles.ruleIcon}>
                  <Ionicons name={rule.icon} size={22} color={Colors.primary} />
                </View>
                <View style={styles.ruleTextContainer}>
                  <Text style={styles.ruleTitle}>{rule.title}</Text>
                  <Text style={styles.ruleDesc}>{rule.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SettingsModal({
  visible,
  onClose,
  settings,
  onSettingsChange,
  selectedTheme,
  onThemeChange,
  playerLevel,
}: {
  visible: boolean;
  onClose: () => void;
  settings: { soundEnabled: boolean; hapticsEnabled: boolean };
  onSettingsChange: (s: { soundEnabled: boolean; hapticsEnabled: boolean }) => void;
  selectedTheme: string;
  onThemeChange: (t: string) => void;
  playerLevel: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.settingsModal, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="volume-high" size={22} color={Colors.primary} />
                <Text style={styles.settingLabel}>Sound Effects</Text>
              </View>
              <Pressable
                onPress={() => {
                  onSettingsChange({ ...settings, soundEnabled: !settings.soundEnabled });
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.toggle, settings.soundEnabled && styles.toggleOn]}
              >
                <View style={[styles.toggleKnob, settings.soundEnabled && styles.toggleKnobOn]} />
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="phone-portrait" size={22} color={Colors.primary} />
                <Text style={styles.settingLabel}>Haptic Feedback</Text>
              </View>
              <Pressable
                onPress={() => {
                  const newVal = !settings.hapticsEnabled;
                  onSettingsChange({ ...settings, hapticsEnabled: newVal });
                  if (newVal) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.toggle, settings.hapticsEnabled && styles.toggleOn]}
              >
                <View style={[styles.toggleKnob, settings.hapticsEnabled && styles.toggleKnobOn]} />
              </Pressable>
            </View>

            <Text style={styles.themeHeader}>Tile Themes</Text>
            <View style={styles.themeGrid}>
              {TILE_THEMES.map((theme) => {
                const isLocked = playerLevel < theme.unlockLevel;
                const isSelected = selectedTheme === theme.id;
                return (
                  <Pressable
                    key={theme.id}
                    onPress={() => !isLocked && onThemeChange(theme.id)}
                    style={[
                      styles.themeCard,
                      isSelected && { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
                      isLocked && { opacity: 0.5 },
                    ]}
                  >
                    <View style={styles.themeColors}>
                      {Object.values(theme.colors).slice(0, 4).map((c, i) => (
                        <View key={i} style={[styles.themeColorDot, { backgroundColor: c }]} />
                      ))}
                    </View>
                    <Text style={[styles.themeName, isSelected && { color: Colors.primary }]}>{theme.name}</Text>
                    {isLocked && (
                      <View style={styles.themeLock}>
                        <Ionicons name="lock-closed" size={10} color={Colors.textMuted} />
                        <Text style={styles.themeLockText}>Lv.{theme.unlockLevel}</Text>
                      </View>
                    )}
                    {isSelected && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} style={{ marginTop: 2 }} />}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  topBarRight: {
    flexDirection: "row",
    gap: 4,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  levelText: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
  },
  levelProgressTrack: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceLight,
    overflow: "hidden",
  },
  levelProgressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.secondaryDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.secondary + "40",
  },
  streakText: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: Colors.secondary,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  titleBlock: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  title: {
    fontSize: 48,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 4,
  },
  titleAccent: {
    fontSize: 48,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.primary,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.textSecondary,
    letterSpacing: 6,
    marginTop: 4,
  },
  levelTitle: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.accent,
    letterSpacing: 3,
    marginTop: 6,
  },
  bestScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bestScoreText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  modePicker: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  modeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modeLabel: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
  },
  modeDesc: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    marginTop: 10,
    letterSpacing: 1,
  },
  difficultyPicker: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  difficultyOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  difficultyLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
  },
  difficultyDetail: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    marginLeft: 2,
  },
  powerUpPreview: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  puBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  puBadgeText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    color: Colors.textSecondary,
  },
  gamePicker: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  gameCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  gameCardName: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  gameCardTagline: {
    fontSize: 10,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    opacity: 0.7,
  },
  actions: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 12,
  },
  playBtn: {
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  playGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: Colors.primary,
    borderRadius: 30,
  },
  playGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  playText: {
    fontSize: 22,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.background,
    letterSpacing: 4,
  },
  dailyBtn: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.warning + "40",
  },
  dailyGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  dailyBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
    letterSpacing: 2,
  },
  dailyBestText: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  settingsModal: {
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    padding: 20,
  },
  ruleItem: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
  },
  ruleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryDim,
    justifyContent: "center",
    alignItems: "center",
  },
  ruleTextContainer: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  ruleDesc: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
    color: Colors.text,
  },
  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    padding: 3,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: Colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textMuted,
  },
  toggleKnobOn: {
    backgroundColor: Colors.text,
    alignSelf: "flex-end",
  },
  themeHeader: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 2,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  themeCard: {
    width: "30%",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 4,
  },
  themeColors: {
    flexDirection: "row",
    gap: 3,
  },
  themeColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  themeName: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  themeLock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  themeLockText: {
    fontSize: 9,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
  },
  rewardModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    alignItems: "center",
  },
  rewardHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  rewardTitle: {
    fontSize: 24,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 2,
  },
  rewardStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.secondaryDim,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.secondary + "40",
    marginBottom: 16,
  },
  rewardStreakText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.secondary,
  },
  rewardDays: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  rewardDay: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 8,
    minWidth: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  rewardDayCurrent: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + "18",
  },
  rewardDayPast: {
    backgroundColor: Colors.surfaceLight,
  },
  rewardDayNum: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
  },
  rewardDayXP: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: Colors.textMuted,
  },
  rewardAmount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
    marginBottom: 12,
  },
  rewardAmountText: {
    fontSize: 24,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.accent,
  },
  milestoneBonus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warning + "18",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.warning + "40",
    marginBottom: 12,
  },
  milestoneBonusText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  rewardClaimBtn: {
    borderRadius: 16,
    overflow: "hidden",
    width: "80%",
    marginTop: 4,
  },
  rewardClaimGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  rewardClaimText: {
    fontSize: 18,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.background,
    letterSpacing: 4,
  },
});
