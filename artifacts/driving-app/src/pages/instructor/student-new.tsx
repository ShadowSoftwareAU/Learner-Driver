import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateStudent, useParseLicence, getListStudentsQueryKey } from "@workspace/api-client-react";
import type { ParsedLicenceData } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PhotoCaptureField } from "@/components/PhotoCaptureField";
import { uploadFileToBucket } from "@/lib/upload";
import { ChevronLeft, Loader2, UserPlus, ScanLine, CheckCircle2, Upload, X, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  fullName: string;
  licenseNumber: string;
  licenceClass: string;
  licenceType: string;
  dateOfBirth: string;
  licenceEffectiveDate: string;
  licenceExpiry: string;
  licenceCardNumber: string;
  address: string;
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
  licenceClass: "",
  licenceType: "",
  dateOfBirth: "",
  licenceEffectiveDate: "",
  licenceExpiry: "",
  licenceCardNumber: "",
  address: "",
  phone: "",
  email: "",
  guardianPhone: "",
  guardianEmail: "",
  pcycSchoolEmail: "",
  notes: "",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix: "data:image/jpeg;base64,"
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Format ISO date (YYYY-MM-DD) → DD/MM/YYYY for display badges */
function fmtDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InstructorStudentNew() {
  const [, setLocation] = useLocation();
  const createStudent = useCreateStudent();
  const parseLicence = useParseLicence();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [headshotPath, setHeadshotPath] = useState<string | null>(null);
  const [licenceFrontPath, setLicenceFrontPath] = useState<string | null>(null);
  const [licenceBackPath, setLicenceBackPath] = useState<string | null>(null);
  const [sendInvite, setSendInvite] = useState(true);

  // OCR scan state
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ParsedLicenceData | null>(null);
  const [scanning, setScanning] = useState(false);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  // ── Image selection ────────────────────────────────────────────────────────

  const handleFrontSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFrontFile(file);
    setFrontPreview(URL.createObjectURL(file));
    setScanResult(null);
  };

  const handleBackSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackFile(file);
    setBackPreview(URL.createObjectURL(file));
    setScanResult(null);
  };

  // ── AI scan ───────────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (!frontFile) return;
    setScanning(true);
    try {
      const frontBase64 = await fileToBase64(frontFile);
      const backBase64 = backFile ? await fileToBase64(backFile) : undefined;

      const data = await parseLicence.mutateAsync({
        data: {
          frontBase64,
          frontMimeType: frontFile.type || "image/jpeg",
          backBase64: backBase64 ?? undefined,
          backMimeType: backFile?.type ?? undefined,
        },
      });

      setScanResult(data);

      // Upload the scanned images to storage so they populate the licence photo fields
      const [frontUpload, backUpload] = await Promise.all([
        uploadFileToBucket(frontFile),
        backFile ? uploadFileToBucket(backFile) : Promise.resolve(null),
      ]);
      if (frontUpload) setLicenceFrontPath(frontUpload.objectPath);
      if (backUpload)  setLicenceBackPath(backUpload.objectPath);

      // Pre-fill the form from OCR results
      setForm(prev => ({
        ...prev,
        fullName:             data.fullName              ?? prev.fullName,
        licenseNumber:        data.licenceNumber         ?? prev.licenseNumber,
        licenceClass:         data.licenceClass          ?? prev.licenceClass,
        licenceType:          data.licenceType           ?? prev.licenceType,
        dateOfBirth:          data.dateOfBirth           ?? prev.dateOfBirth,
        licenceEffectiveDate: data.licenceEffectiveDate  ?? prev.licenceEffectiveDate,
        licenceExpiry:        data.licenceExpiry         ?? prev.licenceExpiry,
        licenceCardNumber:    data.cardNumber            ?? prev.licenceCardNumber,
        address:              data.address               ?? prev.address,
      }));

      toast({
        title: "Licence scanned",
        description: "Fields pre-filled from the licence. Please review and correct if needed.",
      });
    } catch {
      toast({ title: "Scan failed", description: "Could not read the licence. Please fill the fields manually.", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const canSubmit = form.fullName.trim().length > 0 && form.email.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const created = await createStudent.mutateAsync({
        data: {
          fullName:             form.fullName.trim(),
          email:                form.email.trim(),
          licenseNumber:        form.licenseNumber.trim()         || undefined,
          licenceClass:         form.licenceClass.trim()          || undefined,
          licenceType:          form.licenceType.trim()           || undefined,
          dateOfBirth:          form.dateOfBirth.trim()           || undefined,
          licenceEffectiveDate: form.licenceEffectiveDate.trim()  || undefined,
          licenceExpiry:        form.licenceExpiry.trim()         || undefined,
          licenceCardNumber:    form.licenceCardNumber.trim()     || undefined,
          address:              form.address.trim()               || undefined,
          phone:                form.phone.trim()                 || undefined,
          guardianPhone:        form.guardianPhone.trim()         || undefined,
          guardianEmail:        form.guardianEmail.trim()         || undefined,
          pcycSchoolEmail:      form.pcycSchoolEmail.trim()       || undefined,
          notes:                form.notes.trim()                 || undefined,
          headshotPath:         headshotPath                      || undefined,
          licenceFrontPath:     licenceFrontPath                  || undefined,
          licenceBackPath:      licenceBackPath                   || undefined,
          country:              "AU",
          sendInvite,
        },
      });
      queryClient.removeQueries({ queryKey: getListStudentsQueryKey() });
      toast({
        title: "Student added",
        description: sendInvite
          ? `${form.fullName.trim()} has been created and a welcome email has been sent to ${form.email.trim()}.`
          : `${form.fullName.trim()} has been created.`,
      });
      setLocation(`/instructor/students/${created.id}`);
    } catch {
      toast({ title: "Could not add student", description: "Please try again.", variant: "destructive" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
            Scan the student's driver licence to pre-fill the form, or enter details manually.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Licence scan ─────────────────────────────────────────── */}
          <Card className="border-primary/30 bg-primary/[0.02]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-primary" /> Scan Driver Licence
              </CardTitle>
              <CardDescription>
                Upload photos of both sides and let AI extract the details automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image selectors */}
              <div className="grid grid-cols-2 gap-4">
                {/* Front */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Front of licence</p>
                  <input ref={frontInputRef} type="file" accept="image/*" className="hidden" onChange={handleFrontSelect} />
                  {frontPreview ? (
                    <div className="relative rounded-lg overflow-hidden border aspect-video bg-muted">
                      <img src={frontPreview} alt="Licence front" className="object-cover w-full h-full" />
                      <button
                        type="button"
                        onClick={() => { setFrontFile(null); setFrontPreview(null); setScanResult(null); if (frontInputRef.current) frontInputRef.current.value = ""; }}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => frontInputRef.current?.click()}
                      className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Select image</span>
                    </button>
                  )}
                </div>

                {/* Back */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Rear of licence <span className="text-muted-foreground text-xs">(optional)</span></p>
                  <input ref={backInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackSelect} />
                  {backPreview ? (
                    <div className="relative rounded-lg overflow-hidden border aspect-video bg-muted">
                      <img src={backPreview} alt="Licence back" className="object-cover w-full h-full" />
                      <button
                        type="button"
                        onClick={() => { setBackFile(null); setBackPreview(null); if (backInputRef.current) backInputRef.current.value = ""; }}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => backInputRef.current?.click()}
                      className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Select image</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scan button */}
              <Button
                type="button"
                onClick={handleScan}
                disabled={!frontFile || scanning}
                className="w-full gap-2"
              >
                {scanning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
                ) : (
                  <><ScanLine className="w-4 h-4" /> Scan with AI</>
                )}
              </Button>

              {/* Scan results summary */}
              {scanResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Scan complete, fields pre-filled
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {scanResult.fullName       && <Badge variant="secondary" className="text-xs">{scanResult.fullName}</Badge>}
                    {scanResult.dateOfBirth    && <Badge variant="secondary" className="text-xs">DOB: {fmtDate(scanResult.dateOfBirth)}</Badge>}
                    {scanResult.licenceClass   && <Badge variant="secondary" className="text-xs">Class: {scanResult.licenceClass}</Badge>}
                    {scanResult.licenceType    && <Badge variant="secondary" className="text-xs">Type: {scanResult.licenceType}</Badge>}
                    {scanResult.licenceNumber  && <Badge variant="secondary" className="text-xs">CRN: {scanResult.licenceNumber}</Badge>}
                    {scanResult.licenceExpiry  && <Badge variant="secondary" className="text-xs">Exp: {fmtDate(scanResult.licenceExpiry)}</Badge>}
                    {scanResult.address        && <Badge variant="secondary" className="text-xs truncate max-w-[200px]">{scanResult.address}</Badge>}
                    {scanResult.cardNumber     && <Badge variant="secondary" className="text-xs">Card: {scanResult.cardNumber}</Badge>}
                  </div>
                  <p className="text-xs text-green-700">Review the fields below and correct any errors before saving.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Learner details ──────────────────────────────────────── */}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of birth</Label>
                  <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="04xx xxx xxx" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Student email <span className="text-destructive">*</span></Label>
                <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="student@example.com" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={set("address")} placeholder="6 Vanessa Court Camira 4300" />
              </div>
            </CardContent>
          </Card>

          {/* ── Licence details ──────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Licence Details</CardTitle>
              <CardDescription>Extracted from the licence scan or entered manually.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">Licence No / CRN</Label>
                  <Input id="licenseNumber" value={form.licenseNumber} onChange={set("licenseNumber")} placeholder="077 873 196" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenceClass">Class</Label>
                  <Input id="licenceClass" value={form.licenceClass} onChange={set("licenceClass")} placeholder="e.g. MR, C" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenceType">Type</Label>
                  <Input id="licenceType" value={form.licenceType} onChange={set("licenceType")} placeholder="e.g. O, P1, P2" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenceEffectiveDate">Effective date</Label>
                  <Input id="licenceEffectiveDate" type="date" value={form.licenceEffectiveDate} onChange={set("licenceEffectiveDate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenceExpiry">Expiry date</Label>
                  <Input id="licenceExpiry" type="date" value={form.licenceExpiry} onChange={set("licenceExpiry")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenceCardNumber">Card number</Label>
                  <Input id="licenceCardNumber" value={form.licenceCardNumber} onChange={set("licenceCardNumber")} placeholder="DE7 A42 6BE D" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Parent / guardian ────────────────────────────────────── */}
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

          {/* ── Photos ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
              <CardDescription>Save licence images and headshot to the student's permanent record.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <PhotoCaptureField
                label="Student headshot"
                description="Used as the student's profile picture."
                value={headshotPath}
                onChange={setHeadshotPath}
                rounded
              />
              <PhotoCaptureField
                label="Licence front"
                description="Photo showing name, licence number and photo."
                value={licenceFrontPath}
                onChange={setLicenceFrontPath}
              />
              <PhotoCaptureField
                label="Licence back"
                description="Photo showing address, card number and conditions."
                value={licenceBackPath}
                onChange={setLicenceBackPath}
              />
            </CardContent>
          </Card>

          {/* ── Notes ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>Anything else worth recording about this learner.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={form.notes} onChange={set("notes")} rows={4} placeholder="e.g. Nervous on roundabouts, prefers morning lessons." />
            </CardContent>
          </Card>

          {/* ── Invite email ─────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="sendInvite"
                  checked={sendInvite}
                  onCheckedChange={v => setSendInvite(!!v)}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="sendInvite" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-primary" />
                    Send welcome email to student
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sends a login invitation to <strong>{form.email || "the student's email"}</strong> so they can access their assessments, progress, and bookings.
                    {!form.email && <span className="text-amber-600"> Enter an email above to enable.</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Actions ──────────────────────────────────────────────── */}
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
