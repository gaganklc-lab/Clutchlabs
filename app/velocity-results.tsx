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
} from "@/lib/storage";
import AmbientParticles from "@/components/AmbientParticles";

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
    mode: string;
  }>();

  const score = parseInt(params.score ?? "0");
  const maxCombo = parseInt(params.maxCombo ?? "0");
  const mistakes = parseInt(params.mistakes ?? "0");
  const totalDodges = parseInt(params.totalDodges ?? "0");
  const timeSurvived = parseInt(params.timeSurvived ?? "0");
  const mode = params.mode ?? "regular";

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [xpEarned, setXpEarned] = useState(0);
  const processedRef = useRef(false);

  const accuracy = totalDodges + mistakes > 0
    ? Math.round((totalDodges / (totalDodges + mistakes)) * 100)
    : 100;

  const containerOpacity = useSharedValue(0);
  const headerScale = useSharedValue(0.85);

  useEffect(() => {
    containerOpacity.value = withTiming(1, { duration: 500 });
    headerScale.value = withSpring(1, { damping: 12, stiffness: 180 });
  }, []);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const xp = Math.max(20, Math.round(score / 10) + maxCombo * 2);
    setXpEarned(xp);

    const process = async () => {
      await addXP(xp);
      await updateGameStats(score, accuracy, "normal", mode as any, timeSurvived);

      if (mode !== "zen") {
        await addLeaderboardEntry({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          score,
          combo: maxCombo,
          avgReaction: 0,
          date: new Date().toISOString(),
        });
      }

      trackEvent("velocity_results_viewed", { score, maxCombo, mode, accuracy });
    };

    process();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleShare = async () => {
    const modeLabel = mode === "regular" ? "Regular" : mode === "endless" ? "Endless" : "Zen";
    const text = [
      "⚡ VELOCITY — Swipe to Dodge",
      `🏆 Score: ${score.toLocaleString()}`,
      `🔥 Max Combo: ${maxCombo}x`,
      `🎯 Accuracy: ${accuracy}%`,
      `⏱ Time: ${timeSurvived}s`,
      `📋 Mode: ${modeLabel}`,
      "",
      "Can you beat me? Try Velocity in ClutchTap!",
    ].join("\n");

    try {
      await Share.share({ message: text });
    } catch {}
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
  }));

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
                  <Ionicons name="speedometer" size={28} color={Colors.accent} />
                  <Text style={rs.titleText}>VELOCITY</Text>
                </View>
                <Text style={rs.subtitleText}>
                  {mode === "regular" ? "Regular" : mode === "endless" ? "Endless" : "Zen"} Mode
                </Text>
              </Animated.View>

              {/* Score */}
              <View style={rs.scoreSection}>
                <Text style={rs.scoreLabel}>SCORE</Text>
                <AnimatedScoreCounter target={score} />
                {maxCombo >= 3 && (
                  <Text style={rs.comboHighlight}>🔥 Max Combo {maxCombo}x</Text>
                )}
              </View>

              {/* XP Badge */}
              {xpEarned > 0 && (
                <View style={rs.xpBadge}>
                  <Ionicons name="star" size={16} color={Colors.warning} />
                  <Text style={rs.xpText}>+{xpEarned} XP Earned</Text>
                </View>
              )}

              {/* Stat cards */}
              <View style={rs.statsGrid}>
                <StatCard label="Max Combo" value={`${maxCombo}x`} icon="flame" color={Colors.secondary} />
                <StatCard label="Accuracy" value={`${accuracy}%`} icon="checkmark-circle" color={Colors.success} />
                <StatCard label="Time" value={`${timeSurvived}s`} icon="timer" color={Colors.primary} />
                <StatCard label="Dodges" value={`${totalDodges}`} icon="shield-checkmark" color={Colors.accent} />
              </View>

              {/* Buttons */}
              <View style={rs.buttonStack}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.replace({ pathname: "/velocity", params: { mode } });
                  }}
                  style={({ pressed }) => [rs.primaryBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <LinearGradient
                    colors={["#7B61FF", "#5E35B1"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={rs.primaryBtnInner}
                  >
                    <Ionicons name="refresh" size={22} color="#fff" />
                    <Text style={rs.primaryBtnText}>Play Again</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [rs.secondaryBtn, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Ionicons name="share-social-outline" size={20} color={Colors.primary} />
                  <Text style={rs.secondaryBtnText}>Share Score</Text>
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
    color: Colors.accent,
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
    borderColor: Colors.accent + "40",
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
  },
  xpText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.warning,
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
    borderColor: Colors.primary + "60",
    backgroundColor: Colors.primary + "10",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
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
});
