import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type Student = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  totalHours?: number | null;
  licenceClass?: string | null;
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

export function StudentCard({
  student,
  onPress,
}: {
  student: Student;
  onPress: () => void;
}) {
  const colors = useColors();
  const displayName =
    [student.firstName, student.lastName].filter(Boolean).join(" ") || student.email || "Unknown";
  const hours = student.totalHours ?? 0;

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
        <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
          {student.email ?? ""}
        </Text>
      </View>
      <View style={styles.meta}>
        <View style={[styles.hoursBadge, { backgroundColor: colors.muted }]}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.hoursText, { color: colors.mutedForeground }]}>{hours}h</Text>
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
  email: { fontSize: 12, fontFamily: "Inter_400Regular" },
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
});
