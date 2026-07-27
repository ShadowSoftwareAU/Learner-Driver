import { useAuth } from "@clerk/expo";
import { useGetMe } from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#FFF7ED",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ fontSize: size * 0.35, fontFamily: "Inter_700Bold", color: "#F97316" }}
      >
        {initials}
      </Text>
    </View>
  );
}

export default function ViewerProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data: user, isLoading } = useGetMe();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const displayName = user ? user.name || user.email || "Viewer" : "Viewer";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: topPad },
      ]}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>Profile</Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Avatar name={displayName} size={72} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>
                {displayName}
              </Text>
              <Text style={[styles.email, { color: colors.mutedForeground }]}>
                {user?.email ?? ""}
              </Text>
              <View style={[styles.badge, { backgroundColor: "#FFF7ED" }]}>
                <Text style={[styles.badgeText, { color: "#F97316" }]}>
                  Viewer
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.section, { borderColor: colors.border }]}>
            <Pressable style={styles.row} onPress={() => {}}>
              <Feather name="bell" size={20} color={colors.mutedForeground} />
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                Notifications
              </Text>
              <Feather name="chevron-right" size={18} color={colors.border} />
            </Pressable>
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <Pressable style={styles.row} onPress={() => {}}>
              <Feather
                name="help-circle"
                size={20}
                color={colors.mutedForeground}
              />
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                Help & Support
              </Text>
              <Feather name="chevron-right" size={18} color={colors.border} />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => signOut()}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>
              Sign out
            </Text>
          </Pressable>
        </>
      )}

      <View style={{ height: bottomPad + 80 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 24,
    marginTop: 8,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  name: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 2 },
  email: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  separator: { height: 1, marginLeft: 52 },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
