import { useListInstructors } from "@workspace/api-client-react";
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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function InstructorAdminCard({ instructor, colors }: { instructor: any; colors: ReturnType<typeof useColors> }) {
  const initials = [instructor.firstName?.[0], instructor.lastName?.[0]]
    .filter(Boolean).join("").toUpperCase() || "?";

  const rate = instructor.hourlyRateCents
    ? `$${(instructor.hourlyRateCents / 100).toFixed(0)}/hr`
    : null;

  return (
    <View style={[card.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[card.avatar, { backgroundColor: colors.primary + "20" }]}>
        <Text style={[card.avatarText, { color: colors.primary }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[card.name, { color: colors.foreground }]}>
          {instructor.firstName} {instructor.lastName}
        </Text>
        {instructor.email ? (
          <Text style={[card.sub, { color: colors.mutedForeground }]}>{instructor.email}</Text>
        ) : null}
        <View style={card.metaRow}>
          {instructor.suburb ? (
            <View style={card.meta}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[card.metaText, { color: colors.mutedForeground }]}>{instructor.suburb}</Text>
            </View>
          ) : null}
          {rate ? (
            <View style={card.meta}>
              <Feather name="dollar-sign" size={11} color={colors.mutedForeground} />
              <Text style={[card.metaText, { color: colors.mutedForeground }]}>{rate}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function AdminInstructorsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const { data: instructors, isLoading, isError, refetch, isRefetching } = useListInstructors();

  const filtered = useMemo(() => {
    if (!instructors) return [];
    const q = search.toLowerCase();
    if (!q) return instructors as any[];
    return (instructors as any[]).filter((i) =>
      (i.firstName + " " + i.lastName).toLowerCase().includes(q) ||
      i.email?.toLowerCase().includes(q) ||
      i.suburb?.toLowerCase().includes(q),
    );
  }, [instructors, search]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: colors.foreground }]}>Instructors</Text>
          <Text style={[s.count, { color: colors.mutedForeground }]}>
            {instructors ? String(filtered.length) : ""}
          </Text>
        </View>
        <View style={[s.searchBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search instructors…"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={s.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Failed to load instructors</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i: any) => String(i.id)}
          contentContainerStyle={[s.list, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
          scrollEnabled={filtered.length > 0}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => <InstructorAdminCard instructor={item} colors={colors} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.centered}>
              <Feather name="award" size={40} color={colors.border} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {search ? "No instructors match your search" : "No instructors yet"}
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
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
