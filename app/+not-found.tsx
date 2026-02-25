import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found", headerShown: false }} />
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.title}>Screen not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go Home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.textSecondary,
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
});
