import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type ViewerStudent = {
  id: number;
  fullName?: string | null;
  totalHours?: number | null;
  instructorHours?: number | null;
  supervisedHours?: number | null;
  effectiveTotalHours?: number | null;
  isQLD?: boolean | null;
};

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
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

export function ViewerStudentCard({
  student,
  onPress,
}: {
  student: ViewerStudent;
  onPress: () => void;
}) {
  const colors = useColors();
  const displayName = student.fullName || "Unknown";

  const isQLD = !!student.isQLD;
  const displayHours = isQLD
    ? (student.effectiveTotalHours ?? 0)
    : (student.totalHours ?? 0);
  const instructorHrs = student.instructorHours ?? 0;
  const supervisedHrs = student.supervisedHours ?? 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
      onPress={onPress}
    >
      <Avatar name={displayName} />

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {displayName}
        </Text>
        {isQLD ? (
          <Text style={[styles.split, { color: colors.mutedForeground }]} numberOfLines={1}>
            {instructorHrs}h instructor · {supervisedHrs}h supervised
          </Text>
        ) : null}
      </View>

      <View style={styles.meta}>
        <View style={[styles.hoursBadge, { backgroundColor: isQLD ? "#EFF6FF" : colors.muted }]}>
          <Feather name="clock" size={11} color={isQLD ? "#2563EB" : colors.mutedForeground} />
          <Text style={[styles.hoursText, { color: isQLD ? "#2563EB" : colors.mutedForeground }]}>
            {displayHours}h
          </Text>
          {isQLD ? (
            <Text style={[styles.qldTag, { color: "#2563EB" }]}>eff.</Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={18} color={colors.border} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  split: { fontSize: 11, fontFamily: "Inter_400Regular" },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  hoursBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hoursText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  qldTag: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
