import { useListStudents } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { StudentCard } from "@/components/StudentCard";

export default function AdminStudentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: students, isLoading, isError, refetch, isRefetching } = useListStudents();

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.toLowerCase();
    if (!q) return students as any[];
    return (students as any[]).filter((s) =>
      (s.fullName ?? (s.firstName + " " + s.lastName)).toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q),
    );
  }, [students, search]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: colors.foreground }]}>Students</Text>
          <Text style={[s.count, { color: colors.mutedForeground }]}>
            {students ? `${filtered.length}` : ""}
          </Text>
        </View>
        <View style={[s.searchBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search students…"
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
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Failed to load students</Text>
          <Pressable style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s: any) => String(s.id)}
          contentContainerStyle={[s.list, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
          scrollEnabled={filtered.length > 0}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <StudentCard
              student={item}
              onPress={() => router.push(`/student/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.centered}>
              <Feather name="users" size={40} color={colors.border} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {search ? "No students match your search" : "No students yet"}
              </Text>
            </View>
          }
        />
      )}

      {/* Add student FAB */}
      <Pressable
        style={[s.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
        onPress={() => router.push("/new-student")}
      >
        <Feather name="user-plus" size={20} color="#FFF" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
});
