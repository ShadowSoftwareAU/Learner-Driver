import { useState, useRef } from "react";
import { useGetVerificationStatus, useSubmitVerification } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Upload, CheckCircle2, Clock, XCircle, AlertTriangle,
  FileText, ShieldCheck, Car, BookOpen, Trash2, Camera, CreditCard, Award, HeartPulse, CalendarDays,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const AU_STATES = [
  { value: "QLD", label: "Queensland (QLD)" },
  { value: "NSW", label: "New South Wales (NSW)" },
  { value: "VIC", label: "Victoria (VIC)" },
  { value: "SA", label: "South Australia (SA)" },
  { value: "WA", label: "Western Australia (WA)" },
  { value: "TAS", label: "Tasmania (TAS)" },
  { value: "NT", label: "Northern Territory (NT)" },
  { value: "ACT", label: "Australian Capital Territory (ACT)" },
];

type DocType =
  | "wwcc"
  | "insurance"
  | "license_front"
  | "license_back"
  | "driver_trainer_accreditation"
  | "first_aid"
  | "rider_trainer_accreditation"
  | "qualification";

type UploadedDoc = {
  docType: DocType;
  fileName: string;
  fileSize: number;
  objectPath: string;
  expiresAt?: string;
};

const DOC_CONFIG: Record<DocType, { label: string; description: string; icon: React.ElementType; required: boolean }> = {
  wwcc: {
    label: "Working With Children Check (WWCC)",
    description: "Your current WWCC card or clearance certificate",
    icon: ShieldCheck,
    required: true,
  },
  insurance: {
    label: "Vehicle Insurance",
    description: "Certificate of currency for your tuition vehicle",
    icon: Car,
    required: true,
  },
  license_front: {
    label: "Front of Licence",
    description: "Front of your driver's licence — Accreditation Reg 2015, s.12",
    icon: CreditCard,
    required: true,
  },
  license_back: {
    label: "Back of Licence",
    description: "Photo showing licence conditions and expiry date",
    icon: CreditCard,
    required: true,
  },
  driver_trainer_accreditation: {
    label: "Driver Trainer Accreditation Card",
    description: "Current accreditation card — Accreditation Reg 2015, s.26–27 (mandatory)",
    icon: Award,
    required: true,
  },
  first_aid: {
    label: "First Aid Certificate",
    description: "Valid first aid certificate — recommended for all instructors",
    icon: HeartPulse,
    required: false,
  },
  rider_trainer_accreditation: {
    label: "Rider Trainer Accreditation",
    description: "Required for Q-Ride motorcycle training — Accreditation Reg 2015, s.33–37",
    icon: Award,
    required: false,
  },
  qualification: {
    label: "Instructor Qualification",
    description: "ADI certificate or equivalent driving instructor qualification (optional)",
    icon: BookOpen,
    required: false,
  },
};

