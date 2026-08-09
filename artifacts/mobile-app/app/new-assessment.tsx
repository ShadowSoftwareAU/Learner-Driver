import {
  useListStudents,
  useListManeuvers,
  useCreateAssessment,
  useSaveManeuverResults,
  useUpdateAssessment,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  clearAssessmentDraft,
  loadAssessmentDraft,
  saveAssessmentDraft,
} from "@/hooks/useAssessmentDraft";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "setup" | "maneuvers" | "notes";
type CompetencyLevel = "not_attempted" | "attempted" | "practiced" | "mastered";
type PedalOperator = "student" | "instructor" | "shared";
type WeatherCondition = "clear" | "cloudy" | "rain" | "night" | "";

const COMPETENCY_LEVELS: {
  value: CompetencyLevel;
  label: string;       // Full label for tile mode
  shortLabel: string;  // Compact label for list mode
  color: string;
  bg: string;
}[] = [
  { value: "not_attempted", label: "Not Attempted",    shortLabel: "—",          color: "#94A3B8", bg: "#F1F5F9" },
  { value: "attempted",     label: "Developing",       shortLabel: "Dev.",        color: "#D97706", bg: "#FFF7ED" },
  { value: "practiced",     label: "Competent",        shortLabel: "Comp.",       color: "#2563EB", bg: "#EFF6FF" },
  { value: "mastered",      label: "Consistent Skills",shortLabel: "Consistent",  color: "#16A34A", bg: "#F0FDF4" },
];

const PEDAL_OPTIONS: { value: PedalOperator; label: string }[] = [
  { value: "student",    label: "Student" },
  { value: "shared",     label: "Shared" },
  { value: "instructor", label: "Instructor" },
];

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; icon: string }[] = [
  { value: "clear",   label: "Clear",   icon: "sun" },
  { value: "cloudy",  label: "Cloudy",  icon: "cloud" },
  { value: "rain",    label: "Rain",    icon: "cloud-rain" },
  { value: "night",   label: "Night",   icon: "moon" },
];

