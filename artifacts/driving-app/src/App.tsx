import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, useClerk } from "@clerk/clerk-react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, useGetTermsStatus, useGetVerificationStatus } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

// Pages
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Onboarding from "@/pages/onboarding";
import TermsPage from "@/pages/terms";
import InstructorDashboard from "@/pages/instructor/dashboard";
import InstructorStudents from "@/pages/instructor/students";
import InstructorStudentDetail from "@/pages/instructor/student-detail";
import NewAssessment from "@/pages/instructor/new-assessment";
import ViewAssessment from "@/pages/instructor/assessment-detail";
import HandoverView from "@/pages/instructor/handover";
import InstructorVerification from "@/pages/instructor/verification";

import StudentDashboard from "@/pages/student/dashboard";
import StudentSearch from "@/pages/student/search";
import StudentBookings from "@/pages/student/bookings";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminStudents from "@/pages/admin/students";
import AdminInstructors from "@/pages/admin/instructors";
import AdminAuditLog from "@/pages/admin/audit";
import AdminBookings from "@/pages/admin/bookings";
import AdminVerifications from "@/pages/admin/verifications";

import InstructorAvailability from "@/pages/instructor/availability";
import InstructorZones from "@/pages/instructor/zones";
import InstructorBookings from "@/pages/instructor/bookings";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(221 83% 53%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214 32% 91%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-sm",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "text-sm font-medium text-foreground",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground text-sm",
    dividerText: "text-muted-foreground text-xs font-medium",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-sm text-green-600",
    alertText: "text-sm text-destructive",
    logoBox: "h-12 w-auto mx-auto mb-4",
    logoImage: "h-full w-auto",
    socialButtonsBlockButton: "border-border hover:bg-accent hover:text-accent-foreground",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium",
    formFieldInput: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    footerAction: "justify-center",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive text-destructive",
    otpCodeFieldInput: "border-input",
    formFieldRow: "mb-4",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin rounded-full text-primary" />
    </div>
  );
}

/**
 * Wraps any protected page. Shows a terms acceptance screen if the user
 * hasn't accepted the current privacy policy version yet.
 * Passes through immediately for unassigned users (onboarding handles them).
 */
function TermsGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: terms, isLoading: termsLoading, refetch } = useGetTermsStatus({
    query: { enabled: !!user && user.role !== "unassigned", queryKey: ["/api/terms/status"] },
  });

  if (userLoading) return <LoadingScreen />;
  if (!user || user.role === "unassigned") return <>{children}</>;
  if (termsLoading) return <LoadingScreen />;
  if (!terms?.accepted) {
    return (
      <TermsPage
        onAccepted={() => {
          refetch();
        }}
      />
    );
  }
  return <>{children}</>;
}

/**
 * Redirects instructors to /instructor/verification if they haven't been approved yet.
 *
 * TEMPORARILY DISABLED for editor review (May 2026 demo).
 * To re-enable, set BYPASS_VERIFICATION_GATE = false below.
 */
const BYPASS_VERIFICATION_GATE = true;

function InstructorVerificationGate({ children }: { children: React.ReactNode }) {
  if (BYPASS_VERIFICATION_GATE) return <>{children}</>;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: verification, isLoading } = useGetVerificationStatus({
    query: { queryKey: ["/api/instructor/verification/status"] },
  });

  if (isLoading) return <LoadingScreen />;

  const status = verification?.status;
  if (status !== "approved") {
    return <Redirect to="/instructor/verification" />;
  }
  return <>{children}</>;
}

function DashboardRedirect() {
  const { data: user, isLoading } = useGetMe();

  if (isLoading) return <LoadingScreen />;

  if (!user) return <Redirect to="/onboarding" />;

  switch (user.role) {
    case "instructor":
      return <Redirect to="/instructor/dashboard" />;
    case "student":
      return <Redirect to="/student/dashboard" />;
    case "admin":
      return <Redirect to="/admin/dashboard" />;
    default:
      return <Redirect to="/onboarding" />;
  }
}

function HomeRedirect() {
  return (
    <>
      <SignedIn>
        <DashboardRedirect />
      </SignedIn>
      <SignedOut>
        <Landing />
      </SignedOut>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClientInstance = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClientInstance.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClientInstance]);

  return null;
}

function ProtectedRoute({ component: Component, gateInstructors }: { component: React.ComponentType, gateInstructors?: boolean }) {
  return (
    <>
      <SignedOut>
        <Redirect to="/" />
      </SignedOut>
      <SignedIn>
        <TermsGate>
          {gateInstructors ? (
            <InstructorVerificationGate>
              <Component />
            </InstructorVerificationGate>
          ) : (
            <Component />
          )}
        </TermsGate>
      </SignedIn>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/onboarding" component={() => <ProtectedRoute component={Onboarding} />} />

          {/* Instructor routes — most require verified status */}
          <Route path="/instructor/verification" component={() => <ProtectedRoute component={InstructorVerification} />} />
          <Route path="/instructor/dashboard" component={() => <ProtectedRoute component={InstructorDashboard} gateInstructors />} />
          <Route path="/instructor/students" component={() => <ProtectedRoute component={InstructorStudents} gateInstructors />} />
          <Route path="/instructor/students/:id" component={() => <ProtectedRoute component={InstructorStudentDetail} gateInstructors />} />
          <Route path="/instructor/assessments/new" component={() => <ProtectedRoute component={NewAssessment} gateInstructors />} />
          <Route path="/instructor/assessments/:id" component={() => <ProtectedRoute component={ViewAssessment} gateInstructors />} />
          <Route path="/instructor/handover/:studentId" component={() => <ProtectedRoute component={HandoverView} gateInstructors />} />
          <Route path="/instructor/availability" component={() => <ProtectedRoute component={InstructorAvailability} gateInstructors />} />
          <Route path="/instructor/zones" component={() => <ProtectedRoute component={InstructorZones} gateInstructors />} />
          <Route path="/instructor/bookings" component={() => <ProtectedRoute component={InstructorBookings} gateInstructors />} />

          {/* Student routes */}
          <Route path="/student/dashboard" component={() => <ProtectedRoute component={StudentDashboard} />} />
          <Route path="/student/search" component={() => <ProtectedRoute component={StudentSearch} />} />
          <Route path="/student/bookings" component={() => <ProtectedRoute component={StudentBookings} />} />

          {/* Admin routes */}
          <Route path="/admin/dashboard" component={() => <ProtectedRoute component={AdminDashboard} />} />
          <Route path="/admin/students" component={() => <ProtectedRoute component={AdminStudents} />} />
          <Route path="/admin/instructors" component={() => <ProtectedRoute component={AdminInstructors} />} />
          <Route path="/admin/audit" component={() => <ProtectedRoute component={AdminAuditLog} />} />
          <Route path="/admin/bookings" component={() => <ProtectedRoute component={AdminBookings} />} />
          <Route path="/admin/verifications" component={() => <ProtectedRoute component={AdminVerifications} />} />

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <TooltipProvider>
        <ClerkProviderWithRoutes />
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
