import { useListAuditLogs } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React from "react";
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

function actionColor(action: string, colors: ReturnType<typeof useColors>): string {
  const a = (action ?? "").toLowerCase();
  if (a.includes("delete") || a.includes("remove") || a.includes("reject")) return colors.destructive;
  if (a.includes("create") || a.includes("approve") || a.includes("add")) return "#16A34A";
  if (a.includes("update") || a.includes("edit") || a.includes("change")) return "#D97706";
  return colors.primary;
}

function AuditRow({ item, colors }: { item: any; colors: ReturnType<typeof useColors> }) {
  const accent = actionColor(item.action, colors);
  const actor = item.actorName ?? item.actorId ?? "System";
  const resource = item.resourceType
    ? item.resourceId
      ? `${item.resourceType} #${item.resourceId}`
      : item.resourceType
    : null;
  const timestamp = item.createdAt
    ? new Date(item.createdAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <View style={[row.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[row.dot, { backgroundColor: accent }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={row.topLine}>
          <Text style={[row.action, { color: colors.foreground }]} numberOfLines={1}>
            {item.action ?? "Unknown action"}
          </Text>
          <Text style={[row.time, { color: colors.mutedForeground }]}>{timestamp}</Text>
        </View>
        <Text style={[row.actor, { color: colors.mutedForeground }]} numberOfLines={1}>
          {actor}
          {resource ? ` · ${resource}` : ""}
        </Text>
        {item.metadata ? (
          <Text style={[row.meta, { color: colors.mutedForeground }]} numberOfLines={2}>
            {(() => {
              try {
                const parsed =
                  typeof item.metadata === "string"
                    ? JSON.parse(item.metadata)
                    : item.metadata;
                if (parsed && typeof parsed === "object") {
                  const entries = Object.entries(parsed).slice(0, 3);
                  if (entries.length > 0) {
                    return entries.map(([k, v]) => `${k}: ${v}`).join("  ·  ");
                  }
                }
                return typeof item.metadata === "string" ? item.metadata : null;
              } catch {
                return typeof item.metadata === "string" ? item.metadata : null;
              }
            })()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  topLine: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  action: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  actor: { fontSize: 12, fontFamily: "Inter_400Regular" },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function AuditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    data: logs,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useListAuditLogs();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const list = (logs as any[]) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isLoading ? (
        <View style={[s.centered, { paddingTop: topPad + 24 }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={[s.centered, { paddingTop: topPad + 24 }]}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[s.errorText, { color: colors.mutedForeground }]}>
            Failed to load audit log
          </Text>
          <Pressable
            style={[s.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => refetch()}
          >
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item, i) => String(item.id ?? i)}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            s.content,
            {
              paddingTop: topPad + 8,
              paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80,
            },
          ]}
          ListHeaderComponent={
            <>
              <Text style={[s.title, { color: colors.foreground }]}>Audit Log</Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
                {list.length > 0 ? `${list.length} recent entries` : "No audit entries"}
              </Text>
            </>
          }
          renderItem={({ item }) => <AuditRow item={item} colors={colors} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="clipboard" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                No audit entries yet
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 2 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },
  errorText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
