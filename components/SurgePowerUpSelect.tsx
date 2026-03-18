import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  type SurgePowerUpType,
  type SurgePowerUpInventory,
  getSurgePowerUps,
} from "@/lib/surge-storage";

const SURGE_PURPLE = "#7C3AED";
const SURGE_ORANGE = "#FF6D00";

interface PowerUpConfig {
  type: SurgePowerUpType;
  label: string;
  description: string;
  duration: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}

const POWER_UP_CONFIGS: PowerUpConfig[] = [
  {
    type: "slow_ring",
    label: "Slow Ring",
    description: "Raises the speed floor — rings never go faster than 700ms",
    duration: "15 seconds",
    icon: "hourglass-outline",
    color: "#00B0FF",
  },
  {
    type: "extra_life",
    label: "Extra Life",
    description: "Start with +1 life. Survive longer in Endless and Rush",
    duration: "Whole run",
    icon: "heart",
    color: "#FF4081",
  },
  {
    type: "double_score",
    label: "Double Score",
    description: "All score gains are doubled — stack with combos for huge numbers",
    duration: "20 seconds",
    icon: "flash",
    color: Colors.warning,
  },
];

interface Props {
  visible: boolean;
  inventory: SurgePowerUpInventory;
  onClose: () => void;
  onPlay: (selectedPowerUp: SurgePowerUpType | null) => void;
}

export default function SurgePowerUpSelect({ visible, inventory, onClose, onPlay }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<SurgePowerUpType | null>(null);

  useEffect(() => {
    if (visible) setSelected(null);
  }, [visible]);

  const handleSelect = (type: SurgePowerUpType) => {
    if (inventory[type] <= 0) return;
    setSelected((prev) => (prev === type ? null : type));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPlay(selected);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={ps.overlay}>
        <View style={[ps.sheet, { paddingBottom: bottomPad + 16 }]}>
          <View style={ps.header}>
            <View>
              <Text style={ps.title}>Power-Ups</Text>
              <Text style={ps.subtitle}>Use one to boost this run</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [ps.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          {POWER_UP_CONFIGS.map((cfg) => {
            const count = inventory[cfg.type];
            const isAvailable = count > 0;
            const isSelected = selected === cfg.type;
            return (
              <Pressable
                key={cfg.type}
                onPress={() => handleSelect(cfg.type)}
                style={({ pressed }) => [
                  ps.powerUpRow,
                  isSelected && { borderColor: cfg.color, backgroundColor: cfg.color + "12" },
                  !isAvailable && ps.powerUpRowDisabled,
                  { opacity: pressed && isAvailable ? 0.8 : 1 },
                ]}
              >
                <View style={[ps.iconCircle, { backgroundColor: isAvailable ? cfg.color + "20" : Colors.border + "40" }]}>
                  <Ionicons name={cfg.icon} size={22} color={isAvailable ? cfg.color : Colors.textMuted} />
                </View>
                <View style={ps.powerUpInfo}>
                  <View style={ps.powerUpNameRow}>
                    <Text style={[ps.powerUpName, !isAvailable && { color: Colors.textMuted }]}>{cfg.label}</Text>
                    <View style={[ps.countBadge, isAvailable ? { backgroundColor: cfg.color + "25" } : { backgroundColor: Colors.border }]}>
                      <Text style={[ps.countText, { color: isAvailable ? cfg.color : Colors.textMuted }]}>
                        {count}
                      </Text>
                    </View>
                  </View>
                  <Text style={ps.powerUpDesc}>{cfg.description}</Text>
                  <Text style={[ps.powerUpDuration, { color: isAvailable ? cfg.color : Colors.textMuted }]}>
                    {cfg.duration}
                  </Text>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={24} color={cfg.color} />
                ) : isAvailable ? (
                  <Ionicons name="radio-button-off" size={24} color={Colors.textMuted} />
                ) : (
                  <Ionicons name="lock-closed" size={18} color={Colors.textMuted} />
                )}
              </Pressable>
            );
          })}

          <View style={ps.actions}>
            <Pressable
              onPress={handlePlay}
              style={({ pressed }) => [ps.playBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={ps.playBtnText}>
                {selected ? `PLAY + ${POWER_UP_CONFIGS.find(c => c.type === selected)?.label}` : "PLAY WITHOUT POWER-UP"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export { POWER_UP_CONFIGS };

const ps = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  powerUpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  powerUpRowDisabled: {
    opacity: 0.5,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  powerUpInfo: {
    flex: 1,
    gap: 2,
  },
  powerUpNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  powerUpName: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  countText: {
    fontSize: 12,
    fontFamily: "Outfit_800ExtraBold",
  },
  powerUpDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    lineHeight: 16,
  },
  powerUpDuration: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 2,
  },
  actions: {
    marginTop: 6,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 15,
  },
  playBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    letterSpacing: 1,
  },
});
