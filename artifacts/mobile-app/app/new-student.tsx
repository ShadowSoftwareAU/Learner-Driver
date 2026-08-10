import { useCreateStudent } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

// ─── Types ───────────────────────────────────────────────────────────────────

type LicenseStatus = "learner" | "provisional" | "open" | "overseas";
type Transmission = "automatic" | "manual";

const LICENSE_OPTIONS: { value: LicenseStatus; label: string }[] = [
  { value: "learner",      label: "Learner" },
  { value: "provisional",  label: "Provisional" },
  { value: "open",         label: "Open" },
  { value: "overseas",     label: "Overseas" },
];

const TRANSMISSION_OPTIONS: { value: Transmission; label: string }[] = [
  { value: "automatic", label: "Automatic" },
  { value: "manual",    label: "Manual" },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NewStudentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Form state
  const [fullName, setFullName]           = useState("");
  const [email, setEmail]                 = useState("");
  const [phone, setPhone]                 = useState("");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | "">("");
  const [transmission, setTransmission]   = useState<Transmission | "">("");
  const [sendInvite, setSendInvite]       = useState(true);

  // ── API
  const createStudent = useCreateStudent();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; general?: string }>({});

  // ── Validation
  const validate = () => {
    const e: typeof errors = {};
    if (!fullName.trim()) e.fullName = "Full name is required";
    if (!email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Enter a valid email address";
    }
    return e;
  };

  // ── Submit
  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await createStudent.mutateAsync({
        data: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          licenseStatus: (licenseStatus || undefined) as any,
          transmissionPreference: (transmission || undefined) as any,
          sendInvite,
        },
      });
      Alert.alert(
        "Student created",
        sendInvite
          ? `${fullName.trim()} has been added and an invitation email has been sent.`
          : `${fullName.trim()} has been added.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create student. Please try again.";
      setErrors({ general: message });
      setSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page header */}
        <View style={s.pageHeader}>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>New Student</Text>
          <Text style={[s.pageSub, { color: colors.mutedForeground }]}>
            Only name and email are required
          </Text>
        </View>

        {/* General error */}
        {errors.general ? (
          <View style={[s.errorBox, { borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={16} color="#DC2626" />
            <Text style={s.errorText}>{errors.general}</Text>
          </View>
        ) : null}

        {/* ── Required fields ──────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>REQUIRED</Text>

          <Text style={[s.label, { color: colors.foreground }]}>Full Name</Text>
          <TextInput
            style={[
              s.input,
              { color: colors.foreground, borderColor: errors.fullName ? "#EF4444" : colors.border, backgroundColor: colors.background },
            ]}
            value={fullName}
            onChangeText={(v) => { setFullName(v); setErrors((p) => ({ ...p, fullName: undefined })); }}
            placeholder="e.g. Jane Smith"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
          {errors.fullName ? <Text style={s.fieldError}>{errors.fullName}</Text> : null}

          <Text style={[s.label, { color: colors.foreground, marginTop: 14 }]}>Email Address</Text>
          <TextInput
            style={[
              s.input,
              { color: colors.foreground, borderColor: errors.email ? "#EF4444" : colors.border, backgroundColor: colors.background },
            ]}
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: undefined })); }}
            placeholder="student@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />
          {errors.email ? <Text style={s.fieldError}>{errors.email}</Text> : null}
        </View>

        {/* ── Optional fields ──────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>OPTIONAL</Text>

          <Text style={[s.label, { color: colors.foreground }]}>Phone Number</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="04XX XXX XXX"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            returnKeyType="done"
          />

          <Text style={[s.label, { color: colors.foreground, marginTop: 14 }]}>Licence Status</Text>
          <View style={s.toggleRow}>
            {LICENSE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  s.toggleBtn,
                  { borderColor: colors.border },
                  licenseStatus === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setLicenseStatus((p) => (p === opt.value ? "" : opt.value))}
              >
                <Text
                  style={[s.toggleBtnText, { color: licenseStatus === opt.value ? "#FFF" : colors.foreground }]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.label, { color: colors.foreground, marginTop: 14 }]}>Transmission</Text>
          <View style={s.toggleRow}>
            {TRANSMISSION_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  s.toggleBtn,
                  { borderColor: colors.border },
                  transmission === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setTransmission((p) => (p === opt.value ? "" : opt.value))}
              >
                <Text
                  style={[s.toggleBtnText, { color: transmission === opt.value ? "#FFF" : colors.foreground }]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Invite toggle ─────────────────────────────────────────────── */}
        <Pressable
          style={[s.inviteRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setSendInvite((p) => !p)}
        >
          <View style={[s.checkbox, { borderColor: colors.primary }, sendInvite && { backgroundColor: colors.primary }]}>
            {sendInvite && <Feather name="check" size={13} color="#FFF" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.inviteLabel, { color: colors.foreground }]}>Send invitation email</Text>
            <Text style={[s.inviteSub, { color: colors.mutedForeground }]}>
              Student will receive an email to create their account
            </Text>
          </View>
        </Pressable>

        {/* ── Save button ───────────────────────────────────────────────── */}
        <Pressable
          style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Feather name="user-plus" size={17} color="#FFF" />
              <Text style={s.saveBtnText}>Create Student</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },

  pageHeader: { gap: 4, marginBottom: 4 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  pageSub: { fontSize: 14, fontFamily: "Inter_400Regular" },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626" },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 3 },

  toggleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  inviteSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFF" },
});
