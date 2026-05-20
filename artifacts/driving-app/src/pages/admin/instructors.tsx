import { useListInstructors } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Search, Car } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function AdminInstructors() {
  const { data: instructors, isLoading } = useListInstructors();
  const [search, setSearch] = useState("");

  const filteredInstructors = instructors?.filter(i => 
    i.fullName.toLowerCase().includes(search.toLowerCase()) || 
    i.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instructors</h1>
          <p className="text-muted-foreground">School instructor roster and details.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search instructors..."
                className="pl-9 bg-gray-50/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredInstructors && filteredInstructors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInstructors.map(instructor => (
                  <div key={instructor.id} className="p-4 rounded-xl border border-border bg-white shadow-sm flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                        {instructor.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{instructor.fullName}</h3>
                        <p className="text-sm text-muted-foreground truncate">{instructor.email}</p>
                        {instructor.phone && <p className="text-sm text-muted-foreground truncate">{instructor.phone}</p>}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg text-sm grid grid-cols-2 gap-2 mt-auto">
                      <div>
                        <span className="text-muted-foreground text-xs block mb-1">Vehicle</span>
                        <span className="font-medium flex items-center gap-1">
                          <Car className="w-3 h-3" /> {instructor.vehicleMake} {instructor.vehicleModel}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block mb-1">Active Students</span>
                        <span className="font-medium">{instructor.activeStudents || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No instructors found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
