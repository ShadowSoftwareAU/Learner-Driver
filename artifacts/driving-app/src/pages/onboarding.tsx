import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, useUpdateMyRole, useCreateStudent, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhotoCaptureField } from "@/components/PhotoCaptureField";
import { Car, GraduationCap, Building2, Users, Loader2, ArrowLeft, Info, AlertCircle } from "lucide-react";
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

const STATE_REQUIREMENTS: Record<string, { hours: number; nightHours: number; citation: string }> = {
  QLD: { hours: 100, nightHours: 10, citation: "Driver Licensing Regulation 2021, s.29" },
  NSW: { hours: 120, nightHours: 20, citation: "Road Transport (Driver Licensing) Regulation 2017" },
  VIC: { hours: 120, nightHours: 10, citation: "Road Safety (Driver Standards) Regulations 2019" },
  SA: { hours: 75, nightHours: 15, citation: "Motor Vehicle Act 1959" },
  WA: { hours: 50, nightHours: 5, citation: "Road Traffic (Driver Licensing) Regulations 2008" },
  TAS: { hours: 80, nightHours: 10, citation: "Vehicle and Traffic Act 1999" },
  NT: { hours: 100, nightHours: 10, citation: "Motor Vehicle Act (NT)" },
  ACT: { hours: 100, nightHours: 10, citation: "Road Transport (Driver Licensing) Regulation 2000" },
};

export default function Onboarding() {
  const { data: user, isLoading, isError } = useGetMe();
  const updateRole = useUpdateMyRole();
  const createStudent = useCreateStudent();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<"role" | "region">("role");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [details, setDetails] = useState({
    licenseNumber: "",
    phone: "",
    guardianPhone: "",
    guardianEmail: "",
    pcycSchoolEmail: "",
    notes: "",
    medicalNotes: "",
  });
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [licenseStatus, setLicenseStatus] = useState("");
  const [transmissionPreference, setTransmissionPreference] = useState("");
  const [headshotPath, setHeadshotPath] = useState<string | null>(null);
  const [licenceFrontPath, setLicenceFrontPath] = useState<string | null>(null);
  const [licenceBackPath, setLicenceBackPath] = useState<string | null>(null);

  const setDetail = (key: keyof typeof details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDetails((prev) => ({ ...prev, [key]: e.target.value }));

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
      { data: { role: role as "student" | "instructor" | "admin" } },
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
                  state: selectedRegion || undefined,
                  dateOfBirth: dateOfBirth || undefined,
                  licenseStatus: (licenseStatus as any) || undefined,
                  transmissionPreference: (transmissionPreference as any) || undefined,
                  licenseNumber: details.licenseNumber.trim() || undefined,
                  phone: details.phone.trim() || undefined,
                  guardianPhone: details.guardianPhone.trim() || undefined,
                  guardianEmail: details.guardianEmail.trim() || undefined,
                  pcycSchoolEmail: details.pcycSchoolEmail.trim() || undefined,
                  notes: details.notes.trim() || undefined,
                  medicalNotes: details.medicalNotes.trim() || undefined,
                  headshotPath: headshotPath || undefined,
                  licenceFrontPath: licenceFrontPath || undefined,
                  licenceBackPath: licenceBackPath || undefined,
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
        <div className="max-w-lg w-full">
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
              <CardTitle className="text-2xl">Tell us about yourself</CardTitle>
              <CardDescription>
                These details help your instructor track your progress. You can skip and add them later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>State / Territory</Label>
                <p className="text-xs text-muted-foreground">Road rules and licence requirements vary by state.</p>
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
                {selectedRegion && STATE_REQUIREMENTS[selectedRegion] && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {STATE_REQUIREMENTS[selectedRegion].hours} hours required, including {STATE_REQUIREMENTS[selectedRegion].nightHours} at night
                        </p>
                        <p className="text-xs text-blue-600 mt-0.5">
                          {STATE_REQUIREMENTS[selectedRegion].citation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-dob">
                  Date of Birth <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ob-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="h-12"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Licence Status</Label>
                  <Select value={licenseStatus} onValueChange={setLicenseStatus}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="learner">Learner</SelectItem>
                      <SelectItem value="provisional">Provisional</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="overseas">Overseas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transmission</Label>
                  <Select value={transmissionPreference} onValueChange={setTransmissionPreference}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select transmission" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">Automatic</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-license">Learner Licence number</Label>
                <Input id="ob-license" value={details.licenseNumber} onChange={setDetail("licenseNumber")} placeholder="e.g. 123 456 789" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-phone">Your phone</Label>
                <Input id="ob-phone" type="tel" value={details.phone} onChange={setDetail("phone")} placeholder="04xx xxx xxx" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ob-gphone">Parent / guardian phone</Label>
                  <Input id="ob-gphone" type="tel" value={details.guardianPhone} onChange={setDetail("guardianPhone")} placeholder="04xx xxx xxx" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-gemail">Parent / guardian email</Label>
                  <Input id="ob-gemail" type="email" value={details.guardianEmail} onChange={setDetail("guardianEmail")} placeholder="guardian@example.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-pcyc">PCYC / School email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="ob-pcyc" type="email" value={details.pcycSchoolEmail} onChange={setDetail("pcycSchoolEmail")} placeholder="program@school.edu.au" />
              </div>

              <div className="space-y-3">
                <PhotoCaptureField
                  label="Profile photo"
                  description="Used as your profile picture across Learner Log."
                  value={headshotPath}
                  onChange={setHeadshotPath}
                  rounded
                />
                <PhotoCaptureField
                  label="Licence — front"
                  value={licenceFrontPath}
                  onChange={setLicenceFrontPath}
                />
                <PhotoCaptureField
                  label="Licence — back"
                  value={licenceBackPath}
                  onChange={setLicenceBackPath}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-notes">Notes</Label>
                <Textarea id="ob-notes" value={details.notes} onChange={setDetail("notes")} rows={2} placeholder="Anything your instructor should know." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-medical" className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  Medical Conditions / Notes
                  <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="ob-medical"
                  value={details.medicalNotes}
                  onChange={setDetail("medicalNotes")}
                  rows={2}
                  placeholder="e.g. wears glasses, takes medication for anxiety, bee sting allergy"
                />
                <p className="text-xs text-muted-foreground">Only your instructor can see this. Keep it brief — add detailed medical records through your instructor.</p>
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
      <div className="max-w-5xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">Welcome to Learner Log</h1>
          <p className="text-muted-foreground text-lg">Select your role to get started.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-1" onClick={() => handleSelectRole(RoleUpdateRole.student)}>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <GraduationCap className="w-8 h-8" />
              </div>
              <CardTitle>Learner Driver</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Track your logged hours, view assessment feedback, and see what you need to practise.
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

          <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-1" onClick={() => handleSelectRole(RoleUpdateRole.viewer)}>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <Users className="w-8 h-8" />
              </div>
              <CardTitle>Parent / Guardian</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                View your learner driver's progress, upcoming lessons, and add credits for bookings.
              </CardDescription>
              <Button className="w-full mt-6" variant="outline">Select Guardian</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
