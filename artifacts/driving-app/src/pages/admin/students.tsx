import { useListStudents } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function AdminStudents() {
  const { data: students, isLoading } = useListStudents();
  const [search, setSearch] = useState("");

  const filteredStudents = students?.filter(s => 
    s.fullName.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Students</h1>
          <p className="text-muted-foreground">School-wide student directory.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
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
            ) : filteredStudents && filteredStudents.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium hidden md:table-cell">Contact</th>
                      <th className="px-6 py-3 font-medium text-center">Hours</th>
                      <th className="px-6 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => (
                      <tr key={student.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-foreground">
                          {student.fullName}
                          <span className="block md:hidden text-xs text-muted-foreground font-normal">{student.email}</span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <div>{student.email}</div>
                          <div className="text-xs text-muted-foreground">{student.phone}</div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium">
                          {student.totalHours || 0}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                            {student.status?.replace('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No students found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
