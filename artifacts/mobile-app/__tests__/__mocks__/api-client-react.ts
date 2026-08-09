/**
 * Minimal mock for @workspace/api-client-react used during unit tests.
 * All hooks return safe no-op defaults so the component renders without
 * hitting the network.
 */
import { jest } from "@jest/globals";

export const useListStudents = jest.fn(() => ({
  data: [{ id: 42, firstName: "Alex", lastName: "Nguyen", email: "alex@example.com" }],
  isLoading: false,
}));

export const useListManeuvers = jest.fn(() => ({
  data: [],
  isLoading: false,
}));

export const useCreateAssessment = jest.fn(() => ({
  mutateAsync: jest.fn().mockResolvedValue({ id: 99 }),
}));

export const useSaveManeuverResults = jest.fn(() => ({
  mutateAsync: jest.fn().mockResolvedValue({}),
}));

export const useUpdateAssessment = jest.fn(() => ({
  mutateAsync: jest.fn().mockResolvedValue({}),
}));
