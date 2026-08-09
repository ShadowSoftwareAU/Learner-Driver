import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function StatCard({
  icon,
  label,
  value,
  accent,
  colors,
}: {
  icon: string;
  label: string;
  value: string | number;
  accent: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[card.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[card.iconBox, { backgroundColor: accent + "20" }]}>
        <Feather name={icon as any} size={20} color={accent} />
      </View>
      <Text style={[card.value, { color: colors.foreground }]}>{value ?? "—"}</Text>
      <Text style={[card.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const card = StyleSheet.create({
  container: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 8, minWidth: 140 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 26, fontFamily: "Inter_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

export default function AdminOverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: dash, isLoading, isError, refetch, isRefetching } = useGetAdminDashboard();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const d = dash as any;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Text style={[s.title, { color: colors.foreground }]}>Overview</Text>

      {isLoading ? (
        <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={s.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[s.errorText, { color: colors.mutedForeground }]}>Failed to load dashboard</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Stat grid */}
          <View style={s.grid}>
            <StatCard icon="users" label="Students" value={d?.totalStudents ?? d?.studentCount ?? "—"} accent="#2563EB" colors={colors} />
            <StatCard icon="award" label="Instructors" value={d?.totalInstructors ?? d?.instructorCount ?? "—"} accent="#7C3AED" colors={colors} />
          </View>
          <View style={s.grid}>
            <StatCard icon="calendar" label="Total Bookings" value={d?.totalBookings ?? d?.bookingCount ?? "—"} accent="#D97706" colors={colors} />
            <StatCard icon="shield" label="Pending Verif." value={d?.pendingVerifications ?? d?.pendingVerificationCount ?? "—"} accent="#DC2626" colors={colors} />
          </View>

          {/* Recent activity placeholder */}
          {d?.recentActivity?.length > 0 ? (
            <>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
              {(d.recentActivity as any[]).slice(0, 5).map((item: any, i: number) => (
                <View key={i} style={[s.activityRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.activityDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.activityText, { color: colors.foreground }]}>{item.description ?? item.action}</Text>
                    {item.createdAt ? (
                      <Text style={[s.activityTime, { color: colors.mutedForeground }]}>
                        {new Date(item.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 6 },
  grid: { flexDirection: "row", gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginTop: 8, marginBottom: 4 },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  activityText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  activityTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  centered: { justifyContent: "center", alignItems: "center", gap: 12, paddingVertical: 40 },
  errorText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
