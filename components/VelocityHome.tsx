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
import { Ionicons } from "@expo/vector-icons";
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
import { type GameMode, MODE_CONFIGS, DAILY_REWARDS, getLevelInfo } from "@/constants/game";
import {
  getBestScore,
  getSettings,
  getTotalXP,
  getGameMode,
  saveGameMode,
  getLoginStreak,
  checkAndUpdateLoginStreak,
  saveSettings,
  getDifficulty,
  saveDifficulty,
  type VelocitySettings,
  type VelocityDifficulty,
} from "@/lib/velocity-storage";
import { trackEvent } from "@/lib/analytics";
import AmbientParticles from "@/components/AmbientParticles";
import { getVelocityTitle, getTitleColor } from "@/lib/velocity-progression";
import { getEquippedOrb, getOrbStyle, type OrbStyleId } from "@/lib/velocity-cosmetics";
import VelocityCustomizeModal from "@/components/VelocityCustomizeModal";

const VELOCITY_CYAN = Colors.accent;
const VELOCITY_PURPLE = "#7B61FF";

const DIFFICULTY_CONFIGS: Record<VelocityDifficulty, { label: string; icon: string; color: string; desc: string }> = {
  easy: { label: "Easy", icon: "leaf-outline", color: Colors.success, desc: "More time, 5 lives" },
  normal: { label: "Normal", icon: "flash-outline", color: VELOCITY_CYAN, desc: "Balanced challenge" },
  hard: { label: "Hard", icon: "skull-outline", color: Colors.secondary, desc: "Fast, 2 lives, brutal" },
};

