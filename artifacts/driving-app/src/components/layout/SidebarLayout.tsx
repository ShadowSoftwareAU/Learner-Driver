import { useState } from "react";
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
  Menu,
  X,
  FileText,
  MessageSquare,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/NotificationBell";
import { GeolocationBanner } from "@/components/GeolocationBanner";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
      { label: "Heatmap", href: "/instructor/heatmap", icon: MapPin },
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
      { label: "Compliance", href: "/admin/compliance", icon: AlertTriangle },
      { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
      { label: "Handover Audit", href: "/admin/handover-notes", icon: FileText },
      { label: "Feedback", href: "/admin/feedback", icon: MessageSquare },
      { label: "Audit Log", href: "/admin/audit", icon: ShieldAlert },
      { label: "Heatmap", href: "/instructor/heatmap", icon: MapPin },
    ],
    school_admin: [
      { label: "Dashboard", href: "/school-admin/dashboard", icon: LayoutDashboard },
      { label: "Booking Approvals", href: "/school-admin/booking-approvals", icon: CalendarCheck },
      { label: "Handover Audit", href: "/admin/handover-notes", icon: FileText },
      { label: "Feedback", href: "/admin/feedback", icon: MessageSquare },
      { label: "Settings", href: "/school-admin/settings", icon: Settings },
    ],
    unassigned: [],
  };

  const items = user?.role ? navItems[user.role as keyof typeof navItems] ?? [] : [];

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} onClick={onItemClick}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
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
    </>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border text-sidebar-foreground hidden md:flex flex-col">
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar-accent/50">
          <img src="/learnerlog-logo.png" alt="Learner Log" className="h-9 w-auto" />
        </div>
        <NavList />
      </aside>

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border text-sidebar-foreground sticky top-0 z-10">
          <img src="/learnerlog-logo.png" alt="Learner Log" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border text-sidebar-foreground flex flex-col">
                <div className="h-14 flex items-center px-4 border-b border-sidebar-border bg-sidebar-accent/50">
                  <img src="/learnerlog-logo.png" alt="Learner Log" className="h-8 w-auto" />
                </div>
                <NavList onItemClick={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">
          <GeolocationBanner role={user?.role ?? undefined} />
          <div className="p-4 pb-12 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
