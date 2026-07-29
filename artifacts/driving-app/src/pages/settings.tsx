import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Copy, Check, Link2 } from "lucide-react";
import {
  useGetMe,
  useUpdateMe,
  useGetInstructorProfile,
  useUpdateInstructor,
  useGetMyStudentProfile,
  useUpdateMyStudentProfile,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ─── Instructor Link Code card ─────────────────────────────────────────────────

function InstructorLinkCodeCard() {
  const [copied, setCopied] = useState(false);
  const { data: profile } = useGetInstructorProfile({
    query: { queryKey: ["/api/instructor/profile"] },
  });

  const code = profile?.uniqueLinkCode ?? null;

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-blue-900 dark:text-blue-100">
            Your Instructor Link Code
          </CardTitle>
        </div>
        <CardDescription className="text-blue-700 dark:text-blue-300">
          Share this 6-character code with a school admin to instantly link your
          profile to their school — no email invite needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-lg px-6 py-3 font-mono text-2xl tracking-[0.35em] font-bold text-blue-900 dark:text-blue-100 select-all min-w-[140px] text-center">
            {code ?? "——————"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!code}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/40"
          >
            {copied ? (
              <Check className="w-4 h-4 mr-1.5" />
            ) : (
              <Copy className="w-4 h-4 mr-1.5" />
            )}
            {copied ? "Copied!" : "Copy Code"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
          This code is unique to you and permanently tied to your account.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Account section (all roles) ──────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});
type AccountValues = z.infer<typeof accountSchema>;

function AccountSection({ onSaved }: { onSaved: () => void }) {
  const { data: user } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const updateMe = useUpdateMe();
  const { toast } = useToast();

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    values: { name: user?.name ?? "" },
  });

  const onSubmit = async (values: AccountValues) => {
    try {
      await updateMe.mutateAsync({ data: { name: values.name } });
      onSaved();
      toast({ title: "Account updated" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Your display name and login email address.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1.5">
              <FormLabel className="text-muted-foreground">Email</FormLabel>
              <Input
                value={user?.email ?? ""}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Email is managed by your login provider and cannot be changed here.
              </p>
            </div>

            <Button
              type="submit"
              disabled={updateMe.isPending || !form.formState.isDirty}
            >
              {updateMe.isPending ? "Saving…" : "Save Account"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ─── Instructor profile section ────────────────────────────────────────────────

const instructorProfileSchema = z.object({
  phone: z.string().optional(),
});
type InstructorProfileValues = z.infer<typeof instructorProfileSchema>;

function InstructorProfileSection() {
  const { data: profile } = useGetInstructorProfile({
    query: { queryKey: ["/api/instructor/profile"] },
  });
  const updateInstructor = useUpdateInstructor();
  const { toast } = useToast();

  const form = useForm<InstructorProfileValues>({
    resolver: zodResolver(instructorProfileSchema),
    values: { phone: profile?.phone ?? "" },
  });

  const onSubmit = async (values: InstructorProfileValues) => {
    if (!profile?.id) return;
    try {
      await updateInstructor.mutateAsync({
        id: profile.id,
        data: { phone: values.phone || undefined },
      });
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instructor Profile</CardTitle>
        <CardDescription>
          Your professional contact details visible to students and schools.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="04xx xxx xxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {profile?.licenseNumber && (
              <div className="space-y-1.5">
                <FormLabel className="text-muted-foreground">
                  Licence Number
                </FormLabel>
                <Input
                  value={profile.licenseNumber}
                  disabled
                  className="bg-muted font-mono text-muted-foreground"
                />
              </div>
            )}

            {profile?.adtaNumber && (
              <div className="space-y-1.5">
                <FormLabel className="text-muted-foreground">
                  ADTA Number
                </FormLabel>
                <Input
                  value={profile.adtaNumber}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={
                updateInstructor.isPending || !form.formState.isDirty
              }
            >
              {updateInstructor.isPending ? "Saving…" : "Save Profile"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ─── Student profile section ───────────────────────────────────────────────────

const studentProfileSchema = z.object({
  phone: z.string().optional(),
});
type StudentProfileValues = z.infer<typeof studentProfileSchema>;

function StudentProfileSection() {
  const { data: profile } = useGetMyStudentProfile({
    query: { queryKey: ["/api/students/me"] },
  });
  const updateProfile = useUpdateMyStudentProfile();
  const { toast } = useToast();

  const form = useForm<StudentProfileValues>({
    resolver: zodResolver(studentProfileSchema),
    values: { phone: profile?.phone ?? "" },
  });

  const onSubmit = async (values: StudentProfileValues) => {
    try {
      await updateProfile.mutateAsync({
        data: { phone: values.phone || null },
      });
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your contact details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="04xx xxx xxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {profile?.licenseNumber && (
              <div className="space-y-1.5">
                <FormLabel className="text-muted-foreground">
                  Licence Number
                </FormLabel>
                <Input
                  value={profile.licenseNumber}
                  disabled
                  className="bg-muted font-mono text-muted-foreground"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={updateProfile.isPending || !form.formState.isDirty}
            >
              {updateProfile.isPending ? "Saving…" : "Save Profile"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: user, refetch: refetchUser } = useGetMe({
    query: { queryKey: ["/api/users/me"] },
  });
  const role = user?.role;

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and profile information.
          </p>
        </div>

        {/* Instructor link code — prominent, shown first */}
        {role === "instructor" && <InstructorLinkCodeCard />}

        {/* Account — all roles */}
        <AccountSection onSaved={() => refetchUser()} />

        {/* Role-specific profile */}
        {role === "instructor" && <InstructorProfileSection />}
        {role === "student" && <StudentProfileSection />}

        {/* School admin — link through to school entity settings */}
        {role === "school_admin" && (
          <Card>
            <CardHeader>
              <CardTitle>School Settings</CardTitle>
              <CardDescription>
                Manage your school's name, branding, and configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/school-admin/settings">
                <Button variant="outline">Open School Settings</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
