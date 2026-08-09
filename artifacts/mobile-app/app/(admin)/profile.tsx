// Admin profile — reuses the same sign-out / account UI as the instructor profile
// but labels the role correctly and omits instructor-only settings.
import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function MenuItem({
  icon,
  label,
  onPress,
  destructive,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        item.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[item.icon, { backgroundColor: destructive ? "#FEE2E2" : colors.background }]}>
        <Feather name={icon as any} size={18} color={destructive ? "#DC2626" : colors.foreground} />
      </View>
      <Text style={[item.label, { color: destructive ? "#DC2626" : colors.foreground }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const item = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
});

const ROLE_LABEL: Record<string, string> = {
  school_admin: "School Admin",
  super_admin: "Super Admin",
  instructor: "Instructor",
};

export default function AdminProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { data: me } = useGetMe();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const roleLabel = ROLE_LABEL[(me as any)?.role] ?? "Admin";
  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.primaryEmailAddress?.emailAddress
    : "";

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => signOut().then(() => router.replace("/sign-in")),
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        s.content,
        { paddingTop: topPad + 8, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 },
      ]}
    >
      {/* Account card */}
      <View style={[s.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[s.avatarText, { color: colors.primary }]}>
            {(user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <Text style={[s.name, { color: colors.foreground }]}>{displayName}</Text>
        <View style={[s.roleBadge, { backgroundColor: colors.primary + "15" }]}>
          <Text style={[s.roleText, { color: colors.primary }]}>{roleLabel}</Text>
        </View>
      </View>

      {/* Menu items */}
      <View style={s.section}>
        <MenuItem icon="bell" label="Notifications" onPress={() => {}} colors={colors} />
        <MenuItem icon="help-circle" label="Help & Support" onPress={() => {}} colors={colors} />
        <MenuItem icon="log-out" label="Sign out" onPress={handleSignOut} destructive colors={colors} />
      </View>

      <Text style={[s.version, { color: colors.mutedForeground }]}>Steps2Drive Admin Portal</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16 },
  accountCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 10,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 30, fontFamily: "Inter_700Bold" },
  name: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  section: { gap: 8 },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
