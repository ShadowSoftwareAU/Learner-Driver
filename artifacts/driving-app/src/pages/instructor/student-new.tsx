import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateStudent, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoCaptureField } from "@/components/PhotoCaptureField";
import { ChevronLeft, Loader2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormState {
  fullName: string;
  licenseNumber: string;
  phone: string;
  email: string;
  guardianPhone: string;
  guardianEmail: string;
  pcycSchoolEmail: string;
  notes: string;
}

const EMPTY: FormState = {
  fullName: "",
  licenseNumber: "",
  phone: "",
  email: "",
  guardianPhone: "",
  guardianEmail: "",
  pcycSchoolEmail: "",
  notes: "",
};

export default function InstructorStudentNew() {
  const [, setLocation] = useLocation();
  const createStudent = useCreateStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [headshotPath, setHeadshotPath] = useState<string | null>(null);
  const [licenceFrontPath, setLicenceFrontPath] = useState<string | null>(null);
  const [licenceBackPath, setLicenceBackPath] = useState<string | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const canSubmit = form.fullName.trim().length > 0 && form.email.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const created = await createStudent.mutateAsync({
        data: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          licenseNumber: form.licenseNumber.trim() || undefined,
          phone: form.phone.trim() || undefined,
          guardianPhone: form.guardianPhone.trim() || undefined,
          guardianEmail: form.guardianEmail.trim() || undefined,
          pcycSchoolEmail: form.pcycSchoolEmail.trim() || undefined,
          notes: form.notes.trim() || undefined,
          headshotPath: headshotPath || undefined,
          licenceFrontPath: licenceFrontPath || undefined,
          licenceBackPath: licenceBackPath || undefined,
          country: "AU",
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: "Student added", description: `${form.fullName.trim()} has been created.` });
      setLocation(`/instructor/students/${created.id}`);
    } catch {
      toast({ title: "Could not add student", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/instructor/students">
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-primary" /> Add Student
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a learner profile manually. The student does not need an account yet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Learner Details</CardTitle>
              <CardDescription>Basic information about the student.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name <span className="text-destructive">*</span></Label>
                <Input id="fullName" value={form.fullName} onChange={set("fullName")} placeholder="Jordan Smith" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseNumber">Learner Licence number</Label>
                <Input id="licenseNumber" value={form.licenseNumber} onChange={set("licenseNumber")} placeholder="e.g. 123 456 789" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="04xx xxx xxx" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Student email <span className="text-destructive">*</span></Label>
                  <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="student@example.com" required />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parent / Guardian & School</CardTitle>
              <CardDescription>Contact details for the guardian and any PCYC / school program.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guardianPhone">Parent / guardian phone</Label>
                  <Input id="guardianPhone" type="tel" value={form.guardianPhone} onChange={set("guardianPhone")} placeholder="04xx xxx xxx" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianEmail">Parent / guardian email</Label>
                  <Input id="guardianEmail" type="email" value={form.guardianEmail} onChange={set("guardianEmail")} placeholder="guardian@example.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pcycSchoolEmail">PCYC / School email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="pcycSchoolEmail" type="email" value={form.pcycSchoolEmail} onChange={set("pcycSchoolEmail")} placeholder="program@school.edu.au" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
              <CardDescription>Upload from gallery or capture with the camera.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <PhotoCaptureField
                label="Student headshot"
                description="Used as the student's profile picture across Learner Log."
                value={headshotPath}
                onChange={setHeadshotPath}
                rounded
              />
              <PhotoCaptureField
                label="Licence — front"
                description="Photo showing name, licence number and photo."
                value={licenceFrontPath}
                onChange={setLicenceFrontPath}
              />
              <PhotoCaptureField
                label="Licence — back"
                description="Photo showing conditions and expiry date."
                value={licenceBackPath}
                onChange={setLicenceBackPath}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>Anything else worth recording about this learner.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={form.notes} onChange={set("notes")} rows={4} placeholder="e.g. Nervous on roundabouts, prefers morning lessons." />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/instructor/students">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={!canSubmit || createStudent.isPending}>
              {createStudent.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                "Create Student"
              )}
            </Button>
          </div>
        </form>
      </div>
    </SidebarLayout>
  );
}
