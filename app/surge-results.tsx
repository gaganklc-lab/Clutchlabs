import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Share,
  Platform,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { trackEvent } from "@/lib/analytics";
import {
  addSurgeXP,
  addSurgeLeaderboardEntry,
  setSurgeBestScore,
  getSurgeTotalXP,
  getSurgeBestScore,
  earnSurgePowerUp,
  recordPlayToday,
  type SurgePowerUpType,
  type SurgeStreakData,
} from "@/lib/surge-storage";
import { recordDailyAttempt, DAILY_MAX_ATTEMPTS, DAILY_XP_MULTIPLIER, type DailyState } from "@/lib/surge-daily";

import {
  getSurgeTitle,
  getSurgeTitleColor,
  getNextSurgeTitle,
  getSurgeTierXP,
  getSurgeTitleInfo,
  type SurgeTitle,
} from "@/lib/surge-progression";
import {
  checkAndUnlockRingThemes,
  unlockProThemes,
  getRingTheme,
  type RingThemeId,
} from "@/lib/surge-cosmetics";
import AmbientParticles from "@/components/AmbientParticles";
import { useSurgeSubscription } from "@/lib/surge-subscription";
import SurgePaywallSheet from "@/components/SurgePaywallSheet";

const SURGE_PURPLE = "#7C3AED";
const SURGE_MAGENTA = "#E040FB";

const POWER_UP_TYPES: SurgePowerUpType[] = ["slow_ring", "extra_life", "double_score"];
function randomPowerUpType(): SurgePowerUpType {
  return POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
}
const POWER_UP_META: Record<SurgePowerUpType, { label: string; icon: string; color: string }> = {
  slow_ring: { label: "Slow Ring", icon: "hourglass-outline", color: "#00B0FF" },
  extra_life: { label: "Extra Life", icon: "heart", color: "#FF4081" },
  double_score: { label: "Double Score", icon: "flash", color: "#FFB300" },
};

type RankLetter = "S" | "A" | "B" | "C" | "D";
interface SurgeRankInfo {
  rank: RankLetter;
  label: string;
  color: string;
  description: string;
  xpMultiplier: number;
}

function calculateSurgeRank(score: number, perfectHits: number, totalHits: number, maxCombo: number): SurgeRankInfo {
  const accuracy = totalHits > 0 ? Math.round((perfectHits / totalHits) * 100) : 0;
  if (accuracy >= 80 && maxCombo >= 15 && score >= 200) {
    return { rank: "S", label: "FLAWLESS", color: Colors.warning, description: "Perfect timing mastery!", xpMultiplier: 2 };
  }
  if (accuracy >= 65 && score >= 120) {
    return { rank: "A", label: "SHARP", color: SURGE_MAGENTA, description: "Excellent precision!", xpMultiplier: 1.5 };
  }
  if (accuracy >= 50 && score >= 60) {
    return { rank: "B", label: "SOLID", color: SURGE_PURPLE, description: "Good timing sense", xpMultiplier: 1 };
  }
  if (accuracy >= 30) {
    return { rank: "C", label: "LEARNING", color: Colors.warning, description: "Keep practicing", xpMultiplier: 1 };
  }
  return { rank: "D", label: "ROOKIE", color: Colors.secondary, description: "You'll get there!", xpMultiplier: 1 };
}

function AnimatedScoreCounter({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const step = 16;
    const steps = duration / step;
    const increment = target / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setDisplay(target);
        clearInterval(timer);
      } else {
        setDisplay(Math.round(start));
      }
    }, step);
    return () => clearInterval(timer);
  }, [target]);

  return <Text style={rs.scoreBig}>{display.toLocaleString()}</Text>;
}

