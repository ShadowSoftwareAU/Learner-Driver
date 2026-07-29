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
  FileCheck,
  MessageSquare,
  Settings,
  AlertTriangle,
  UserCog,
  User,
  CreditCard,
} from "lucide-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
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

  const adminPerms = useAdminPermissions();

  const staticNavItems = {
    instructor: [
      { label: "Dashboard",       href: "/instructor/dashboard",        icon: LayoutDashboard },
      { label: "Students",        href: "/instructor/students",          icon: Users },
      { label: "My Assessments",  href: "/instructor/assessments",       icon: FileCheck, exact: true },
      { label: "New Assessment",  href: "/instructor/assessments/new",   icon: ClipboardList },
      { label: "Bookings",        href: "/instructor/bookings",          icon: CalendarCheck },
      { label: "Availability",    href: "/instructor/availability",      icon: Calendar },
      { label: "Teaching Zones",  href: "/instructor/zones",             icon: MapPin },
      { label: "My Verification", href: "/instructor/verification",      icon: ShieldCheck },
      { label: "Heatmap",         href: "/instructor/heatmap",           icon: MapPin },
      { label: "Settings",        href: "/settings",                     icon: User },
    ],
    student: [
      { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
      { label: "Find Instructor", href: "/student/search", icon: Search },
      { label: "My Bookings", href: "/student/bookings", icon: BookOpen },
      { label: "Settings", href: "/settings", icon: User },
    ],
    school_admin: [
      { label: "Dashboard", href: "/school-admin/dashboard", icon: LayoutDashboard },
      { label: "Instructor Management", href: "/school-admin/instructor-management", icon: UserCog },
      { label: "Booking Approvals", href: "/school-admin/booking-approvals", icon: CalendarCheck },
      { label: "Handover Audit", href: "/admin/handover-notes", icon: FileText },
      { label: "Feedback", href: "/admin/feedback", icon: MessageSquare },
      { label: "My Account", href: "/settings", icon: User },
      { label: "School Settings", href: "/school-admin/settings", icon: Settings },
    ],
    unassigned: [],
  };

  // Admin nav is permission-gated — built dynamically so staff only see
  // sections they have access to.
  const adminNavItems = [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, show: true },
    { label: "Billing & Finance", href: "/admin/billing", icon: CreditCard, show: adminPerms.canViewBilling },
    { label: "Students", href: "/admin/students", icon: Users, show: adminPerms.canManageInstructors },
    { label: "Instructors", href: "/admin/instructors", icon: Car, show: adminPerms.canManageInstructors },
    { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck, show: adminPerms.canManageCompliance },
    { label: "Compliance", href: "/admin/compliance", icon: AlertTriangle, show: adminPerms.canManageCompliance },
    { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck, show: adminPerms.canManageBookings },
    { label: "Handover Audit", href: "/admin/handover-notes", icon: FileText, show: adminPerms.canManageInstructors },
    { label: "Feedback", href: "/admin/feedback", icon: MessageSquare, show: adminPerms.isMasterTier },
    { label: "Audit Log", href: "/admin/audit", icon: ShieldAlert, show: adminPerms.canViewAuditLog },
    { label: "Manage Staff", href: "/admin/staff", icon: UserCog, show: adminPerms.isMasterTier },
    { label: "Settings", href: "/settings", icon: User, show: true },
  ].filter((item) => item.show);

  const items =
    user?.role === "admin"
      ? adminNavItems
      : (user?.role ? staticNavItems[user.role as keyof typeof staticNavItems] ?? [] : []);

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = (item as any).exact
            ? location === item.href
            : location === item.href || location.startsWith(item.href + "/");
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
          <img src="/steps2drive-logo.png" alt="Steps2Drive" className="max-w-[210px] h-auto" />
        </div>
        <NavList />
      </aside>

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border text-sidebar-foreground sticky top-0 z-10">
          <img src="/steps2drive-logo.png" alt="Steps2Drive" className="max-w-[170px] h-auto" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border text-sidebar-foreground flex flex-col">
                <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar-accent/50">
                  <img src="/steps2drive-logo.png" alt="Steps2Drive" className="max-w-[210px] h-auto" />
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
