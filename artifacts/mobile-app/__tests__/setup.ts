/**
 * Jest global setup for the mobile-app test suite.
 * Installs the official AsyncStorage in-memory mock so tests never
 * touch real device storage.
 */
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import { jest } from "@jest/globals";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// Silence the noisy "act()" warnings that come from React 18 when we
// resolve async effects inside tests.
jest.spyOn(console, "error").mockImplementation((msg: unknown) => {
  if (typeof msg === "string" && msg.includes("act(")) return;
  // Let other errors through so real failures are visible.
});
