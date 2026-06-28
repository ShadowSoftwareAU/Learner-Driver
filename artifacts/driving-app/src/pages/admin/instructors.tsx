import { useState } from "react";
import { Link } from "wouter";
import { useListInstructors, useListInstructorVerifications, useReviewVerification, useReviewVerificationDocument } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Loader2, Search, Car, Bike, Truck, ChevronRight, Users, ShieldCheck,
  AlertTriangle, AlertCircle, Clock, XCircle, CheckCircle2, FileText,
  ExternalLink, CreditCard, Award, HeartPulse, BookOpen, ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const TRAINING_CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "car_learner", label: "Car — Learner" },
  { value: "car_probationary", label: "Car — Provisional" },
  { value: "q_ride_re", label: "Q-RIDE RE" },
  { value: "q_ride_r", label: "Q-RIDE R" },
  { value: "q_ride_re_to_r", label: "Q-RIDE RE→R" },
  { value: "mr", label: "MR Truck" },
  { value: "hr", label: "HR Truck" },
  { value: "hc", label: "HC Truck" },
  { value: "mc", label: "MC Truck" },
];

const CAT_COLOURS: Record<string, string> = {
  car_learner: "bg-blue-100 text-blue-700",
  car_probationary: "bg-sky-100 text-sky-700",
  q_ride_re: "bg-purple-100 text-purple-700",
  q_ride_r: "bg-violet-100 text-violet-700",
  q_ride_re_to_r: "bg-indigo-100 text-indigo-700",
  mr: "bg-amber-100 text-amber-700",
  hr: "bg-orange-100 text-orange-700",
  hc: "bg-red-100 text-red-700",
  mc: "bg-rose-100 text-rose-700",
};

const CAT_SHORT: Record<string, string> = {
  car_learner: "Car L", car_probationary: "Car P",
  q_ride_re: "RE", q_ride_r: "R", q_ride_re_to_r: "RE→R",
  mr: "MR", hr: "HR", hc: "HC", mc: "MC",
};

const DOC_CONFIG: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  wwcc: { label: "Working With Children Check (WWCC)", description: "Current WWCC card or clearance certificate", icon: ShieldCheck },
  insurance: { label: "Vehicle Insurance", description: "Certificate of currency for tuition vehicle", icon: Car },
  license_front: { label: "Front of Licence", description: "Front of driver's licence — Accreditation Reg 2015, s.12", icon: CreditCard },
  license_back: { label: "Back of Licence", description: "Licence conditions and expiry date", icon: CreditCard },
  driver_trainer_accreditation: { label: "Driver Trainer Accreditation Card", description: "Current accreditation card — Accreditation Reg 2015, s.26–27", icon: Award },
  first_aid: { label: "First Aid Certificate", description: "Valid first aid certificate", icon: HeartPulse },
  rider_trainer_accreditation: { label: "Rider Trainer Accreditation", description: "Required for Q-Ride training — Accreditation Reg 2015, s.33–37", icon: Award },
  qualification: { label: "Instructor Qualification", description: "ADI certificate or equivalent qualification", icon: BookOpen },
};

