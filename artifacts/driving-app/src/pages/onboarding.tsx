import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, useUpdateMyRole, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, GraduationCap, Building2, Loader2 } from "lucide-react";
import { RoleUpdateRole } from "@/lib/enums";

export default function Onboarding() {
  const { data: user, isLoading, isError } = useGetMe();
  const updateRole = useUpdateMyRole();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

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
