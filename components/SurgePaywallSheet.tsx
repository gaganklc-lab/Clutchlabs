import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import Colors from "@/constants/colors";
import { useSurgeSubscription } from "@/lib/surge-subscription";

const SURGE_PURPLE = "#7C3AED";
const SURGE_MAGENTA = "#E040FB";

interface ConfirmModalProps {
  visible: boolean;
  price: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function TestConfirmModal({
  visible,
  price,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={pw.confirmOverlay}>
        <View style={pw.confirmBox}>
          <Ionicons name="storefront-outline" size={36} color={SURGE_PURPLE} />
          <Text style={pw.confirmTitle}>Test Purchase</Text>
          <Text style={pw.confirmBody}>
            {"You're in the RevenueCat Test Store. This simulates a real purchase of Surge Pro (" + price + "/mo) without charging you."}
          </Text>
          <View style={pw.confirmRow}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                pw.confirmCancelBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={pw.confirmCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                pw.confirmConfirmBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={pw.confirmConfirmText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SurgePaywallSheet({
  visible,
  onClose,
  onSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const { offerings, purchasePro, restorePurchases, isPurchasing, isRestoring } =
    useSurgeSubscription();

  const [showTestConfirm, setShowTestConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentOffering = offerings?.current;
  const pkg = currentOffering?.availablePackages[0];
  const price = pkg?.product.priceString ?? "$4.99";

  const features = [
    {
      icon: "flash",
      color: Colors.warning,
      title: "Double XP",
      desc: "Earn 2× XP on every run",
    },
    {
      icon: "eye-off",
      color: SURGE_PURPLE,
      title: "Ad-Free",
      desc: "No revive ads, ever",
    },
    {
      icon: "color-palette",
      color: SURGE_MAGENTA,
      title: "Pro Ring Themes",
      desc: "Exclusive Pro-only cosmetics",
    },
    {
      icon: "trophy",
      color: Colors.warning,
      title: "Pro Badge",
      desc: "Stand out on the leaderboard",
    },
  ];

  const isTestEnv =
    __DEV__ ||
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient";

  const handleSubscribePress = () => {
    if (!pkg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    if (isTestEnv) {
      setShowTestConfirm(true);
    } else {
      handleConfirmPurchase();
    }
  };

  const handleConfirmPurchase = async () => {
    setShowTestConfirm(false);
    if (!pkg) return;
    try {
      await purchasePro(pkg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "userCancelled" in err &&
        (err as { userCancelled: boolean }).userCancelled
      ) {
        return;
      }
      setError("Purchase failed. Please try again.");
    }
  };

  const handleRestore = async () => {
    setError(null);
    try {
      await restorePurchases();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setError("Restore failed. Please try again.");
    }
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide">
        <Pressable style={pw.backdrop} onPress={onClose} />
        <View
          style={[pw.sheet, { paddingBottom: bottomPad + 16 }]}
        >
          <View style={pw.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={pw.scrollContent}
          >
            <LinearGradient
              colors={[SURGE_PURPLE + "22", "transparent"]}
              style={pw.gradientBanner}
            >
              <Ionicons name="radio-button-on" size={32} color={SURGE_PURPLE} />
              <Text style={pw.surgeLogo}>SURGE PRO</Text>
              <Text style={pw.surgeTagline}>Take your game to the next level</Text>
            </LinearGradient>

            <View style={pw.featureList}>
              {features.map((f) => (
                <View key={f.title} style={pw.featureRow}>
                  <View
                    style={[
                      pw.featureIcon,
                      { backgroundColor: f.color + "20" },
                    ]}
                  >
                    <Ionicons
                      name={f.icon as React.ComponentProps<typeof Ionicons>["name"]}
                      size={20}
                      color={f.color}
                    />
                  </View>
                  <View style={pw.featureText}>
                    <Text style={pw.featureTitle}>{f.title}</Text>
                    <Text style={pw.featureDesc}>{f.desc}</Text>
                  </View>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Colors.success}
                  />
                </View>
              ))}
            </View>

            {error && (
              <View style={pw.errorBox}>
                <Text style={pw.errorText}>{error}</Text>
              </View>
            )}

            <View style={pw.priceBlock}>
              <Text style={pw.priceLabel}>Monthly subscription</Text>
              <Text style={pw.price}>{price}</Text>
              <Text style={pw.priceNote}>Cancel anytime · No free trial in test mode</Text>
            </View>

            <Pressable
              onPress={handleSubscribePress}
              disabled={isPurchasing || !pkg}
              style={({ pressed }) => [
                pw.subscribeBtn,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
                (isPurchasing || !pkg) && pw.subscribeBtnDisabled,
              ]}
            >
              {isPurchasing ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <LinearGradient
                  colors={[SURGE_PURPLE, SURGE_MAGENTA]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={pw.subscribeBtnGradient}
                >
                  <Ionicons name="flash" size={20} color={Colors.text} />
                  <Text style={pw.subscribeBtnText}>
                    Subscribe · {price}/mo
                  </Text>
                </LinearGradient>
              )}
            </Pressable>

            <Pressable
              onPress={handleRestore}
              disabled={isRestoring}
              style={({ pressed }) => [
                pw.restoreBtn,
                { opacity: pressed || isRestoring ? 0.6 : 1 },
              ]}
            >
              <Text style={pw.restoreText}>
                {isRestoring ? "Restoring…" : "Restore Purchases"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <TestConfirmModal
        visible={showTestConfirm}
        price={price}
        onConfirm={handleConfirmPurchase}
        onCancel={() => setShowTestConfirm(false)}
      />
    </>
  );
}

const pw = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: "#111124",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#7C3AED40",
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  gradientBanner: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  surgeLogo: {
    fontSize: 26,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 4,
  },
  surgeTagline: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
  featureDesc: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
  },
  errorBox: {
    backgroundColor: Colors.secondary + "20",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.secondary + "50",
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.secondary,
    textAlign: "center",
  },
  priceBlock: {
    alignItems: "center",
    gap: 4,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  price: {
    fontSize: 36,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
  },
  priceNote: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  subscribeBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  subscribeBtnDisabled: {
    opacity: 0.5,
  },
  subscribeBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  subscribeBtnText: {
    fontSize: 17,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
    letterSpacing: 1,
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  restoreText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.textMuted,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmBox: {
    backgroundColor: "#111124",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#7C3AED50",
    width: "100%",
    maxWidth: 360,
  },
  confirmTitle: {
    fontSize: 20,
    fontFamily: "Outfit_800ExtraBold",
    color: Colors.text,
  },
  confirmBody: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmCancelText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textMuted,
  },
  confirmConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: SURGE_PURPLE,
  },
  confirmConfirmText: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: Colors.text,
  },
});
