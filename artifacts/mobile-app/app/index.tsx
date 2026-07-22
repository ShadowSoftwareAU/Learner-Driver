import { useAuth } from "@clerk/expo";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { data: user, isLoading } = useGetMe({
    query: { enabled: isLoaded && !!isSignedIn, queryKey: getGetMeQueryKey() },
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (isLoading || !user) return;

    const role = user.role;
    if (role === "instructor" || role === "school_admin" || role === "super_admin") {
      router.replace("/(tabs)");
    } else if (role === "student") {
      router.replace("/(student)");
    }
    // unassigned: stay on loading screen (user needs to be set up)
  }, [isLoaded, isSignedIn, isLoading, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.label}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
  },
});
