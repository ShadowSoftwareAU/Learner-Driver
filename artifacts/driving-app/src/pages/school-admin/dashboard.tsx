import { useGetMySchool } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Users, Settings, CheckSquare } from "lucide-react";
import { useLocation } from "wouter";

export default function SchoolAdminDashboard() {
  const [, navigate] = useLocation();
  const { data: school, isLoading } = useGetMySchool({
    query: { queryKey: ["/api/schools/mine"] },
  });

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (!school) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <Building2 className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-lg font-semibold">No school associated</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your account is not linked to a driving school yet.
              Contact a super-admin to set this up.
            </p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">{school.name}</h1>
            </div>
            <p className="text-muted-foreground mt-1">School administration dashboard.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/school-admin/settings")}>
            <Settings className="w-4 h-4 mr-1.5" />
            Settings
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/school-admin/booking-approvals")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Booking Approvals
              </CardTitle>
              <CheckSquare className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground mt-1">Pending change requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Instructors</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground mt-1">Active in this school</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">School</CardTitle>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{school.name}</p>
              {school.abn && (
                <p className="text-xs text-muted-foreground mt-0.5">ABN {school.abn}</p>
              )}
              {school.state && (
                <p className="text-xs text-muted-foreground">{school.state}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate("/school-admin/booking-approvals")}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Review Booking Requests
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate("/school-admin/settings")}
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage School Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {school.contactEmail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact email</span>
                  <span>{school.contactEmail}</span>
                </div>
              )}
              {school.contactPhone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{school.contactPhone}</span>
                </div>
              )}
              {school.addressLine1 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span className="text-right max-w-[200px]">
                    {school.addressLine1}
                    {school.suburb && `, ${school.suburb}`}
                    {school.state && ` ${school.state}`}
                    {school.postcode && ` ${school.postcode}`}
                  </span>
                </div>
              )}
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate("/school-admin/settings")}
                >
                  Edit details →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
