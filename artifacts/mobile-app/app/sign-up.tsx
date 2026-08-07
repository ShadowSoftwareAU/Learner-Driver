import { useClerk, useOAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

WebBrowser.maybeCompleteAuthSession();

// ── Step: "register" | "verify" ───────────────────────────────────────────────

export default function SignUpScreen() {
  const clerk = useClerk();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Form state
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Verification step
  const [step, setStep]             = useState<"register" | "verify">("register");
  const [code, setCode]             = useState("");

  // Loading / error
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading]   = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const codeRef = useRef<TextInput>(null);

  // ── OAuth ──────────────────────────────────────────────────────────────────
  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startAppleFlow  } = useOAuth({ strategy: "oauth_apple" });

  const handleOAuth = async (
    startFlow: typeof startGoogleFlow,
    setOAuthLoading: (v: boolean) => void,
    label: string,
  ) => {
    setOAuthLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startFlow({
        redirectUrl: Linking.createURL("/", { scheme: "mobile-app" }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "errors" in err &&
        Array.isArray((err as { errors: { message: string }[] }).errors)
          ? (err as { errors: { message: string }[] }).errors[0]?.message
          : `${label} sign in failed. Please try again.`;
      setError(msg ?? `${label} sign in failed.`);
    } finally {
      setOAuthLoading(false);
    }
  };

  // ── Email / password sign-up ───────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!firstName || !email || !password) return;
    if (!clerk.loaded || !clerk.client) {
      setError("Still loading — please try again in a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const signUp = await clerk.client.signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        emailAddress: email.trim(),
        password,
      });
      // Trigger email OTP
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
      setTimeout(() => codeRef.current?.focus(), 300);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "errors" in err &&
        Array.isArray((err as { errors: { message: string }[] }).errors)
          ? (err as { errors: { message: string }[] }).errors[0]?.message
          : "Sign up failed. Please try again.";
      setError(msg ?? "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!code || code.length < 6) return;
    if (!clerk.loaded || !clerk.client) {
      setError("Still loading — please try again in a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await clerk.client.signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete" && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/");
      } else {
        setError("Verification could not be completed. Please try again.");
      }
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "errors" in err &&
        Array.isArray((err as { errors: { message: string }[] }).errors)
          ? (err as { errors: { message: string }[] }).errors[0]?.message
          : "Invalid code. Please try again.";
      setError(msg ?? "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render: verify step ───────────────────────────────────────────────────
  if (step === "verify") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <Image
              source={require("../assets/images/steps2drive-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Check your email</Text>
            <Text style={styles.verifyHint}>
              We sent a 6-digit code to {email}. Enter it below to confirm your account.
            </Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                ref={codeRef}
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                textContentType="oneTimeCode"
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (!code || code.length < 6) && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={loading || !code || code.length < 6}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Confirm account</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.switchRow}
              onPress={() => { setStep("register"); setError(null); setCode(""); }}
            >
              <Text style={styles.switchText}>
                Wrong email?{" "}
                <Text style={styles.switchLink}>Go back</Text>
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>Steps2Drive · Instructor & Student Portal</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: register step ─────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Image
            source={require("../assets/images/steps2drive-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Create an account</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Apple SSO */}
          <Pressable
            style={({ pressed }) => [styles.appleButton, pressed && styles.buttonPressed]}
            onPress={() => handleOAuth(startAppleFlow, setAppleLoading, "Apple")}
            disabled={appleLoading || googleLoading || loading}
          >
            {appleLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="smartphone" size={18} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </>
            )}
          </Pressable>

          {/* Google SSO */}
          <Pressable
            style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
            onPress={() => handleOAuth(startGoogleFlow, setGoogleLoading, "Google")}
            disabled={googleLoading || appleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#374151" size="small" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Name row */}
          <View style={styles.nameRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="given-name"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Last name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Smith"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="family-name"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#64748B"
                />
              </Pressable>
            </View>
          </View>

          {/* Sign up button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              (!firstName || !email || !password) && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={loading || googleLoading || appleLoading || !firstName || !email || !password}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>

          {/* Switch to sign-in */}
          <Pressable style={styles.switchRow} onPress={() => router.replace("/sign-in")}>
            <Text style={styles.switchText}>
              Already have an account?{" "}
              <Text style={styles.switchLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>Steps2Drive · Instructor & Student Portal</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 28 },
  logo: { width: 220, height: 44, marginBottom: 20 },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  verifyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  form: { gap: 0 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#DC2626",
  },

  // Apple button
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingVertical: 13,
    minHeight: 50,
    marginBottom: 10,
  },
  appleButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },

  // Google button
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 13,
    minHeight: 50,
    marginBottom: 4,
  },
  googleIconContainer: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#4285F4",
  },
  googleButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },

  // Name row
  nameRow: { flexDirection: "row", gap: 12 },

  // Fields
  field: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
  codeInput: {
    textAlign: "center",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 8,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingRight: 12,
  },
  eyeButton: { padding: 8 },

  // Buttons
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 50,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },

  // Switch row
  switchRow: { marginTop: 20, alignItems: "center" },
  switchText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  switchLink: {
    fontFamily: "Inter_600SemiBold",
    color: "#2563EB",
  },

  footer: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
});