function RankDisplay({ rankInfo, delay }: { rankInfo: SurgeRankInfo; delay: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 180 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    glowScale.value = withDelay(delay + 300, withRepeat(
      withSequence(
        withTiming(1.2, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    ));
  }, []);

  const rankStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ scale: glowScale.value }], opacity: 0.3 }));

  return (
    <Animated.View testID="surge-results-rank-card" style={[rs.rankContainer, rankStyle]}>
      <Animated.View style={[rs.rankGlow, { backgroundColor: rankInfo.color }, glowStyle]} />
      <View style={[rs.rankCircle, { borderColor: rankInfo.color }]}>
        <Text testID="surge-results-rank-letter" style={[rs.rankLetter, { color: rankInfo.color }]}>{rankInfo.rank}</Text>
      </View>
      <Text testID="surge-results-rank-label" style={[rs.rankLabel, { color: rankInfo.color }]}>{rankInfo.label}</Text>
      <Text style={rs.rankDesc}>{rankInfo.description}</Text>
    </Animated.View>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(300, withSpring(0, { damping: 14 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[rs.statCard, animStyle]}>
      <Ionicons name={icon as React.ComponentProps<typeof Ionicons>["name"]} size={20} color={color} />
      <Text style={rs.statValue}>{value}</Text>
      <Text style={rs.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function UnlockCard({ newThemes }: { newThemes: RingThemeId[] }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(600, withSpring(1, { damping: 10, stiffness: 160 }));
    opacity.value = withDelay(600, withTiming(1, { duration: 400 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <Animated.View style={[rs.unlockCard, animStyle]}>
      <View style={rs.unlockHeader}>
        <Ionicons name="trophy" size={18} color={Colors.warning} />
        <Text style={rs.unlockTitle}>NEW RING THEME!</Text>
      </View>
      {newThemes.map((id) => {
        const theme = getRingTheme(id);
        return (
          <View key={id} style={rs.unlockItem}>
            <View style={[rs.unlockDot, { backgroundColor: theme.ringColor, shadowColor: theme.glowColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={rs.unlockItemName}>{theme.name}</Text>
              <Text style={rs.unlockItemSub}>New Ring Theme</Text>
            </View>
            <Ionicons name="sparkles" size={14} color={Colors.warning} />
          </View>
        );
      })}
      <Text style={rs.unlockHint}>Equip from the home screen</Text>
    </Animated.View>
  );
}

export default function SurgeResultsScreen() {
  const params = useLocalSearchParams<{
    score: string;
    maxCombo: string;
    perfectHits: string;
    totalHits: string;
    timeSurvived: string;
    mode: string;
    dailyAttemptNum: string;
  }>();

  const score = parseInt(params.score ?? "0");
  const maxCombo = parseInt(params.maxCombo ?? "0");
  const perfectHits = parseInt(params.perfectHits ?? "0");
  const totalHits = parseInt(params.totalHits ?? "0");
  const timeSurvived = parseInt(params.timeSurvived ?? "0");
  const mode = (params.mode ?? "classic") as "classic" | "endless" | "rush" | "daily";
  const dailyAttemptNum = parseInt(params.dailyAttemptNum ?? "1", 10);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { isPro, isLoading: isSubLoading } = useSurgeSubscription();
  const [xpEarned, setXpEarned] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [totalXP, setTotalXP] = useState(0);
  const [newThemes, setNewThemes] = useState<RingThemeId[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [earnedPowerUp, setEarnedPowerUp] = useState<SurgePowerUpType | null>(null);
  const [streakData, setStreakData] = useState<SurgeStreakData | null>(null);
  const [levelUpData, setLevelUpData] = useState<{ from: SurgeTitle; to: SurgeTitle } | null>(null);
  const [finalDailyState, setFinalDailyState] = useState<DailyState | null>(null);
  const processedRef = useRef(false);

  const perfectAccuracy = totalHits > 0 ? Math.round((perfectHits / totalHits) * 100) : 0;
  const rankInfo = calculateSurgeRank(score, perfectHits, totalHits, maxCombo);

  const containerOpacity = useSharedValue(0);
  const headerScale = useSharedValue(0.85);

  useEffect(() => {
    containerOpacity.value = withTiming(1, { duration: 500 });
    headerScale.value = withSpring(1, { damping: 12, stiffness: 180 });
  }, []);

  useEffect(() => {
    if (isSubLoading) return;
    if (processedRef.current) return;
    processedRef.current = true;

    const dailyMultiplier = mode === "daily" ? DAILY_XP_MULTIPLIER : 1;
    const baseXP = Math.max(15, Math.round(score / 8) + maxCombo * 2 + perfectHits);
    const proMultiplier = isPro ? 2 : 1;
    const xp = Math.round(baseXP * rankInfo.xpMultiplier * proMultiplier * dailyMultiplier);
    setXpEarned(xp);

    const process = async () => {
      const prevXP = await getSurgeTotalXP();
      const prevTitle = getSurgeTitle(prevXP);

      if (mode !== "daily") {
        const prevBest = await getSurgeBestScore(mode);
        const newPersonalBest = score > prevBest;
        if (newPersonalBest) {
          setIsNewBest(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (!isPro) {
            setTimeout(() => setShowPaywall(true), 1800);
          }
        }
        await setSurgeBestScore(score, mode);
      }

      await addSurgeXP(xp);

      const newTotal = await getSurgeTotalXP();
      setTotalXP(newTotal);

      const newTitle = getSurgeTitle(newTotal);
      if (prevTitle !== newTitle) {
        setLevelUpData({ from: prevTitle, to: newTitle });
      }

      const newStreak = await recordPlayToday(isPro);
      setStreakData(newStreak);

      if (mode === "daily") {
        const ds = await recordDailyAttempt(score);
        setFinalDailyState(ds);
      }

      const unlocks = await checkAndUnlockRingThemes({
        score,
        maxCombo,
        totalXP: newTotal,
        timeSurvived,
        mode: mode === "daily" ? "classic" : mode,
      });

      if (isPro) {
        const proUnlocks = await unlockProThemes();
        const allUnlocks = [...unlocks.newThemes, ...proUnlocks];
        if (allUnlocks.length > 0) setNewThemes(allUnlocks);
      } else {
        if (unlocks.newThemes.length > 0) {
          setNewThemes(unlocks.newThemes);
        }
        if (unlocks.hasProOnlyThemes) {
          setTimeout(() => setShowPaywall(true), 1800);
        }
      }

      if (mode !== "daily") {
        await addSurgeLeaderboardEntry(
          {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            score,
            maxCombo,
            perfectHits,
            date: new Date().toISOString(),
            rank: rankInfo.rank,
          },
          mode
        );
      }

      const earnsPowerUp = rankInfo.rank === "S" || (rankInfo.rank === "A" && isPro);
      if (earnsPowerUp) {
        const type = randomPowerUpType();
        await earnSurgePowerUp(type, 1);
        setEarnedPowerUp(type);
      }

      trackEvent("surge_results_viewed", { score, maxCombo, mode, perfectAccuracy, rank: rankInfo.rank, isPro });
    };

    process().catch((err) => console.error("[surge-results] process error:", err));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isSubLoading, isPro]);

  const handleShare = async () => {
    const text = [
      isNewBest ? "🎉 NEW PERSONAL BEST in SURGE!" : `⚡ SURGE — Rank ${rankInfo.rank} (${rankInfo.label})`,
      `🏆 Score: ${score.toLocaleString()}`,
      `🎯 Perfect Hits: ${perfectHits} · 🔥 Max Combo: ${maxCombo}x`,
      `⏱ ${timeSurvived}s · ${modeLabel} Mode`,
      "",
      `Can you beat my score of ${score}?`,
      "Download ClutchLabs and play Surge! #Surge #ClutchLabs",
    ].join("\n");
    try {
      await Share.share({ message: text });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ scale: headerScale.value }] }));
  const modeLabel = mode === "classic" ? "Classic" : mode === "rush" ? "Rush" : mode === "daily" ? "Daily" : "Endless";

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[rs.container, { paddingTop: topInset }]}
    >
      <AmbientParticles count={8} />
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 20 }}>
            <Animated.View style={[rs.content, containerStyle]}>

              <Animated.View style={[rs.header, headerStyle]}>
                <View style={rs.titleRow}>
                  <Ionicons name="radio-button-on" size={26} color={SURGE_PURPLE} />
                  <Text style={rs.titleText}>SURGE</Text>
                </View>
                <Text style={rs.subtitleText}>{modeLabel} Mode</Text>
              </Animated.View>

              {mode === "daily" && (
                <View style={rs.dailyBadge}>
                  <Ionicons name="calendar" size={14} color={Colors.warning} />
                  <Text style={rs.dailyBadgeText}>
                    DAILY CHALLENGE — Attempt {dailyAttemptNum}/{DAILY_MAX_ATTEMPTS}
                  </Text>
                </View>
              )}

              {isNewBest && (
                <View style={rs.newBestBanner}>
                  <Text style={rs.newBestText}>🎉 NEW PERSONAL BEST!</Text>
                </View>
              )}

              {levelUpData && (() => {
                const toColor = getSurgeTitleColor(levelUpData.to);
                return (
                  <View style={[rs.levelUpBanner, { borderColor: toColor + "80" }]}>
                    <Ionicons name="arrow-up-circle" size={18} color={toColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={[rs.levelUpTitle, { color: toColor }]}>LEVEL UP!</Text>
                      <Text style={rs.levelUpSub}>{levelUpData.from} → {levelUpData.to}</Text>
                    </View>
                    <Ionicons name="sparkles" size={16} color={toColor} />
                  </View>
                );
              })()}

              <View testID="surge-results-score-section" style={[rs.scoreSection, isNewBest && { borderColor: Colors.warning + "80" }]}>
                <Text style={rs.scoreLabel}>SCORE</Text>
                <AnimatedScoreCounter target={score} />
                {maxCombo >= 3 && (
                  <Text style={rs.comboHighlight}>🔥 Max Combo {maxCombo}x</Text>
                )}
              </View>

              <RankDisplay rankInfo={rankInfo} delay={400} />

              {xpEarned > 0 && (
                <View testID="surge-results-xp-badge" style={rs.xpBadge}>
                  <Ionicons name="star" size={16} color={Colors.warning} />
                  <Text testID="surge-results-xp-text" style={rs.xpText}>+{xpEarned} XP</Text>
                  {isPro && (
                    <Text style={rs.xpMultiplier}>2× Pro</Text>
                  )}
                  {!isPro && rankInfo.xpMultiplier > 1 && (
                    <Text style={rs.xpMultiplier}>{rankInfo.xpMultiplier}× bonus</Text>
                  )}
                </View>
              )}

              {streakData && streakData.current >= 2 && (
                <View style={rs.streakCard}>
                  <Text style={rs.streakFire}>🔥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={rs.streakNum}>{streakData.current} day streak!</Text>
                    {streakData.best > streakData.current && (
                      <Text style={rs.streakBest}>Best: {streakData.best} days</Text>
                    )}
                    {streakData.best === streakData.current && streakData.current > 1 && (
                      <Text style={rs.streakBest}>New record!</Text>
                    )}
                  </View>
                  {streakData.current >= 7 && (
                    <Ionicons name="trophy" size={16} color="#FF6D00" />
                  )}
                </View>
              )}

              {earnedPowerUp && (() => {
                const meta = POWER_UP_META[earnedPowerUp];
                return (
                  <View style={rs.powerUpRewardCard}>
                    <View style={[rs.powerUpRewardIcon, { backgroundColor: meta.color + "20" }]}>
                      <Ionicons name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]} size={20} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[rs.powerUpRewardTitle, { color: meta.color }]}>Power-Up Earned!</Text>
                      <Text style={rs.powerUpRewardLabel}>{meta.label}</Text>
                    </View>
                    <Ionicons name="sparkles" size={16} color={meta.color} />
                  </View>
                );
              })()}

              {newThemes.length > 0 && <UnlockCard newThemes={newThemes} />}

              {totalXP > 0 && (() => {
                const title = getSurgeTitle(totalXP);
                const color = getSurgeTitleColor(title);
                const info = getSurgeTitleInfo(title);
                const nextT = getNextSurgeTitle(totalXP);
                const tierXP = getSurgeTierXP(totalXP);
                const progress = tierXP.needed > 0 ? tierXP.current / tierXP.needed : 1;
                return (
                  <View style={rs.titleSection}>
                    <Text style={[rs.playerTitle, { color }]}>{title.toUpperCase()}</Text>
                    <Text style={rs.titleDesc}>{info.description}</Text>
                    {nextT && (
                      <View style={rs.progressRow}>
                        <View style={rs.progressBar}>
                          <View style={[rs.progressFill, { width: `${Math.min(progress * 100, 100)}%` as `${number}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={rs.progressLabel}>{tierXP.current}/{tierXP.needed} XP → {nextT.title}</Text>
                      </View>
                    )}
                    {!nextT && <Text style={[rs.progressLabel, { color: Colors.warning }]}>MAX RANK ACHIEVED</Text>}
                  </View>
                );
              })()}

              <View style={rs.statsGrid}>
                <StatCard label="Perfect" value={`${perfectHits}`} icon="checkmark-circle" color={Colors.warning} />
                <StatCard label="Accuracy" value={`${perfectAccuracy}%`} icon="radio-button-on" color={SURGE_PURPLE} />
                <StatCard label="Max Combo" value={`${maxCombo}x`} icon="flame" color={Colors.secondary} />
                <StatCard label="Time" value={`${timeSurvived}s`} icon="timer" color={Colors.primary} />
              </View>

              <View testID="surge-results-buttons" style={rs.buttonStack}>
                <Pressable
                  testID="surge-results-play-again"
                  onPress={() => router.replace({ pathname: "/surge", params: { mode } })}
                  style={({ pressed }) => [rs.primaryBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <LinearGradient colors={[SURGE_PURPLE, SURGE_MAGENTA]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={rs.primaryGradient}>
                    <Ionicons name="refresh" size={22} color={Colors.text} />
                    <Text style={rs.primaryBtnText}>PLAY AGAIN</Text>
                  </LinearGradient>
                </Pressable>

                <View style={rs.secondaryRow}>
                  <Pressable
                    testID="surge-results-home"
                    onPress={() => router.replace("/")}
                    style={({ pressed }) => [rs.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="home-outline" size={20} color={SURGE_PURPLE} />
                    <Text style={[rs.secondaryBtnText, { color: SURGE_PURPLE }]}>Home</Text>
                  </Pressable>
                  <Pressable
                    testID="surge-results-share"
                    onPress={handleShare}
                    style={({ pressed }) => [rs.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="share-social-outline" size={20} color={SURGE_MAGENTA} />
                    <Text style={[rs.secondaryBtnText, { color: SURGE_MAGENTA }]}>Share</Text>
                  </Pressable>
                  <Pressable
                    testID="surge-results-scores"
                    onPress={() => router.push("/surge-leaderboard")}
                    style={({ pressed }) => [rs.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="podium-outline" size={20} color={Colors.warning} />
                    <Text style={[rs.secondaryBtnText, { color: Colors.warning }]}>Scores</Text>
                  </Pressable>
                </View>
              </View>

            </Animated.View>
          </ScrollView>
        </View>
      </View>
      <SurgePaywallSheet
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </LinearGradient>
  );
}

const rs = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 8 },
  header: { alignItems: "center", paddingVertical: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleText: { fontSize: 28, fontFamily: "Outfit_800ExtraBold", color: Colors.text, letterSpacing: 6 },
  subtitleText: { fontSize: 13, fontFamily: "Outfit_500Medium", color: Colors.textMuted, letterSpacing: 2, marginTop: 4 },
  newBestBanner: {
    backgroundColor: Colors.warning + "18",
    borderWidth: 1,
    borderColor: Colors.warning + "60",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  newBestText: { fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: Colors.warning, letterSpacing: 1 },
  scoreSection: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreLabel: { fontSize: 12, fontFamily: "Outfit_600SemiBold", color: Colors.textMuted, letterSpacing: 3, marginBottom: 4 },
  scoreBig: { fontSize: 56, fontFamily: "Outfit_800ExtraBold", color: Colors.text, letterSpacing: -2 },
  comboHighlight: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: Colors.secondary, marginTop: 4 },
  rankContainer: { alignItems: "center", marginBottom: 16 },
  rankGlow: { position: "absolute", width: 100, height: 100, borderRadius: 50 },
  rankCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  rankLetter: { fontSize: 36, fontFamily: "Outfit_800ExtraBold" },
  rankLabel: { fontSize: 14, fontFamily: "Outfit_700Bold", letterSpacing: 3, marginTop: 8 },
  rankDesc: { fontSize: 12, fontFamily: "Outfit_400Regular", color: Colors.textMuted, marginTop: 2 },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warning + "18",
    borderWidth: 1,
    borderColor: Colors.warning + "40",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "center",
    marginBottom: 12,
  },
  xpText: { fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: Colors.warning },
  xpMultiplier: { fontSize: 12, fontFamily: "Outfit_600SemiBold", color: Colors.warning, opacity: 0.7 },
  unlockCard: {
    backgroundColor: Colors.warning + "10",
    borderWidth: 1,
    borderColor: Colors.warning + "40",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  unlockHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  unlockTitle: { fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: Colors.warning, letterSpacing: 2 },
  unlockItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  unlockDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  unlockItemName: { fontSize: 14, fontFamily: "Outfit_700Bold", color: Colors.text },
  unlockItemSub: { fontSize: 11, fontFamily: "Outfit_400Regular", color: Colors.textMuted },
  unlockHint: { fontSize: 11, fontFamily: "Outfit_400Regular", color: Colors.textMuted, marginTop: 6, textAlign: "center" },
  titleSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  playerTitle: { fontSize: 20, fontFamily: "Outfit_800ExtraBold", letterSpacing: 3, marginBottom: 4 },
  titleDesc: { fontSize: 12, fontFamily: "Outfit_400Regular", color: Colors.textMuted, marginBottom: 10 },
  progressRow: { width: "100%", gap: 6 },
  progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 11, fontFamily: "Outfit_500Medium", color: Colors.textMuted, textAlign: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: 22, fontFamily: "Outfit_800ExtraBold", color: Colors.text },
  statLabel: { fontSize: 11, fontFamily: "Outfit_500Medium", color: Colors.textMuted, letterSpacing: 1 },
  buttonStack: { gap: 12 },
  primaryBtn: { borderRadius: 18, overflow: "hidden" },
  primaryGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  primaryBtnText: { fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: Colors.text, letterSpacing: 3 },
  secondaryRow: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: { fontSize: 13, fontFamily: "Outfit_700Bold" },
  powerUpRewardCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  powerUpRewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  powerUpRewardTitle: {
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 1,
  },
  powerUpRewardLabel: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
    marginTop: 1,
  },
  dailyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warning + "18",
    borderWidth: 1,
    borderColor: Colors.warning + "60",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: "center",
    marginBottom: 10,
  },
  dailyBadgeText: {
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.warning,
    letterSpacing: 1,
  },
  levelUpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  levelUpTitle: {
    fontSize: 13,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 2,
  },
  levelUpSub: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    marginTop: 1,
  },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FF6D0018",
    borderWidth: 1,
    borderColor: "#FF6D0050",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  streakFire: { fontSize: 24 },
  streakNum: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: "#FF6D00",
  },
  streakBest: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    marginTop: 1,
  },
});
