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
  addXP,
  addLeaderboardEntry,
  updateGameStats,
  getBestScore,
  getTotalXP,
} from "@/lib/velocity-storage";
import {
  getVelocityTitle,
  getTitleColor,
  getNextTitle,
  getCurrentTierXP,
  getTitleInfo,
} from "@/lib/velocity-progression";
import {
  checkAndUnlockCosmetics,
  getOrbStyle,
  getTrailStyle,
  type OrbStyleId,
  type TrailStyleId,
} from "@/lib/velocity-cosmetics";
import AmbientParticles from "@/components/AmbientParticles";

const VELOCITY_CYAN = Colors.accent;
const VELOCITY_PURPLE = "#7B61FF";

type RankLetter = "S" | "A" | "B" | "C" | "D";

interface RankInfo {
  rank: RankLetter;
  label: string;
  color: string;
  description: string;
  xpMultiplier: number;
}

function calculateVelocityRank(score: number, accuracy: number, maxCombo: number, isZen: boolean): RankInfo {
  if (isZen) {
    return { rank: "S", label: "ZEN", color: Colors.success, description: "Practice complete!", xpMultiplier: 1 };
  }
  if (accuracy >= 90 && maxCombo >= 10 && score >= 150) {
    return { rank: "S", label: "FLAWLESS", color: "#FFD700", description: "Near-perfect dodging!", xpMultiplier: 2 };
  }
  if (accuracy >= 75 && score >= 80) {
    return { rank: "A", label: "SHARP", color: Colors.accent, description: "Excellent reactions!", xpMultiplier: 1.5 };
  }
  if (accuracy >= 60 && score >= 40) {
    return { rank: "B", label: "SOLID", color: VELOCITY_PURPLE, description: "Good performance", xpMultiplier: 1 };
  }
  if (accuracy >= 40) {
    return { rank: "C", label: "DECENT", color: Colors.warning, description: "Keep practicing", xpMultiplier: 1 };
  }
  return { rank: "D", label: "LEARNING", color: Colors.secondary, description: "You'll get there!", xpMultiplier: 1 };
}

function RankDisplay({ rankInfo, delay }: { rankInfo: RankInfo; delay: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 180 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    glowScale.value = withDelay(
      delay + 300,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const rankStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: 0.3,
  }));

  return (
    <Animated.View style={[rs.rankContainer, rankStyle]}>
      <Animated.View style={[rs.rankGlow, { backgroundColor: rankInfo.color }, glowStyle]} />
      <View style={[rs.rankCircle, { borderColor: rankInfo.color }]}>
        <Text style={[rs.rankLetter, { color: rankInfo.color }]}>{rankInfo.rank}</Text>
      </View>
      <Text style={[rs.rankLabel, { color: rankInfo.color }]}>{rankInfo.label}</Text>
      <Text style={rs.rankDesc}>{rankInfo.description}</Text>
    </Animated.View>
  );
}

function NewBestBanner() {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 300 });
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  return (
    <Animated.View style={[rs.newBestBanner, bannerStyle]}>
      <Animated.Text style={[rs.newBestText, shimmerStyle]}>🎉 NEW PERSONAL BEST!</Animated.Text>
    </Animated.View>
  );
}

