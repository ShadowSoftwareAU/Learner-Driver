import { useGetExpiringDocuments } from "@workspace/api-client-react";
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

function daysLabel(days: number): string {
  if (days <= 0) return "Expired";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function daysAccent(days: number, colors: ReturnType<typeof useColors>): string {
  if (days <= 0) return colors.destructive;
  if (days <= 7) return "#DC2626";
  if (days <= 30) return "#D97706";
  return colors.primary;
}

function DocRow({ item, colors }: { item: any; colors: ReturnType<typeof useColors> }) {
  const days: number = item.daysUntilExpiry ?? 0;
  const accent = daysAccent(days, colors);
  const expiresAt = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("en-AU") : "—";

  return (
    <View style={[row.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[row.badge, { backgroundColor: accent + "20" }]}>
        <Feather name="file-text" size={18} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[row.docType, { color: colors.foreground }]} numberOfLines={1}>
          {item.docType ?? "Document"}
        </Text>
        <Text style={[row.instructor, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.instructorName ?? item.instructorEmail ?? `Instructor #${item.instructorId}`}
        </Text>
        <Text style={[row.meta, { color: colors.mutedForeground }]}>
          Expires {expiresAt}
        </Text>
      </View>
      <View style={[row.pill, { backgroundColor: accent + "20" }]}>
        <Text style={[row.pillText, { color: accent }]}>{daysLabel(days)}</Text>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  docType: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  instructor: { fontSize: 12, fontFamily: "Inter_400Regular" },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

export default function VerificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    data: docs,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useGetExpiringDocuments();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const list = (docs as any[]) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isLoading ? (
        <View
          style={[
            s.centered,
            { paddingTop: topPad + 24 },
          ]}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={[s.centered, { paddingTop: topPad + 24 }]}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[s.errorText, { color: colors.mutedForeground }]}>
            Failed to load documents
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
              <Text style={[s.title, { color: colors.foreground }]}>
                Verifications
              </Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
                {list.length === 0
                  ? "No expiring documents"
                  : `${list.length} document${list.length === 1 ? "" : "s"} expiring within 30 days`}
              </Text>
            </>
          }
          renderItem={({ item }) => <DocRow item={item} colors={colors} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="check-circle" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                All documents are current
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
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 60,
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
