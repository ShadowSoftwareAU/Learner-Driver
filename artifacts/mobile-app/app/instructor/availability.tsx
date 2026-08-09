import {
  useGetMyAvailability,
  useGetMyAvailabilityContexts,
  useCreateAvailabilitySlot,
  useDeleteAvailabilitySlot,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const AVAIL_QK = ["/api/availability/me"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(t: string) {
  // HH:mm → h:mm am/pm
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

function isValidTime(val: string): boolean {
  return /^\d{2}:\d{2}$/.test(val) && (() => {
    const [h, m] = val.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  })();
}

function transmissionLabel(csv: string): string {
  const parts = csv.split(",").map((s) => s.trim());
  if (parts.includes("auto") && parts.includes("manual")) return "Auto & Manual";
  if (parts.includes("manual")) return "Manual only";
  return "Automatic only";
}

// ─── Slot card ────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  colors,
  onDelete,
}: {
  slot: any;
  colors: ReturnType<typeof useColors>;
  onDelete: () => void;
}) {
  return (
    <View style={[card.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={card.row}>
        <View style={[card.dayBadge, { backgroundColor: colors.primary + "18" }]}>
          <Text style={[card.dayText, { color: colors.primary }]}>{DAY_SHORT[slot.dayOfWeek]}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[card.time, { color: colors.foreground }]}>
            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
          </Text>
          <Text style={[card.sub, { color: colors.mutedForeground }]}>
            {transmissionLabel(slot.transmissionTypes ?? "auto")}
            {slot.contextType === "school" ? "  ·  School" : "  ·  Independent"}
          </Text>
        </View>
        <Pressable
          style={[card.deleteBtn, { borderColor: colors.border }]}
          onPress={onDelete}
          hitSlop={8}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: { borderRadius: 12, borderWidth: 1, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  time: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Day section header ───────────────────────────────────────────────────────

function DaySectionHeader({ day, colors }: { day: number; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>{DAY_LONG[day]}</Text>
  );
}

// ─── Add Slot Form ────────────────────────────────────────────────────────────

interface AddSlotFormProps {
  colors: ReturnType<typeof useColors>;
  contexts: Array<{ type: string; label: string; schoolAdminId?: number | null }>;
  onClose: () => void;
  onSaved: () => void;
}

function AddSlotForm({ colors, contexts, onClose, onSaved }: AddSlotFormProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [transmissions, setTransmissions] = useState<string[]>(["auto"]);
  const [contextKey, setContextKey] = useState(
    contexts.length > 0 ? buildContextKey(contexts[0]) : "independent"
  );
  const [saving, setSaving] = useState(false);

  const create = useCreateAvailabilitySlot();

  function buildContextKey(ctx: { type: string; schoolAdminId?: number | null }): string {
    return ctx.type === "school" && ctx.schoolAdminId
      ? `school:${ctx.schoolAdminId}`
      : "independent";
  }

  function parseContextKey(val: string): { contextType: "independent" | "school"; schoolAdminId?: number } {
    if (val.startsWith("school:")) {
      const id = parseInt(val.slice(7), 10);
      if (!isNaN(id)) return { contextType: "school", schoolAdminId: id };
    }
    return { contextType: "independent" };
  }

  function toggleTransmission(t: string) {
    setTransmissions((prev) =>
      prev.includes(t) ? (prev.length > 1 ? prev.filter((x) => x !== t) : prev) : [...prev, t]
    );
  }

  async function handleSave() {
    if (selectedDay === null) {
      Alert.alert("Select a day", "Please pick a day of the week for this slot.");
      return;
    }
    if (!isValidTime(startTime)) {
      Alert.alert("Invalid start time", "Enter time as HH:MM, e.g. 08:00.");
      return;
    }
    if (!isValidTime(endTime)) {
      Alert.alert("Invalid end time", "Enter time as HH:MM, e.g. 17:00.");
      return;
    }
    if (startTime >= endTime) {
      Alert.alert("Invalid range", "End time must be after start time.");
      return;
    }

    setSaving(true);
    try {
      const ctx = parseContextKey(contextKey);
      await create.mutateAsync({
        data: {
          dayOfWeek: selectedDay,
          startTime,
          endTime,
          transmissionTypes: transmissions.join(","),
          isActive: true,
          ...ctx,
        },
      });
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Something went wrong. Please try again.";
      Alert.alert("Could not save slot", msg);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [f.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }];

  return (
    <View style={[f.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      <View style={f.header}>
        <Text style={[f.title, { color: colors.foreground }]}>Add Availability Slot</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Day picker */}
      <Text style={[f.label, { color: colors.foreground }]}>Day</Text>
      <View style={f.dayRow}>
        {DAY_SHORT.map((label, idx) => (
          <Pressable
            key={idx}
            style={[
              f.dayChip,
              { borderColor: colors.border },
              selectedDay === idx && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSelectedDay(idx)}
          >
            <Text
              style={[
                f.dayChipText,
                { color: selectedDay === idx ? "#FFF" : colors.foreground },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Times */}
      <View style={f.row}>
        <View style={{ flex: 1 }}>
          <Text style={[f.label, { color: colors.foreground }]}>Start (HH:MM)</Text>
          <TextInput
            style={inputStyle}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="08:00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            autoCorrect={false}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[f.label, { color: colors.foreground }]}>End (HH:MM)</Text>
          <TextInput
            style={inputStyle}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="17:00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Transmission */}
      <Text style={[f.label, { color: colors.foreground }]}>Transmission</Text>
      <View style={f.row}>
        {(["auto", "manual"] as const).map((t) => (
          <Pressable
            key={t}
            style={[
              f.toggleChip,
              { borderColor: colors.border },
              transmissions.includes(t) && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => toggleTransmission(t)}
          >
            <Text
              style={[
                f.toggleChipText,
                { color: transmissions.includes(t) ? "#FFF" : colors.foreground },
              ]}
            >
              {t === "auto" ? "Automatic" : "Manual"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Context – only show when there are multiple options */}
      {contexts.length > 1 && (
        <>
          <Text style={[f.label, { color: colors.foreground }]}>Context</Text>
          <View style={f.row}>
            {contexts.map((ctx) => {
              const key = buildContextKey(ctx);
              return (
                <Pressable
                  key={key}
                  style={[
                    f.toggleChip,
                    { borderColor: colors.border },
                    contextKey === key && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setContextKey(key)}
                >
                  <Text
                    style={[
                      f.toggleChipText,
                      { color: contextKey === key ? "#FFF" : colors.foreground },
                    ]}
                  >
                    {ctx.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Save button */}
      <Pressable
        style={[f.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={f.saveBtnText}>Save Slot</Text>
        )}
      </Pressable>
    </View>
  );
}

const f = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 8,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  dayRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  dayChip: {
    width: 42,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InstructorAvailabilityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: rawSlots, isLoading, isError, refetch, isRefetching } = useGetMyAvailability({
    query: { queryKey: AVAIL_QK },
  });

  const { data: rawContexts } = useGetMyAvailabilityContexts({
    query: { queryKey: ["/api/availability/my-contexts"] },
  });

  const deleteSlot = useDeleteAvailabilitySlot();

  const slots = (rawSlots ?? []) as any[];
  const contexts = (rawContexts ?? []) as Array<{ type: string; label: string; schoolAdminId?: number | null }>;

  // Group slots by day of week for display
  const grouped = React.useMemo(() => {
    const byDay: { day: number; items: any[] }[] = [];
    const map = new Map<number, any[]>();
    for (const slot of slots) {
      const d = slot.dayOfWeek as number;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(slot);
    }
    // Sort by day 0–6
    for (let d = 0; d <= 6; d++) {
      if (map.has(d)) byDay.push({ day: d, items: map.get(d)! });
    }
    return byDay;
  }, [slots]);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert("Remove slot?", "This availability window will be removed and students won't be able to book it.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSlot.mutateAsync({ id });
              qc.invalidateQueries({ queryKey: AVAIL_QK });
            } catch {
              Alert.alert("Error", "Could not remove this slot. Please try again.");
            }
          },
        },
      ]);
    },
    [deleteSlot, qc]
  );

  const handleSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: AVAIL_QK });
  }, [qc]);

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  // Flatten grouped into a list-compatible structure for FlatList
  type ListItem =
    | { type: "header"; day: number; key: string }
    | { type: "slot"; slot: any; key: string };

  const listData: ListItem[] = React.useMemo(() => {
    const items: ListItem[] = [];
    for (const group of grouped) {
      items.push({ type: "header", day: group.day, key: `h-${group.day}` });
      for (const slot of group.items) {
        items.push({ type: "slot", slot, key: `s-${slot.id}` });
      }
    }
    return items;
  }, [grouped]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Page header */}
      <View style={[s.header, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <Text style={[s.title, { color: colors.foreground }]}>Availability</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
          Students can book lessons during these windows
        </Text>
      </View>

      {/* Slot list */}
      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={s.centered}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Failed to load availability
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
          data={listData}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[
            s.list,
            { paddingBottom: showForm ? 0 : (Platform.OS === "web" ? 34 : insets.bottom) + 24 },
          ]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            if (item.type === "header") {
              return <DaySectionHeader day={item.day} colors={colors} />;
            }
            return (
              <SlotCard
                slot={item.slot}
                colors={colors}
                onDelete={() => handleDelete(item.slot.id)}
              />
            );
          }}
          ItemSeparatorComponent={({ leadingItem }) =>
            (leadingItem as ListItem).type === "header" ? null : <View style={{ height: 8 }} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="clock" size={48} color={colors.border} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                No availability slots yet
              </Text>
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
                Add a slot below to let students book lessons with you.
              </Text>
            </View>
          }
          ListFooterComponent={
            !showForm ? (
              <Pressable
                style={[s.addBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowForm(true)}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={[s.addBtnText, { color: colors.primary }]}>Add Availability Slot</Text>
              </Pressable>
            ) : null
          }
        />
      )}

      {/* Inline add form */}
      {showForm && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          bounces={false}
          style={{ flexShrink: 0 }}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 16 : insets.bottom + 8 }}
        >
          <AddSlotForm
            colors={colors}
            contexts={contexts}
            onClose={() => setShowForm(false)}
            onSaved={handleSaved}
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
    paddingLeft: 2,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 60 },
  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    marginHorizontal: 0,
  },
  addBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