function AnimatedScoreCounter({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1400;
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

  return (
    <Text style={rs.scoreBig}>{display.toLocaleString()}</Text>
  );
}

function UnlockRewardCard({ unlocks }: { unlocks: { orbs: OrbStyleId[]; trails: TrailStyleId[] } }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(600, withSpring(1, { damping: 10, stiffness: 160 }));
    opacity.value = withDelay(600, withTiming(1, { duration: 400 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[rs.unlockCard, animStyle]}>
      <View style={rs.unlockHeader}>
        <Ionicons name="trophy" size={18} color={Colors.warning} />
        <Text style={rs.unlockTitle}>NEW UNLOCK!</Text>
      </View>
      {unlocks.orbs.map((id) => {
        const orb = getOrbStyle(id);
        return (
          <View key={id} style={rs.unlockItem}>
            <View style={[rs.unlockColorDot, { backgroundColor: orb.colors.core, shadowColor: orb.colors.core }]} />
            <View style={rs.unlockItemInfo}>
              <Text style={rs.unlockItemName}>{orb.name}</Text>
              <Text style={rs.unlockItemType}>New Orb Style</Text>
            </View>
            <Ionicons name="sparkles" size={14} color={Colors.warning} />
          </View>
        );
      })}
      {unlocks.trails.map((id) => {
        const trail = getTrailStyle(id);
        return (
          <View key={id} style={rs.unlockItem}>
            <View style={[rs.unlockColorDot, { backgroundColor: trail.color, shadowColor: trail.color }]} />
            <View style={rs.unlockItemInfo}>
              <Text style={rs.unlockItemName}>{trail.name}</Text>
              <Text style={rs.unlockItemType}>New Trail Style</Text>
            </View>
            <Ionicons name="sparkles" size={14} color={Colors.warning} />
          </View>
        );
      })}
      <Text style={rs.unlockHint}>Equip from the Customize menu</Text>
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

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[rs.statCard, animStyle]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={rs.statValue}>{value}</Text>
      <Text style={rs.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function VelocityResultsScreen() {
  const params = useLocalSearchParams<{
    score: string;
    maxCombo: string;
    mistakes: string;
    totalDodges: string;
    timeSurvived: string;
    speedLevel: string;
    mode: string;
    difficulty: string;
  }>();

  const score = parseInt(params.score ?? "0");
  const maxCombo = parseInt(params.maxCombo ?? "0");
  const mistakes = parseInt(params.mistakes ?? "0");
  const totalDodges = parseInt(params.totalDodges ?? "0");
  const timeSurvived = parseInt(params.timeSurvived ?? "0");
  const speedLevel = parseInt(params.speedLevel ?? "0");
  const mode = params.mode ?? "regular";
  const difficulty = params.difficulty ?? "normal";

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [xpEarned, setXpEarned] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [totalXP, setTotalXP] = useState(0);
  const [newUnlocks, setNewUnlocks] = useState<{ orbs: OrbStyleId[]; trails: TrailStyleId[] }>({ orbs: [], trails: [] });
  const processedRef = useRef(false);

  const isZen = mode === "zen";
  const accuracy = totalDodges + mistakes > 0
    ? Math.round((totalDodges / (totalDodges + mistakes)) * 100)
    : 100;

  const rankInfo = calculateVelocityRank(score, accuracy, maxCombo, isZen);

  const containerOpacity = useSharedValue(0);
  const headerScale = useSharedValue(0.85);

  useEffect(() => {
    containerOpacity.value = withTiming(1, { duration: 500 });
    headerScale.value = withSpring(1, { damping: 12, stiffness: 180 });
  }, []);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const baseXP = Math.max(20, Math.round(score / 10) + maxCombo * 2);
    const xp = Math.round(baseXP * rankInfo.xpMultiplier);
    setXpEarned(xp);

    const process = async () => {
      const prevBest = await getBestScore();
      if (mode !== "zen" && score > prevBest) {
        setIsNewBest(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await addXP(xp);
      await updateGameStats(score, accuracy, difficulty, mode as any, timeSurvived);

      const newTotal = await getTotalXP();
      setTotalXP(newTotal);

      const unlocks = await checkAndUnlockCosmetics({ score, maxCombo, totalXP: newTotal, speedLevel, mode });
      if (unlocks.newOrbs.length > 0 || unlocks.newTrails.length > 0) {
        setNewUnlocks(unlocks);
      }

      if (mode !== "zen") {
        await addLeaderboardEntry({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          score,
          combo: maxCombo,
          avgReaction: 0,
          date: new Date().toISOString(),
          rank: rankInfo.rank,
        });
      }

      trackEvent("velocity_results_viewed", { score, maxCombo, mode, accuracy, rank: rankInfo.rank });
    };

    process().catch(err => console.error("[velocity-results] process error:", err));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleShare = async () => {
    const modeLabel = mode === "regular" ? "Regular" : mode === "endless" ? "Endless" : "Zen";
    const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    const challengePrefix = isNewBest
      ? "🎉 NEW PERSONAL BEST in VELOCITY!"
      : `⚡ VELOCITY — Rank ${rankInfo.rank} (${rankInfo.label})`;
    const text = [
      challengePrefix,
      `🏆 Score: ${score.toLocaleString()}`,
      `🔥 Max Combo: ${maxCombo}x · 🎯 Accuracy: ${accuracy}%`,
      `⏱ ${timeSurvived}s survived · ${modeLabel} ${diffLabel}`,
      "",
      `🎮 I scored ${score} — think you can beat me?`,
      "Download ClutchLabs and play Velocity! #Velocity #ClutchLabs",
    ].join("\n");

    try {
      await Share.share({ message: text });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleChallengeShare = async () => {
    const modeLabel = mode === "regular" ? "Regular" : mode === "endless" ? "Endless" : "Zen";
    const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    const text = [
      `🏆 CHALLENGE: Beat my ${score.toLocaleString()} in Velocity!`,
      `Mode: ${modeLabel} · Difficulty: ${diffLabel}`,
      `My rank: ${rankInfo.rank} (${rankInfo.label}) with ${maxCombo}x combo`,
      "",
      "Download ClutchLabs → play Velocity → beat me. I dare you 😤",
      "#Velocity #ClutchLabs #SwipeToDodge",
    ].join("\n");

    try {
      await Share.share({ message: text });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
  }));

  const modeLabel = mode === "regular" ? "Regular" : mode === "endless" ? "Endless" : "Zen";
  const diffLabel = difficulty !== "normal" ? ` · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}` : "";

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[rs.container, { paddingTop: topInset }]}
    >
      <AmbientParticles count={10} />

      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
          >
            <Animated.View style={[rs.content, containerStyle]}>

              {/* Header */}
              <Animated.View style={[rs.header, headerStyle]}>
                <View style={rs.titleRow}>
                  <Ionicons name="speedometer" size={28} color={VELOCITY_CYAN} />
                  <Text style={rs.titleText}>VELOCITY</Text>
                </View>
                <Text style={rs.subtitleText}>{modeLabel}{diffLabel} Mode</Text>
              </Animated.View>

              {/* New personal best banner */}
              {isNewBest && (
                <NewBestBanner />
              )}

              {/* Score */}
              <View style={[rs.scoreSection, isNewBest && { borderColor: Colors.warning + "80" }]}>
                <Text style={rs.scoreLabel}>SCORE</Text>
                <AnimatedScoreCounter target={score} />
                {maxCombo >= 3 && (
                  <Text style={rs.comboHighlight}>🔥 Max Combo {maxCombo}x</Text>
                )}
              </View>

              {/* Rank */}
              <RankDisplay rankInfo={rankInfo} delay={400} />

              {/* XP Badge */}
              {xpEarned > 0 && (
                <View style={rs.xpBadge}>
                  <Ionicons name="star" size={16} color={Colors.warning} />
                  <Text style={rs.xpText}>+{xpEarned} XP</Text>
                  {rankInfo.xpMultiplier > 1 && (
                    <Text style={rs.xpMultiplier}>{rankInfo.xpMultiplier}× bonus</Text>
                  )}
                </View>
              )}

              {/* Unlock reward card */}
              {(newUnlocks.orbs.length > 0 || newUnlocks.trails.length > 0) && (
                <UnlockRewardCard unlocks={newUnlocks} />
              )}

              {/* Title progression */}
              {totalXP > 0 && (() => {
                const title = getVelocityTitle(totalXP);
                const titleColor = getTitleColor(title);
                const nextT = getNextTitle(totalXP);
                const tierXP = getCurrentTierXP(totalXP);
                const progress = tierXP.needed > 0 ? tierXP.current / tierXP.needed : 1;
                return (
                  <View style={rs.titleSection}>
                    <Text style={[rs.playerTitle, { color: titleColor }]}>{title.toUpperCase()}</Text>
                    <Text style={rs.titleDesc}>{getTitleInfo(title).description}</Text>
                    {nextT && (
                      <View style={rs.progressRow}>
                        <View style={rs.progressBar}>
                          <View style={[rs.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any, backgroundColor: titleColor }]} />
                        </View>
                        <Text style={rs.progressLabel}>{tierXP.current}/{tierXP.needed} XP → {nextT.title}</Text>
                      </View>
                    )}
                    {!nextT && (
                      <Text style={[rs.progressLabel, { color: "#FFD700" }]}>MAX RANK ACHIEVED</Text>
                    )}
                  </View>
                );
              })()}

              {/* Stat cards */}
              <View style={rs.statsGrid}>
                <StatCard label="Max Combo" value={`${maxCombo}x`} icon="flame" color={Colors.secondary} />
                <StatCard label="Accuracy" value={`${accuracy}%`} icon="checkmark-circle" color={Colors.success} />
                <StatCard label="Time" value={`${timeSurvived}s`} icon="timer" color={Colors.primary} />
                <StatCard label="Dodges" value={`${totalDodges}`} icon="shield-checkmark" color={VELOCITY_CYAN} />
              </View>

              {/* Buttons */}
              <View style={rs.buttonStack}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.replace({ pathname: "/velocity", params: { mode, difficulty } });
                  }}
                  style={({ pressed }) => [rs.primaryBtn, { transform: [{ scale: pressed ? 0.96 : 1 }], opacity: 1 }]}
                >
                  <LinearGradient
                    colors={["#00E5FF", "#0072FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={rs.primaryBtnInner}
                  >
                    <Ionicons name="play" size={22} color="#fff" />
                    <Text style={rs.primaryBtnText}>PLAY AGAIN</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={handleChallengeShare}
                  style={({ pressed }) => [rs.challengeBtn, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <LinearGradient
                    colors={[Colors.secondary, "#C62828"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={rs.challengeBtnInner}
                  >
                    <Ionicons name="people" size={20} color="#fff" />
                    <Text style={rs.challengeBtnText}>Challenge a Friend</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [rs.secondaryBtn, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Ionicons name="share-social-outline" size={20} color={VELOCITY_CYAN} />
                  <Text style={[rs.secondaryBtnText, { color: VELOCITY_CYAN }]}>Share Score</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.replace("/");
                  }}
                  style={({ pressed }) => [rs.homeBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="home-outline" size={20} color={Colors.textSecondary} />
                  <Text style={rs.homeBtnText}>Home</Text>
                </Pressable>
              </View>

            </Animated.View>
          </ScrollView>

        </View>
      </View>
    </LinearGradient>
  );
}

const rs = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    gap: 20,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleText: {
    fontSize: 34,
    fontFamily: "Outfit_800ExtraBold",
    color: VELOCITY_CYAN,
    letterSpacing: 4,
  },
  subtitleText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  scoreSection: {
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: VELOCITY_CYAN + "40",
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 3,
  },
  scoreBig: {
    fontSize: 56,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    lineHeight: 64,
  },
  comboHighlight: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.secondary,
    marginTop: 2,
  },
  rankContainer: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  rankGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    top: -15,
  },
  rankCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  rankLetter: {
    fontSize: 48,
    fontFamily: "Outfit_800ExtraBold",
    lineHeight: 56,
  },
  rankLabel: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 4,
  },
  rankDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
  },
  titleSection: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerTitle: {
    fontSize: 24,
    fontFamily: "Outfit_800ExtraBold",
    letterSpacing: 5,
  },
  titleDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  progressRow: {
    alignSelf: "stretch",
    gap: 4,
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    backgroundColor: Colors.warning + "20",
    borderColor: Colors.warning + "50",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  xpText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
  },
  xpMultiplier: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning + "BB",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  buttonStack: {
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  primaryBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: VELOCITY_CYAN + "60",
    backgroundColor: VELOCITY_CYAN + "10",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  homeBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.textSecondary,
  },
  newBestBanner: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.warning + "20",
    borderWidth: 1.5,
    borderColor: Colors.warning + "80",
    alignItems: "center",
    marginBottom: 4,
  },
  newBestText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
    letterSpacing: 1,
  },
  challengeBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  challengeBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  unlockCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.warning + "70",
    padding: 16,
    gap: 10,
  },
  unlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unlockTitle: {
    fontSize: 14,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.warning,
    letterSpacing: 3,
  },
  unlockItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  unlockColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  unlockItemInfo: {
    flex: 1,
  },
  unlockItemName: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  unlockItemType: {
    fontSize: 10,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  unlockHint: {
    fontSize: 10,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  challengeBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
