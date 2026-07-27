import {
  useCreateSupervisedSession,
  SupervisedSessionInputWeatherCondition,
  SupervisedSessionInputLightingCondition,
  SupervisedSessionInputPedalOperator,
} from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type Weather = SupervisedSessionInputWeatherCondition;
type Lighting = SupervisedSessionInputLightingCondition;
type Pedal = SupervisedSessionInputPedalOperator;

const WEATHER_OPTIONS: { value: Weather; label: string; icon: string }[] = [
  { value: "clear", label: "Clear", icon: "sun" },
  { value: "partly_cloudy", label: "Partly cloudy", icon: "cloud" },
  { value: "overcast", label: "Overcast", icon: "cloud" },
  { value: "light_rain", label: "Light rain", icon: "cloud-drizzle" },
  { value: "heavy_rain", label: "Heavy rain", icon: "cloud-rain" },
  { value: "foggy", label: "Foggy", icon: "wind" },
  { value: "windy", label: "Windy", icon: "wind" },
];

const LIGHTING_OPTIONS: { value: Lighting; label: string; icon: string }[] = [
  { value: "daylight", label: "Daylight", icon: "sun" },
  { value: "dawn", label: "Dawn", icon: "sunrise" },
  { value: "dusk", label: "Dusk", icon: "sunset" },
  { value: "night", label: "Night", icon: "moon" },
];

const PEDAL_OPTIONS: { value: Pedal; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "instructor", label: "Supervisor" },
  { value: "shared", label: "Shared" },
];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function parseDateInput(raw: string): string | null {
  // Accept yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return raw;
  }
  // Accept dd/mm/yyyy
  const parts = raw.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return iso;
  }
  return null;
}

interface Props {
  visible: boolean;
  studentId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogSessionModal({ visible, studentId, onClose, onSuccess }: Props) {
  const colors = useColors();

  const [lessonDate, setLessonDate] = useState(todayISO());
  const [durationText, setDurationText] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [lighting, setLighting] = useState<Lighting | null>(null);
  const [pedal, setPedal] = useState<Pedal>("student");
  const [notes, setNotes] = useState("");
  const [dateError, setDateError] = useState("");
  const [durationError, setDurationError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const { mutate, isPending } = useCreateSupervisedSession();

  function resetForm() {
    setLessonDate(todayISO());
    setDurationText("");
    setWeather(null);
    setLighting(null);
    setPedal("student");
    setNotes("");
    setDateError("");
    setDurationError("");
    setSubmitError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit() {
    setDateError("");
    setDurationError("");
    setSubmitError("");

    let valid = true;

    const parsedDate = parseDateInput(lessonDate);
    if (!parsedDate) {
      setDateError("Enter a valid date (dd/mm/yyyy or yyyy-mm-dd)");
      valid = false;
    }

    const duration = parseInt(durationText, 10);
    if (!durationText || isNaN(duration) || duration < 1 || duration > 480) {
      setDurationError("Enter a duration between 1 and 480 minutes");
      valid = false;
    }

    if (!valid) return;

    mutate(
      {
        studentId,
        data: {
          lessonDate: parsedDate!,
          durationMinutes: duration,
          pedalOperator: pedal,
          weatherCondition: weather ?? undefined,
          lightingCondition: lighting ?? undefined,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          resetForm();
          onSuccess();
        },
        onError: () => {
          setSubmitError("Could not save the session. Please try again.");
        },
      }
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { borderColor: colors.border }]}>
          <Pressable onPress={handleClose} style={styles.headerBtn} hitSlop={12}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Log supervised session
          </Text>
          <Pressable
            onPress={handleSubmit}
            style={[styles.saveBtn, { backgroundColor: colors.primary }, isPending && { opacity: 0.6 }]}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Date</Text>
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: dateError ? "#EF4444" : colors.border },
              ]}
              value={lessonDate}
              onChangeText={(t) => { setLessonDate(t); setDateError(""); }}
              placeholder="dd/mm/yyyy"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
            {dateError ? <Text style={styles.fieldError}>{dateError}</Text> : null}
          </View>

          {/* Duration */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Duration (minutes)</Text>
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: durationError ? "#EF4444" : colors.border },
              ]}
              value={durationText}
              onChangeText={(t) => { setDurationText(t); setDurationError(""); }}
              placeholder="e.g. 60"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            {durationError ? <Text style={styles.fieldError}>{durationError}</Text> : null}
          </View>

          {/* Pedal operator */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Pedal operator</Text>
            <View style={styles.chipRow}>
              {PEDAL_OPTIONS.map((opt) => {
                const active = pedal === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPedal(opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Weather */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Weather (optional)</Text>
            <View style={styles.chipRow}>
              {WEATHER_OPTIONS.map((opt) => {
                const active = weather === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setWeather(active ? null : opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? "#EFF6FF" : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Lighting */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Lighting (optional)</Text>
            <View style={styles.chipRow}>
              {LIGHTING_OPTIONS.map((opt) => {
                const active = lighting === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setLighting(active ? null : opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? "#EFF6FF" : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Notes (optional)</Text>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes about the session…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Submit error */}
          {submitError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  saveBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 4 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  notesInput: { minHeight: 88 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldError: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  errorText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
});
