import { useClerk, useOAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
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

// Required so the OAuth session is marked complete when the app is resumed
WebBrowser.maybeCompleteAuthSession();

type Step = "signin" | "forgot_email" | "forgot_code";

function clerkError(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "errors" in err &&
    Array.isArray((err as { errors: { message: string }[] }).errors)
  ) {
    return (err as { errors: { message: string }[] }).errors[0]?.message ?? fallback;
  }
  return fallback;
}

export default function SignInScreen() {
  const clerk = useClerk();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Sign-in state ─────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ── Forgot-password state ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("signin");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // ── Shared loading / error ────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── OAuth ─────────────────────────────────────────────────────────────────
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: "oauth_apple" });

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL("/", { scheme: "mobile-app" }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      setError(clerkError(err, "Google sign in failed. Please try again."));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startAppleOAuthFlow({
        redirectUrl: Linking.createURL("/", { scheme: "mobile-app" }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      setError(clerkError(err, "Apple sign in failed. Please try again."));
    } finally {
      setAppleLoading(false);
    }
  };

  // ── Email / password sign-in ──────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email || !password) return;
    if (!clerk.loaded || !clerk.client) {
      setError("Still loading — please try again in a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await clerk.client.signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/");
      } else {
        setError("Sign in could not be completed. Please try again.");
      }
    } catch (err) {
      setError(clerkError(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password — request code ───────────────────────────────────────
  const handleForgotRequest = async () => {
    if (!forgotEmail) return;
    if (!clerk.loaded || !clerk.client) {
      setError("Still loading — please try again in a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await clerk.client.signIn.create({
        strategy: "reset_password_email_code",
        identifier: forgotEmail.trim(),
      });
      setStep("forgot_code");
    } catch (err) {
      setError(clerkError(err, "Could not send reset email. Check the address and try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password — verify code + set new password ─────────────────────
  const handleForgotReset = async () => {
    if (!resetCode || !newPassword) return;
    if (!clerk.loaded || !clerk.client) {
      setError("Still loading — please try again in a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await clerk.client.signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode,
        password: newPassword,
      });
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/");
      } else {
        setError("Password reset could not be completed. Please try again.");
      }
    } catch (err) {
      setError(clerkError(err, "Invalid code or password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Shared scroll wrapper ─────────────────────────────────────────────────
  const scrollPad = { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 };

  // ── Render: forgot_email step ─────────────────────────────────────────────
  if (step === "forgot_email") {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, scrollPad]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <Image source={require("../assets/images/steps2drive-logo.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.subtitle}>Reset your password</Text>
            <Text style={styles.hint}>
              Enter the email address for your account and we'll send you a reset code.
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
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                autoFocus
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                !forgotEmail && styles.buttonDisabled,
              ]}
              onPress={handleForgotRequest}
              disabled={loading || !forgotEmail}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Send reset code</Text>
              )}
            </Pressable>

            <Pressable style={styles.switchRow} onPress={() => { setStep("signin"); setError(null); }}>
              <Text style={styles.switchText}>
                <Text style={styles.switchLink}>Back to sign in</Text>
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>Steps2Drive · Instructor & Student Portal</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: forgot_code step ──────────────────────────────────────────────
  if (step === "forgot_code") {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, scrollPad]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <Image source={require("../assets/images/steps2drive-logo.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.subtitle}>Choose a new password</Text>
            <Text style={styles.hint}>
              We sent a 6-digit code to {forgotEmail}. Enter it below along with your new password.
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
              <Text style={styles.label}>Reset code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={resetCode}
                onChangeText={setResetCode}
                placeholder="000000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowNewPassword(v => !v)} hitSlop={8}>
                  <Feather name={showNewPassword ? "eye-off" : "eye"} size={20} color="#64748B" />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                (!resetCode || !newPassword) && styles.buttonDisabled,
              ]}
              onPress={handleForgotReset}
              disabled={loading || !resetCode || !newPassword}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Set new password</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.switchRow}
              onPress={() => { setStep("forgot_email"); setError(null); setResetCode(""); setNewPassword(""); }}
            >
              <Text style={styles.switchText}>
                Didn't receive a code?{" "}
                <Text style={styles.switchLink}>Try again</Text>
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>Steps2Drive · Instructor & Student Portal</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: main sign-in step ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, scrollPad]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image source={require("../assets/images/steps2drive-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          {/* Error banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Apple SSO */}
          <Pressable
            style={({ pressed }) => [styles.appleButton, pressed && styles.buttonPressed]}
            onPress={handleAppleSignIn}
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
            onPress={handleGoogleSignIn}
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
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Pressable
                onPress={() => {
                  setForgotEmail(email); // pre-fill from whatever they typed
                  setError(null);
                  setStep("forgot_email");
                }}
                hitSlop={8}
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>
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
                autoComplete="password"
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#64748B" />
              </Pressable>
            </View>
          </View>

          {/* Sign in button */}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSignIn}
            disabled={loading || googleLoading || !email || !password}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        {/* Switch to sign-up */}
        <Pressable style={styles.switchRow} onPress={() => router.replace("/sign-up")}>
          <Text style={styles.switchText}>
            Don't have an account?{" "}
            <Text style={styles.switchLink}>Sign up</Text>
          </Text>
        </Pressable>

        <Text style={styles.footer}>Steps2Drive · Instructor & Student Portal</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 36 },
  logo: { width: 220, height: 44, marginBottom: 20 },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  hint: {
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
  googleIconContainer: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
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

  // Fields
  field: { marginBottom: 16 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  forgotLink: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#2563EB",
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
    marginBottom: 0,
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
    gap: 0,
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
    marginTop: 24,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
});
