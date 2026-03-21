import React, { useEffect, useState, useCallback } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { trackEvent } from "@/lib/analytics";
import AmbientParticles from "@/components/AmbientParticles";
import {
  getSurgeBestScore,
  getSurgeTotalXP,
  getSurgeGameMode,
  saveSurgeGameMode,
  getSurgeSettings,
  saveSurgeSettings,
  getSurgePowerUps,
  getStreak,
  totalPowerUps,
  type SurgeGameMode,
  type SurgeSettings,
  type SurgePowerUpInventory,
  type SurgePowerUpType,
  type SurgeStreakData,
} from "@/lib/surge-storage";
import {
  getDailyChallenge,
  getDailyState,
  DAILY_MAX_ATTEMPTS,
  type DailyChallenge,
  type DailyState,
} from "@/lib/surge-daily";
import SurgePowerUpSelect from "@/components/SurgePowerUpSelect";
import { getSurgeTitle, getSurgeTitleColor, getSurgeTierXP, getNextSurgeTitle } from "@/lib/surge-progression";
import {
  getEquippedRingTheme,
  setEquippedRingTheme,
  getUnlockedRingThemes,
  getRingTheme,
  RING_THEMES,
  type RingThemeId,
} from "@/lib/surge-cosmetics";
import { useSurgeSubscription } from "@/lib/surge-subscription";
import SurgePaywallSheet from "@/components/SurgePaywallSheet";

const SURGE_PURPLE = "#7C3AED";
const SURGE_MAGENTA = "#E040FB";

