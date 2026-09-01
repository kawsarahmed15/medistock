import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { employeesStore, type Employee } from "@/lib/storage";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UserCheck,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Pencil,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Store,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { session } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "disabled">("active");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Change Password Modal State
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdEmployee, setPwdEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await employeesStore.list();
      setEmployees(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormStatus("active");
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormEmail(emp.email || "");
    setFormPhone(emp.phone || "");
    setFormPassword("");
    setFormStatus(emp.status);
    setShowPassword(false);
    setModalOpen(true);
  };

  const openPasswordModal = (emp: Employee) => {
    setPwdEmployee(emp);
    setNewPassword("");
    setShowNewPassword(false);
    setPwdModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      return toast.error("Employee name is required");
    }

    if (!editingEmployee && (!formPassword || formPassword.length < 4)) {
      return toast.error("Password is required and must be at least 4 characters");
    }

    setSubmitting(true);
    try {
      if (editingEmployee) {
        await employeesStore.update(editingEmployee.id, {
          name: formName.trim(),
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          status: formStatus,
        });
        toast.success(`Employee "${formName}" updated successfully`);
      } else {
        await employeesStore.create({
          name: formName.trim(),
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          password: formPassword,
          status: formStatus,
        });
        toast.success(`Employee "${formName}" created successfully`);
      }
      setModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      toast.error(err.message || "Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      return toast.error("New password must be at least 4 characters");
    }
    if (!pwdEmployee) return;

    setChangingPwd(true);
    try {
      await employeesStore.updatePassword(pwdEmployee.id, newPassword);
      toast.success(`Password for ${pwdEmployee.name} updated successfully`);
      setPwdModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setChangingPwd(false);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    const nextStatus = emp.status === "active" ? "disabled" : "active";
    try {
      await employeesStore.toggleStatus(emp.id, nextStatus);
      toast.success(
        nextStatus === "active"
          ? `${emp.name}'s account is now Active`
          : `${emp.name}'s account is now Suspended`
      );
      loadEmployees();
    } catch (err: any) {
      toast.error(err.message || "Failed to change status");
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (
      !confirm(
        `Are you sure you want to delete employee "${emp.name}"? They will no longer be able to log in.`
      )
    ) {
      return;
    }

    try {
      await employeesStore.delete(emp.id);
      toast.success(`Employee "${emp.name}" removed successfully`);
      loadEmployees();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete employee");
    }
  };

  const filtered = employees.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.email && e.email.toLowerCase().includes(q)) ||
      (e.phone && e.phone.toLowerCase().includes(q))
    );
  });

  const activeCount = employees.filter((e) => e.status === "active").length;
  const disabledCount = employees.filter((e) => e.status === "disabled").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Employee Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create employee accounts, manage passwords, and configure access for your pharmacy staff.
          </p>
        </div>
        <Button onClick={openCreateModal} className="shadow-soft gap-2">
          <UserPlus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* Info & Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-soft border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total Staff
              </p>
              <h3 className="text-2xl font-bold mt-1">{employees.length}</h3>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Active Staff
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {activeCount}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Inactive / Suspended
              </p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {disabledCount}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/80 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Login Store Email
              </p>
              <p className="text-xs font-mono font-bold text-foreground mt-1 truncate max-w-[150px]" title={session?.email}>
                {session?.email}
              </p>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Store className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guide Note */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-1.5 leading-relaxed text-muted-foreground">
        <div className="font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          How Employees Log In & Access The System
        </div>
        <p>
          1. <strong>Shared Store Email Login</strong>: Employees log in at the same login page using your store email (<code>{session?.email}</code>) and their individual employee password.
        </p>
        <p>
          2. <strong>Restricted Employee Panel</strong>: Once logged in with employee credentials, only <strong>Inventory Stock Check</strong> and <strong>New Sale (POS)</strong> are accessible. All administrative settings, purchase bills, and reports are hidden.
        </p>
        <p>
          3. <strong>Pending Bills Workflow</strong>: When employees bill items, bills are saved as <strong>Pending</strong> without deducting stock. You confirm & approve them from your <em>Bills</em> section.
        </p>
      </div>

      {/* Employees Table Card */}
      <Card className="shadow-soft overflow-hidden border-border/80">
        <CardHeader className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b bg-card">
          <div>
            <CardTitle className="text-base font-semibold">Staff Directory</CardTitle>
            <CardDescription className="text-xs">
              List of all registered staff accounts for this pharmacy.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {query ? "No employees found" : "No employees registered yet"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {query
                  ? "Try searching for another name or clear your search."
                  : "Add your pharmacy counter staff or assistants to allow them to create sales bills."}
              </p>
              {!query && (
                <Button onClick={openCreateModal} className="mt-4 shadow-soft gap-2" size="sm">
                  <UserPlus className="h-4 w-4" /> Add First Employee
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center text-xs">#</TableHead>
                  <TableHead className="text-xs">Staff Details</TableHead>
                  <TableHead className="text-xs">Login Email</TableHead>
                  <TableHead className="text-xs">Role & Access</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Joined</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp, idx) => (
                  <TableRow key={emp.id} className="hover:bg-muted/50">
                    <TableCell className="text-center text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                        {emp.name}
                      </div>
                      {emp.phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground/70" /> {emp.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-mono text-foreground flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {emp.email || session?.email}
                      </div>
                      {!emp.email && (
                        <span className="text-[10px] text-muted-foreground">
                          (Uses Store Email)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-[11px] font-medium">
                        POS & Stock Check
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {emp.status === "active" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-medium">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[11px] font-medium">
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(emp.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => openPasswordModal(emp)}
                          title="Change Password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditModal(emp)}
                          title="Edit Details"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteEmployee(emp)}
                          title="Delete Employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Employee Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {editingEmployee ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingEmployee
                ? "Update staff contact details and status."
                : "Create a staff account with limited sales and stock check permissions."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEmployee} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="emp-name">Full Name *</Label>
              <Input
                id="emp-name"
                placeholder="e.g. Rahul Sharma"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-phone">Phone Number (Optional)</Label>
              <Input
                id="emp-phone"
                placeholder="e.g. +91 98765 43210"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-email">
                Custom Login Email (Optional)
              </Label>
              <Input
                id="emp-email"
                type="email"
                placeholder={`Defaults to store email: ${session?.email || ""}`}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to let employee log in using your store email:{" "}
                <strong className="text-foreground">{session?.email}</strong>.
              </p>
            </div>

            {!editingEmployee && (
              <div className="space-y-2">
                <Label htmlFor="emp-password">Employee Password *</Label>
                <div className="relative">
                  <Input
                    id="emp-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password (min 4 characters)"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold">Account Status</div>
                <div className="text-[11px] text-muted-foreground">
                  Active staff can log in to POS and check stock.
                </div>
              </div>
              <Switch
                checked={formStatus === "active"}
                onCheckedChange={(checked) => setFormStatus(checked ? "active" : "disabled")}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="shadow-soft">
                {submitting
                  ? "Saving..."
                  : editingEmployee
                  ? "Update Employee"
                  : "Create Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={pwdModalOpen} onOpenChange={setPwdModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5 text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription className="text-xs">
              Set a new login password for <strong>{pwdEmployee?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-emp-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-emp-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password (min 4 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPwdModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={changingPwd || !newPassword.trim()} className="shadow-soft">
                {changingPwd ? "Updating..." : "Save New Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
