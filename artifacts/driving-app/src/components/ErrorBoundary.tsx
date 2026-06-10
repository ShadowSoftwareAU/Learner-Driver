/**
 * React Error Boundaries — three levels of isolation.
 *
 * Usage:
 *   <ErrorBoundary level="root">    — wraps the whole app in main.tsx
 *   <ErrorBoundary level="page">    — wraps the route switch in App.tsx
 *   <ErrorBoundary level="widget">  — wraps individual high-risk widgets
 */
import { Component, ErrorInfo, ReactNode } from "react";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: "root" | "page" | "widget";
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const level = this.props.level ?? "unknown";
    try {
      fetch(`${BASE_PATH}/api/errors/client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          message: error.message,
          stack: error.stack?.slice(0, 2000),
          componentStack: info.componentStack?.slice(0, 2000),
        }),
      }).catch(() => {});
    } catch {
      // never throw inside error boundary
    }
  }

  retry = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const { level = "root" } = this.props;

    if (level === "widget") {
      return (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center gap-3">
          <span>This component is temporarily unavailable.</span>
          <button
            onClick={this.retry}
            className="underline hover:no-underline text-primary text-xs"
          >
            Retry
          </button>
        </div>
      );
    }

    if (level === "page") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Something went wrong on this page</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            This page crashed unexpectedly. Your data is safe — try navigating back or clicking Retry.
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-2 max-w-lg text-left text-xs bg-muted p-3 rounded overflow-auto text-destructive">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.retry}
            className="mt-2 rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
          <span className="text-destructive text-3xl font-bold">!</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md">
          An unexpected error occurred. Please refresh the page to continue. If the problem persists, contact support.
        </p>
        {process.env.NODE_ENV === "development" && this.state.error && (
          <pre className="mt-2 max-w-lg text-left text-xs bg-muted p-3 rounded overflow-auto text-destructive">
            {this.state.error.message}
            {"\n"}
            {this.state.error.stack}
          </pre>
        )}
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Refresh Page
        </button>
      </div>
    );
  }
}
