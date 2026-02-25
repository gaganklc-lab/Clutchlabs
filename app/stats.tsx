import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { getGameStats, getBadgeStats, getTotalXP, getBestScore, getEndlessBest, type GameStats } from "@/lib/storage";
import { getLevelInfo, type BadgeStats } from "@/constants/game";
import AmbientParticles from "@/components/AmbientParticles";

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIconBox, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function AccuracyChart({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const last = history.slice(-20);
  const max = 100;
  const barW = Math.floor((280 - (last.length - 1) * 2) / last.length);

  return (
    <View style={s.chartSection}>
      <Text style={s.sectionTitle}>Accuracy Trend</Text>
      <View style={s.chartContainer}>
        {last.map((v, i) => (
          <View key={i} style={s.chartBarWrap}>
            <View
              style={[
                s.chartBar,
                {
                  height: Math.max(4, (v / max) * 80),
                  width: Math.max(8, barW),
                  backgroundColor: v >= 80 ? Colors.success : v >= 50 ? Colors.warning : Colors.error,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={s.chartLabel}>Last {last.length} games</Text>
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [badgeStats, setBadgeStats] = useState<BadgeStats | null>(null);
  const [totalXP, setTotalXP] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [endlessBest, setEndlessBest] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [gs, bs, xp, best, eBest] = await Promise.all([
      getGameStats(),
      getBadgeStats(),
      getTotalXP(),
      getBestScore(),
      getEndlessBest(),
    ]);
    setGameStats(gs);
    setBadgeStats(bs);
    setTotalXP(xp);
    setBestScore(best);
    setEndlessBest(eBest);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const levelInfo = getLevelInfo(totalXP);

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  };

  const avgAccuracy = gameStats && gameStats.accuracyHistory.length > 0
    ? Math.round(gameStats.accuracyHistory.reduce((a, b) => a + b, 0) / gameStats.accuracyHistory.length)
    : 0;

  return (
    <LinearGradient
      colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
      style={[s.container, { paddingTop: topInset }]}
    >
      <AmbientParticles count={8} />
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Stats</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: bottomInset + 20 }} showsVerticalScrollIndicator={false}>
        <View style={s.levelSection}>
          <View style={s.levelCircle}>
            <Text style={s.levelNum}>{levelInfo.level}</Text>
          </View>
          <View style={s.levelInfo}>
            <Text style={s.levelTitle}>{levelInfo.title}</Text>
            <View style={s.xpBar}>
              <View style={[s.xpFill, { width: `${levelInfo.progress * 100}%` }]} />
            </View>
            <Text style={s.xpLabel}>{levelInfo.currentXP} / {levelInfo.xpForNext} XP</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Overview</Text>
        <View style={s.statsGrid}>
          <StatCard label="Total Games" value={(gameStats?.totalGames || 0).toString()} icon="game-controller" color={Colors.primary} />
          <StatCard label="Play Time" value={formatTime(gameStats?.totalPlayTimeSec || 0)} icon="time" color={Colors.accent} />
          <StatCard label="Best Score" value={bestScore.toString()} icon="trophy" color={Colors.warning} />
          <StatCard label="Avg Accuracy" value={`${avgAccuracy}%`} icon="analytics" color={Colors.success} />
        </View>

        <Text style={s.sectionTitle}>Best by Difficulty</Text>
        <View style={s.statsGrid}>
          <StatCard label="Easy" value={(gameStats?.bestByDifficulty?.easy || 0).toString()} icon="leaf" color={Colors.success} />
          <StatCard label="Normal" value={(gameStats?.bestByDifficulty?.normal || 0).toString()} icon="flash" color={Colors.warning} />
          <StatCard label="Hard" value={(gameStats?.bestByDifficulty?.hard || 0).toString()} icon="flame" color={Colors.error} />
          <StatCard label="Endless" value={endlessBest.toString()} icon="infinite" color={Colors.accent} />
        </View>

        <Text style={s.sectionTitle}>Records</Text>
        <View style={s.statsGrid}>
          <StatCard label="Best Combo" value={`${badgeStats?.bestCombo || 0}x`} icon="flash" color={Colors.secondary} />
          <StatCard label="Perfect Games" value={(badgeStats?.perfectRounds || 0).toString()} icon="shield-checkmark" color={Colors.primary} />
          <StatCard label="Games Today" value={(gameStats?.gamesToday || 0).toString()} icon="today" color={Colors.warning} />
          <StatCard label="This Week" value={(gameStats?.gamesThisWeek || 0).toString()} icon="calendar" color={Colors.accent} />
        </View>

        {gameStats && <AccuracyChart history={gameStats.accuracyHistory} />}

        <View style={s.totalXPSection}>
          <Ionicons name="star" size={24} color={Colors.accent} />
          <Text style={s.totalXPText}>{totalXP.toLocaleString()} Total XP</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Outfit_700Bold", color: Colors.text, letterSpacing: 2 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  levelSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
    marginBottom: 20,
  },
  levelCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentDim,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  levelNum: { fontSize: 22, fontFamily: "Outfit_800ExtraBold", color: Colors.accent },
  levelInfo: { flex: 1 },
  levelTitle: { fontSize: 16, fontFamily: "Outfit_700Bold", color: Colors.text, marginBottom: 6 },
  xpBar: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceLight, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 3 },
  xpLabel: { fontSize: 11, fontFamily: "Outfit_400Regular", color: Colors.textSecondary, marginTop: 4 },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: { fontSize: 20, fontFamily: "Outfit_800ExtraBold", color: Colors.text },
  statLabel: { fontSize: 11, fontFamily: "Outfit_400Regular", color: Colors.textSecondary, marginTop: 2 },
  chartSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    marginTop: 8,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 90,
    gap: 2,
    marginTop: 10,
  },
  chartBarWrap: { justifyContent: "flex-end" },
  chartBar: { borderRadius: 3 },
  chartLabel: { fontSize: 10, fontFamily: "Outfit_400Regular", color: Colors.textMuted, textAlign: "center", marginTop: 6 },
  totalXPSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.accentDim,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
    marginTop: 8,
  },
  totalXPText: { fontSize: 18, fontFamily: "Outfit_700Bold", color: Colors.accent },
});
