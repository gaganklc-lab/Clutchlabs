import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Platform,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import {
  getSurgeLeaderboard,
  type SurgeLeaderboardEntry,
  type SurgeGameMode,
} from "@/lib/surge-storage";
import AmbientParticles from "@/components/AmbientParticles";

const SURGE_PURPLE = "#7C3AED";
const SURGE_MAGENTA = "#E040FB";

function LeaderboardRow({
  entry,
  position,
  index,
}: {
  entry: SurgeLeaderboardEntry;
  position: number;
  index: number;
}) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-20);

  useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 350 }));
    translateX.value = withDelay(index * 60, withSpring(0, { damping: 14 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const isTop3 = position <= 3;
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const medalColor = isTop3 ? medalColors[position - 1] : Colors.textMuted;
  const rankColor = entry.rank === "S" ? Colors.warning : entry.rank === "A" ? SURGE_MAGENTA : SURGE_PURPLE;

  const date = new Date(entry.date);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <Animated.View style={[lb.row, isTop3 && lb.topRow, animStyle]}>
      <View style={lb.positionBlock}>
        {isTop3 ? (
          <Text style={[lb.medal, { color: medalColor }]}>
            {["🥇", "🥈", "🥉"][position - 1]}
          </Text>
        ) : (
          <Text style={lb.posNumber}>{position}</Text>
        )}
      </View>

      <View style={lb.rowInfo}>
        <View style={lb.rowTop}>
          <Text style={[lb.scoreText, isTop3 && { color: medalColor }]}>
            {entry.score.toLocaleString()}
          </Text>
          {entry.rank && (
            <View style={[lb.rankBadge, { borderColor: rankColor }]}>
              <Text style={[lb.rankBadgeText, { color: rankColor }]}>{entry.rank}</Text>
            </View>
          )}
        </View>
        <View style={lb.rowStats}>
          <Text style={lb.miniStat}>🔥 {entry.maxCombo}x combo</Text>
          <Text style={lb.miniStat}>🎯 {entry.perfectHits} perfect</Text>
          <Text style={lb.dateText}>{dateStr}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function EmptyState() {
  return (
    <View style={lb.empty}>
      <Ionicons name="radio-button-on" size={40} color={Colors.textMuted} />
      <Text style={lb.emptyTitle}>No runs yet</Text>
      <Text style={lb.emptySub}>Play Surge to set your first score</Text>
    </View>
  );
}

export default function SurgeLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 560 : undefined;
  const contentHorizontalPadding = isTablet ? 24 : 16;
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [modeTab, setModeTab] = useState<SurgeGameMode>("classic");
  const [classicScores, setClassicScores] = useState<SurgeLeaderboardEntry[]>([]);
  const [endlessScores, setEndlessScores] = useState<SurgeLeaderboardEntry[]>([]);

  useEffect(() => {
    Promise.all([
      getSurgeLeaderboard("classic"),
      getSurgeLeaderboard("endless"),
    ]).then(([c, e]) => {
      setClassicScores(c);
      setEndlessScores(e);
    });
  }, []);

  const scores = modeTab === "classic" ? classicScores : endlessScores;

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[lb.container, { paddingTop: topInset }]}
    >
      <AmbientParticles count={8} />
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: contentHorizontalPadding }}>

          {/* Header */}
          <View style={lb.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [lb.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <View style={lb.titleBlock}>
              <Ionicons name="radio-button-on" size={18} color={SURGE_PURPLE} />
              <Text style={lb.title}>BEST SCORES</Text>
            </View>
            <Pressable
              onPress={() => router.replace("/")}
              style={({ pressed }) => [lb.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="home-outline" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={lb.tabs}>
            {(["classic", "endless"] as SurgeGameMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setModeTab(m)}
                style={[lb.tabBtn, modeTab === m && lb.tabBtnActive]}
              >
                <Ionicons
                  name={m === "classic" ? "timer-outline" : "infinite-outline"}
                  size={15}
                  color={modeTab === m ? Colors.text : Colors.textMuted}
                />
                <Text style={[lb.tabText, modeTab === m && lb.tabTextActive]}>
                  {m === "classic" ? "Classic" : "Endless"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Top-3 summary */}
          {scores.length > 0 && (
            <View style={lb.topSummary}>
              <Text style={lb.topSummaryLabel}>TOP SCORE</Text>
              <Text style={lb.topSummaryScore}>{scores[0].score.toLocaleString()}</Text>
            </View>
          )}

          <FlatList
            data={scores}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <LeaderboardRow entry={item} position={index + 1} index={index} />
            )}
            ListEmptyComponent={<EmptyState />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
            scrollEnabled={!!scores.length}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const lb = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 4,
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  tabBtn: {
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
  tabBtnActive: {
    borderColor: SURGE_PURPLE,
    backgroundColor: SURGE_PURPLE + "15",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.text,
  },
  topSummary: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.warning + "30",
  },
  topSummaryLabel: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 3,
  },
  topSummaryScore: {
    fontSize: 42,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.warning,
    letterSpacing: -1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    borderColor: Colors.warning + "40",
    backgroundColor: Colors.warning + "06",
  },
  positionBlock: {
    width: 32,
    alignItems: "center",
  },
  medal: {
    fontSize: 22,
  },
  posNumber: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: Colors.textMuted,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreText: {
    fontSize: 22,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
  },
  rankBadge: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  rankBadgeText: {
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
  },
  rowStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  miniStat: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
  },
  dateText: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    marginLeft: "auto" as any,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
});
