import {
  useGetStudent,
  useGetStudentProgress,
  useListAssessments,
  getGetStudentQueryKey,
  getGetStudentProgressQueryKey,
  getListAssessmentsQueryKey,
} from "@workspace/api-client-react";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { AssessmentCard } from "@/components/AssessmentCard";

function Avatar({ name, size = 56 }: { name: string; size?: number }) {
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
        backgroundColor: "#EFF6FF",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.36, fontFamily: "Inter_700Bold", color: "#2563EB" }}>
        {initials}
      </Text>
    </View>
  );
}

function ProgressBar({ value, total, color = "#2563EB" }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${pct * 100}%` }} />
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

type TabType = "progress" | "assessments";

export default function StudentDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const [tab, setTab] = useState<TabType>("progress");

  const {
    data: student,
    isLoading: loadingStudent,
    refetch: refetchStudent,
  } = useGetStudent(studentId, { query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) } });

  const {
    data: progress,
    isLoading: loadingProgress,
    refetch: refetchProgress,
  } = useGetStudentProgress(studentId, { query: { enabled: !!studentId, queryKey: getGetStudentProgressQueryKey(studentId) } });

  const {
    data: assessments,
    isLoading: loadingAssessments,
    refetch: refetchAssessments,
  } = useListAssessments({ studentId }, { query: { enabled: !!studentId, queryKey: getListAssessmentsQueryKey({ studentId }) } });

  const isLoading = loadingStudent || loadingProgress;

  const handleRefresh = () => {
    refetchStudent();
    refetchProgress();
    refetchAssessments();
  };

  const displayName = student ? student.fullName || "Student" : "Student";

  const categories = progress?.skillBreakdown ?? [];
  const totalManeuvers = categories.reduce((sum, c) => sum + (c.total ?? 0), 0);
  const masteredManeuvers = categories.reduce((sum, c) => sum + (c.mastered ?? 0), 0);
  const overallPct = totalManeuvers > 0 ? Math.round((masteredManeuvers / totalManeuvers) * 100) : 0;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Avatar name={displayName} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroName, { color: colors.foreground }]}>{displayName}</Text>
              <Text style={[styles.heroEmail, { color: colors.mutedForeground }]}>
                {student?.email ?? ""}
              </Text>
              <View style={styles.heroMeta}>
                <View style={[styles.metaPill, { backgroundColor: colors.muted }]}>
                  <Feather name="clock" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {student?.totalHours ?? 0}h logged
                  </Text>
                </View>
                <View style={[styles.metaPill, { backgroundColor: "#EFF6FF" }]}>
                  <Feather name="award" size={12} color="#2563EB" />
                  <Text style={[styles.metaText, { color: "#2563EB" }]}>
                    {overallPct}% complete
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.tabRow, { borderColor: colors.border }]}>
            {(["progress", "assessments"] as TabType[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setTab(t)}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: tab === t ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {t === "progress" ? "Progress" : "Assessments"}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "progress" ? (
            <View style={styles.section}>
              <View style={[styles.overallCard, { backgroundColor: "#EFF6FF" }]}>
                <View style={styles.overallTop}>
                  <Text style={[styles.sectionTitle, { color: "#1D4ED8" }]}>Overall Progress</Text>
                  <Text style={styles.overallPct}>{overallPct}%</Text>
                </View>
                <ProgressBar value={masteredManeuvers} total={totalManeuvers} color="#2563EB" />
                <Text style={styles.overallSub}>
                  {masteredManeuvers} of {totalManeuvers} maneuvers mastered
                </Text>
              </View>

              {categories.length > 0 ? (
                categories.map((cat) => {
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
              ) : (
                <View style={styles.emptyState}>
                  <Feather name="bar-chart-2" size={32} color={colors.border} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No progress data yet
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              {loadingAssessments ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : assessments?.length ? (
                assessments.map((a) => (
                  <View key={a.id} style={{ marginBottom: 8 }}>
                    <AssessmentCard assessment={a} />
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Feather name="file-text" size={32} color={colors.border} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No assessments yet
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  heroCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroName: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 2 },
  heroEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
  heroMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  section: { paddingHorizontal: 16, paddingTop: 8 },
  overallCard: { borderRadius: 14, padding: 16, marginBottom: 12 },
  overallTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  overallPct: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1D4ED8" },
  overallSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#3B82F6", marginTop: 6 },
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
  emptyState: { alignItems: "center", gap: 10, paddingTop: 48 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
