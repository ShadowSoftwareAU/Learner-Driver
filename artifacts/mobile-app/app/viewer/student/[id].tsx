import {
  useGetViewerStudentDashboard,
  getGetViewerStudentDashboardQueryKey,
} from "@workspace/api-client-react";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        statStyles.card,
        {
          backgroundColor: accent ? "#EFF6FF" : colors.card,
          borderColor: accent ? "#BFDBFE" : colors.border,
        },
      ]}
    >
      <Text style={[statStyles.value, { color: accent ? "#2563EB" : colors.foreground }]}>
        {value}
      </Text>
      {sub ? (
        <Text style={[statStyles.sub, { color: accent ? "#3B82F6" : colors.mutedForeground }]}>
          {sub}
        </Text>
      ) : null}
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 2,
  },
  value: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  label: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});

export default function ViewerStudentDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = parseInt(id, 10);
  const [showLogModal, setShowLogModal] = useState(false);

  const { data, isLoading, isError, refetch } = useGetViewerStudentDashboard(studentId, undefined, {
    query: {
      enabled: !isNaN(studentId),
      queryKey: getGetViewerStudentDashboardQueryKey(studentId),
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={32} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          Could not load student details
        </Text>
      </View>
    );
  }

  const { student, instructorHours, supervisedHours, effectiveTotalHours, isQLD } = data;
  const displayName = student.fullName || "Student";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Avatar name={displayName} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]}>{displayName}</Text>
          {data.link?.relationshipType ? (
            <Text style={[styles.relationship, { color: colors.mutedForeground }]}>
              {data.link.relationshipType}
            </Text>
          ) : null}
          {isQLD ? (
            <View style={styles.qldBadge}>
              <Text style={styles.qldBadgeText}>QLD</Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.logBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowLogModal(true)}
          >
            <Feather name="plus-circle" size={14} color="#fff" />
            <Text style={styles.logBtnText}>Log supervised session</Text>
          </Pressable>
        </View>
      </View>

      {/* Hours breakdown */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours</Text>
      <View style={styles.statsRow}>
        {isQLD ? (
          <StatCard
            label="Effective total"
            value={`${effectiveTotalHours ?? 0}h`}
            sub="3x instructor hours"
            accent
          />
        ) : (
          <StatCard
            label="Total hours"
            value={`${student.totalHours ?? 0}h`}
          />
        )}
        <StatCard label="With instructor" value={`${instructorHours ?? 0}h`} />
        <StatCard label="Supervised" value={`${supervisedHours ?? 0}h`} />
      </View>

      {isQLD ? (
        <View style={[styles.qldNote, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
          <Feather name="info" size={14} color="#3B82F6" />
          <Text style={styles.qldNoteText}>
            QLD learners count each instructor hour as 3 effective hours toward
            the 100h requirement.
          </Text>
        </View>
      ) : null}

      {/* Recent assessments */}
      {data.recentAssessments?.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Recent lessons
          </Text>
          {data.recentAssessments.map((a) => (
            <View
              key={a.id}
              style={[
                styles.lessonRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="calendar" size={16} color={colors.mutedForeground} />
              <Text style={[styles.lessonDate, { color: colors.foreground }]}>
                {a.lessonDate
                  ? new Date(a.lessonDate).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Unknown date"}
              </Text>
              <Text style={[styles.lessonDur, { color: colors.mutedForeground }]}>
                {a.durationMinutes}min
              </Text>
            </View>
          ))}
        </>
      ) : null}

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
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  name: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 2 },
  relationship: { fontSize: 13, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  qldBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  qldBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2563EB" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  statsRow: { flexDirection: "row", gap: 8 },
  qldNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  qldNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#3B82F6",
    lineHeight: 18,
  },
  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  lessonDate: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  lessonDur: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  logBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