const STATUS_CONFIG = {
  pending: { label: "Under Review", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", badge: "default" as const },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200", badge: "default" as const },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", badge: "destructive" as const },
  needs_revision: { label: "Revision Required", icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", badge: "secondary" as const },
  not_submitted: { label: "Not Submitted", icon: Upload, color: "text-muted-foreground", bg: "", badge: "secondary" as const },
};

async function uploadFileToBucket(file: File): Promise<{ objectPath: string }> {
  const urlRes = await fetch(`${BASE_URL}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Failed to upload file");
  return { objectPath };
}

const DOC_TYPES_WITH_EXPIRY: DocType[] = [
  "wwcc",
  "insurance",
  "driver_trainer_accreditation",
  "first_aid",
  "rider_trainer_accreditation",
];

function UploadSlot({
  docType,
  uploaded,
  onUploaded,
  onRemove,
  onExpiryChange,
  disabled,
  compact = false,
}: {
  docType: DocType;
  uploaded: UploadedDoc | null;
  onUploaded: (doc: UploadedDoc) => void;
  onRemove: () => void;
  onExpiryChange?: (docType: DocType, expiresAt: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const cfg = DOC_CONFIG[docType];
  const Icon = cfg.icon;
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const showExpiry = DOC_TYPES_WITH_EXPIRY.includes(docType);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { objectPath } = await uploadFileToBucket(file);
      onUploaded({ docType, fileName: file.name, fileSize: file.size, objectPath });
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <div className={`rounded-lg border transition-colors ${uploaded ? "border-green-300 bg-green-50/40" : "border-border bg-background"} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${uploaded ? "bg-green-100" : "bg-muted"}`}>
          <Icon className={`w-4 h-4 ${uploaded ? "text-green-600" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-sm font-medium">{cfg.label}</p>
            {cfg.required && <span className="text-xs text-destructive">*</span>}
          </div>
          <p className="text-xs text-muted-foreground">{cfg.description}</p>
          {uploaded && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <span className="text-xs text-green-700 truncate max-w-[180px]">{uploaded.fileName}</span>
                {!disabled && (
                  <button onClick={onRemove} className="ml-1 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                  </button>
                )}
              </div>
              {showExpiry && !disabled && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Expiry date</label>
                  <Input
                    type="date"
                    value={uploaded.expiresAt ?? ""}
                    onChange={(e) => onExpiryChange?.(docType, e.target.value)}
                    className="h-7 text-xs py-0 px-2 max-w-[150px]"
                  />
                </div>
              )}
              {showExpiry && uploaded.expiresAt && (
                <p className="text-xs text-muted-foreground pl-5">
                  Expires {new Date(uploaded.expiresAt + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          )}
        </div>

        {!uploaded && !disabled && (
          <div className="flex-shrink-0 flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3 text-xs"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span className="ml-1.5">{uploading ? "Uploading…" : "Upload"}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3 text-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="ml-1.5">Camera</span>
            </Button>
          </div>
        )}

        {uploading && (
          <div className="flex-shrink-0 flex items-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

function LicenceSection({
  uploads,
  onUploaded,
  onRemove,
  disabled,
}: {
  uploads: { license_front: UploadedDoc | null; license_back: UploadedDoc | null };
  onUploaded: (doc: UploadedDoc) => void;
  onRemove: (dt: "license_front" | "license_back") => void;
  disabled?: boolean;
}) {
  const bothDone = uploads.license_front && uploads.license_back;

  return (
    <Card className={`transition-colors ${bothDone ? "border-green-300" : ""}`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-2 ${bothDone ? "bg-green-100" : "bg-muted"}`}>
            <CreditCard className={`w-4 h-4 ${bothDone ? "text-green-600" : "text-muted-foreground"}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium">Driver's Licence</CardTitle>
              <span className="text-xs text-destructive">*</span>
            </div>
            <p className="text-xs text-muted-foreground">Upload or photograph both sides of your Queensland driver's licence</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <UploadSlot
          docType="license_front"
          uploaded={uploads.license_front}
          onUploaded={onUploaded}
          onRemove={() => onRemove("license_front")}
          disabled={disabled}
          compact
        />
        <UploadSlot
          docType="license_back"
          uploaded={uploads.license_back}
          onUploaded={onUploaded}
          onRemove={() => onRemove("license_back")}
          disabled={disabled}
          compact
        />
      </CardContent>
    </Card>
  );
}

export default function InstructorVerification() {
  const { data, isLoading, refetch } = useGetVerificationStatus({ query: { queryKey: ["/api/instructor/verification/status"] } });
  const submitVerification = useSubmitVerification();
  const { toast } = useToast();

  const [uploads, setUploads] = useState<Record<DocType, UploadedDoc | null>>({
    wwcc: null,
    insurance: null,
    license_front: null,
    license_back: null,
    driver_trainer_accreditation: null,
    first_aid: null,
    rider_trainer_accreditation: null,
    qualification: null,
  });
  const [deliversQRide, setDeliversQRide] = useState(false);
  const [instructorState, setInstructorState] = useState("");
  const [adtaNumber, setAdtaNumber] = useState("");

  const handleExpiryChange = (docType: DocType, expiresAt: string) => {
    setUploads((prev) => {
      const doc = prev[docType];
      if (!doc) return prev;
      return { ...prev, [docType]: { ...doc, expiresAt: expiresAt || undefined } };
    });
  };

  const requiredDocs: DocType[] = ["wwcc", "insurance", "license_front", "license_back", "driver_trainer_accreditation"];
  const allRequiredUploaded = requiredDocs.every((dt) => uploads[dt] !== null) &&
    (!deliversQRide || uploads.rider_trainer_accreditation !== null);
  const anyUploaded = Object.values(uploads).some(Boolean);

  const handleSubmit = () => {
    const docs = Object.values(uploads).filter(Boolean) as UploadedDoc[];
    submitVerification.mutate(
      { data: { documents: docs, state: instructorState || undefined, adtaNumber: adtaNumber.trim() || undefined } as any },
      {
        onSuccess: () => {
          toast({ title: "Application submitted", description: "We'll review your documents and notify you." });
          refetch();
        },
        onError: () => {
          toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
        },
      }
    );
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

  // Pre-fill ADTA from saved instructor profile once data loads
  const [adtaInitialised, setAdtaInitialised] = useState(false);
  if (data && !adtaInitialised) {
    const saved = (data as any).adtaNumber ?? "";
    if (saved) setAdtaNumber(saved);
    setAdtaInitialised(true);
  }

  const status = (data?.status as keyof typeof STATUS_CONFIG) ?? "not_submitted";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_submitted;
  const StatusIcon = cfg.icon;
  const verification = data?.verification;
  const isActive = status === "pending" || status === "approved";
  const canResubmit = status === "needs_revision" || status === "rejected" || status === "not_submitted";

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instructor Verification</h1>
          <p className="text-muted-foreground mt-1">
            Submit your credentials to be approved to accept bookings on Learner Log.
          </p>
        </div>

        {status !== "not_submitted" && (
          <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cfg.bg}`}>
            <StatusIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.color}`} />
            <div>
              <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</p>
              {verification?.reviewerNotes && (
                <p className="text-sm mt-1 text-foreground">{verification.reviewerNotes}</p>
              )}
              {verification?.submittedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Submitted {new Date(verification.submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        )}

        {status === "approved" && (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
              <p className="font-semibold text-green-800">You're verified!</p>
              <p className="text-sm text-green-700 mt-1">Your application has been approved. You can now accept student bookings.</p>
            </CardContent>
          </Card>
        )}

        {canResubmit && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Your Documents</CardTitle>
              <CardDescription>
                Required: WWCC, Insurance, and Driver's Licence (front &amp; back). Each document can be uploaded as a file or captured with your camera.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>State / Territory</Label>
                <p className="text-xs text-muted-foreground">The state where you primarily operate as an instructor.</p>
                <Select value={instructorState} onValueChange={setInstructorState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>ADTA Membership Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <p className="text-xs text-muted-foreground">
                  Australian Driver Trainers Association member number. Not required, but ADTA-verified instructors
                  will be highlighted in search results once database integration is live.
                </p>
                <Input
                  value={adtaNumber}
                  onChange={(e) => setAdtaNumber(e.target.value)}
                  placeholder="e.g. ADTA-12345"
                  className="max-w-xs"
                />
              </div>

              <UploadSlot
                docType="wwcc"
                uploaded={uploads.wwcc}
                onUploaded={(doc) => setUploads((prev) => ({ ...prev, wwcc: doc }))}
                onRemove={() => setUploads((prev) => ({ ...prev, wwcc: null }))}
                onExpiryChange={handleExpiryChange}
              />
              <UploadSlot
                docType="insurance"
                uploaded={uploads.insurance}
                onUploaded={(doc) => setUploads((prev) => ({ ...prev, insurance: doc }))}
                onRemove={() => setUploads((prev) => ({ ...prev, insurance: null }))}
                onExpiryChange={handleExpiryChange}
              />

              <LicenceSection
                uploads={{ license_front: uploads.license_front, license_back: uploads.license_back }}
                onUploaded={(doc) => setUploads((prev) => ({ ...prev, [doc.docType]: doc }))}
                onRemove={(dt) => setUploads((prev) => ({ ...prev, [dt]: null }))}
              />

              <UploadSlot
                docType="driver_trainer_accreditation"
                uploaded={uploads.driver_trainer_accreditation}
                onUploaded={(doc) => setUploads((prev) => ({ ...prev, driver_trainer_accreditation: doc }))}
                onRemove={() => setUploads((prev) => ({ ...prev, driver_trainer_accreditation: null }))}
                onExpiryChange={handleExpiryChange}
              />
              <UploadSlot
                docType="first_aid"
                uploaded={uploads.first_aid}
                onUploaded={(doc) => setUploads((prev) => ({ ...prev, first_aid: doc }))}
                onRemove={() => setUploads((prev) => ({ ...prev, first_aid: null }))}
                onExpiryChange={handleExpiryChange}
              />

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-purple-50 border-purple-200">
                <input
                  type="checkbox"
                  id="qride-checkbox"
                  checked={deliversQRide}
                  onChange={e => setDeliversQRide(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-purple-600 flex-shrink-0"
                />
                <label htmlFor="qride-checkbox" className="text-sm font-medium text-purple-900 cursor-pointer">
                  I deliver Q-Ride motorcycle training
                  <span className="block text-xs font-normal text-purple-700 mt-0.5">
                    Rider Trainer Accreditation required — Accreditation Reg 2015, s.33–37
                  </span>
                </label>
              </div>

              {deliversQRide && (
                <UploadSlot
                  docType="rider_trainer_accreditation"
                  uploaded={uploads.rider_trainer_accreditation}
                  onUploaded={(doc) => setUploads((prev) => ({ ...prev, rider_trainer_accreditation: doc }))}
                  onRemove={() => setUploads((prev) => ({ ...prev, rider_trainer_accreditation: null }))}
                  onExpiryChange={handleExpiryChange}
                />
              )}

              <UploadSlot
                docType="qualification"
                uploaded={uploads.qualification}
                onUploaded={(doc) => setUploads((prev) => ({ ...prev, qualification: doc }))}
                onRemove={() => setUploads((prev) => ({ ...prev, qualification: null }))}
              />

              <div className="pt-2">
                <Button
                  className="w-full"
                  disabled={!allRequiredUploaded || submitVerification.isPending}
                  onClick={handleSubmit}
                >
                  {submitVerification.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
                {!allRequiredUploaded && anyUploaded && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Please upload all required documents (*) before submitting.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isActive && data?.documents && data.documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submitted Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.documents.map((doc: any) => {
                const isExpiringSoon = doc.expiresAt && (() => {
                  const expiry = new Date(doc.expiresAt + "T00:00:00");
                  const now = new Date();
                  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return daysLeft <= 30;
                })();
                return (
                  <div key={doc.id} className={`flex items-center gap-2 text-sm p-2 rounded-md ${isExpiringSoon ? "bg-amber-50 border border-amber-200" : ""}`}>
                    <FileText className={`w-4 h-4 flex-shrink-0 ${isExpiringSoon ? "text-amber-500" : "text-muted-foreground"}`} />
                    <span className="truncate">{doc.fileName}</span>
                    <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      {doc.expiresAt && (
                        <span className={`text-xs flex items-center gap-1 ${isExpiringSoon ? "text-amber-700 font-medium" : "text-muted-foreground"}`}>
                          {isExpiringSoon && <AlertTriangle className="w-3 h-3" />}
                          Exp. {new Date(doc.expiresAt + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs capitalize">
                        {doc.docType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
