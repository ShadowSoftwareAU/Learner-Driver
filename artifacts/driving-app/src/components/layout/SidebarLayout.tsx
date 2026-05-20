import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useClerk } from "@clerk/clerk-react";
import {
  LogOut,
  Users,
  LayoutDashboard,
  ClipboardList,
  ShieldAlert,
  ShieldCheck,
  Car,
  Calendar,
  MapPin,
  BookOpen,
  Search,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe();
  const { signOut } = useClerk();
  const [location] = useLocation();

  const handleSignOut = () => {
    signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
  };

  const navItems = {
    instructor: [
      { label: "Dashboard", href: "/instructor/dashboard", icon: LayoutDashboard },
      { label: "Students", href: "/instructor/students", icon: Users },
      { label: "New Assessment", href: "/instructor/assessments/new", icon: ClipboardList },
      { label: "Bookings", href: "/instructor/bookings", icon: CalendarCheck },
      { label: "Availability", href: "/instructor/availability", icon: Calendar },
      { label: "Teaching Zones", href: "/instructor/zones", icon: MapPin },
      { label: "My Verification", href: "/instructor/verification", icon: ShieldCheck },
    ],
    student: [
      { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
      { label: "Find Instructor", href: "/student/search", icon: Search },
      { label: "My Bookings", href: "/student/bookings", icon: BookOpen },
    ],
    admin: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Students", href: "/admin/students", icon: Users },
      { label: "Instructors", href: "/admin/instructors", icon: Car },
      { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
      { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
      { label: "Audit Log", href: "/admin/audit", icon: ShieldAlert },
    ],
    unassigned: [],
  };

  const items = user?.role ? navItems[user.role] : [];

  return (
    <div className="flex min-h-[100dvh] w-full bg-gray-50">
      <aside className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border text-sidebar-foreground hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar-accent/50">
          <span className="font-bold text-lg tracking-tight">DriveTrack</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3 px-2 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{user?.role}</p>
            </div>
            <NotificationBell />
          </div>
          <Button
            variant="outline"
            className="w-full justify-start text-sidebar-foreground border-sidebar-border bg-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Mobile header could go here */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
