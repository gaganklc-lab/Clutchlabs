import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  useWindowDimensions,
  Share,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/velocity-storage";
import { trackEvent } from "@/lib/analytics";
import AmbientParticles from "@/components/AmbientParticles";
import { LinearGradient } from "expo-linear-gradient";

const VELOCITY_CYAN = Colors.accent;
const VELOCITY_PURPLE = "#7B61FF";

function LeaderboardItem({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(30);

  useEffect(() => {
    const d = Math.min(rank * 50, 500);
    opacity.value = withDelay(d, withTiming(1, { duration: 280 }));
    translateX.value = withDelay(d, withSpring(0, { damping: 14 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const getRankColor = () => {
    if (rank === 1) return Colors.warning;
    if (rank === 2) return "#C0C0C0";
    if (rank === 3) return "#CD7F32";
    return Colors.textMuted;
  };

  const dateStr = new Date(entry.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const rankLetter = entry.rank ?? "—";
  const rankColor = rankLetter === "S" ? Colors.warning
    : rankLetter === "A" ? VELOCITY_CYAN
    : rankLetter === "B" ? VELOCITY_PURPLE
    : rankLetter === "C" ? Colors.warning
    : Colors.textMuted;

  return (
    <Animated.View style={[styles.entryRow, rank === 1 && styles.topEntry, animStyle]}>
      <View style={[styles.rankBadge, rank <= 3 && { backgroundColor: getRankColor() + "20", borderColor: getRankColor() + "60" }]}>
        {rank <= 3 ? (
          <Ionicons name="trophy" size={14} color={getRankColor()} />
        ) : (
          <Text style={[styles.rankNum, { color: getRankColor() }]}>{rank}</Text>
        )}
      </View>

      <View style={styles.entryMain}>
        <Text style={styles.entryScore}>{entry.score.toLocaleString()}</Text>
        <View style={styles.entryMeta}>
          <Text style={styles.entryMetaText}>🔥 {entry.combo}x</Text>
          <Text style={styles.entryMetaText}>·</Text>
          <Text style={styles.entryMetaText}>{dateStr}</Text>
        </View>
      </View>

      {rankLetter !== "—" && (
        <View style={[styles.gradeBadge, { borderColor: rankColor + "60", backgroundColor: rankColor + "15" }]}>
          <Text style={[styles.gradeText, { color: rankColor }]}>{rankLetter}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function VelocityLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent("screen_viewed", { screen: "velocity_leaderboard" });
    getLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const handleShare = async () => {
    if (entries.length === 0) return;
    const top = entries[0];
    const text = [
      "⚡ My VELOCITY high score!",
      `🏆 Score: ${top.score.toLocaleString()}${top.rank ? ` · Rank ${top.rank}` : ""}`,
      `🔥 Best Combo: ${top.combo}x`,
      "",
      "Think you can beat me? Download ClutchLabs and play Velocity!",
    ].join("\n");
    try {
      await Share.share({ message: text });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}
    >
      <AmbientParticles count={6} />

      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <View style={styles.titleRow}>
              <Ionicons name="speedometer" size={22} color={VELOCITY_CYAN} />
              <Text style={styles.title}>LEADERBOARD</Text>
            </View>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="share-social-outline" size={22} color={VELOCITY_CYAN} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="speedometer-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No scores yet</Text>
              <Text style={styles.emptyText}>Play your first game to appear here!</Text>
              <Pressable
                onPress={() => router.replace("/")}
                style={({ pressed }) => [styles.playNowBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <LinearGradient
                  colors={[VELOCITY_PURPLE, "#5E35B1"]}
                  style={styles.playNowGradient}
                >
                  <Text style={styles.playNowText}>Play Now</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <LeaderboardItem entry={item} rank={index + 1} />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderText}>Your personal best runs</Text>
                </View>
              }
              ListFooterComponent={
                entries.length >= 20 ? (
                  <Text style={styles.footerText}>Top 20 scores shown</Text>
                ) : null
              }
            />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 3,
  },
  shareBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    gap: 8,
    paddingBottom: 20,
  },
  listHeader: {
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 1,
    textAlign: "center",
  },
  footerText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 12,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topEntry: {
    borderColor: Colors.warning + "50",
    backgroundColor: Colors.warning + "08",
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rankNum: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
  },
  entryMain: {
    flex: 1,
  },
  entryScore: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 0.5,
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  entryMetaText: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
  },
  gradeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeText: {
    fontSize: 15,
    fontFamily: "Outfit_800ExtraBold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  playNowBtn: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
  },
  playNowGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: "center",
  },
  playNowText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
});
