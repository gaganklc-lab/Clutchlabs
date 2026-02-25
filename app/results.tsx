import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Share,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  getBestScore,
  setBestScore,
  addLeaderboardEntry,
  updateBadgeStats,
  getBadgeStats,
  getUnlockedBadges,
  unlockBadge,
  updateStreakOnGameEnd,
  getSettings,
  addXP,
  setDailyBest,
  setEndlessBest,
  updateGameStats,
  earnPowerUp,
  getTotalXP,
} from "@/lib/storage";
import {
  BADGES,
  DIFFICULTY_CONFIGS,
  MODE_CONFIGS,
  calculateRank,
  calculateXPEarned,
  getLevelInfo,
  type BadgeStats,
  type Difficulty,
  type GameMode,
  type RankInfo,
} from "@/constants/game";
import { trackEvent } from "@/lib/analytics";
import { soundManager } from "@/lib/sounds";
import Confetti from "@/components/Confetti";
import AmbientParticles from "@/components/AmbientParticles";

function AnimatedScoreCounter({ target, duration }: { target: number; duration: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let frame: ReturnType<typeof requestAnimationFrame> | null = null;
    const startTime = Date.now() + 400;

    const tick = () => {
      if (!mountedRef.current) return;
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayValue(Math.round(target * eased));
      if (p < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      mountedRef.current = false;
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  return <Text style={styles.scoreValue}>{displayValue}</Text>;
}

function AnimatedStat({
  label,
  value,
  icon,
  color,
  delay,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 12 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.statCard, animStyle]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function RankDisplay({ rankInfo, delay }: { rankInfo: RankInfo; delay: number }) {
  const scale = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSequence(
      withSpring(1.3, { damping: 6, stiffness: 180 }),
      withSpring(1, { damping: 10 })
    ));
    glow.value = withDelay(delay + 300, withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
  }, []);

  const rankStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.8]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.95, 1.1]) }],
  }));

  return (
    <Animated.View style={[styles.rankContainer, rankStyle]}>
      <Animated.View style={[styles.rankGlow, { backgroundColor: rankInfo.color }, glowStyle]} />
      <View style={[styles.rankCircle, { borderColor: rankInfo.color }]}>
        <Text style={[styles.rankLetter, { color: rankInfo.color }]}>{rankInfo.rank}</Text>
      </View>
      <Text style={[styles.rankLabel, { color: rankInfo.color }]}>{rankInfo.label}</Text>
      <Text style={styles.rankDesc}>{rankInfo.description}</Text>
    </Animated.View>
  );
}

function NewBestBanner() {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.7, 1]),
    transform: [{ scale: interpolate(shimmer.value, [0, 1], [1, 1.05]) }],
  }));

  return (
    <Animated.View style={shimmerStyle}>
      <LinearGradient
        colors={[Colors.warning, "#FFB300", "#FF8F00"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.newBestBadge}
      >
        <Ionicons name="trophy" size={18} color={Colors.background} />
        <Text style={styles.newBestText}>NEW BEST SCORE!</Text>
        <Ionicons name="trophy" size={18} color={Colors.background} />
      </LinearGradient>
    </Animated.View>
  );
}

