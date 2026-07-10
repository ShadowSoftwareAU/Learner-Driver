import { useGetViewerStudents, useRequestViewerLink, useGetMyWallet, useCreateWalletCheckout } from "@workspace/api-client-react";
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
import { Loader2, Eye, Plus, ChevronRight, Clock, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const QK = "/api/viewer/students";
const WALLET_QK = "/api/wallet";

const RELATIONSHIP_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "mentor", label: "Mentor" },
  { value: "support_worker", label: "Support Worker" },
  { value: "agency_case_worker", label: "Agency Case Worker" },
  { value: "school_mentor", label: "School Mentor" },
  { value: "other", label: "Other" },
];

interface ViewerStudent {
  id: number;
  fullName: string;
  totalHours?: number | null;
  headshotPath?: string | null;
  noShowCount: number;
  attendanceReliabilityScore?: number | null;
  relationshipType?: string | null;
  linkedAt: string;
}

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((s: ViewerStudent) => (
              <Card
                key={s.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/viewer/students/${s.id}`)}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{s.fullName}</p>
                      {s.relationshipType && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {s.relationshipType.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>

                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{s.totalHours != null ? `${Number(s.totalHours).toFixed(1)} hrs` : "—"}</span>
                    </div>
                    {s.noShowCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{s.noShowCount} no-show{s.noShowCount !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>

                  {s.attendanceReliabilityScore != null && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Attendance reliability</span>
                        <span className="font-medium">{s.attendanceReliabilityScore}%</span>
                      </div>
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
                </CardContent>
              </Card>
            ))}
          </div>
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
