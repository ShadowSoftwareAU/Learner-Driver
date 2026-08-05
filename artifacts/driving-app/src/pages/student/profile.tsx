import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetMyStudentProfile, useUpdateMyStudentProfile, useGenerateMyViewerCode } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Copy, Check, Users } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  phone: z.string().max(20, "Phone number too long").optional().or(z.literal("")),
  address: z.string().max(500, "Address too long").optional().or(z.literal("")),
});

type ProfileValues = z.infer<typeof profileSchema>;

// ─── Read-only field ──────────────────────────────────────────────────────────

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium leading-none">{label}</span>
        <Lock className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {value || <span className="opacity-50">Not set</span>}
      </div>
      {hint && <p className="text-[0.8rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const { data: profile, isLoading } = useGetMyStudentProfile({
    query: { queryKey: ["/api/students/me"] },
  });
  const updateProfile = useUpdateMyStudentProfile();
  const generateViewerCode = useGenerateMyViewerCode();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [codeCopied, setCodeCopied] = useState(false);

  async function handleGenerateCode() {
    try {
      await generateViewerCode.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      toast({ title: "Viewer code generated", description: "Share this code with a parent or guardian so they can link to your profile." });
    } catch {
      toast({
        title: "Failed to generate code",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
    },
  });

  const onSubmit = async (values: ProfileValues) => {
    try {
      await updateProfile.mutateAsync({
        data: {
          phone: values.phone || null,
          address: values.address || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      toast({ title: "Profile updated", description: "Your contact details have been saved." });
    } catch {
      toast({
        title: "Failed to save changes",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const dob = profile?.dateOfBirth
    ? format(new Date(profile.dateOfBirth), "d MMMM yyyy")
    : null;

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <User className="w-7 h-7" />
            My Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            View and update your contact details.
          </p>
        </div>

        {/* Read-only identity fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              These fields are managed by your instructor and cannot be changed here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadOnlyField label="Full name" value={profile?.fullName} />
            <ReadOnlyField label="Email" value={profile?.email} />
            <ReadOnlyField
              label="Date of birth"
              value={dob}
              hint="Contact your instructor to correct this."
            />
          </CardContent>
        </Card>

        {/* Editable contact fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Details</CardTitle>
            <CardDescription>
              Keep your phone number and address up to date.
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
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input placeholder="04xx xxx xxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Example St, Suburb QLD 4000" {...field} />
                      </FormControl>
                      <FormDescription>
                        Update this if your address has changed since your licence was scanned.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updateProfile.isPending || !form.formState.isDirty}
                  className="w-full sm:w-auto"
                >
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Viewer code — share with parents/guardians */}
        <Card className="border-violet-200 bg-violet-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-violet-900">
              <Users className="w-4 h-4" />
              Share with a Parent or Guardian
            </CardTitle>
            <CardDescription>
              Give this code to a parent, guardian, or mentor so they can link to your profile and track your progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(profile as any)?.viewerCode ? (
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-lg font-mono font-semibold tracking-widest text-violet-800 bg-violet-100 px-3 py-1.5 rounded-md">
                  {(profile as any).viewerCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => copyCode((profile as any).viewerCode)}
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {codeCopied ? "Copied!" : "Copy code"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-violet-700 hover:text-violet-900 hover:bg-violet-100"
                  onClick={handleGenerateCode}
                  disabled={generateViewerCode.isPending}
                >
                  {generateViewerCode.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  Regenerate
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No viewer code yet. Generate one to share with a parent or guardian.
                </p>
                <Button
                  size="sm"
                  className="gap-1.5 bg-violet-700 hover:bg-violet-800 text-white"
                  onClick={handleGenerateCode}
                  disabled={generateViewerCode.isPending}
                >
                  {generateViewerCode.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  Generate code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
