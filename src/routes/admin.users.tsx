import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, Trash2, Ban } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await apiRequest("/admin/users", { auth: true });
      setUsers(res.users);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiRequest(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: { status },
        auth: true,
      });
      toast.success(`User status updated to ${status}`);
      load();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to completely delete this user and all their data? This action cannot be undone.")) return;
    try {
      await apiRequest(`/admin/users/${id}`, {
        method: "DELETE",
        auth: true,
      });
      toast.success("User deleted completely");
      load();
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Manage Users</h1>
        <p className="text-sm text-slate-400">View and manage all registered accounts on the platform.</p>
      </div>

      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Pharmacy</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">{u.pharmacy_name || "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[10px] rounded border ${
                      u.role === "superadmin" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[10px] rounded border ${
                      u.account_status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {u.account_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {u.account_status === "active" ? (
                      <Button variant="outline" size="sm" onClick={() => updateStatus(u.id, "suspended")} className="h-8 border-slate-700 hover:bg-slate-800 text-amber-500 hover:text-amber-400">
                        <Ban className="w-3 h-3 mr-1" /> Suspend
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => updateStatus(u.id, "active")} className="h-8 border-slate-700 hover:bg-slate-800 text-emerald-500 hover:text-emerald-400">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Activate
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => deleteUser(u.id)} className="h-8 border-slate-700 hover:bg-slate-800 text-rose-500 hover:text-rose-400">
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