function CustomizeModal({
  visible,
  onClose,
  onEquip,
}: {
  visible: boolean;
  onClose: () => void;
  onEquip: (id: RingThemeId) => void;
}) {
  const insets = useSafeAreaInsets();
  const [equipped, setEquipped] = useState<RingThemeId>("neon_purple");
  const [unlocked, setUnlocked] = useState<RingThemeId[]>(["neon_purple"]);

  useEffect(() => {
    if (visible) {
      Promise.all([getEquippedRingTheme(), getUnlockedRingThemes()]).then(([eq, unl]) => {
        setEquipped(eq);
        setUnlocked(unl);
      });
    }
  }, [visible]);

  const handleEquip = async (id: RingThemeId) => {
    if (!unlocked.includes(id)) return;
    await setEquippedRingTheme(id);
    setEquipped(id);
    onEquip(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={cs.overlay}>
        <View style={[cs.sheet, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 16 }]}>
          <View style={cs.header}>
            <Text testID="surge-customize-title" style={cs.title}>Ring Themes</Text>
            <Pressable testID="surge-customize-close" onPress={onClose} style={({ pressed }) => [cs.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView testID="surge-customize-list" showsVerticalScrollIndicator={false}>
            {RING_THEMES.map((theme) => {
              const isUnlocked = unlocked.includes(theme.id);
              const isEquipped = equipped === theme.id;
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => handleEquip(theme.id)}
                  style={({ pressed }) => [
                    cs.themeRow,
                    isEquipped && { borderColor: theme.ringColor, backgroundColor: theme.ringColor + "12" },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={[cs.ringPreview, { borderColor: theme.ringColor, shadowColor: theme.glowColor }]}>
                    <View style={[cs.ringPreviewOrb, { backgroundColor: theme.glowColor }]} />
                  </View>
                  <View style={cs.themeInfo}>
                    <Text style={[cs.themeName, { color: isEquipped ? theme.ringColor : Colors.text }]}>{theme.name}</Text>
                    <Text style={cs.themeDesc}>{isUnlocked ? theme.description : theme.unlockText}</Text>
                  </View>
                  {isEquipped ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.ringColor} />
                  ) : isUnlocked ? (
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  ) : (
                    <Ionicons name="lock-closed" size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
              );
            })}
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
  hasNoAds,
  onOpenPaywall,
}: {
  visible: boolean;
  onClose: () => void;
  settings: SurgeSettings;
  onSettingsChange: (s: SurgeSettings) => void;
  hasNoAds: boolean;
  onOpenPaywall: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={cs.overlay}>
        <View style={[cs.sheet, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 16 }]}>
          <View style={cs.header}>
            <Text style={cs.title}>Settings</Text>
            <Pressable testID="surge-settings-close" onPress={onClose} style={({ pressed }) => [cs.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <View testID="surge-settings-sound-row" style={cs.settingRow}>
            <View style={cs.settingLeft}>
              <Ionicons name="volume-high" size={22} color={SURGE_PURPLE} />
              <Text style={cs.settingLabel}>Sound Effects</Text>
            </View>
            <Pressable
              testID="surge-settings-sound-toggle"
              onPress={() => onSettingsChange({ ...settings, soundEnabled: !settings.soundEnabled })}
              style={[cs.toggle, settings.soundEnabled && cs.toggleOn]}
            >
              <View style={[cs.toggleKnob, settings.soundEnabled && cs.toggleKnobOn]} />
            </Pressable>
          </View>
          <View testID="surge-settings-haptics-row" style={cs.settingRow}>
            <View style={cs.settingLeft}>
              <Ionicons name="phone-portrait" size={22} color={SURGE_PURPLE} />
              <Text style={cs.settingLabel}>Haptic Feedback</Text>
            </View>
            <Pressable
              testID="surge-settings-haptics-toggle"
              onPress={() => {
                const v = !settings.hapticsEnabled;
                onSettingsChange({ ...settings, hapticsEnabled: v });
                if (v) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[cs.toggle, settings.hapticsEnabled && cs.toggleOn]}
            >
              <View style={[cs.toggleKnob, settings.hapticsEnabled && cs.toggleKnobOn]} />
            </Pressable>
          </View>
          {hasNoAds ? (
            <View testID="surge-settings-pro-active" style={cs.settingRow}>
              <View style={cs.settingLeft}>
                <Ionicons name="eye-off" size={22} color="#7C3AED" />
                <Text style={[cs.settingLabel, { color: "#7C3AED" }]}>Ads Removed</Text>
              </View>
              <View style={[cs.proBadgeSmall]}>
                <Text style={cs.proBadgeSmallText}>✓</Text>
              </View>
            </View>
          ) : (
            <Pressable
              testID="surge-settings-upgrade-pro"
              onPress={() => { onClose(); setTimeout(onOpenPaywall, 150); }}
              style={({ pressed }) => [cs.settingRow, cs.upgradeRow, { opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={cs.settingLeft}>
                <Ionicons name="eye-off" size={22} color="#7C3AED" />
                <Text style={[cs.settingLabel, { color: "#7C3AED" }]}>Remove Ads</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function SurgeHome() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { hasNoAds } = useSurgeSubscription();
  const [bestClassic, setBestClassic] = useState(0);
  const [bestEndless, setBestEndless] = useState(0);
  const [mode, setMode] = useState<SurgeGameMode>("classic");
  const [settings, setSettings] = useState<SurgeSettings>({ soundEnabled: true, hapticsEnabled: true });
  const [surgeTitle, setSurgeTitle] = useState("Novice");
  const [surgeTitleColor, setSurgeTitleColor] = useState("#9E9E9E");
  const [equippedThemeId, setEquippedThemeId] = useState<RingThemeId>("neon_purple");
  const [showCustomize, setShowCustomize] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPowerUpSelect, setShowPowerUpSelect] = useState(false);
  const [powerUpInventory, setPowerUpInventory] = useState<SurgePowerUpInventory>({ slow_ring: 0, extra_life: 0, double_score: 0 });
  const [powerUpTotal, setPowerUpTotal] = useState(0);
  const [bestRush, setBestRush] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [streak, setStreak] = useState<SurgeStreakData>({ current: 0, best: 0, lastPlayedDate: "" });
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [dailyState, setDailyState] = useState<DailyState | null>(null);

  const pulseAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  const theme = getRingTheme(equippedThemeId);


  useEffect(() => {
    trackEvent("screen_viewed", { screen: "surge_home" });

    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
    ring1.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
    ring2.value = withDelay(600, withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true));
    ring3.value = withDelay(1200, withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, []);

  const loadData = useCallback(async () => {
    const [bc, be, br, m, s, xp, eq, inv, sk, ds] = await Promise.all([
      getSurgeBestScore("classic"),
      getSurgeBestScore("endless"),
      getSurgeBestScore("rush"),
      getSurgeGameMode(),
      getSurgeSettings(),
      getSurgeTotalXP(),
      getEquippedRingTheme(),
      getSurgePowerUps(),
      getStreak(),
      getDailyState(),
    ]);
    setBestClassic(bc);
    setBestEndless(be);
    setBestRush(br);
    setMode(m);
    setSettings(s);
    setTotalXP(xp);
    const title = getSurgeTitle(xp);
    setSurgeTitle(title);
    setSurgeTitleColor(getSurgeTitleColor(title));
    setEquippedThemeId(eq);
    setPowerUpInventory(inv);
    setPowerUpTotal(totalPowerUps(inv));
    setStreak(sk);
    setDailyState(ds);
    setDailyChallenge(getDailyChallenge());
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const handleModeChange = async (m: SurgeGameMode) => {
    setMode(m);
    await saveSurgeGameMode(m);
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePlay = () => {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (powerUpTotal > 0) {
      setShowPowerUpSelect(true);
    } else {
      router.push({ pathname: "/surge", params: { mode } });
    }
  };

  const handlePlayDaily = () => {
    if (!dailyChallenge || !dailyState) return;
    if (dailyState.attemptsUsed >= DAILY_MAX_ATTEMPTS) return;
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const attemptNum = dailyState.attemptsUsed + 1;
    router.push({ pathname: "/surge", params: { mode: "daily", dailyAttemptNum: String(attemptNum) } });
  };

  const handlePowerUpPlay = (selectedPowerUp: SurgePowerUpType | null) => {
    setShowPowerUpSelect(false);
    const params: Record<string, string> = { mode };
    if (selectedPowerUp) params.powerUp = selectedPowerUp;
    router.push({ pathname: "/surge", params });
  };

  const playBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.04]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.9, 1.1]) }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.5, 1], [0.08, 0.22, 0.08]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.85, 1.15]) }],
    width: 120,
    height: 120,
    borderRadius: 60,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.5, 1], [0.08, 0.22, 0.08]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.85, 1.15]) }],
    width: 180,
    height: 180,
    borderRadius: 90,
  }));

  const ring3Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring3.value, [0, 0.5, 1], [0.08, 0.22, 0.08]),
    transform: [{ scale: interpolate(ring3.value, [0, 1], [0.85, 1.15]) }],
    width: 240,
    height: 240,
    borderRadius: 120,
  }));

  const bestForMode = mode === "classic" ? bestClassic : mode === "rush" ? bestRush : bestEndless;

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
    >
      <AmbientParticles count={12} />

      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.titleBadge}>
              <View style={[styles.titleDot, { backgroundColor: surgeTitleColor }]} />
              <Text style={[styles.titleText, { color: surgeTitleColor }]}>{surgeTitle.toUpperCase()}</Text>
            </View>

            <View style={styles.topBarRight}>
              {!hasNoAds && (
                <Pressable
                  testID="surge-pro-button"
                  onPress={() => { if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPaywall(true); }}
                  style={({ pressed }) => [styles.proBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="eye-off" size={14} color="#fff" />
                </Pressable>
              )}
              <Pressable
                testID="surge-theme-button"
                onPress={() => { if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCustomize(true); }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[styles.ringPreviewDot, { borderColor: theme.ringColor }]} />
                <Ionicons name="color-palette-outline" size={20} color={Colors.textSecondary} />
              </Pressable>
              <Pressable
                testID="surge-leaderboard-button"
                onPress={() => router.push("/surge-leaderboard")}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="podium-outline" size={22} color={Colors.textSecondary} />
              </Pressable>
              <Pressable
                testID="surge-settings-button"
                onPress={() => { if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSettings(true); }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Streak row */}
          {streak.current > 0 && (
            <View style={styles.streakRow}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakText}>{streak.current} day streak</Text>
            </View>
          )}

          {/* Orb visual */}
          <View style={styles.orbSection}>
            <Animated.View style={[styles.orbRing, ring3Style, { borderColor: theme.glowColor }]} />
            <Animated.View style={[styles.orbRing, ring2Style, { borderColor: theme.ringColor }]} />
            <Animated.View style={[styles.orbRing, ring1Style, { borderColor: theme.targetColor }]} />

            <Animated.View style={orbContainerStyle}>
              <Animated.View style={[styles.orbGlow, { backgroundColor: theme.glowColor + "30" }, glowStyle]} />
              <LinearGradient
                colors={[theme.ringColor, theme.glowColor]}
                style={styles.orb}
              />
            </Animated.View>

            <View style={styles.gameTitleBlock}>
              <Text style={[styles.gameTitle, { color: theme.ringColor }]}>SURGE</Text>
              <Text style={styles.gameSubtitle}>TAP WITH PRECISION</Text>
            </View>

            {bestForMode > 0 && (
              <View style={styles.bestScore}>
                <Ionicons name="trophy" size={14} color={Colors.warning} />
                <Text style={styles.bestScoreText}>
                  {mode === "classic" ? "Classic" : mode === "rush" ? "Rush" : "Endless"} Best: {bestForMode}
                </Text>
              </View>
            )}
          </View>

          {/* XP progress card */}
          {(() => {
            const tierXP = getSurgeTierXP(totalXP);
            const nextT = getNextSurgeTitle(totalXP);
            const progress = tierXP.needed > 0 ? Math.min(tierXP.current / tierXP.needed, 1) : 1;
            return (
              <View style={styles.xpCard}>
                <View style={styles.xpRow}>
                  <Text style={[styles.xpTitle, { color: surgeTitleColor }]}>{surgeTitle.toUpperCase()}</Text>
                  <Text style={styles.xpAmount}>{totalXP} XP</Text>
                </View>
                <View style={styles.xpBar}>
                  <View style={[styles.xpFill, { width: `${Math.round(progress * 100)}%` as `${number}%`, backgroundColor: surgeTitleColor }]} />
                </View>
                {nextT && (
                  <Text style={styles.xpNext}>{tierXP.current}/{tierXP.needed} → {nextT.title}</Text>
                )}
                {!nextT && (
                  <Text style={[styles.xpNext, { color: Colors.warning }]}>MAX RANK</Text>
                )}
              </View>
            );
          })()}

          {/* Mode picker */}
          <View style={styles.modePicker}>
            {([
              { id: "classic", icon: "timer-outline", label: "Classic", desc: "30 seconds" },
              { id: "endless", icon: "infinite-outline", label: "Endless", desc: "Survive" },
              { id: "rush", icon: "flash-outline", label: "Rush", desc: "Fast ramp" },
            ] as const).map(({ id: m, icon, label, desc }) => {
              const isSelected = mode === m;
              const isRush = m === "rush";
              const accentColor = isRush ? "#FF6D00" : theme.ringColor;
              return (
                <Pressable
                  key={m}
                  onPress={() => handleModeChange(m)}
                  style={({ pressed }) => [
                    styles.modeOption,
                    isSelected && {
                      borderColor: accentColor,
                      borderWidth: 2,
                      backgroundColor: accentColor + "28",
                      shadowColor: accentColor,
                      shadowOpacity: 0.35,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 6,
                    },
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons
                    name={icon as React.ComponentProps<typeof Ionicons>["name"]}
                    size={18}
                    color={isSelected ? accentColor : "rgba(255,255,255,0.55)"}
                  />
                  <Text style={[styles.modeLabel, isSelected && { color: accentColor }]}>{label}</Text>
                  <Text style={[styles.modeDesc, isSelected && { color: isRush ? "#FF6D00" : theme.glowColor }]}>{desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Daily challenge card */}
          {dailyChallenge && dailyState && (
            <Pressable
              onPress={handlePlayDaily}
              disabled={dailyState.attemptsUsed >= DAILY_MAX_ATTEMPTS}
              style={({ pressed }) => [
                styles.dailyCard,
                dailyState.attemptsUsed >= DAILY_MAX_ATTEMPTS && styles.dailyCardDone,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={styles.dailyLeft}>
                <View style={styles.dailyIconWrap}>
                  <Ionicons name="calendar" size={18} color={Colors.warning} />
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={styles.dailyLabel}>Daily Challenge</Text>
                  <Text style={styles.dailyName}>{dailyChallenge.name}</Text>
                  <Text style={styles.dailyAttemptsLabel}>
                    Attempts: {dailyState.attemptsUsed}/{DAILY_MAX_ATTEMPTS}
                  </Text>
                </View>
              </View>
              <View style={styles.dailyRight}>
                {dailyState.attemptsUsed < DAILY_MAX_ATTEMPTS ? (
                  <View style={styles.dailyPlayCta}>
                    <Text style={styles.dailyPlayCtaText}>Play Daily</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.warning} />
                  </View>
                ) : (
                  <View style={styles.dailyDoneGroup}>
                    {dailyState.bestScore > 0 && (
                      <Text style={styles.dailyBest}>{dailyState.bestScore}</Text>
                    )}
                    <View style={styles.dailyDoneBadge}>
                      <Ionicons name="checkmark" size={12} color={Colors.background} />
                      <Text style={styles.dailyDoneText}>Done</Text>
                    </View>
                    <Text style={styles.dailyDoneSubtext}>Come back tomorrow</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}

          {/* Play button */}
          <View style={styles.actions}>
            <Animated.View style={playBtnStyle}>
              <Pressable
                onPress={handlePlay}
                style={({ pressed }) => [styles.playBtn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                testID="play-button"
              >
                <Animated.View style={[styles.playGlow, { backgroundColor: theme.glowColor }, glowStyle]} />
                <LinearGradient
                  colors={[theme.ringColor, theme.glowColor]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playGradient}
                >
                  <Ionicons name="play" size={30} color={Colors.background} />
                  <Text style={styles.playText}>PLAY</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
            {powerUpTotal > 0 && (
              <Pressable onPress={() => setShowPowerUpSelect(true)} style={styles.powerUpCountBadge}>
                <Ionicons name="flash" size={13} color={Colors.warning} />
                <Text style={styles.powerUpCountText}>{powerUpTotal} Power-Up{powerUpTotal !== 1 ? "s" : ""}</Text>
              </Pressable>
            )}
          </View>

        </View>
      </View>

      <CustomizeModal
        visible={showCustomize}
        onClose={() => setShowCustomize(false)}
        onEquip={(id) => setEquippedThemeId(id)}
      />
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={(s) => { setSettings(s); saveSurgeSettings(s); }}
        hasNoAds={hasNoAds}
        onOpenPaywall={() => setShowPaywall(true)}
      />
      <SurgePaywallSheet
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => setShowPaywall(false)}
      />
      <SurgePowerUpSelect
        visible={showPowerUpSelect}
        inventory={powerUpInventory}
        onClose={() => setShowPowerUpSelect(false)}
        onPlay={handlePowerUpPlay}
      />
    </LinearGradient>
  );
}

const orbContainerStyle: {
  alignItems: "center";
  justifyContent: "center";
  position: "absolute";
} = {
  alignItems: "center",
  justifyContent: "center",
  position: "absolute",
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  titleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  titleText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 2,
  },
  proBadge: {
    backgroundColor: "#7C3AED",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  proBadgeText: {
    fontSize: 9,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    letterSpacing: 1,
  },
  proBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 4,
  },
  proBtnText: {
    fontSize: 11,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    letterSpacing: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 2,
  },
  ringPreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginRight: 2,
  },
  orbSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  orbRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  orbGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 8,
  },
  gameTitleBlock: {
    alignItems: "center",
    marginTop: 90,
  },
  gameTitle: {
    fontSize: 48,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 8,
  },
  gameSubtitle: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 3,
    marginTop: 4,
  },
  bestScore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.warning + "70",
  },
  bestScoreText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  modePicker: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  modeOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: Colors.surfaceLight,
    gap: 4,
  },
  modeLabel: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: "rgba(255,255,255,0.60)",
    letterSpacing: 0.5,
  },
  modeDesc: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: "rgba(255,255,255,0.50)",
  },
  actions: {
    alignItems: "center",
    paddingBottom: 8,
    paddingTop: 4,
  },
  playBtn: {
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    width: 180,
    height: 64,
  },
  playGlow: {
    position: "absolute",
    width: 160,
    height: 60,
    borderRadius: 30,
  },
  playGradient: {
    width: 180,
    height: 64,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  playText: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.background,
    letterSpacing: 4,
  },
  powerUpCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.warning + "40",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  powerUpCountText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "#FF6D0015",
    borderWidth: 1,
    borderColor: "#FF6D0040",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 4,
  },
  streakFire: { fontSize: 16 },
  streakText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: "#FF6D00",
  },
  streakBestBadge: {
    backgroundColor: "#FF6D00",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  streakBestText: {
    fontSize: 8,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    letterSpacing: 1,
  },
  xpCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 6,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  xpTitle: {
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 2,
  },
  xpAmount: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
  },
  xpBar: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 3,
  },
  xpNext: {
    fontSize: 10,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    textAlign: "right",
  },
  dailyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.warning + "12",
    borderWidth: 1,
    borderColor: Colors.warning + "70",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  dailyCardDone: {
    opacity: 0.6,
  },
  dailyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dailyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.warning + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  dailyLabel: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  dailyName: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
    marginTop: 1,
  },
  dailyRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  dailyAttemptsLabel: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
  },
  dailyAttempts: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  dailyPlayCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.warning + "20",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warning + "40",
  },
  dailyPlayCtaText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
  },
  dailyDoneGroup: {
    alignItems: "flex-end",
    gap: 3,
  },
  dailyDoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dailyDoneText: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    color: Colors.background,
  },
  dailyDoneSubtext: {
    fontSize: 10,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  dailyBest: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    color: Colors.textMuted,
  },
});

const cs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: Colors.card,
  },
  ringPreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  ringPreviewOrb: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
  },
  themeDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.text,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    padding: 3,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: SURGE_PURPLE,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textSecondary,
  },
  toggleKnobOn: {
    backgroundColor: Colors.text,
    transform: [{ translateX: 20 }],
  },
  upgradeRow: {
    borderBottomColor: "#7C3AED33",
  },
  proBadgeSmall: {
    backgroundColor: "#7C3AED",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeSmallText: {
    fontSize: 10,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    letterSpacing: 1,
  },
});
