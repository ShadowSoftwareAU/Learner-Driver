/**
 * MedicalInfoCard — shows encrypted-at-rest medical/allergy data.
 * Only rendered for instructor/admin roles. Fetches on demand to minimise PII exposure.
 * classification: restricted — do NOT render in student or viewer views.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Edit2, Save, X, AlertTriangle, Pill } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type MedicalData = {
  medicalConditions: string | null;
  allergies: string | null;
  medicalConditionsPreview: string | null;
  allergiesPreview: string | null;
};

type Props = {
  studentId: number;
  preview: {
    medicalConditionsPreview?: string | null;
    allergiesPreview?: string | null;
  };
  className?: string;
};

async function fetchMedical(studentId: number): Promise<MedicalData> {
  const res = await fetch(`/api/students/${studentId}/medical`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch medical data");
  return res.json();
}

async function saveMedical(studentId: number, data: { medicalConditions?: string; allergies?: string }): Promise<void> {
  const res = await fetch(`/api/students/${studentId}/medical`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save medical data");
}

export function MedicalInfoCard({ studentId, preview, className }: Props) {
  const { toast } = useToast();
  const [isRevealed, setIsRevealed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<MedicalData | null>(null);
  const [editMedical, setEditMedical] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasMedical = !!(preview.medicalConditionsPreview || preview.allergiesPreview);

  async function handleReveal() {
    if (isRevealed) {
      setIsRevealed(false);
      setData(null);
      return;
    }
    setIsLoading(true);
    try {
      const result = await fetchMedical(studentId);
      setData(result);
      setIsRevealed(true);
    } catch {
      toast({ title: "Error", description: "Could not load medical data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit() {
    setEditMedical(data?.medicalConditions ?? "");
    setEditAllergies(data?.allergies ?? "");
    setIsEditing(true);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await saveMedical(studentId, { medicalConditions: editMedical, allergies: editAllergies });
      setData(prev => prev ? { ...prev, medicalConditions: editMedical || null, allergies: editAllergies || null } : prev);
      setIsEditing(false);
      toast({ title: "Saved", description: "Medical information updated and encrypted." });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className={cn("border-amber-200 bg-amber-50/50", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900">
          <Shield className="w-4 h-4 text-amber-600" />
          Medical &amp; Allergy Information
          <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 ml-auto">Restricted</Badge>
        </CardTitle>
        <p className="text-xs text-amber-700/80">Encrypted at rest · visible to instructor and admin only</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasMedical && !isRevealed && (
          <p className="text-xs text-muted-foreground italic">No medical or allergy information on file.</p>
        )}

        {hasMedical && !isRevealed && (
          <div className="space-y-1.5">
            {preview.medicalConditionsPreview && (
              <div className="flex items-center gap-2 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-medium">Medical conditions:</span>
                <span>{preview.medicalConditionsPreview}</span>
              </div>
            )}
            {preview.allergiesPreview && (
              <div className="flex items-center gap-2 text-xs text-amber-800">
                <Pill className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-medium">Allergies:</span>
                <span>{preview.allergiesPreview}</span>
              </div>
            )}
          </div>
        )}

        {isRevealed && !isEditing && data && (
          <div className="space-y-3 bg-white rounded-md border border-amber-200 p-3">
            <div>
              <p className="text-xs font-semibold text-amber-900 mb-1">Medical conditions</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {data.medicalConditions || <span className="text-muted-foreground italic">None recorded</span>}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-900 mb-1">Allergies</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {data.allergies || <span className="text-muted-foreground italic">None recorded</span>}
              </p>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="space-y-3 bg-white rounded-md border border-amber-200 p-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-amber-900">Medical conditions</Label>
              <Textarea
                value={editMedical}
                onChange={e => setEditMedical(e.target.value)}
                placeholder="Describe any medical conditions relevant to driving lessons…"
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-amber-900">Allergies</Label>
              <Textarea
                value={editAllergies}
                onChange={e => setEditAllergies(e.target.value)}
                placeholder="List any known allergies or medication sensitivities…"
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {isSaving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100" onClick={handleReveal} disabled={isLoading}>
            {isRevealed
              ? <><EyeOff className="w-3.5 h-3.5 mr-1" /> Hide</>
              : <><Eye className="w-3.5 h-3.5 mr-1" /> {isLoading ? "Loading…" : "Reveal"}</>
            }
          </Button>
          {isRevealed && !isEditing && (
            <Button size="sm" variant="ghost" className="text-amber-800 hover:bg-amber-100" onClick={handleEdit}>
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
          {!isRevealed && !hasMedical && (
            <Button size="sm" variant="ghost" className="text-amber-800 hover:bg-amber-100" onClick={async () => { await handleReveal(); setIsEditing(true); }}>
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Add info
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
