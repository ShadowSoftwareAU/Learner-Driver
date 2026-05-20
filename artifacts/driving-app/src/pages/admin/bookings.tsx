import { useState } from "react";
import { useListBookings } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, CalendarCheck, Search } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  claimed: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminBookings() {
  const [search, setSearch] = useState("");

  const { data: bookings, isLoading } = useListBookings(undefined, {
    query: { queryKey: ["/api/bookings"] },
  });

  const filtered = (bookings ?? []).filter((b: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.studentName?.toLowerCase().includes(q) ||
      b.instructorName?.toLowerCase().includes(q) ||
      b.suburb?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: bookings?.length ?? 0,
    pending: (bookings ?? []).filter((b: any) => b.status === "pending").length,
    active: (bookings ?? []).filter((b: any) => ["claimed", "confirmed"].includes(b.status)).length,
    completed: (bookings ?? []).filter((b: any) => b.status === "completed").length,
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">System-wide view of all lesson bookings and dispatch status.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total },
            { label: "Pending", value: stats.pending },
            { label: "Active", value: stats.active },
            { label: "Completed", value: stats.completed },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">All Bookings</CardTitle>
              <div className="flex-1 max-w-xs relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Search student, instructor, suburb..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <CalendarCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {search ? "No bookings match your search." : "No bookings yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left pb-2 pr-4 font-medium">ID</th>
                      <th className="text-left pb-2 pr-4 font-medium">Date & Time</th>
                      <th className="text-left pb-2 pr-4 font-medium">Student</th>
                      <th className="text-left pb-2 pr-4 font-medium">Instructor</th>
                      <th className="text-left pb-2 pr-4 font-medium">Area</th>
                      <th className="text-left pb-2 pr-4 font-medium">Type</th>
                      <th className="text-left pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((b: any) => (
                      <tr key={b.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 pr-4 text-muted-foreground">#{b.id}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <div>{format(new Date(b.requestedDate), "d MMM yyyy")}</div>
                          <div className="text-muted-foreground text-xs">{b.requestedTime}</div>
                        </td>
                        <td className="py-2.5 pr-4">{b.studentName ?? "—"}</td>
                        <td className="py-2.5 pr-4">{b.instructorName ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {[b.suburb, b.postcode].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="py-2.5 pr-4 capitalize text-muted-foreground">
                          {b.transmissionType ?? "—"}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700"}`}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