function XPGainBar({ xpEarned, delay }: { xpEarned: number; delay: number }) {
  const width = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    width.value = withDelay(delay + 200, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <Animated.View style={[styles.xpContainer, barStyle]}>
      <View style={styles.xpRow}>
        <Ionicons name="star" size={16} color={Colors.accent} />
        <Text style={styles.xpText}>+{xpEarned} XP</Text>
      </View>
    </Animated.View>
  );
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    score: string;
    maxCombo: string;
    avgReaction: string;
    correctTaps: string;
    mistakes: string;
    livesLeft: string;
    difficulty: string;
    daily: string;
    mode: string;
    elapsed: string;
  }>();

  const score = parseInt(params.score || "0");
  const maxCombo = parseInt(params.maxCombo || "0");
  const avgReaction = parseInt(params.avgReaction || "0");
  const correctTaps = parseInt(params.correctTaps || "0");
  const mistakes = parseInt(params.mistakes || "0");
  const livesLeft = parseInt(params.livesLeft || "0");
  const difficulty = (params.difficulty as Difficulty) || "normal";
  const isDaily = params.daily === "true";
  const mode = (params.mode as GameMode) || "regular";
  const elapsed = parseInt(params.elapsed || "0");
  const diffConfig = DIFFICULTY_CONFIGS[difficulty];
  const isZen = mode === "zen";

  const accuracy = correctTaps + mistakes > 0
    ? Math.round((correctTaps / (correctTaps + mistakes)) * 100)
    : 0;

  const rankInfo = isZen ? { rank: "S" as const, label: "ZEN", color: Colors.success, description: "Practice complete!" } : calculateRank(score, accuracy, maxCombo, difficulty);
  const xpEarned = isZen ? Math.round(correctTaps * 0.5) : calculateXPEarned(score, accuracy, rankInfo.rank);

  const [isNewBest, setIsNewBest] = useState(false);
  const [bestScore, setBest] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [settings, setSettings] = useState({ soundEnabled: true, hapticsEnabled: true });
  const [showConfetti, setShowConfetti] = useState(false);

  const titleScale = useSharedValue(0);
  const scoreScale = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
    opacity: titleScale.value,
  }));

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: scoreScale.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  useEffect(() => {
    trackEvent("screen_viewed", { screen: "results" });
    processResults();

    titleScale.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 200 }));
    scoreScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 150 }));
    buttonsOpacity.value = withDelay(1200, withTiming(1, { duration: 400 }));
  }, []);

  const processResults = async () => {
    const s = await getSettings();
    setSettings(s);
    soundManager.setEnabled(s.soundEnabled);

    if (!isZen) {
      const currentBest = await getBestScore();
      setBest(currentBest);

      if (score > currentBest) {
        setIsNewBest(true);
        await setBestScore(score);
        setBest(score);
        setShowConfetti(true);
        soundManager.play("newBest");
        if (s.hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }

      if (mode === "endless") {
        await setEndlessBest(score);
      }
    }

    if (isDaily) {
      await setDailyBest(score);
    }

    await addXP(xpEarned);
    await updateGameStats(score, accuracy, difficulty, mode, elapsed);

    if (!isZen) {
      const entryId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      await addLeaderboardEntry({
        id: entryId,
        score,
        combo: maxCombo,
        avgReaction,
        date: new Date().toISOString(),
      });
    }

    const streakResult = await updateStreakOnGameEnd();

    const prevStats = await getBadgeStats();
    const newTotal = prevStats.totalGames + 1;
    const updatedStats: BadgeStats = {
      totalGames: newTotal,
      bestScore: Math.max(prevStats.bestScore, score),
      totalScore: prevStats.totalScore + score,
      bestCombo: Math.max(prevStats.bestCombo, maxCombo),
      perfectRounds: mistakes === 0 && !isZen ? prevStats.perfectRounds + 1 : prevStats.perfectRounds,
      fastestReaction:
        avgReaction > 0 && (prevStats.fastestReaction === 0 || avgReaction < prevStats.fastestReaction)
          ? avgReaction
          : prevStats.fastestReaction,
      gamesWithoutMistake: mistakes === 0 && !isZen ? prevStats.gamesWithoutMistake + 1 : prevStats.gamesWithoutMistake,
      currentStreak: streakResult.currentStreak,
      longestStreak: streakResult.longestStreak,
    };

    await updateBadgeStats(updatedStats);

    if (newTotal % 5 === 0) await earnPowerUp("shield");
    if (maxCombo >= 5 && !isZen) await earnPowerUp("time_freeze");
    const totalXP = await getTotalXP();
    if (totalXP > 0 && totalXP % 500 < xpEarned) await earnPowerUp("double_points");

    const unlockedBadgeIds = await getUnlockedBadges();
    const newlyUnlocked: string[] = [];
    for (const badge of BADGES) {
      if (!unlockedBadgeIds.includes(badge.id) && badge.condition(updatedStats)) {
        await unlockBadge(badge.id);
        newlyUnlocked.push(badge.id);
        trackEvent("badge_unlocked", { badge: badge.id });
      }
    }
    setNewBadges(newlyUnlocked);
  };

  const getRankEmoji = (r: string) => {
    switch (r) { case "S": return "👑"; case "A": return "⭐"; case "B": return "💪"; case "C": return "👍"; default: return "🎮"; }
  };

  const handleShare = async () => {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackEvent("score_shared", { score });
    try {
      const modeLabel = mode === "endless" ? "Endless" : mode === "zen" ? "Zen" : diffConfig.label;
      const emoji = getRankEmoji(rankInfo.rank);
      const lines = [
        `${emoji} ClutchTap ${emoji}`,
        ``,
        `🏆 Score: ${score}`,
        `📊 Rank: ${rankInfo.rank} (${rankInfo.label})`,
        `🔥 Max Combo: ${maxCombo}x`,
        `🎯 Accuracy: ${accuracy}%`,
        `⚡ Mode: ${modeLabel}`,
        ``,
        `Can you beat my score? #ClutchTap`,
      ];
      await Share.share({ message: lines.join("\n") });
    } catch (e) {}
  };

  const handleChallenge = async () => {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackEvent("challenge_shared", { score });
    try {
      const modeLabel = mode === "endless" ? "Endless" : mode === "zen" ? "Zen" : diffConfig.label;
      await Share.share({
        message: `🎯 CHALLENGE: Beat my score of ${score} on ${modeLabel} mode in ClutchTap! I got Rank ${rankInfo.rank} with a ${maxCombo}x combo. Think you're faster? #ClutchTap #Challenge`,
      });
    } catch (e) {}
  };

  const handlePlayAgain = () => {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: "/game",
      params: { difficulty, mode, ...(isDaily ? { daily: "true" } : {}) },
    });
  };

  const handleHome = () => {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[styles.container, { paddingTop: topInset + 12, paddingBottom: bottomInset + 16 }]}
    >
      <AmbientParticles count={10} />
      <Confetti active={showConfetti} />

      <Animated.View style={[styles.titleArea, titleStyle]}>
        {isNewBest ? (
          <NewBestBanner />
        ) : (
          <Text style={styles.gameOverText}>GAME OVER</Text>
        )}
      </Animated.View>

      <RankDisplay rankInfo={rankInfo} delay={200} />

      <Animated.View style={[styles.scoreArea, scoreStyle]}>
        <View style={styles.scoreLabelRow}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <View style={[styles.diffBadge, { borderColor: diffConfig.color + "60" }]}>
            <Ionicons name={diffConfig.icon as any} size={12} color={diffConfig.color} />
            <Text style={[styles.diffBadgeText, { color: diffConfig.color }]}>{diffConfig.label}</Text>
          </View>
          {mode !== "regular" && (
            <View style={[styles.diffBadge, { borderColor: MODE_CONFIGS[mode].color + "60" }]}>
              <Ionicons name={MODE_CONFIGS[mode].icon as any} size={12} color={MODE_CONFIGS[mode].color} />
              <Text style={[styles.diffBadgeText, { color: MODE_CONFIGS[mode].color }]}>{MODE_CONFIGS[mode].label}</Text>
            </View>
          )}
          {isDaily && (
            <View style={[styles.diffBadge, { borderColor: Colors.warning + "60" }]}>
              <Ionicons name="calendar" size={12} color={Colors.warning} />
              <Text style={[styles.diffBadgeText, { color: Colors.warning }]}>Daily</Text>
            </View>
          )}
        </View>
        <AnimatedScoreCounter target={score} duration={1200} />
        {bestScore > 0 && !isNewBest && (
          <Text style={styles.bestText}>Best: {bestScore}</Text>
        )}
      </Animated.View>

      <XPGainBar xpEarned={xpEarned} delay={600} />

      <View style={styles.statsGrid}>
        <AnimatedStat
          label="Correct Taps"
          value={correctTaps.toString()}
          icon="checkmark-circle"
          color={Colors.success}
          delay={700}
        />
        <AnimatedStat
          label="Max Combo"
          value={`${maxCombo}x`}
          icon="flash"
          color={Colors.warning}
          delay={800}
        />
        <AnimatedStat
          label="Accuracy"
          value={`${accuracy}%`}
          icon="analytics"
          color={Colors.accent}
          delay={900}
        />
        <AnimatedStat
          label="Avg Reaction"
          value={avgReaction > 0 ? `${avgReaction}ms` : "--"}
          icon="speedometer"
          color={Colors.primary}
          delay={1000}
        />
      </View>

      {newBadges.length > 0 && (
        <View style={styles.newBadgesSection}>
          <Text style={styles.newBadgesTitle}>Badges Unlocked</Text>
          <View style={styles.newBadgesRow}>
            {newBadges.map((badgeId) => {
              const badge = BADGES.find((b) => b.id === badgeId);
              if (!badge) return null;
              return (
                <View key={badgeId} style={styles.newBadgeItem}>
                  <View style={styles.newBadgeIcon}>
                    <Ionicons name={badge.icon as any} size={20} color={Colors.warning} />
                  </View>
                  <Text style={styles.newBadgeName}>{badge.title}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <Animated.View style={[styles.buttonsArea, buttonsStyle]}>
        <Pressable
          onPress={handlePlayAgain}
          style={({ pressed }) => [styles.playAgainBtn, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <LinearGradient
            colors={[Colors.primary, "#00B8D4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playAgainGradient}
          >
            <Ionicons name="refresh" size={22} color={Colors.background} />
            <Text style={styles.playAgainText}>PLAY AGAIN</Text>
          </LinearGradient>
        </Pressable>

        {!isZen && (
          <Pressable
            onPress={handleChallenge}
            style={({ pressed }) => [styles.challengeBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <Ionicons name="people" size={18} color={Colors.warning} />
            <Text style={styles.challengeBtnText}>CHALLENGE FRIEND</Text>
          </Pressable>
        )}

        <View style={styles.secondaryBtns}>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.secondBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
            <Text style={styles.secondBtnText}>Share</Text>
          </Pressable>

          <Pressable
            onPress={handleHome}
            style={({ pressed }) => [styles.secondBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="home-outline" size={20} color={Colors.primary} />
            <Text style={styles.secondBtnText}>Home</Text>
          </Pressable>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  titleArea: {
    alignItems: "center",
  },
  gameOverText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 6,
  },
  newBestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newBestText: {
    fontSize: 15,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.background,
    letterSpacing: 3,
  },
  rankContainer: {
    alignItems: "center",
    marginTop: 12,
    position: "relative",
  },
  rankGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    top: -10,
  },
  rankCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
  },
  rankLetter: {
    fontSize: 44,
    fontFamily: "Outfit_800ExtraBold",
  },
  rankLabel: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 3,
    marginTop: 6,
  },
  rankDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreArea: {
    alignItems: "center",
    marginTop: 12,
  },
  scoreLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.textSecondary,
    letterSpacing: 4,
  },
  diffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  diffBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
  },
  scoreValue: {
    fontSize: 56,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    lineHeight: 64,
  },
  bestText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    marginTop: 2,
  },
  xpContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  xpText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.accent,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  newBadgesSection: {
    marginTop: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.warning + "40",
  },
  newBadgesTitle: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 1,
  },
  newBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  newBadgeItem: {
    alignItems: "center",
    gap: 4,
  },
  newBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.warning + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  newBadgeName: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: Colors.text,
    textAlign: "center",
    maxWidth: 80,
  },
  buttonsArea: {
    marginTop: "auto",
    gap: 10,
  },
  playAgainBtn: {
    borderRadius: 18,
    overflow: "hidden",
  },
  playAgainGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  playAgainText: {
    fontSize: 18,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.background,
    letterSpacing: 3,
  },
  secondaryBtns: {
    flexDirection: "row",
    gap: 12,
  },
  challengeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.warning + "18",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.warning + "40",
  },
  challengeBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
    letterSpacing: 2,
  },
  secondBtn: {
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
  secondBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
});
