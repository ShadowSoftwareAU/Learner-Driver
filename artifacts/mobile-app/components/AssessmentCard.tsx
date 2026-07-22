import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type Assessment = {
  id: number;
  date?: string | null;
  durationMinutes?: number | null;
  finalizationStatus?: string | null;
  notes?: string | null;
  student?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "#F1F5F9", color: "#64748B" },
  pending_approval: { label: "Pending", bg: "#FEF9C3", color: "#A16207" },
  approved: { label: "Approved", bg: "#F0FDF4", color: "#16A34A" },
  dispatched: { label: "Dispatched", bg: "#EFF6FF", color: "#2563EB" },
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const colors = useColors();
  const status = assessment.finalizationStatus ?? "draft";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const studentName = assessment.student
    ? [assessment.student.firstName, assessment.student.lastName].filter(Boolean).join(" ")
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.top}>
        <View style={styles.topLeft}>
          <View style={[styles.iconBg, { backgroundColor: colors.muted }]}>
            <Feather name="file-text" size={18} color={colors.primary} />
          </View>
          <View>
            {studentName ? (
              <Text style={[styles.studentName, { color: colors.foreground }]}>{studentName}</Text>
            ) : null}
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {formatDate(assessment.date)}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      <View style={styles.meta}>
        {assessment.durationMinutes ? (
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {assessment.durationMinutes} min
            </Text>
          </View>
        ) : null}
      </View>

      {assessment.notes ? (
        <Text style={[styles.notes, { color: colors.mutedForeground }]} numberOfLines={2}>
          {assessment.notes}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 1 },
  date: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  meta: { flexDirection: "row", gap: 12, marginBottom: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  notes: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 4 },
});
