import { useListStudents } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { StudentCard } from "@/components/StudentCard";

export default function StudentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: students, isLoading, isError, refetch, isRefetching } = useListStudents();

  const filtered = students?.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  }) ?? [];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Students</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {students ? `${students.length} learner${students.length !== 1 ? "s" : ""}` : ""}
        </Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search students…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
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
            Failed to load students
          </Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 },
          ]}
          scrollEnabled={!!filtered.length}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <StudentCard
              student={item}
              onPress={() => router.push(`/student/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Feather name="users" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search ? "No students match your search" : "No students yet"}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Add student FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: botPad + 24 }]}
        onPress={() => router.push("/new-student")}
      >
        <Feather name="user-plus" size={20} color="#FFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryButton: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
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
