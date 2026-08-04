import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetMyStudentProfile, useUpdateMyStudentProfile } from "@workspace/api-client-react";
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
import { Loader2, User, Lock } from "lucide-react";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      </div>
    </SidebarLayout>
  );
}
