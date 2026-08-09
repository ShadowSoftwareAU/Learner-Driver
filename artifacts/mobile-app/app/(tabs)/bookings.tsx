import { useListBookings } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
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

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "#FEF3C7", text: "#D97706", label: "Pending" },
  confirmed:  { bg: "#DBEAFE", text: "#2563EB", label: "Confirmed" },
  completed:  { bg: "#DCFCE7", text: "#16A34A", label: "Completed" },
  cancelled:  { bg: "#FEE2E2", text: "#DC2626", label: "Cancelled" },
  no_show:    { bg: "#F3F4F6", text: "#6B7280", label: "No Show" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

function BookingCard({ booking, colors }: { booking: any; colors: ReturnType<typeof useColors> }) {
  const dt = formatDateTime(booking.scheduledAt ?? booking.lessonDate ?? "");
  const status = STATUS_STYLE[booking.status] ?? STATUS_STYLE.pending;

  return (
    <View style={[card.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={card.top}>
        <View style={{ flex: 1 }}>
          <Text style={[card.name, { color: colors.foreground }]} numberOfLines={1}>
            {booking.studentName ?? "Student"}
          </Text>
          <Text style={[card.sub, { color: colors.mutedForeground }]}>
            {dt.date} · {dt.time} · {booking.durationMinutes ?? 60} min
          </Text>
        </View>
        <View style={[card.badge, { backgroundColor: status.bg }]}>
          <Text style={[card.badgeText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>
      {booking.notes ? (
        <Text style={[card.notes, { color: colors.mutedForeground }]} numberOfLines={2}>
          {booking.notes}
        </Text>
      ) : null}
    </View>
  );
}

const card = StyleSheet.create({
  container: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  notes: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
});

type Filter = "upcoming" | "past" | "all";

export default function InstructorBookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const { data: bookings, isLoading, isError, refetch, isRefetching } = useListBookings();

  const now = new Date();
  const filtered = useMemo(() => {
    if (!bookings) return [];
    return (bookings as any[]).filter((b) => {
      const d = new Date(b.scheduledAt ?? b.lessonDate ?? 0);
      if (filter === "upcoming") return d >= now && b.status !== "cancelled" && b.status !== "no_show";
      if (filter === "past") return d < now || b.status === "completed" || b.status === "no_show";
      return true;
    });
  }, [bookings, filter]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "all", label: "All" },
  ];

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <Text style={[s.title, { color: colors.foreground }]}>Bookings</Text>
        <View style={s.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[
                s.filterBtn,
                { borderColor: colors.border },
                filter === f.key && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterText, { color: filter === f.key ? "#FFF" : colors.foreground }]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={s.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Failed to load bookings</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b: any) => String(b.id)}
          contentContainerStyle={[
            s.list,
            { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 },
          ]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => <BookingCard booking={item} colors={colors} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.centered}>
              <Feather name="calendar" size={40} color={colors.border} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {filter === "upcoming" ? "No upcoming bookings" : "No bookings found"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