const VERIF_STATUS_CONFIG = {
  pending: { label: "Under Review", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  needs_revision: { label: "Needs Revision", icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
};

const DOC_STATUS_BADGE: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  approved: { label: "Approved", icon: CheckCircle2, className: "text-green-700 bg-green-50 border-green-200" },
  rejected: { label: "Rejected", icon: XCircle, className: "text-red-700 bg-red-50 border-red-200" },
  needs_revision: { label: "Needs Revision", icon: AlertTriangle, className: "text-orange-700 bg-orange-50 border-orange-200" },
};

function ComplianceBadge({ status, hasExpiringDocs }: { status?: string; hasExpiringDocs?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {status === "compliant" ? (
        <div className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
          <ShieldCheck className="w-3 h-3" /> Compliant
        </div>
      ) : status === "partial" ? (
        <div className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          <AlertTriangle className="w-3 h-3" /> Docs incomplete
        </div>
      ) : (
        <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
          <AlertCircle className="w-3 h-3" /> No docs
        </div>
      )}
      {hasExpiringDocs && (
        <div className="flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
          <Clock className="w-3 h-3" /> Expiring soon
        </div>
      )}
    </div>
  );
}

function VehicleTypeIcon({ type }: { type?: string | null }) {
  if (type === "motorbike") return <Bike className="w-3.5 h-3.5" />;
  if (type && type.includes("truck")) return <Truck className="w-3.5 h-3.5" />;
  return <Car className="w-3.5 h-3.5" />;
}

// ─── Per-document review row ──────────────────────────────────────────────────

function DocReviewRow({
  doc,
  verificationId,
  onDone,
}: {
  doc: any;
  verificationId: number;
  onDone: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(doc.docReviewNotes ?? "");
  const { mutate, isPending } = useReviewVerificationDocument();
  const { toast } = useToast();
  const cfg = DOC_CONFIG[doc.docType];
  const Icon = cfg?.icon ?? FileText;
  const statusBadge = doc.docStatus ? DOC_STATUS_BADGE[doc.docStatus] : null;

  const act = (action: "approved" | "rejected" | "needs_revision") => {
    mutate(
      { id: verificationId, docId: doc.id, data: { action, notes: notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: `Document ${action.replace("_", " ")}` });
          setNotesOpen(false);
          onDone();
        },
        onError: () => toast({ title: "Action failed", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{cfg?.label ?? doc.docType.replace(/_/g, " ")}</p>
          {cfg?.description && <p className="text-xs text-muted-foreground/70">{cfg.description}</p>}
          <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {statusBadge && (() => {
            const SIcon = statusBadge.icon;
            return (
              <span className={`flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5 ${statusBadge.className}`}>
                <SIcon className="w-3 h-3" /> {statusBadge.label}
              </span>
            );
          })()}
          <a
            href={`${BASE_URL}/api/storage${doc.objectPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Open document"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {doc.docReviewNotes && (
        <p className="text-xs text-muted-foreground italic border-l-2 pl-2">{doc.docReviewNotes}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => act("approved")}
          disabled={isPending}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3 h-3" /> Approve
        </button>
        <button
          onClick={() => setNotesOpen(v => !v)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
        >
          <AlertTriangle className="w-3 h-3" /> Needs revision
        </button>
        <button
          onClick={() => act("rejected")}
          disabled={isPending}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3 h-3" /> Reject
        </button>
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {notesOpen && (
        <div className="space-y-1.5">
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Note why this document needs revision…"
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNotesOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={() => act("needs_revision")} disabled={isPending}>
              Send Revision Request
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compliance sheet ─────────────────────────────────────────────────────────

function ComplianceSheet({
  instructor,
  open,
  onClose,
}: {
  instructor: any;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const VQK = ["/api/instructors", instructor.id, "verifications"];
  const { data: verifications, isLoading, refetch } = useListInstructorVerifications(instructor.id, {
    query: { queryKey: VQK, enabled: open },
  });
  const reviewVerification = useReviewVerification();
  const { toast } = useToast();
  const [appNotes, setAppNotes] = useState("");

  const all = (verifications ?? []) as any[];
  const latest = all[0] ?? null;

  const handleAppAction = (action: "approved" | "rejected" | "needs_revision") => {
    if (!latest) return;
    reviewVerification.mutate(
      { id: latest.id, data: { action, notes: appNotes || undefined } },
      {
        onSuccess: () => {
          const labels: Record<string, string> = { approved: "approved", rejected: "rejected", needs_revision: "revision requested" };
          toast({ title: `Application ${labels[action]}` });
          setAppNotes("");
          refetch();
          qc.invalidateQueries({ queryKey: ["/api/instructors"] });
        },
        onError: () => toast({ title: "Action failed", variant: "destructive" }),
      }
    );
  };

  const onDocDone = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["/api/instructors"] });
  };

  const latestCfg = latest ? VERIF_STATUS_CONFIG[latest.status as keyof typeof VERIF_STATUS_CONFIG] : null;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              {instructor.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-tight">{instructor.fullName}</SheetTitle>
              <SheetDescription className="text-xs truncate">{instructor.email}</SheetDescription>
            </div>
            <ComplianceBadge status={(instructor as any).complianceStatus} />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !latest ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No compliance application submitted yet.</p>
            </div>
          ) : (
            <>
              {/* Application status banner */}
              {latestCfg && (() => {
                const StatusIcon = latestCfg.icon;
                return (
                  <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${latestCfg.bg}`}>
                    <StatusIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${latestCfg.color}`} />
                    <div>
                      <p className={`text-sm font-semibold ${latestCfg.color}`}>{latestCfg.label}</p>
                      {latest.reviewerNotes && <p className="text-xs text-foreground mt-0.5">{latest.reviewerNotes}</p>}
                      {latest.submittedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Submitted {format(new Date(latest.submittedAt), "d MMM yyyy")}
                          {latest.reviewedAt && ` · Reviewed ${format(new Date(latest.reviewedAt), "d MMM yyyy")}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Per-document review */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Documents ({latest.documents.length})
                </p>
                {latest.documents.map((doc: any) => (
                  <DocReviewRow key={doc.id} doc={doc} verificationId={latest.id} onDone={onDocDone} />
                ))}
                {latest.documents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No documents submitted.</p>
                )}
              </div>

              {/* Overall application decision */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold">Overall Application Decision</p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
                  <Textarea
                    value={appNotes}
                    onChange={e => setAppNotes(e.target.value)}
                    placeholder="Notes for the instructor about the overall application…"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    onClick={() => handleAppAction("needs_revision")}
                    disabled={reviewVerification.isPending}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Request Revision
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAppAction("rejected")}
                    disabled={reviewVerification.isPending}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAppAction("approved")}
                    disabled={reviewVerification.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {reviewVerification.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Approve
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer: link to full profile */}
        <div className="border-t p-4">
          <Link href={`/admin/instructors/${instructor.id}`} onClick={onClose}>
            <Button variant="outline" className="w-full" size="sm">
              View Full Profile <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminInstructors() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedInstructor, setSelectedInstructor] = useState<any | null>(null);

  const { data: instructors, isLoading } = useListInstructors(
    categoryFilter !== "all" ? { trainingCategory: categoryFilter } : {},
    { query: { queryKey: ["/api/instructors", categoryFilter] } }
  );

  const filtered = instructors?.filter(i =>
    i.fullName.toLowerCase().includes(search.toLowerCase()) ||
    i.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instructors</h1>
          <p className="text-muted-foreground">School instructor roster and qualifications.</p>
        </div>

        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                className="pl-9 bg-gray-50/50"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered && filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(instructor => {
                  const cats: string[] = (instructor as any).trainingCategories ?? [];
                  const pv = (instructor as any).primaryVehicle;
                  return (
                    <div
                      key={instructor.id}
                      onClick={() => setSelectedInstructor(instructor)}
                      className="p-4 rounded-xl border border-border bg-white shadow-sm flex flex-col gap-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                          {instructor.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                              {instructor.fullName}
                            </h3>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{instructor.email}</p>
                          {instructor.phone && <p className="text-sm text-muted-foreground">{instructor.phone}</p>}
                          <div className="mt-1.5">
                            <ComplianceBadge status={(instructor as any).complianceStatus} hasExpiringDocs={(instructor as any).hasExpiringDocs} />
                          </div>
                        </div>
                      </div>

                      {cats.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {cats.map(cat => (
                            <Badge key={cat} className={`text-xs border-0 ${CAT_COLOURS[cat] ?? "bg-gray-100 text-gray-700"}`}>
                              {CAT_SHORT[cat] ?? cat}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="bg-gray-50 p-3 rounded-lg text-sm grid grid-cols-2 gap-2 mt-auto">
                        <div>
                          <span className="text-muted-foreground text-xs block mb-1">Primary vehicle</span>
                          <span className="font-medium flex items-center gap-1.5">
                            {pv ? (
                              <>
                                <VehicleTypeIcon type={pv.vehicleType} />
                                {pv.make} {pv.model}
                                {pv.rego && <span className="text-xs text-muted-foreground font-mono">({pv.rego})</span>}
                              </>
                            ) : instructor.vehicleMake ? (
                              <>
                                <Car className="w-3.5 h-3.5" />
                                {instructor.vehicleMake} {instructor.vehicleModel ?? ""}
                              </>
                            ) : (
                              <span className="text-muted-foreground font-normal text-xs">Not registered</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block mb-1">Active students</span>
                          <span className="font-medium flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            {instructor.activeStudents ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {categoryFilter !== "all"
                    ? "No instructors qualified for this training category."
                    : "No instructors found."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedInstructor && (
        <ComplianceSheet
          instructor={selectedInstructor}
          open={!!selectedInstructor}
          onClose={() => setSelectedInstructor(null)}
        />
      )}
    </SidebarLayout>
  );
}
