import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getUnlockedBadges, getBadgeStats } from "@/lib/storage";
import { BADGES, type Badge, type BadgeStats } from "@/constants/game";
import { trackEvent } from "@/lib/analytics";

function BadgeItem({ badge, unlocked, index }: { badge: Badge; unlocked: boolean; index: number }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(Math.min(index * 50, 500), withSpring(1, { damping: 12, stiffness: 200 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.badgeCard, !unlocked && styles.badgeCardLocked, animStyle]}>
      <View style={[styles.badgeIcon, unlocked ? styles.badgeIconUnlocked : styles.badgeIconLocked]}>
        <Ionicons
          name={badge.icon as any}
          size={28}
          color={unlocked ? Colors.warning : Colors.textMuted}
        />
      </View>
      <Text style={[styles.badgeTitle, !unlocked && styles.badgeTitleLocked]}>
        {badge.title}
      </Text>
      <Text style={[styles.badgeDesc, !unlocked && styles.badgeDescLocked]}>
        {badge.description}
      </Text>
      {unlocked && (
        <View style={styles.unlockedTag}>
          <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
        </View>
      )}
    </Animated.View>
  );
}

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<BadgeStats | null>(null);

  useEffect(() => {
    trackEvent("screen_viewed", { screen: "badges" });
    loadBadges();
  }, []);

  const loadBadges = async () => {
    const ids = await getUnlockedBadges();
    const s = await getBadgeStats();
    setUnlockedIds(ids);
    setStats(s);
  };

  const sortedBadges = [...BADGES].sort((a, b) => {
    const aUnlocked = unlockedIds.includes(a.id);
    const bUnlocked = unlockedIds.includes(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return 0;
  });

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
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
        <Text style={styles.headerTitle}>Badges</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.progressBar}>
        <Text style={styles.progressText}>
          {unlockedIds.length} / {BADGES.length} Unlocked
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(unlockedIds.length / BADGES.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{stats.totalGames}</Text>
            <Text style={styles.miniStatLabel}>Games</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{stats.bestScore}</Text>
            <Text style={styles.miniStatLabel}>Best</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{stats.longestStreak}</Text>
            <Text style={styles.miniStatLabel}>Streak</Text>
          </View>
        </View>
      )}

      <FlatList
        data={sortedBadges}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.badgeRow}
        renderItem={({ item, index }) => (
          <BadgeItem
            badge={item}
            unlocked={unlockedIds.includes(item.id)}
            index={index}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={sortedBadges.length > 0}
      />
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
    paddingHorizontal: 16,
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
  progressBar: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceLight,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.warning,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniStat: {
    alignItems: "center",
  },
  miniStatValue: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
  },
  miniStatLabel: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  badgeRow: {
    gap: 10,
    marginBottom: 10,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  badgeIconUnlocked: {
    backgroundColor: Colors.warning + "20",
  },
  badgeIconLocked: {
    backgroundColor: Colors.surfaceLight,
  },
  badgeTitle: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  badgeTitleLocked: {
    color: Colors.textMuted,
  },
  badgeDesc: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 15,
  },
  badgeDescLocked: {
    color: Colors.textMuted,
  },
  unlockedTag: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
