import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  ORB_STYLES,
  TRAIL_STYLES,
  getUnlockedCosmetics,
  getEquippedOrb,
  getEquippedTrail,
  setEquippedOrb,
  setEquippedTrail,
  type OrbStyleId,
  type TrailStyleId,
} from "@/lib/velocity-cosmetics";

const VELOCITY_CYAN = "#00E5FF";
const VELOCITY_PURPLE = "#7B61FF";

interface Props {
  visible: boolean;
  onClose: () => void;
}

function OrbPreview({ colors }: { colors: { aura: string; mid: string; core: string } }) {
  return (
    <View style={cp.orbPreviewContainer}>
      <View style={[cp.orbAuraPreview, { backgroundColor: colors.aura }]} />
      <View style={[cp.orbMidPreview, { backgroundColor: colors.mid }]} />
      <View style={[cp.orbCorePreview, { backgroundColor: colors.core, shadowColor: colors.core }]} />
    </View>
  );
}

function TrailPreview({ color }: { color: string }) {
  return (
    <View style={cp.trailPreviewContainer}>
      {[1, 0.6, 0.3].map((opacity, i) => (
        <View
          key={i}
          style={[
            cp.trailDot,
            {
              backgroundColor: color,
              opacity,
              width: 10 - i * 2,
              height: 10 - i * 2,
              borderRadius: (10 - i * 2) / 2,
              shadowColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function VelocityCustomizeModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [unlocked, setUnlocked] = useState<{ orbs: OrbStyleId[]; trails: TrailStyleId[] }>({
    orbs: ["core_blue"],
    trails: ["cyan_trail"],
  });
  const [equippedOrb, setEquippedOrbState] = useState<OrbStyleId>("core_blue");
  const [equippedTrail, setEquippedTrailState] = useState<TrailStyleId>("cyan_trail");

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    const [u, orb, trail] = await Promise.all([
      getUnlockedCosmetics(),
      getEquippedOrb(),
      getEquippedTrail(),
    ]);
    setUnlocked(u);
    setEquippedOrbState(orb);
    setEquippedTrailState(trail);
  };

  const handleEquipOrb = async (id: OrbStyleId) => {
    if (!unlocked.orbs.includes(id)) return;
    await setEquippedOrb(id);
    setEquippedOrbState(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleEquipTrail = async (id: TrailStyleId) => {
    if (!unlocked.trails.includes(id)) return;
    await setEquippedTrail(id);
    setEquippedTrailState(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={cp.overlay}>
        <View style={[cp.sheet, { paddingBottom: bottomPad + 16 }]}>
          <View style={cp.header}>
            <Text style={cp.headerTitle}>CUSTOMIZE</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [cp.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            <Text style={cp.sectionLabel}>ORB STYLE</Text>
            {ORB_STYLES.map((orb) => {
              const isUnlocked = unlocked.orbs.includes(orb.id);
              const isEquipped = equippedOrb === orb.id;
              return (
                <View
                  key={orb.id}
                  style={[
                    cp.itemCard,
                    isEquipped && { borderColor: VELOCITY_CYAN, borderWidth: 1.5 },
                    !isUnlocked && cp.lockedCard,
                  ]}
                >
                  <OrbPreview colors={orb.colors} />
                  <View style={cp.itemInfo}>
                    <Text style={[cp.itemName, !isUnlocked && cp.lockedText]}>{orb.name}</Text>
                    <Text style={cp.itemDesc}>{orb.description}</Text>
                    {!isUnlocked && (
                      <View style={cp.lockRow}>
                        <Ionicons name="lock-closed" size={11} color={Colors.textMuted} />
                        <Text style={cp.lockText}>{orb.unlockText}</Text>
                      </View>
                    )}
                  </View>
                  <View style={cp.itemAction}>
                    {isEquipped ? (
                      <View style={cp.equippedBadge}>
                        <Ionicons name="checkmark" size={12} color={VELOCITY_CYAN} />
                        <Text style={cp.equippedText}>ON</Text>
                      </View>
                    ) : isUnlocked ? (
                      <Pressable
                        onPress={() => handleEquipOrb(orb.id)}
                        style={({ pressed }) => [cp.equipBtn, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Text style={cp.equipBtnText}>EQUIP</Text>
                      </Pressable>
                    ) : (
                      <Ionicons name="lock-closed" size={18} color={Colors.border} />
                    )}
                  </View>
                </View>
              );
            })}

            <Text style={[cp.sectionLabel, { marginTop: 20 }]}>TRAIL STYLE</Text>
            {TRAIL_STYLES.map((trail) => {
              const isUnlocked = unlocked.trails.includes(trail.id);
              const isEquipped = equippedTrail === trail.id;
              return (
                <View
                  key={trail.id}
                  style={[
                    cp.itemCard,
                    isEquipped && { borderColor: VELOCITY_CYAN, borderWidth: 1.5 },
                    !isUnlocked && cp.lockedCard,
                  ]}
                >
                  <TrailPreview color={trail.color} />
                  <View style={cp.itemInfo}>
                    <Text style={[cp.itemName, !isUnlocked && cp.lockedText]}>{trail.name}</Text>
                    <Text style={cp.itemDesc}>{trail.description}</Text>
                    {!isUnlocked && (
                      <View style={cp.lockRow}>
                        <Ionicons name="lock-closed" size={11} color={Colors.textMuted} />
                        <Text style={cp.lockText}>{trail.unlockText}</Text>
                      </View>
                    )}
                  </View>
                  <View style={cp.itemAction}>
                    {isEquipped ? (
                      <View style={cp.equippedBadge}>
                        <Ionicons name="checkmark" size={12} color={VELOCITY_CYAN} />
                        <Text style={cp.equippedText}>ON</Text>
                      </View>
                    ) : isUnlocked ? (
                      <Pressable
                        onPress={() => handleEquipTrail(trail.id)}
                        style={({ pressed }) => [cp.equipBtn, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Text style={cp.equipBtnText}>EQUIP</Text>
                      </Pressable>
                    ) : (
                      <Ionicons name="lock-closed" size={18} color={Colors.border} />
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const cp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: VELOCITY_CYAN + "30",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: Colors.textMuted,
    letterSpacing: 3,
    marginBottom: 10,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  lockedCard: {
    opacity: 0.6,
  },
  orbPreviewContainer: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  orbAuraPreview: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  orbMidPreview: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  orbCorePreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  trailPreviewContainer: {
    width: 44,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  trailDot: {
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  lockedText: {
    color: Colors.textMuted,
  },
  itemDesc: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    lineHeight: 16,
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  lockText: {
    fontSize: 10,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  itemAction: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
  },
  equippedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: VELOCITY_CYAN + "20",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: VELOCITY_CYAN + "50",
  },
  equippedText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: VELOCITY_CYAN,
    letterSpacing: 1,
  },
  equipBtn: {
    backgroundColor: VELOCITY_PURPLE + "30",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: VELOCITY_PURPLE + "60",
  },
  equipBtnText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: VELOCITY_PURPLE,
    letterSpacing: 1,
  },
});