function clerkErr(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "errors" in err) {
    const e = (err as { errors: { message: string }[] }).errors;
    return e?.[0]?.message ?? fallback;
  }
  return fallback;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function NewAssessmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Step
  const [step, setStep] = useState<Step>("setup");

  // ── Setup state
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("60");
  const [pedalOperator, setPedalOperator] = useState<PedalOperator>("student");
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition>("");

  // ── Maneuver results
  const [results, setResults] = useState<Record<number, CompetencyLevel>>({});

  // ── Notes
  const [confidenceNote, setConfidenceNote] = useState("");
  const [focusAreas, setFocusAreas] = useState("");

  // ── Loading / error
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Maneuver view mode + expansion (list mode)
  const [viewMode, setViewMode] = useState<"list" | "tile">("list");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ── Draft saved indicator
  const draftSaveAnim = useRef(new Animated.Value(0)).current;
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDraftSaved = () => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    Animated.sequence([
      Animated.timing(draftSaveAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(draftSaveAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    // Belt-and-suspenders: ensure it resets even if animation is interrupted
    draftSaveTimer.current = setTimeout(() => {
      draftSaveAnim.setValue(0);
    }, 2600);
  };

  // ── Draft persistence
  // Load draft on first mount and prompt the instructor to resume or start fresh
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadAssessmentDraft();
      if (!draft || cancelled) return;

      const savedDate = new Date(draft.savedAt);
      const dateStr = savedDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const timeStr = savedDate.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });

      Alert.alert(
        "Resume draft?",
        `You have an unfinished assessment from ${dateStr} at ${timeStr}. Would you like to pick up where you left off?`,
        [
          {
            text: "Start fresh",
            style: "destructive",
            onPress: () => clearAssessmentDraft(),
          },
          {
            text: "Resume",
            onPress: () => {
              setSelectedStudentId(draft.selectedStudentId);
              setDate(draft.date);
              setDuration(draft.duration);
              setPedalOperator(draft.pedalOperator as any);
              setWeatherCondition(draft.weatherCondition as any);
              setResults(draft.results as any);
              setConfidenceNote(draft.confidenceNote);
              setFocusAreas(draft.focusAreas);
            },
          },
        ],
      );
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft whenever relevant state changes, but only once a student
  // has been selected (avoids creating empty drafts on every screen open).
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedStudentId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await saveAssessmentDraft({
        selectedStudentId,
        date,
        duration,
        pedalOperator,
        weatherCondition,
        results,
        confidenceNote,
        focusAreas,
      });
      showDraftSaved();
    }, 800);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, date, duration, pedalOperator, weatherCondition, results, confidenceNote, focusAreas]);

  // ── API
  const { data: students, isLoading: studentsLoading } = useListStudents();
  const { data: maneuvers, isLoading: maneuvLoading } = useListManeuvers();
  const createAssessment = useCreateAssessment();
  const saveManeuverResults = useSaveManeuverResults();
  const updateAssessment = useUpdateAssessment();

  // ── Derived
  const selectedStudent = useMemo(
    () => students?.find((s: any) => s.id === selectedStudentId) as any ?? null,
    [students, selectedStudentId],
  );

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = studentSearch.toLowerCase();
    return (students as any[]).filter(
      (s) =>
        !q ||
        (s.firstName + " " + s.lastName).toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const maneuverSections = useMemo(() => {
    if (!maneuvers) return [];
    const map = new Map<string, any[]>();
    for (const m of maneuvers as any[]) {
      const cat = m.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(m);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [maneuvers]);

  // ── Rate a maneuver (cycles through levels)
  const rate = (maneuverId: number, level: CompetencyLevel) => {
    setResults((prev) => ({ ...prev, [maneuverId]: level }));
  };

  // ── Save
  const handleSave = async () => {
    if (!selectedStudentId) return;
    setSaving(true);
    setError(null);
    try {
      // 1. Create assessment
      const assessment = await createAssessment.mutateAsync({
        data: {
          studentId: selectedStudentId,
          lessonDate: date,
          durationMinutes: parseInt(duration, 10) || 60,
          pedalOperator: pedalOperator as any,
          weatherCondition: (weatherCondition || undefined) as any,
          assessmentType: "qsafe" as any,
        },
      });

      const id = (assessment as any).id as number;

      // 2. Save rated maneuver results
      const rated = Object.entries(results)
        .filter(([, level]) => level !== "not_attempted")
        .map(([maneuverId, competencyLevel]) => ({
          maneuverId: parseInt(maneuverId, 10),
          competencyLevel: competencyLevel as any,
        }));

      if (rated.length > 0) {
        await saveManeuverResults.mutateAsync({ id, data: { results: rated } });
      }

      // 3. Save notes if entered
      if (confidenceNote.trim() || focusAreas.trim()) {
        await updateAssessment.mutateAsync({
          id,
          data: {
            confidenceNote: confidenceNote.trim() || undefined,
            focusAreasNext: focusAreas.trim() || undefined,
          } as any,
        });
      }

      router.replace("/(tabs)/assessments");
    } catch (err) {
      setError(clerkErr(err, "Failed to save assessment. Please try again."));
      setSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = (Platform.OS === "web" ? 34 : insets.bottom) + 16;

  // ─── STEP: NOTES ─────────────────────────────────────────────────────────
  if (step === "notes") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: botPad }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.stepHeader}>
            <Text style={[s.stepTitle, { color: colors.foreground }]}>Lesson Notes</Text>
            <Text style={[s.stepSub, { color: colors.mutedForeground }]}>
              Optional — add any notes before saving
            </Text>
            <DraftSavedBadge anim={draftSaveAnim} />
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.label, { color: colors.foreground }]}>Confidence &amp; Overall Notes</Text>
            <TextInput
              style={[s.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={confidenceNote}
              onChangeText={setConfidenceNote}
              placeholder="How did the student go overall?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[s.label, { color: colors.foreground, marginTop: 16 }]}>Focus Areas for Next Lesson</Text>
            <TextInput
              style={[s.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={focusAreas}
              onChangeText={setFocusAreas}
              placeholder="What should they work on next time?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={s.navRow}>
            <Pressable
              style={[s.backBtn, { borderColor: colors.border }]}
              onPress={() => setStep("maneuvers")}
            >
              <Feather name="arrow-left" size={16} color={colors.foreground} />
              <Text style={[s.backBtnText, { color: colors.foreground }]}>Back</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color="#FFF" />
                  <Text style={s.primaryBtnText}>Save Assessment</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── STEP: MANEUVERS ─────────────────────────────────────────────────────
  if (step === "maneuvers") {
    const ratedCount = Object.values(results).filter((l) => l !== "not_attempted").length;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Fixed header */}
        <View style={[s.fixedHeader, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {/* Title row + view toggle */}
          <View style={s.maneuverHeaderRow}>
            <View>
              <Text style={[s.stepTitle, { color: colors.foreground }]}>Rate Maneuvers</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground }]}>
                {ratedCount > 0 ? `${ratedCount} rated` : "Tap a level for each maneuver"}
              </Text>
              <DraftSavedBadge anim={draftSaveAnim} />
            </View>
            {/* Tile / list toggle */}
            <View style={[s.viewToggle, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Pressable
                style={[s.viewToggleBtn, viewMode === "list" && { backgroundColor: colors.primary }]}
                onPress={() => setViewMode("list")}
              >
                <Feather name="list" size={16} color={viewMode === "list" ? "#FFF" : colors.mutedForeground} />
              </Pressable>
              <Pressable
                style={[s.viewToggleBtn, viewMode === "tile" && { backgroundColor: colors.primary }]}
                onPress={() => setViewMode("tile")}
              >
                <Feather name="grid" size={16} color={viewMode === "tile" ? "#FFF" : colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {/* Legend — only show in list mode */}
          {viewMode === "list" && (
            <View style={s.legend}>
              {COMPETENCY_LEVELS.map((l) => (
                <View key={l.value} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: l.color }]} />
                  <Text style={[s.legendText, { color: colors.mutedForeground }]}>
                    {l.shortLabel === "—" ? "Not done" : l.shortLabel}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {maneuvLoading ? (
          <View style={s.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <SectionList
            sections={maneuverSections}
            keyExtractor={(item: any) => String(item.id)}
            contentContainerStyle={[
              { paddingBottom: botPad + 80 },
              viewMode === "tile" && { paddingHorizontal: 12, paddingTop: 4 },
            ]}
            renderSectionHeader={({ section }) => (
              <View style={[s.sectionHeader, { backgroundColor: colors.background }]}>
                <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
                  {section.title.toUpperCase()}
                </Text>
              </View>
            )}
            renderItem={({ item }: { item: any }) => (
              <ManeuverRow
                maneuver={item}
                level={results[item.id] ?? "not_attempted"}
                onRate={(level) => rate(item.id, level)}
                colors={colors}
                viewMode={viewMode}
                expanded={expandedId === item.id}
                onToggleExpand={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
              />
            )}
            ItemSeparatorComponent={() =>
              viewMode === "list" ? (
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
              ) : (
                <View style={{ height: 10 }} />
              )
            }
          />
        )}

        {/* Bottom nav */}
        <View style={[s.bottomNav, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <Pressable style={[s.backBtn, { borderColor: colors.border }]} onPress={() => setStep("setup")}>
            <Feather name="arrow-left" size={16} color={colors.foreground} />
            <Text style={[s.backBtnText, { color: colors.foreground }]}>Back</Text>
          </Pressable>
          <Pressable
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => setStep("notes")}
          >
            <Text style={s.primaryBtnText}>Notes & Save</Text>
            <Feather name="arrow-right" size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── STEP: SETUP ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: botPad + 80 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.stepHeader}>
          <Text style={[s.stepTitle, { color: colors.foreground }]}>New Assessment</Text>
          <Text style={[s.stepSub, { color: colors.mutedForeground }]}>
            Step 1 of 3 — Lesson details
          </Text>
          <DraftSavedBadge anim={draftSaveAnim} />
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        {/* Student selection */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.label, { color: colors.foreground }]}>Student *</Text>
          {selectedStudent ? (
            <View style={s.selectedStudent}>
              <View style={[s.avatar, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[s.avatarText, { color: colors.primary }]}>
                  {(selectedStudent.firstName?.[0] ?? "?").toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.selectedName, { color: colors.foreground }]}>
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </Text>
                <Text style={[s.selectedEmail, { color: colors.mutedForeground }]}>
                  {selectedStudent.email}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedStudentId(null)} hitSlop={8}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[s.searchBar, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Feather name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[s.searchInput, { color: colors.foreground }]}
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                  placeholder="Search students…"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {studentsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
              ) : (
                <FlatList
                  data={filteredStudents.slice(0, 8)}
                  keyExtractor={(s: any) => String(s.id)}
                  scrollEnabled={false}
                  renderItem={({ item }: { item: any }) => (
                    <Pressable
                      style={[s.studentOption, { borderColor: colors.border }]}
                      onPress={() => { setSelectedStudentId(item.id); setStudentSearch(""); }}
                    >
                      <View style={[s.avatar, { backgroundColor: colors.primary + "20" }]}>
                        <Text style={[s.avatarText, { color: colors.primary }]}>
                          {(item.firstName?.[0] ?? "?").toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={[s.studentOptionName, { color: colors.foreground }]}>
                          {item.firstName} {item.lastName}
                        </Text>
                        <Text style={[s.studentOptionEmail, { color: colors.mutedForeground }]}>
                          {item.email}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No students found</Text>
                  }
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
                />
              )}
            </>
          )}
        </View>

        {/* Lesson details */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Date */}
          <Text style={[s.label, { color: colors.foreground }]}>Lesson Date</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
          />

          {/* Duration */}
          <Text style={[s.label, { color: colors.foreground, marginTop: 14 }]}>Duration (minutes)</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={duration}
            onChangeText={setDuration}
            placeholder="60"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
          />

          {/* Pedal operator */}
          <Text style={[s.label, { color: colors.foreground, marginTop: 14 }]}>Pedal Control</Text>
          <View style={s.toggleRow}>
            {PEDAL_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  s.toggleBtn,
                  { borderColor: colors.border },
                  pedalOperator === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setPedalOperator(opt.value)}
              >
                <Text
                  style={[
                    s.toggleBtnText,
                    { color: pedalOperator === opt.value ? "#FFF" : colors.foreground },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Weather */}
          <Text style={[s.label, { color: colors.foreground, marginTop: 14 }]}>Weather (optional)</Text>
          <View style={s.toggleRow}>
            {WEATHER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  s.toggleBtn,
                  { borderColor: colors.border },
                  weatherCondition === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() =>
                  setWeatherCondition((prev) => (prev === opt.value ? "" : opt.value))
                }
              >
                <Feather
                  name={opt.icon as any}
                  size={14}
                  color={weatherCondition === opt.value ? "#FFF" : colors.foreground}
                />
                <Text
                  style={[
                    s.toggleBtnText,
                    { color: weatherCondition === opt.value ? "#FFF" : colors.foreground },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Next button */}
        <Pressable
          style={[
            s.primaryBtn,
            { backgroundColor: colors.primary, opacity: !selectedStudentId ? 0.45 : 1, alignSelf: "stretch" },
          ]}
          onPress={() => setStep("maneuvers")}
          disabled={!selectedStudentId}
        >
          <Text style={s.primaryBtnText}>Rate Maneuvers</Text>
          <Feather name="arrow-right" size={16} color="#FFF" />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── ManeuverRow ─────────────────────────────────────────────────────────────

function ManeuverRow({
  maneuver,
  level,
  onRate,
  colors,
  viewMode,
  expanded,
  onToggleExpand,
}: {
  maneuver: any;
  level: CompetencyLevel;
  onRate: (l: CompetencyLevel) => void;
  colors: ReturnType<typeof useColors>;
  viewMode: "list" | "tile";
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const hasCriteria = !!(maneuver.complianceCriteria || maneuver.masteryDefinition);
  const showMastery = level === "mastered" && !!maneuver.masteryDefinition;

  // ── TILE VIEW ──────────────────────────────────────────────────────────────
  if (viewMode === "tile") {
    return (
      <View style={[s.tileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Maneuver name */}
        <Text style={[s.tileName, { color: colors.foreground }]}>{maneuver.name}</Text>

        {/* 2×2 competency button grid */}
        <View style={s.tileGrid}>
          {COMPETENCY_LEVELS.map((cl) => {
            const active = level === cl.value;
            return (
              <Pressable
                key={cl.value}
                style={[
                  s.tileBtn,
                  active
                    ? { backgroundColor: cl.color, borderColor: cl.color }
                    : { backgroundColor: cl.bg, borderColor: cl.color + "50" },
                ]}
                onPress={() => onRate(cl.value)}
              >
                {active && (
                  <Feather name="check" size={13} color="#FFF" style={{ marginBottom: 2 }} />
                )}
                <Text
                  style={[
                    s.tileBtnText,
                    { color: active ? "#FFF" : cl.color },
                  ]}
                >
                  {cl.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* QSafe compliance criteria panel — always visible if present */}
        {maneuver.complianceCriteria ? (
          <View style={s.criteriaPanel}>
            <Text style={s.criteriaPanelTitle}>QSAFE Compliance Criteria</Text>
            <Text style={s.criteriaPanelText}>{maneuver.complianceCriteria}</Text>
          </View>
        ) : null}

        {/* Mastery definition — only visible once "Consistent Skills" is selected */}
        {showMastery ? (
          <View style={[s.criteriaPanel, s.masteryPanel]}>
            <Text style={[s.criteriaPanelTitle, { color: "#15803D" }]}>Competency Definition</Text>
            <Text style={[s.criteriaPanelText, { color: "#166534" }]}>{maneuver.masteryDefinition}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <View style={[s.maneuverRow, { backgroundColor: colors.card }]}>
      {/* Name row + expand toggle */}
      <Pressable
        style={s.maneuverNameRow}
        onPress={hasCriteria ? onToggleExpand : undefined}
        disabled={!hasCriteria}
      >
        <Text style={[s.maneuverName, { color: colors.foreground, flex: 1 }]}>
          {maneuver.name}
        </Text>
        {hasCriteria && (
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        )}
      </Pressable>

      {/* Compact 4-button row */}
      <View style={s.competencyBtns}>
        {COMPETENCY_LEVELS.map((cl) => {
          const active = level === cl.value;
          return (
            <Pressable
              key={cl.value}
              style={[
                s.competencyBtn,
                active
                  ? { backgroundColor: cl.color, borderColor: cl.color }
                  : { backgroundColor: cl.bg, borderColor: cl.color + "60" },
              ]}
              onPress={() => onRate(cl.value)}
            >
              <Text
                style={[s.competencyBtnText, { color: active ? "#FFF" : cl.color }]}
                numberOfLines={1}
              >
                {cl.shortLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Expandable criteria — shown when tapped */}
      {expanded && (
        <View style={s.expandedCriteria}>
          {maneuver.complianceCriteria ? (
            <View style={s.criteriaPanel}>
              <Text style={s.criteriaPanelTitle}>QSAFE Compliance Criteria</Text>
              <Text style={s.criteriaPanelText}>{maneuver.complianceCriteria}</Text>
            </View>
          ) : null}
          {maneuver.masteryDefinition ? (
            <View style={[s.criteriaPanel, s.masteryPanel, { marginTop: 6 }]}>
              <Text style={[s.criteriaPanelTitle, { color: "#15803D" }]}>Competency Definition</Text>
              <Text style={[s.criteriaPanelText, { color: "#166534" }]}>{maneuver.masteryDefinition}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function DraftSavedBadge({ anim }: { anim: Animated.Value }) {
  return (
    <Animated.View style={[s.draftBadge, { opacity: anim }]} pointerEvents="none">
      <Feather name="check" size={12} color="#16A34A" />
      <Text style={s.draftBadgeText}>Draft saved</Text>
    </Animated.View>
  );
}
function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={s.errorBox}>
      <Feather name="alert-circle" size={15} color="#DC2626" />
      <Text style={s.errorText}>{message}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  stepHeader: { marginBottom: 16 },
  stepTitle: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 2 },
  stepSub: { fontSize: 13, fontFamily: "Inter_400Regular" },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
  },

  // Student selection
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  studentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  studentOptionName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  studentOptionEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  selectedStudent: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  selectedEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  // Toggle buttons
  toggleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Nav buttons
  navRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  backBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 50,
  },
  primaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Maneuver list
  fixedHeader: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  maneuverHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  viewToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: { flexDirection: "row", gap: 14, marginTop: 10, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },

  // List mode row
  maneuverRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  maneuverNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  maneuverName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  competencyBtns: { flexDirection: "row", gap: 5 },
  competencyBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 0,
  },
  competencyBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Expandable criteria (list mode)
  expandedCriteria: { gap: 6, marginTop: 4 },

  // Criteria panels (shared list + tile)
  criteriaPanel: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  masteryPanel: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  criteriaPanelTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#1D4ED8",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  criteriaPanelText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#1E40AF",
    lineHeight: 18,
  },

  // Tile mode card
  tileCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  tileName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tileBtn: {
    width: "47%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 2,
  },
  tileBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  // Bottom nav
  bottomNav: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" },

  // Draft saved badge
  draftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  draftBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#16A34A",
  },

  // Misc
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { textAlign: "center", fontSize: 14, fontFamily: "Inter_400Regular", padding: 16 },
});
