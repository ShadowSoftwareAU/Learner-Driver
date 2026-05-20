import { QueryClient } from "@tanstack/react-query";

function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number; response?: { status?: number } } | null | undefined)
    ?.status ?? (err as { response?: { status?: number } } | null | undefined)?.response?.status;
  return status === 401 || status === 403;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAuthError(error)) return false;
        return failureCount < 1;
      },
      staleTime: 5 * 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});
