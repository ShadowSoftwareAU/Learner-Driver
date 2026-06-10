import { useGetMySchool, useUpdateSchool } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Building2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const QK = "/api/schools/mine";

interface SchoolFields {
  name: string;
  abn: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  primaryColor: string;
  secondaryColor: string;
}

export default function SchoolSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: school, isLoading } = useGetMySchool({ query: { queryKey: [QK] } });
  const { mutate: patch, isPending } = useUpdateSchool({
    mutation: {
      onSuccess: () => {
        toast({ title: "School settings saved" });
        qc.invalidateQueries({ queryKey: [QK] });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    },
  });

  const [fields, setFields] = useState<SchoolFields>({
    name: "",
    abn: "",
    contactEmail: "",
    contactPhone: "",
    addressLine1: "",
    suburb: "",
    state: "",
    postcode: "",
    primaryColor: "",
    secondaryColor: "",
  });

  useEffect(() => {
    if (school) {
      setFields({
        name: school.name ?? "",
        abn: school.abn ?? "",
        contactEmail: school.contactEmail ?? "",
        contactPhone: school.contactPhone ?? "",
        addressLine1: school.addressLine1 ?? "",
        suburb: school.suburb ?? "",
        state: school.state ?? "",
        postcode: school.postcode ?? "",
        primaryColor: school.primaryColor ?? "",
        secondaryColor: school.secondaryColor ?? "",
      });
    }
  }, [school]);

  function handleSave() {
    if (!school) return;
    patch({
      id: school.id,
      data: {
        name: fields.name || undefined,
        abn: fields.abn || undefined,
        primaryColor: fields.primaryColor || undefined,
        secondaryColor: fields.secondaryColor || undefined,
      },
    });
  }

  const F = ({
    id,
    label,
    placeholder,
    value,
    onChange,
    readOnly,
  }: {
    id: keyof SchoolFields;
    label: string;
    placeholder?: string;
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
  }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className={readOnly ? "bg-muted cursor-not-allowed" : ""}
      />
    </div>
  );

  if (isLoading || !school) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">School Settings</h1>
          </div>
          <p className="text-muted-foreground mt-1">Manage your school profile and branding.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>These details appear on student-facing documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <F
              id="name"
              label="School name"
              placeholder="e.g. PCYC Driving School"
              value={fields.name}
              onChange={(v) => setFields((p) => ({ ...p, name: v }))}
            />
            <F
              id="abn"
              label="ABN"
              placeholder="e.g. 12 345 678 901"
              value={fields.abn}
              readOnly
            />
            <div className="grid grid-cols-2 gap-4">
              <F
                id="contactEmail"
                label="Contact email"
                value={fields.contactEmail}
                readOnly
              />
              <F
                id="contactPhone"
                label="Contact phone"
                value={fields.contactPhone}
                readOnly
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <F
                id="suburb"
                label="Suburb"
                value={fields.suburb}
                readOnly
              />
              <F
                id="state"
                label="State"
                value={fields.state}
                readOnly
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Contact details and address are managed by your super-admin.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
            <CardDescription>Customise the colour scheme for your school portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="primaryColor">Primary colour</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    id="primaryColor"
                    value={fields.primaryColor || "#3B82F6"}
                    onChange={(e) => setFields((p) => ({ ...p, primaryColor: e.target.value }))}
                    className="h-10 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={fields.primaryColor}
                    onChange={(e) => setFields((p) => ({ ...p, primaryColor: e.target.value }))}
                    placeholder="#3B82F6"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secondaryColor">Secondary colour</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={fields.secondaryColor || "#1D4ED8"}
                    onChange={(e) => setFields((p) => ({ ...p, secondaryColor: e.target.value }))}
                    className="h-10 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={fields.secondaryColor}
                    onChange={(e) => setFields((p) => ({ ...p, secondaryColor: e.target.value }))}
                    placeholder="#1D4ED8"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
