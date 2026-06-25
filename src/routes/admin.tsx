import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { UserProfileDialog } from "@/components/user-profile-dialog";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, UserCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { session, ready, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (ready) {
      if (!session) {
        navigate({ to: "/login" });
      } else if (session.role !== "superadmin") {
        navigate({ to: "/dashboard" });
      }
    }
  }, [ready, session, navigate]);

  if (!ready || !session || session.role !== "superadmin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-sm text-slate-400 animate-pulse">Checking permissions…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-50">
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-rose-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">MS</span>
            </div>
            Admin Panel
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            activeProps={{ className: "bg-slate-800 text-white" }}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            to="/admin/users"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            activeProps={{ className: "bg-slate-800 text-white" }}
          >
            <Users className="w-4 h-4" />
            Manage Users
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left"
          >
            <UserCircle className="w-4 h-4" />
            <span className="truncate flex-1">{session?.name || "Admin"}</span>
          </button>
          <Link
            to="/dashboard"
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-left mt-1"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit to User App</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900 md:hidden">
          <span className="font-bold text-lg text-white">Admin Panel</span>
        </header>
        <div className="flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
