import {
  useCreateSupervisedSession,
  SupervisedSessionInputWeatherCondition,
  SupervisedSessionInputLightingCondition,
  SupervisedSessionInputPedalOperator,
} from "@workspace/api-client-react";
import React, { useState, useEffect, useRef } from "react";
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
import { useGpsLocation, GpsCoordinate } from "@/hooks/useGpsLocation";

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return raw;
  }
  const parts = raw.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return iso;
  }
  return null;
}

// ─── GPS Status Badge ─────────────────────────────────────────────────────────

type GpsStatus = "idle" | "requesting" | "active" | "denied" | "error";

function GpsBadge({ status }: { status: GpsStatus }) {
  if (status === "idle") return null;

  const configs: Record<
    Exclude<GpsStatus, "idle">,
    { bg: string; text: string; icon: string; label: string }
  > = {
    requesting: {
      bg: "#F0F9FF",
      text: "#0369A1",
      icon: "loader",
      label: "Acquiring GPS…",
    },
    active: {
      bg: "#F0FDF4",
      text: "#15803D",
      icon: "check-circle",
      label: "GPS Verified",
    },
    denied: {
      bg: "#FEF2F2",
      text: "#DC2626",
      icon: "alert-triangle",
      label: "GPS denied — required for compliance",
    },
    error: {
      bg: "#FEF2F2",
      text: "#DC2626",
      icon: "alert-circle",
      label: "GPS unavailable",
    },
  };

  const cfg = configs[status as Exclude<GpsStatus, "idle">];
  if (!cfg) return null;

  return (
    <View style={[gpsBadgeStyles.pill, { backgroundColor: cfg.bg }]}>
      <Feather name={cfg.icon as any} size={13} color={cfg.text} />
      <Text style={[gpsBadgeStyles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const gpsBadgeStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

// ─── Denial Warning ────────────────────────────────────────────────────────────

function GpsDenialWarning() {
  return (
    <View style={warningStyles.box}>
      <Feather name="alert-triangle" size={16} color="#92400E" />
      <View style={{ flex: 1 }}>
        <Text style={warningStyles.title}>Location access required</Text>
        <Text style={warningStyles.body}>
          GPS coordinates are recorded at the start and end of each supervised
          session for regulatory compliance. Without location permission, this
          session cannot be verified as compliant.{"\n\n"}
          To enable: go to your device Settings, find Steps2Drive, and allow
          location access while using the app.
        </Text>
      </View>
    </View>
  );
}

const warningStyles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#92400E",
    marginBottom: 4,
  },
  body: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#92400E",
    lineHeight: 18,
  },
});

// ─── Modal ────────────────────────────────────────────────────────────────────

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

  // GPS — capture start on open, end on submit
  const { status: gpsStatus, requestAndCapture, captureNow } = useGpsLocation();
  const startCoordsRef = useRef<GpsCoordinate | null>(null);

  // Kick off location permission + start capture whenever the modal opens
  useEffect(() => {
    if (!visible) return;
    startCoordsRef.current = null;
    requestAndCapture().then((coord) => {
      startCoordsRef.current = coord;
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

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
    startCoordsRef.current = null;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
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

    // Capture end coordinates just before submitting (best-effort — no block on failure)
    const endCoords = await captureNow();

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
          startCoordinates: startCoordsRef.current ?? undefined,
          endCoordinates: endCoords ?? undefined,
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
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary },
              isPending && { opacity: 0.6 },
            ]}
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
          {/* GPS status indicator */}
          <View style={styles.fieldGroup}>
            <GpsBadge status={gpsStatus} />
            {(gpsStatus === "denied" || gpsStatus === "error") && <GpsDenialWarning />}
          </View>

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Date</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: dateError ? "#EF4444" : colors.border,
                },
              ]}
              value={lessonDate}
              onChangeText={(t) => {
                setLessonDate(t);
                setDateError("");
              }}
              placeholder="dd/mm/yyyy"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
            {dateError ? (
              <Text style={styles.fieldError}>{dateError}</Text>
            ) : null}
          </View>

          {/* Duration */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Duration (minutes)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: durationError ? "#EF4444" : colors.border,
                },
              ]}
              value={durationText}
              onChangeText={(t) => {
                setDurationText(t);
                setDurationError("");
              }}
              placeholder="e.g. 60"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            {durationError ? (
              <Text style={styles.fieldError}>{durationError}</Text>
            ) : null}
          </View>

          {/* Pedal operator */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Pedal operator
            </Text>
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
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? "#fff" : colors.foreground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Weather */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Weather (optional)
            </Text>
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
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.primary : colors.foreground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Lighting */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Lighting (optional)
            </Text>
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
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.primary : colors.foreground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Notes (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
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
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "center",
  },
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
  fieldError: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
});
