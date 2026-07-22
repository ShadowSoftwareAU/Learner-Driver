import { useGetStudentDashboard } from "@workspace/api-client-react";
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
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Feather name={icon as "clock"} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

function ProgressBar({ value, total, color = "#2563EB" }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${Math.round(pct * 100)}%` }} />
    </View>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  "Pre-Drive Checks": "#6366F1",
  "Basic Vehicle Control": "#0EA5E9",
  "Road Position & Observation": "#10B981",
  "Intersections": "#F59E0B",
  "Merging & Changing Lanes": "#EF4444",
  "Roundabouts": "#8B5CF6",
  "Turning": "#06B6D4",
  "Parking": "#EC4899",
};

export default function StudentProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: dashboard, isLoading, isError, refetch, isRefetching } = useGetStudentDashboard();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const skillBreakdown = dashboard?.skillBreakdown ?? [];
  const totalManeuvers = dashboard?.totalManeuvers ?? 0;
  const masteredManeuvers = skillBreakdown.reduce((s, c) => s + (c.mastered ?? 0), 0);
  const overallPct = dashboard?.progressPercent ?? (totalManeuvers > 0 ? Math.round((masteredManeuvers / totalManeuvers) * 100) : 0);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={{ paddingTop: topPad + 8, paddingHorizontal: 20, marginBottom: 8 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Progress</Text>
        {dashboard?.nextFocusAreas ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
            Focus: {dashboard.nextFocusAreas}
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Failed to load progress
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.statsRow}>
            <StatCard
              icon="clock"
              label="Hours"
              value={`${dashboard?.totalHours ?? 0}`}
              color="#0EA5E9"
              bg="#F0F9FF"
            />
            <StatCard
              icon="award"
              label="Complete"
              value={`${overallPct}%`}
              color="#2563EB"
              bg="#EFF6FF"
            />
            <StatCard
              icon="check-circle"
              label="Mastered"
              value={`${dashboard?.completedManeuvers ?? masteredManeuvers}`}
              color="#10B981"
              bg="#F0FDF4"
            />
          </View>

          <View style={[styles.overallCard, { backgroundColor: "#EFF6FF" }]}>
            <View style={styles.overallTop}>
              <Text style={styles.overallTitle}>Overall Progress</Text>
              <Text style={styles.overallPct}>{overallPct}%</Text>
            </View>
            <ProgressBar value={dashboard?.completedManeuvers ?? masteredManeuvers} total={totalManeuvers} color="#2563EB" />
            <Text style={styles.overallSub}>
              {dashboard?.completedManeuvers ?? masteredManeuvers} of {totalManeuvers} maneuvers mastered
            </Text>
          </View>

          <Text style={[styles.sectionHeading, { color: colors.foreground }]}>Categories</Text>

          {skillBreakdown.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="bar-chart-2" size={32} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No progress data yet
              </Text>
            </View>
          ) : (
            skillBreakdown.map((cat) => {
              const catColor = CATEGORY_COLORS[cat.category] ?? colors.primary;
              const pct = cat.total > 0 ? Math.round((cat.mastered / cat.total) * 100) : 0;
              return (
                <View
                  key={cat.category}
                  style={[styles.catCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.catHeader}>
                    <Text style={[styles.catName, { color: colors.foreground }]}>{cat.category}</Text>
                    <Text style={[styles.catPct, { color: catColor }]}>{pct}%</Text>
                  </View>
                  <ProgressBar value={cat.mastered} total={cat.total} color={catColor} />
                  <Text style={[styles.catSub, { color: colors.mutedForeground }]}>
                    {cat.mastered}/{cat.total} mastered
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  centered: { justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 80 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16, marginTop: 8 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", opacity: 0.8 },
  overallCard: { borderRadius: 14, padding: 16, marginBottom: 20 },
  overallTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  overallTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1D4ED8" },
  overallPct: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1D4ED8" },
  overallSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#3B82F6", marginTop: 6 },
  sectionHeading: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 12 },
  catCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  catHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  catName: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  catPct: { fontSize: 14, fontFamily: "Inter_700Bold" },
  catSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
  emptyState: { alignItems: "center", gap: 10, paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryButton: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
