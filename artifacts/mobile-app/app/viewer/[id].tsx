import {
  useGetViewerStudentDashboard,
  getGetViewerStudentDashboardQueryKey,
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
import { LogSessionModal } from "@/components/LogSessionModal";

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
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${Math.round(pct * 100)}%` }} />
    </View>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function ViewerStudentDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const [showLogModal, setShowLogModal] = useState(false);

  const {
    data: dashboard,
    isLoading,
    isError,
    refetch,
  } = useGetViewerStudentDashboard(studentId, undefined, {
    query: {
      enabled: !!studentId,
      queryKey: getGetViewerStudentDashboardQueryKey(studentId),
    },
  });

  const student = dashboard?.student;
  const displayName = student?.fullName || "Student";

  const instructorHours = dashboard?.instructorHours ?? 0;
  const supervisedHours = dashboard?.supervisedHours ?? 0;
  const effectiveTotal = dashboard?.effectiveTotalHours ?? (instructorHours + supervisedHours);
  const isQLD = dashboard?.isQLD ?? false;

  const recentAssessments = dashboard?.recentAssessments ?? [];
  const upcomingBookings = dashboard?.upcomingBookings ?? [];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Failed to load student details
          </Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Hero card */}
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Avatar name={displayName} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroName, { color: colors.foreground }]}>{displayName}</Text>
              {dashboard?.link?.relationshipType ? (
                <Text style={[styles.heroRelation, { color: colors.mutedForeground }]}>
                  {dashboard.link.relationshipType}
                </Text>
              ) : null}

              {/* Hours pills */}
              <View style={styles.heroMeta}>
                <View style={[styles.metaPill, { backgroundColor: "#F0F9FF" }]}>
                  <Feather name="clock" size={12} color="#0EA5E9" />
                  <Text style={[styles.metaText, { color: "#0EA5E9" }]}>
                    {effectiveTotal}h total
                  </Text>
                </View>
                {isQLD && (
                  <View style={[styles.metaPill, { backgroundColor: "#F0FDF4" }]}>
                    <Feather name="star" size={12} color="#10B981" />
                    <Text style={[styles.metaText, { color: "#10B981" }]}>QLD 3x</Text>
                  </View>
                )}
              </View>

              {/* Log session button */}
              <Pressable
                style={[styles.logBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowLogModal(true)}
              >
                <Feather name="plus-circle" size={14} color="#fff" />
                <Text style={styles.logBtnText}>Log supervised session</Text>
              </Pressable>
            </View>
          </View>

          {/* QLD hours breakdown */}
          {isQLD && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>QLD Hours Breakdown</Text>
              <View style={styles.hoursRow}>
                <View style={styles.hoursItem}>
                  <Text style={[styles.hoursValue, { color: "#2563EB" }]}>{instructorHours}</Text>
                  <Text style={[styles.hoursLabel, { color: colors.mutedForeground }]}>Instructor hrs</Text>
                </View>
                <Text style={[styles.hoursDivider, { color: colors.border }]}>x3</Text>
                <View style={styles.hoursItem}>
                  <Text style={[styles.hoursValue, { color: "#10B981" }]}>{supervisedHours}</Text>
                  <Text style={[styles.hoursLabel, { color: colors.mutedForeground }]}>Supervised hrs</Text>
                </View>
                <Text style={[styles.hoursDivider, { color: colors.border }]}>=</Text>
                <View style={styles.hoursItem}>
                  <Text style={[styles.hoursValue, { color: "#0EA5E9" }]}>{effectiveTotal}</Text>
                  <Text style={[styles.hoursLabel, { color: colors.mutedForeground }]}>Effective hrs</Text>
                </View>
              </View>
              <ProgressBar value={effectiveTotal} total={100} color="#2563EB" />
              <Text style={[styles.hoursHint, { color: colors.mutedForeground }]}>
                QLD requires 100 effective hours (instructor hrs count 3x)
              </Text>
            </View>
          )}

          {/* Hours summary (non-QLD) */}
          {!isQLD && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours Summary</Text>
              <View style={styles.hoursRow}>
                <View style={styles.hoursItem}>
                  <Text style={[styles.hoursValue, { color: "#2563EB" }]}>{instructorHours}</Text>
                  <Text style={[styles.hoursLabel, { color: colors.mutedForeground }]}>Instructor hrs</Text>
                </View>
                <View style={styles.hoursItem}>
                  <Text style={[styles.hoursValue, { color: "#10B981" }]}>{supervisedHours}</Text>
                  <Text style={[styles.hoursLabel, { color: colors.mutedForeground }]}>Supervised hrs</Text>
                </View>
                <View style={styles.hoursItem}>
                  <Text style={[styles.hoursValue, { color: "#0EA5E9" }]}>{effectiveTotal}</Text>
                  <Text style={[styles.hoursLabel, { color: colors.mutedForeground }]}>Total hrs</Text>
                </View>
              </View>
            </View>
          )}

          {/* Recent sessions */}
          {recentAssessments.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>Recent Sessions</Text>
              {recentAssessments.map((a, i) => (
                <View
                  key={a.id ?? i}
                  style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.sessionLeft}>
                    <View
                      style={[
                        styles.sessionBadge,
                        { backgroundColor: a.performedByRole === "supervised" ? "#F0FDF4" : "#EFF6FF" },
                      ]}
                    >
                      <Feather
                        name={a.performedByRole === "supervised" ? "user" : "briefcase"}
                        size={13}
                        color={a.performedByRole === "supervised" ? "#10B981" : "#2563EB"}
                      />
                      <Text
                        style={[
                          styles.sessionBadgeText,
                          { color: a.performedByRole === "supervised" ? "#10B981" : "#2563EB" },
                        ]}
                      >
                        {a.performedByRole === "supervised" ? "Supervised" : "Instructor"}
                      </Text>
                    </View>
                    <Text style={[styles.sessionDate, { color: colors.mutedForeground }]}>
                      {formatDate(a.lessonDate)}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <Feather name="clock" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.sessionDuration, { color: colors.foreground }]}>
                      {a.durationMinutes ?? 0} min
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Upcoming bookings */}
          {upcomingBookings.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>Upcoming Lessons</Text>
              {upcomingBookings.map((b, i) => (
                <View
                  key={b.id ?? i}
                  style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.sessionLeft}>
                    <Text style={[styles.sessionDate, { color: colors.foreground }]}>
                      {formatDate(b.scheduledAt)}
                    </Text>
                    {b.pickupAddress ? (
                      <Text style={[styles.sessionAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {b.pickupAddress}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.sessionDuration, { color: colors.mutedForeground }]}>
                    {b.durationMinutes ?? 0} min
                  </Text>
                </View>
              ))}
            </View>
          )}

          {recentAssessments.length === 0 && upcomingBookings.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={36} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No sessions recorded yet
              </Text>
            </View>
          )}
        </>
      )}

      <LogSessionModal
        visible={showLogModal}
        studentId={studentId}
        onClose={() => setShowLogModal(false)}
        onSuccess={() => {
          setShowLogModal(false);
          refetch();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 80 },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
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
  heroRelation: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
  heroMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  logBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 14 },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 14,
  },
  hoursItem: { alignItems: "center", gap: 2 },
  hoursValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  hoursLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  hoursDivider: { fontSize: 18, fontFamily: "Inter_700Bold" },
  hoursHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center" },
  listSection: { marginHorizontal: 16, marginBottom: 12 },
  listTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 10 },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionLeft: { gap: 4 },
  sessionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  sessionBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sessionDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sessionAddress: { fontSize: 12, fontFamily: "Inter_400Regular", maxWidth: 200 },
  sessionRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionDuration: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyState: { alignItems: "center", gap: 10, paddingTop: 48 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
