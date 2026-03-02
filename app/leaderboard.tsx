import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  useWindowDimensions,
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
import { getLeaderboard, getSettings, type LeaderboardEntry } from "@/lib/storage";
import { trackEvent } from "@/lib/analytics";

function LeaderboardItem({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(30);

  useEffect(() => {
    const d = Math.min(rank * 60, 600);
    opacity.value = withDelay(d, withTiming(1, { duration: 300 }));
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

  const getRankIcon = () => {
    if (rank <= 3) return "trophy";
    return null;
  };

  const dateStr = new Date(entry.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Animated.View style={[styles.entryRow, animStyle]}>
      <View style={[styles.rankBadge, rank <= 3 && { backgroundColor: getRankColor() + "20" }]}>
        {getRankIcon() ? (
          <Ionicons name={getRankIcon() as any} size={16} color={getRankColor()} />
        ) : (
          <Text style={[styles.rankNumber, { color: getRankColor() }]}>
            {rank}
          </Text>
        )}
      </View>

      <View style={styles.entryMain}>
        <Text style={styles.entryScore}>{entry.score}</Text>
        <Text style={styles.entryDate}>{dateStr}</Text>
      </View>

      <View style={styles.entryStats}>
        <View style={styles.entryStat}>
          <Ionicons name="flash" size={12} color={Colors.warning} />
          <Text style={styles.entryStatText}>{entry.combo}x</Text>
        </View>
        <View style={styles.entryStat}>
          <Ionicons name="speedometer" size={12} color={Colors.primary} />
          <Text style={styles.entryStatText}>{entry.avgReaction}ms</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    trackEvent("screen_viewed", { screen: "leaderboard" });
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    const data = await getLeaderboard();
    setEntries(data);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

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
            <Text style={styles.headerTitle}>Leaderboard</Text>
            <View style={{ width: 44 }} />
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="podium-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Scores Yet</Text>
              <Text style={styles.emptyDesc}>Play a game to see your scores here</Text>
            </View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <LeaderboardItem entry={item} rank={index + 1} />
              )}
              contentContainerStyle={{ paddingBottom: bottomInset + 20, paddingTop: 8 }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={entries.length > 0}
            />
          )}

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankNumber: {
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
  },
  entryDate: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
  },
  entryStats: {
    flexDirection: "row",
    gap: 10,
  },
  entryStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  entryStatText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.textSecondary,
  },
});
