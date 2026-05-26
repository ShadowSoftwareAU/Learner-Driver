import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, useUpdateMyRole, useCreateStudent, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Car, GraduationCap, Building2, Loader2, ArrowLeft } from "lucide-react";
import { RoleUpdateRole } from "@/lib/enums";

const AU_STATES = [
  { value: "QLD", label: "Queensland (QLD)" },
  { value: "NSW", label: "New South Wales (NSW)" },
  { value: "VIC", label: "Victoria (VIC)" },
  { value: "SA", label: "South Australia (SA)" },
  { value: "WA", label: "Western Australia (WA)" },
  { value: "TAS", label: "Tasmania (TAS)" },
  { value: "NT", label: "Northern Territory (NT)" },
  { value: "ACT", label: "Australian Capital Territory (ACT)" },
] as const;

export default function Onboarding() {
  const { data: user, isLoading, isError } = useGetMe();
  const updateRole = useUpdateMyRole();
  const createStudent = useCreateStudent();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<"role" | "region">("role");
  const [selectedRegion, setSelectedRegion] = useState<string>("");

  const needsRedirect =
    isError || (!!user?.role && user.role !== "unassigned");

  useEffect(() => {
    if (needsRedirect) {
      setLocation("/");
    }
  }, [needsRedirect, setLocation]);

  if (isLoading || needsRedirect) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSelectRole = (role: RoleUpdateRole) => {
    if (role === RoleUpdateRole.student) {
      setStep("region");
      return;
    }
    updateRole.mutate(
      { data: { role } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/");
        },
      }
    );
  };

  const handleStudentSubmit = () => {
    updateRole.mutate(
      { data: { role: RoleUpdateRole.student } },
      {
        onSuccess: async () => {
          if (user) {
            try {
              await createStudent.mutateAsync({
                data: {
                  fullName: user.name || user.email,
                  email: user.email,
                  region: selectedRegion || undefined,
                  country: "AU",
                },
              });
            } catch {
              // Student profile may already exist, that's ok
            }
          }
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/");
        },
      }
    );
  };

  if (step === "region") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 text-muted-foreground"
            onClick={() => setStep("role")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <GraduationCap className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl">Where are you learning?</CardTitle>
              <CardDescription>
                Select your state so we can show the right assessment criteria for your region.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>State / Territory</Label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full h-12 text-base"
                onClick={handleStudentSubmit}
                disabled={updateRole.isPending || createStudent.isPending}
              >
                {(updateRole.isPending || createStudent.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Continue as Student
              </Button>

              <button
                type="button"
                onClick={handleStudentSubmit}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center underline"
              >
                Skip for now
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">Welcome to DriveTrack</h1>
          <p className="text-muted-foreground text-lg">Select your role to get started.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-1" onClick={() => handleSelectRole(RoleUpdateRole.student)}>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <GraduationCap className="w-8 h-8" />
              </div>
              <CardTitle>Learner Driver</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Track your logged hours, view assessment feedback, and see what you need to practice.
              </CardDescription>
              <Button className="w-full mt-6" variant="outline">Select Student</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-1 border-primary" onClick={() => handleSelectRole(RoleUpdateRole.instructor)}>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="w-8 h-8" />
              </div>
              <CardTitle>Instructor</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Log assessments, manage your students, and record lesson progress accurately.
              </CardDescription>
              <Button className="w-full mt-6">Select Instructor</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-1" onClick={() => handleSelectRole(RoleUpdateRole.admin)}>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <Building2 className="w-8 h-8" />
              </div>
              <CardTitle>School Admin</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Manage multiple instructors, oversee fleet compliance, and view school-wide analytics.
              </CardDescription>
              <Button className="w-full mt-6" variant="outline">Select Admin</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
