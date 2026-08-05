import { useGetViewerStudents, useRequestViewerLink, useGetMyWallet, useCreateWalletCheckout, ViewerStudentSummary } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Eye, Plus, ChevronRight, Clock, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight, ClipboardList, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const QK = "/api/viewer/students";
const WALLET_QK = "/api/wallet";

// ── Student selector ──────────────────────────────────────────────────────────

function StudentSelector({
  students,
  onNavigate,
}: {
  students: ViewerStudentSummary[];
  onNavigate: (id: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<number>(students[0]?.id ?? 0);
  const s = students.find((x) => x.id === selectedId) ?? students[0];

  return (
    <div className="space-y-4">
      {/* Selector — only shown when there are multiple students */}
      {students.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Select student
          </Label>
          <Select
            value={String(selectedId)}
            onValueChange={(v) => setSelectedId(Number(v))}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {students.map((st) => (
                <SelectItem key={st.id} value={String(st.id)}>
                  {st.fullName}
                  {st.relationshipType ? ` (${st.relationshipType.replace(/_/g, " ")})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selected student card */}
      {s && (
        <Card>
          <CardContent className="pt-5 pb-4 space-y-4">
            {/* Name + relationship */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-lg">{s.fullName}</p>
                {s.relationshipType && (
                  <p className="text-sm text-muted-foreground capitalize">
                    {s.relationshipType.replace(/_/g, " ")}
                    {s.linkedAt && (
                      <span className="text-xs ml-2">
                        · linked {new Date(s.linkedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {students.length === 1 && (
                <Badge variant="outline" className="text-xs shrink-0 capitalize">
                  {s.relationshipType?.replace(/_/g, " ") ?? "Linked"}
                </Badge>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 py-3 border-y">
              <div className="text-center">
                <p className="text-xl font-bold">
                  {s.isQLD && s.effectiveTotalHours != null
                    ? Number(s.effectiveTotalHours).toFixed(1)
                    : s.totalHours != null
                    ? Number(s.totalHours).toFixed(1)
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.isQLD ? "effective hrs" : "total hrs"}
                </p>
                {s.isQLD && s.effectiveTotalHours != null && (
                  <p className="text-[10px] text-muted-foreground">
                    {Number(s.instructorHours ?? 0).toFixed(1)}i + {Number(s.supervisedHours ?? 0).toFixed(1)}s
                  </p>
                )}
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${(s.noShowCount ?? 0) > 0 ? "text-yellow-700" : ""}`}>
                  {s.noShowCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">no-shows</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">
                  {s.attendanceReliabilityScore != null ? `${s.attendanceReliabilityScore}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">attendance</p>
              </div>
            </div>

            {/* Attendance bar */}
            {s.attendanceReliabilityScore != null && (
              <div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.attendanceReliabilityScore >= 80
                        ? "bg-green-500"
                        : s.attendanceReliabilityScore >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${s.attendanceReliabilityScore}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => onNavigate(s.id)}
              >
                <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                View Lessons &amp; Assessments
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => onNavigate(s.id)}
              >
                <ChevronRight className="w-3.5 h-3.5 mr-1" />
                Full Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other students as compact links (when >1) */}
      {students.length > 1 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium px-1">All linked students</p>
          {students.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedId(st.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-colors ${
                st.id === selectedId
                  ? "border-primary/40 bg-primary/5 text-primary font-medium"
                  : "border-transparent hover:bg-muted text-foreground"
              }`}
            >
              <span>{st.fullName}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {st.totalHours != null ? `${Number(st.totalHours).toFixed(1)} hrs` : "—"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const RELATIONSHIP_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "mentor", label: "Mentor" },
  { value: "support_worker", label: "Support Worker" },
  { value: "agency_case_worker", label: "Agency Case Worker" },
  { value: "school_mentor", label: "School Mentor" },
  { value: "other", label: "Other" },
];


export default function ViewerDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showLink, setShowLink] = useState(false);
  const [code, setCode] = useState("");
  const [relationship, setRelationship] = useState("parent");
  const [showTopup, setShowTopup] = useState(false);

  const { data: students, isLoading } = useGetViewerStudents({
    query: { queryKey: [QK] },
  });

  const { data: wallet, isLoading: walletLoading } = useGetMyWallet({
    query: { queryKey: [WALLET_QK] },
  });

  const { mutate: startCheckout, isPending: checkoutPending } = useCreateWalletCheckout({
    mutation: {
      onSuccess: (data: any) => {
        if (data?.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      },
      onError: () =>
        toast({ title: "Could not start checkout", description: "Please try again.", variant: "destructive" }),
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("walletTopup");
    if (status === "success") {
      toast({ title: "Payment received", description: "Your credits will appear shortly." });
      qc.invalidateQueries({ queryKey: [WALLET_QK] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (status === "cancelled") {
      toast({ title: "Checkout cancelled", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { mutate: linkStudent, isPending } = useRequestViewerLink({
    mutation: {
      onSuccess: () => {
        toast({ title: "Student linked successfully" });
        qc.invalidateQueries({ queryKey: [QK] });
        setShowLink(false);
        setCode("");
      },
      onError: () =>
        toast({
          title: "Failed to link student",
          description: "Check the code and try again.",
          variant: "destructive",
        }),
    },
  });

  function handleLink() {
    if (!code.trim()) return;
    linkStudent({
      data: {
        code: code.trim().toUpperCase(),
        relationshipType: relationship as "parent" | "guardian" | "mentor" | "support_worker" | "agency_case_worker" | "school_mentor" | "other",
      },
    });
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">My Learner Drivers</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              View progress for learner drivers who have shared their code with you.
            </p>
          </div>
          <Button onClick={() => setShowLink(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Link Student
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="w-4.5 h-4.5 text-primary" />
              Lesson Credits
            </CardTitle>
            <CardDescription>
              Top up prepaid credits to pay for your learner driver's bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-3xl font-bold tracking-tight">
                    ${((wallet?.balanceCents ?? 0) / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lessons cost ${((wallet?.lessonPriceCents ?? 0) / 100).toFixed(2)} each, paid from credits
                  </p>
                </div>
                <Button onClick={() => setShowTopup(true)} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Credits
                </Button>
              </div>
            )}

            {wallet?.transactions && wallet.transactions.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recent activity
                </p>
                {wallet.transactions.slice(0, 5).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {tx.amountCents >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="capitalize text-muted-foreground">
                        {tx.type.replace(/_/g, " ")}
                        {tx.status === "pending" && " (pending)"}
                      </span>
                    </div>
                    <span className={tx.amountCents >= 0 ? "text-green-700 font-medium" : "font-medium"}>
                      {tx.amountCents >= 0 ? "+" : "-"}${(Math.abs(tx.amountCents) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !students || students.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Eye className="w-10 h-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No linked students yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Ask your learner driver to share their viewer code with you, then click
                  "Link Student" to add them.
                </p>
              </div>
              <Button onClick={() => setShowLink(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Link Student
              </Button>
            </CardContent>
          </Card>
        ) : (
          <StudentSelector
            students={students}
            onNavigate={(id) => navigate(`/viewer/students/${id}`)}
          />
        )}
      </div>

      <Dialog open={showLink} onOpenChange={setShowLink}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link a Learner Driver</DialogTitle>
            <DialogDescription>
              Enter the viewer code your learner driver shared with you. Codes look like{" "}
              <span className="font-mono text-xs">DRV-7KQ9X2</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="viewerCode">Viewer code</Label>
              <Input
                id="viewerCode"
                placeholder="DRV-XXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-wider"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="relationship">Your relationship</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger id="relationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLink(false)}>
              Cancel
            </Button>
            <Button onClick={handleLink} disabled={isPending || !code.trim()}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Link Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTopup} onOpenChange={setShowTopup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
            <DialogDescription>
              Choose a top-up amount. You'll be redirected to a secure Stripe checkout page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            {(wallet?.creditPackOptionsCents ?? [5000, 10000, 20000]).map((packCents: number) => (
              <Button
                key={packCents}
                variant="outline"
                className="h-20 flex-col gap-1"
                disabled={checkoutPending}
                onClick={() => startCheckout({ data: { packCents } })}
              >
                {checkoutPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span className="text-lg font-bold">${(packCents / 100).toFixed(0)}</span>
                    <span className="text-xs text-muted-foreground">credits</span>
                  </>
                )}
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTopup(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
