import { useListAdminStaff } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  support: "Support",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "#7C3AED",
  manager: "#2563EB",
  support: "#D97706",
};

function RoleBadge({ role, colors }: { role: string | null | undefined; colors: ReturnType<typeof useColors> }) {
  const key = (role ?? "support").toLowerCase();
  const label = ROLE_LABELS[key] ?? role ?? "Staff";
  const accent = ROLE_COLORS[key] ?? colors.primary;
  return (
    <View style={[badge.pill, { backgroundColor: accent + "20" }]}>
      <Text style={[badge.text, { color: accent }]}>{label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

function StaffRow({ item, colors }: { item: any; colors: ReturnType<typeof useColors> }) {
  const initials = (item.name ?? item.email ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <View style={[row.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[row.avatar, { backgroundColor: colors.primary + "20" }]}>
        <Text style={[row.avatarText, { color: colors.primary }]}>{initials || "?"}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[row.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.name ?? "—"}
        </Text>
        <Text style={[row.email, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.email}
        </Text>
      </View>
      <RoleBadge role={item.adminSubRole} colors={colors} />
    </View>
  );
}

function InviteRow({ item, colors }: { item: any; colors: ReturnType<typeof useColors> }) {
  const expiresAt = item.expiresAt
    ? new Date(item.expiresAt).toLocaleDateString("en-AU")
    : null;

  return (
    <View
      style={[
        row.container,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.7 },
      ]}
    >
      <View style={[row.avatar, { backgroundColor: "#D97706" + "20" }]}>
        <Feather name="mail" size={16} color="#D97706" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[row.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.inviteeEmail}
        </Text>
        {expiresAt ? (
          <Text style={[row.email, { color: colors.mutedForeground }]}>
            Invite expires {expiresAt}
          </Text>
        ) : null}
      </View>
      <View style={[badge.pill, { backgroundColor: "#D97706" + "20" }]}>
        <Text style={[badge.text, { color: "#D97706" }]}>Pending</Text>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  email: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

type ListItem =
  | { kind: "header"; label: string }
  | { kind: "staff"; data: any }
  | { kind: "invite"; data: any };

export default function StaffScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    data: staffData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useListAdminStaff();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const d = staffData as any;
  const staffList: any[] = d?.staff ?? [];
  const inviteList: any[] = d?.pendingInvites ?? [];

  const items: ListItem[] = [
    ...(staffList.length > 0
      ? [
          { kind: "header" as const, label: `Staff (${staffList.length})` },
          ...staffList.map((s) => ({ kind: "staff" as const, data: s })),
        ]
      : []),
    ...(inviteList.length > 0
      ? [
          { kind: "header" as const, label: "Pending Invites" },
          ...inviteList.map((i) => ({ kind: "invite" as const, data: i })),
        ]
      : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isLoading ? (
        <View style={[s.centered, { paddingTop: topPad + 24 }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={[s.centered, { paddingTop: topPad + 24 }]}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[s.errorText, { color: colors.mutedForeground }]}>
            Failed to load staff
          </Text>
          <Text style={[s.errorHint, { color: colors.mutedForeground }]}>
            Owner or Manager access required
          </Text>
          <Pressable
            style={[s.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => refetch()}
          >
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) =>
            item.kind === "header"
              ? `hdr-${i}`
              : item.kind === "staff"
              ? `staff-${item.data.id}`
              : `invite-${item.data.id}`
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            s.content,
            {
              paddingTop: topPad + 8,
              paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80,
            },
          ]}
          ListHeaderComponent={
            <Text style={[s.title, { color: colors.foreground }]}>Staff</Text>
          }
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return (
                <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
                  {item.label}
                </Text>
              );
            }
            if (item.kind === "staff") {
              return <StaffRow item={item.data} colors={colors} />;
            }
            return <InviteRow item={item.data} colors={colors} />;
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                No staff members found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 6 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },
  errorText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
