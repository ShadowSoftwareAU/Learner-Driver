import { useListStudents } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Search, ChevronRight, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StudentAvatar } from "@/components/StudentAvatar";

export default function InstructorStudents() {
  const { data: students, isLoading } = useListStudents();
  const [search, setSearch] = useState("");

  const filteredStudents = students?.filter(s => 
    s.fullName.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Students</h1>
            <p className="text-muted-foreground">Manage your learners and add new ones.</p>
          </div>
          <Link href="/instructor/students/new">
            <Button>
              <UserPlus className="w-4 h-4 mr-2" /> Add Student
            </Button>
          </Link>
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
              <div className="space-y-2">
                {filteredStudents.map(student => (
                  <Link key={student.id} href={`/instructor/students/${student.id}`}>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-gray-50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <StudentAvatar fullName={student.fullName} headshotPath={student.headshotPath} />
                        <div>
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">{student.fullName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{student.totalHours || 0} hrs</span>
                            <span>•</span>
                            <span>{student.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="hidden sm:inline-flex capitalize">
                          {student.status?.replace('_', ' ')}
                        </Badge>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </div>
                  </Link>
                ))}
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
