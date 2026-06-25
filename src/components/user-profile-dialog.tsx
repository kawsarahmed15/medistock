import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";
import { UserCog, KeyRound, Mail, LogOut } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function UserProfileDialog({ open, onOpenChange }: Props) {
  const { session, logout, updatePassword, updateSession } = useAuth();
  const [name, setName] = useState(session?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (open) {
      setName(session?.name ?? "");
      setPwd("");
      setPwd2("");
    }
  }, [open, session?.name]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    if (trimmed.length > 80) {
      toast.error("Name is too long");
      return;
    }
    setSavingName(true);
    try {
      await apiRequest("/auth/profile", {
        method: "PATCH",
        body: { name: trimmed },
        auth: true,
      });
      updateSession({ name: trimmed });
      toast.success("Profile updated");
    } catch (e) {
      toast.error((e as Error).message || "Could not update profile");
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    if (pwd.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPwd(true);
    try {
      await updatePassword(pwd);
      toast.success("Password changed");
      setPwd("");
      setPwd2("");
    } catch (e) {
      toast.error((e as Error).message || "Could not change password");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" /> Your profile
          </DialogTitle>
          <DialogDescription>
            Update your display name and account password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Account snapshot */}
          <div className="rounded-lg border p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold shadow-glow">
              {(session?.name || session?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{session?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {session?.email}
              </div>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-xs">
              Display name
            </Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
              <Button
                type="button"
                onClick={() => void saveName()}
                disabled={savingName || name.trim() === (session?.name ?? "")}
              >
                {savingName ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Change password
            </Label>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="New password (min 8 chars)"
            />
            <Input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="Confirm new password"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void savePassword()}
              disabled={savingPwd || !pwd || !pwd2}
            >
              {savingPwd ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              await logout();
              onOpenChange(false);
            }}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
