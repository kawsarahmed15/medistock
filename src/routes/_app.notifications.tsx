import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { getNotifications, clearNotifications, markAllAsRead, NotificationItem } from "@/lib/notifications";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const mySessId = window.localStorage.getItem("medistock.auth.sessionId");
        const data = await apiRequest<any[]>("/auth/sessions", { auth: true });
        const currentIsAdmin = data.find(s => s.sessionId === mySessId)?.isAdmin === 1;
        if (!currentIsAdmin) {
          toast.error("Unauthorized access to security notifications");
          navigate({ to: "/dashboard" });
          return;
        }
        setCheckingAdmin(false);
      } catch (err) {
        console.error("Failed to verify admin device status:", err);
        navigate({ to: "/dashboard" });
      }
    };
    checkAdmin();
  }, [navigate]);

  useEffect(() => {
    if (checkingAdmin) return;

    // Load initial notifications and mark all as read
    setNotifications(getNotifications());
    markAllAsRead();

    // Listen for changes
    const handleChanges = () => {
      setNotifications(getNotifications());
    };
    window.addEventListener("medistock.notifications_changed", handleChanges);
    return () => window.removeEventListener("medistock.notifications_changed", handleChanges);
  }, [checkingAdmin]);

  const handleClear = () => {
    clearNotifications();
    toast.success("Notifications cleared");
  };

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground animate-pulse">Verifying security permission…</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Security Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor new logins and access authorization history for your MediStock account.
          </p>
        </div>
        {notifications.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear} className="gap-2 text-rose-500 hover:text-rose-600 border-rose-500/20 hover:border-rose-500 hover:bg-rose-50/5">
            <Trash2 className="h-4 w-4" /> Clear All
          </Button>
        )}
      </div>

      <Card className="shadow-soft border-border/80">
        <CardHeader>
          <CardTitle className="text-lg">Authentication History</CardTitle>
          <CardDescription>
            Only visible on this designated Administrator Device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed bg-muted/20">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/80 mb-3 stroke-[1.5]" />
              <h3 className="text-sm font-semibold text-foreground">No alerts recorded</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Your account security logs are clean. New device logins will be displayed here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{item.title}</span>
                      {item.unread && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