function FloatingOrb({ delay, x, y, color, size }: { delay: number; x: number; y: number; color: string; size: number }) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(anim.value, [0, 1], [0, -20]) }],
    opacity: interpolate(anim.value, [0, 0.5, 1], [0.1, 0.18, 0.1]),
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
          borderRadius: size / 2,
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
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={[styles.modalOverlay, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom }]}>
        <Animated.View style={[styles.rewardCard, animStyle]}>
          <Text style={styles.rewardTitle}>Daily Reward</Text>
          <Text style={styles.rewardStreak}>Day {streak} streak</Text>

          <View style={styles.rewardDaysRow}>
            {DAILY_REWARDS.map((xp, i) => {
              const dayNum = i + 1;
              const currentDay = ((streak - 1) % DAILY_REWARDS.length) + 1;
              const isCurrent = dayNum === currentDay;
              const isPast = dayNum < currentDay;
              return (
                <View key={i} style={[styles.rewardDay, isCurrent && styles.rewardDayCurrent, isPast && styles.rewardDayPast]}>
                  <Text style={[styles.rewardDayNum, (isCurrent || isPast) && { color: Colors.text }]}>D{dayNum}</Text>
                  <Ionicons name="star" size={12} color={isCurrent ? Colors.warning : Colors.textMuted} />
                  <Text style={[styles.rewardDayXP, isCurrent && { color: Colors.warning }]}>{xp}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.rewardAmount}>
            <Ionicons name="star" size={26} color={VELOCITY_CYAN} />
            <Text style={[styles.rewardAmountText, { color: VELOCITY_CYAN }]}>+{rewardXP} XP</Text>
          </View>

          {milestoneBonus > 0 && (
            <View style={styles.milestoneBonus}>
              <Ionicons name="trophy" size={16} color={Colors.warning} />
              <Text style={styles.milestoneBonusText}>{milestoneLabel}: +{milestoneBonus} XP</Text>
            </View>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.rewardClaimBtn, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          >
            <LinearGradient
              colors={[VELOCITY_CYAN, VELOCITY_PURPLE]}
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

function SettingsModal({
  visible,
  onClose,
  settings,
  onSettingsChange,
}: {
  visible: boolean;
  onClose: () => void;
  settings: VelocitySettings;
  onSettingsChange: (s: VelocitySettings) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high" size={22} color={VELOCITY_CYAN} />
              <Text style={styles.settingLabel}>Sound Effects</Text>
            </View>
            <Pressable
              onPress={() => onSettingsChange({ ...settings, soundEnabled: !settings.soundEnabled })}
              style={[styles.toggle, settings.soundEnabled && styles.toggleOn]}
            >
              <View style={[styles.toggleKnob, settings.soundEnabled && styles.toggleKnobOn]} />
            </Pressable>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="phone-portrait" size={22} color={VELOCITY_CYAN} />
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
        </View>
      </View>
    </Modal>
  );
}

function HowToPlayModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const rules = [
    { icon: "arrow-forward-circle" as const, color: VELOCITY_CYAN, title: "Read the Bar", desc: "A colored bar slides in from one edge of the screen. Dodge it by swiping away." },
    { icon: "swap-horizontal" as const, color: VELOCITY_PURPLE, title: "Swipe to Dodge", desc: "If the bar comes from the TOP, swipe DOWN. From LEFT → swipe RIGHT. Simple!" },
    { icon: "flash" as const, color: Colors.warning, title: "Swipe Anywhere", desc: "You can swipe anywhere on the whole screen — no need to aim at the play area." },
    { icon: "heart" as const, color: Colors.secondary, title: "Lives System", desc: "Fail to dodge in time and you lose a life. Lose all lives and the game ends." },
    { icon: "flame" as const, color: Colors.secondary, title: "Build Combos", desc: "Consecutive successful dodges build your combo multiplier — up to 5×!" },
    { icon: "timer" as const, color: Colors.primary, title: "Regular Mode", desc: "Dodge as many bars as you can in 30 seconds. Watch out for FRENZY in the last 10!" },
    { icon: "infinite" as const, color: Colors.success, title: "Endless Mode", desc: "Survive as long as possible. Speed increases every 20 seconds — how long can you last?" },
    { icon: "leaf" as const, color: Colors.success, title: "Zen Mode", desc: "Infinite lives, no timer. Perfect for practice or just vibing." },
    { icon: "skull-outline" as const, color: Colors.secondary, title: "Difficulty", desc: "Easy (5 lives, slow), Normal (3 lives), or Hard (2 lives, brutal speed). Pick your poison." },
    { icon: "shield-outline" as const, color: "#2196F3", title: "Shield Power-up", desc: "Absorbs one missed dodge — like it never happened. Earned every 5 successful dodges." },
    { icon: "hourglass-outline" as const, color: VELOCITY_CYAN, title: "Slow-Mo Power-up", desc: "Doubles obstacle travel time for 5 seconds. Breathe easy while it's active." },
    { icon: "star" as const, color: Colors.warning, title: "Earn XP & Ranks", desc: "Every game earns XP. Get ranked S→D based on accuracy, combo, and score. S rank = 2× XP!" },
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
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
            {rules.map((rule, i) => (
              <View key={i} style={styles.ruleItem}>
                <View style={[styles.ruleIcon, { backgroundColor: rule.color + "20" }]}>
                  <Ionicons name={rule.icon} size={20} color={rule.color} />
                </View>
                <View style={styles.ruleText}>
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

export default function VelocityHome() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;

  const [bestScore, setBestScore] = useState(0);
  const [settings, setSettings] = useState<VelocitySettings>({ soundEnabled: true, hapticsEnabled: true });
  const [mode, setMode] = useState<GameMode>("regular");
  const [difficulty, setDifficulty] = useState<VelocityDifficulty>("normal");
  const [levelInfo, setLevelInfo] = useState({ level: 1, currentXP: 0, xpForNext: 100, progress: 0, title: "Beginner" });
  const [loginStreak, setLoginStreak] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [rewardData, setRewardData] = useState({ rewardXP: 0, streak: 0, milestoneBonus: 0, milestoneLabel: "" });
  const [velocityTitle, setVelocityTitle] = useState("Runner");
  const [velocityTitleColor, setVelocityTitleColor] = useState(VELOCITY_CYAN);
  const [equippedOrbId, setEquippedOrbId] = useState<OrbStyleId>("core_blue");
  const [showCustomize, setShowCustomize] = useState(false);

  const pulseAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    trackEvent("screen_viewed", { screen: "velocity_home" });
    loadData();
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const loadCosmetics = async () => {
    const orbId = await getEquippedOrb();
    setEquippedOrbId(orbId);
  };

  const loadData = async () => {
    const [score, s, xp, m, login, diff, orbId] = await Promise.all([
      getBestScore(),
      getSettings(),
      getTotalXP(),
      getGameMode(),
      getLoginStreak(),
      getDifficulty(),
      getEquippedOrb(),
    ]);
    setBestScore(score);
    setSettings(s);
    setLevelInfo(getLevelInfo(xp));
    setMode(m);
    setLoginStreak(login.streak);
    setDifficulty(diff);
    setEquippedOrbId(orbId);
    const title = getVelocityTitle(xp);
    setVelocityTitle(title);
    setVelocityTitleColor(getTitleColor(title));

    const reward = await checkAndUpdateLoginStreak();
    if (reward.isNewDay && reward.rewardXP > 0) {
      setRewardData(reward);
      setLoginStreak(reward.streak);
      setShowReward(true);
      const { getTotalXP: getXP } = await import("@/lib/velocity-storage");
      const updatedXP = await getXP();
      setLevelInfo(getLevelInfo(updatedXP));
    }
  };

  const handleModeChange = async (m: GameMode) => {
    setMode(m);
    await saveGameMode(m);
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDifficultyChange = async (d: VelocityDifficulty) => {
    setDifficulty(d);
    await saveDifficulty(d);
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePlay = () => {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/velocity", params: { mode, difficulty } });
  };

  const playButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.03]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.9, 1.1]) }],
  }));

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const modeDesc = mode === "regular"
    ? "Dodge obstacles for 30 seconds"
    : mode === "endless"
    ? "Survive as long as you can"
    : "Practice dodging, no pressure";

  const floatingOrbs = [
    { delay: 0,    x: width * 0.08, y: 100,  color: VELOCITY_CYAN,   size: 44 },
    { delay: 500,  x: width * 0.78, y: 80,   color: VELOCITY_PURPLE, size: 36 },
    { delay: 900,  x: width * 0.45, y: 220,  color: VELOCITY_CYAN,   size: 28 },
    { delay: 200,  x: width * 0.15, y: 360,  color: VELOCITY_PURPLE, size: 48 },
    { delay: 700,  x: width * 0.62, y: 410,  color: VELOCITY_CYAN,   size: 34 },
    { delay: 1100, x: width * 0.08, y: 510,  color: VELOCITY_CYAN,   size: 40 },
    { delay: 300,  x: width * 0.82, y: 570,  color: VELOCITY_PURPLE, size: 30 },
  ];

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
    >
      <AmbientParticles count={14} />
      {floatingOrbs.map((orb, i) => (
        <FloatingOrb key={i} {...orb} />
      ))}

      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          <View style={styles.topBar}>
            <View style={styles.levelBadge}>
              <Ionicons name="star" size={14} color={VELOCITY_CYAN} />
              <Text style={[styles.levelText, { color: VELOCITY_CYAN }]}>Lv.{levelInfo.level}</Text>
              <View style={styles.levelProgressTrack}>
                <View style={[styles.levelProgressFill, { width: `${levelInfo.progress * 100}%`, backgroundColor: VELOCITY_CYAN }]} />
              </View>
            </View>

            {loginStreak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: VELOCITY_PURPLE + "22", borderColor: VELOCITY_PURPLE + "40" }]}>
                <Ionicons name="flame" size={14} color={VELOCITY_PURPLE} />
                <Text style={[styles.streakText, { color: VELOCITY_PURPLE }]}>{loginStreak}</Text>
              </View>
            )}

            <View style={styles.topBarRight}>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCustomize(true);
                }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={styles.customizeBtnInner}>
                  <View style={[styles.orbPreviewDot, { backgroundColor: getOrbStyle(equippedOrbId).colors.core }]} />
                  <Ionicons name="color-palette-outline" size={20} color={Colors.textSecondary} />
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSettings(true);
                }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.center}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: VELOCITY_CYAN }]}>VELO</Text>
              <Text style={[styles.titleAccent, { color: VELOCITY_PURPLE }]}>CITY</Text>
            </View>
            <Text style={styles.subtitle}>SWIPE TO DODGE</Text>
            <Text style={[styles.levelTitle, { color: velocityTitleColor }]}>{velocityTitle.toUpperCase()}</Text>

            {bestScore > 0 && (
              <View style={styles.bestScoreContainer}>
                <Ionicons name="trophy" size={16} color={Colors.warning} />
                <Text style={styles.bestScoreText}>Best: {bestScore}</Text>
              </View>
            )}

            {/* Mode picker */}
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

            <Text style={[styles.modeDesc, { color: Colors.textSecondary, marginTop: 4 }]}>{modeDesc}</Text>

            {/* Difficulty picker */}
            {mode !== "zen" && (
              <View style={styles.difficultySection}>
                <Text style={styles.difficultyHeader}>DIFFICULTY</Text>
                <View style={styles.difficultyPicker}>
                  {(["easy", "normal", "hard"] as VelocityDifficulty[]).map((d) => {
                    const cfg = DIFFICULTY_CONFIGS[d];
                    const isSelected = difficulty === d;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => handleDifficultyChange(d)}
                        style={({ pressed }) => [
                          styles.diffOption,
                          isSelected && { borderColor: cfg.color, backgroundColor: cfg.color + "18" },
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Ionicons name={cfg.icon as any} size={15} color={isSelected ? cfg.color : Colors.textMuted} />
                        <Text style={[styles.diffLabel, isSelected && { color: cfg.color }]}>{cfg.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.diffDesc}>{DIFFICULTY_CONFIGS[difficulty].desc}</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {/* Secondary action row */}
            <View style={styles.secondaryRow}>
              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowHowToPlay(true);
                }}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="help-circle-outline" size={18} color={VELOCITY_CYAN} />
                <Text style={styles.secondaryBtnText}>How to Play</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/velocity-leaderboard");
                }}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="trophy-outline" size={18} color={VELOCITY_PURPLE} />
                <Text style={[styles.secondaryBtnText, { color: VELOCITY_PURPLE }]}>Leaderboard</Text>
              </Pressable>
            </View>

            <Animated.View style={playButtonStyle}>
              <Pressable
                onPress={handlePlay}
                style={({ pressed }) => [styles.playBtn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                testID="play-button"
              >
                <Animated.View style={[styles.playGlow, { backgroundColor: VELOCITY_CYAN + "40" }, glowStyle]} />
                <LinearGradient
                  colors={mode === "zen" ? [Colors.success, "#00C853"] : difficulty === "hard" ? [Colors.secondary, "#C62828"] : mode === "endless" ? [VELOCITY_CYAN, "#5E35B1"] : [VELOCITY_PURPLE, "#5E35B1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playGradient}
                >
                  <Ionicons name="play" size={32} color="#fff" />
                  <Text style={styles.playText}>PLAY</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>

        </View>
      </View>

      <VelocityCustomizeModal
        visible={showCustomize}
        onClose={() => {
          setShowCustomize(false);
          loadCosmetics();
        }}
      />
      <HowToPlayModal visible={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={(s) => {
          setSettings(s);
          saveSettings(s);
        }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
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
    borderRadius: 2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  streakText: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
  },
  topBarRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  customizeBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  orbPreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  titleBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 52,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: -1,
  },
  titleAccent: {
    fontSize: 52,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 4,
    marginBottom: 6,
  },
  levelTitle: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 2,
    marginBottom: 16,
  },
  bestScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.warning + "30",
    marginBottom: 20,
  },
  bestScoreText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
  },
  modePicker: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  modeOption: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modeLabel: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  modeDesc: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    marginBottom: 12,
  },
  difficultySection: {
    alignItems: "center",
    width: "100%",
    gap: 6,
  },
  difficultyHeader: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 3,
  },
  difficultyPicker: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  diffOption: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  diffLabel: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  diffDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: VELOCITY_CYAN,
    letterSpacing: 0.5,
  },
  ruleItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ruleText: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
    marginBottom: 2,
  },
  ruleDesc: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
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
    borderRadius: 30,
  },
  playGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  playText: {
    fontSize: 22,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    letterSpacing: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  rewardCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  rewardTitle: {
    fontSize: 22,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    marginBottom: 4,
  },
  rewardStreak: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    marginBottom: 16,
  },
  rewardDaysRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 16,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  rewardDay: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: 36,
  },
  rewardDayCurrent: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + "15",
  },
  rewardDayPast: {
    borderColor: Colors.border,
    opacity: 0.6,
  },
  rewardDayNum: {
    fontSize: 9,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
  },
  rewardDayXP: {
    fontSize: 9,
    fontFamily: "Outfit_700Bold",
    color: Colors.textMuted,
  },
  rewardAmount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  rewardAmountText: {
    fontSize: 32,
    fontFamily: "Outfit_800ExtraBold",
  },
  milestoneBonus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warning + "15",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    marginBottom: 8,
  },
  milestoneBonusText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  rewardClaimBtn: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  rewardClaimGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardClaimText: {
    fontSize: 16,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    letterSpacing: 2,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    width: "100%",
    position: "absolute",
    bottom: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
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
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: "Outfit_500Medium",
    color: Colors.text,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: VELOCITY_CYAN,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textMuted,
  },
  toggleKnobOn: {
    backgroundColor: "#fff",
    marginLeft: "auto" as any,
  },
});
