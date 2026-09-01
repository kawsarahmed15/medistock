import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { employeesStore, billsStore, type Employee, type Bill } from "@/lib/storage";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UserCheck,
  KeyRound,
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
  Clock,
  ReceiptText,
  Check,
  X,
  ArrowRight,
  TrendingUp,
  Package,
  Calendar,
  CreditCard,
  Banknote,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled" | "pending">("all");

  // Selected Employee Profile Sheet/Dialog
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<"pending" | "completed" | "settings">("pending");

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

  // Inspect Single Bill Modal State
  const [inspectingBill, setInspectingBill] = useState<Bill | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empData, billsData] = await Promise.all([
        employeesStore.list(),
        billsStore.list("all"),
      ]);
      setEmployees(empData);
      setBills(billsData);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map pending bills and total sales to each employee
  const employeeStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        pendingBills: Bill[];
        completedBills: Bill[];
        totalSales: number;
        pendingAmount: number;
      }
    >();

    for (const emp of employees) {
      map.set(emp.id, {
        pendingBills: [],
        completedBills: [],
        totalSales: 0,
        pendingAmount: 0,
      });
    }

    for (const bill of bills) {
      // Find matching employee by employeeId, or matching createdByName/cashier
      let empId = bill.employeeId;
      if (!empId) {
        const matched = employees.find(
          (e) =>
            e.name.toLowerCase() === (bill.createdByName || bill.cashier || "").toLowerCase()
        );
        if (matched) empId = matched.id;
      }

      if (empId && map.has(empId)) {
        const data = map.get(empId)!;
        if (bill.status === "pending") {
          data.pendingBills.push(bill);
          data.pendingAmount += bill.total;
        } else if (bill.status === "completed") {
          data.completedBills.push(bill);
          data.totalSales += bill.total;
        }
      }
    }

    return map;
  }, [employees, bills]);

  const totalPendingBillsCount = useMemo(() => {
    return bills.filter((b) => b.status === "pending").length;
  }, [bills]);

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

  const openEmployeeProfile = (emp: Employee) => {
    setSelectedEmployee(emp);
    const stats = employeeStatsMap.get(emp.id);
    if (stats && stats.pendingBills.length > 0) {
      setProfileTab("pending");
    } else {
      setProfileTab("completed");
    }
    setProfileOpen(true);
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
      loadData();
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
      loadData();
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
      if (selectedEmployee?.id === emp.id) {
        setProfileOpen(false);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete employee");
    }
  };

  // Approve a pending bill
  const handleApproveBill = async (billId: string, invoiceNo: string) => {
    setApprovingId(billId);
    try {
      await billsStore.approve(billId);
      toast.success(`Bill ${invoiceNo} Approved!`, {
        description: "Stock has been deducted and revenue added to whole store system.",
      });
      if (inspectingBill?.id === billId) {
        setInspectingBill(null);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve bill");
    } finally {
      setApprovingId(null);
    }
  };

  // Reject a pending bill
  const handleRejectBill = async (billId: string, invoiceNo: string) => {
    if (!confirm(`Are you sure you want to reject bill ${invoiceNo}? No stock will be deducted.`)) {
      return;
    }
    setRejectingId(billId);
    try {
      await billsStore.reject(billId);
      toast.success(`Bill ${invoiceNo} marked as Rejected`);
      if (inspectingBill?.id === billId) {
        setInspectingBill(null);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject bill");
    } finally {
      setRejectingId(null);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      // Query filter
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchesQuery =
          e.name.toLowerCase().includes(q) ||
          (e.email && e.email.toLowerCase().includes(q)) ||
          (e.phone && e.phone.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // Status tab filter
      if (statusFilter === "active") return e.status === "active";
      if (statusFilter === "disabled") return e.status === "disabled";
      if (statusFilter === "pending") {
        const stats = employeeStatsMap.get(e.id);
        return (stats?.pendingBills.length || 0) > 0;
      }
      return true;
    });
  }, [employees, query, statusFilter, employeeStatsMap]);

  const activeCount = employees.filter((e) => e.status === "active").length;
  const disabledCount = employees.filter((e) => e.status === "disabled").length;
  const staffWithPendingCount = useMemo(() => {
    return employees.filter((e) => {
      const stats = employeeStatsMap.get(e.id);
      return (stats?.pendingBills.length || 0) > 0;
    }).length;
  }, [employees, employeeStatsMap]);

  const selectedStats = selectedEmployee ? employeeStatsMap.get(selectedEmployee.id) : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Staff & Employee Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create employee accounts, review staff pending bills, and approve sales into store inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="shadow-xs gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={openCreateModal} className="shadow-soft gap-2">
            <UserPlus className="h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Functional Interactive Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staff Card */}
        <Card
          onClick={() => setStatusFilter("all")}
          className={cn(
            "shadow-soft border-border/80 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md",
            statusFilter === "all" && "ring-2 ring-primary border-primary bg-primary/5"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Total Staff
              </p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">{employees.length}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click to view all staff members
              </p>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Active Staff Card */}
        <Card
          onClick={() => setStatusFilter("active")}
          className={cn(
            "shadow-soft border-border/80 cursor-pointer transition-all hover:border-emerald-500/50 hover:shadow-md",
            statusFilter === "active" && "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Active Staff
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {activeCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Can log in & create sales
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <UserCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals Card */}
        <Card
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "shadow-soft border-border/80 cursor-pointer transition-all hover:border-amber-500/50 hover:shadow-md",
            statusFilter === "pending" && "ring-2 ring-amber-500 border-amber-500 bg-amber-500/5",
            totalPendingBillsCount > 0 && "border-amber-500/40 bg-amber-500/5"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider">
                  Pending Approvals
                </p>
                {totalPendingBillsCount > 0 && (
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {totalPendingBillsCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {staffWithPendingCount} staff with pending sales
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Suspended Staff Card */}
        <Card
          onClick={() => setStatusFilter("disabled")}
          className={cn(
            "shadow-soft border-border/80 cursor-pointer transition-all hover:border-slate-400 hover:shadow-md",
            statusFilter === "disabled" && "ring-2 ring-slate-400 border-slate-400 bg-muted/40"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Inactive / Suspended
              </p>
              <h3 className="text-2xl font-bold text-muted-foreground mt-1">
                {disabledCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Staff login currently paused
              </p>
            </div>
            <div className="p-3 bg-muted text-muted-foreground rounded-xl shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guide Callout */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-1.5 leading-relaxed text-muted-foreground">
        <div className="font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Employee Bill Approval Workflow
        </div>
        <p>
          • <strong>Select an employee</strong> below to view their profile, performance, and all sales bills they have generated.
        </p>
        <p>
          • Bills generated by staff remain in <strong>Pending</strong> status until you confirm and approve them.
        </p>
        <p>
          • When you click <strong>Approve</strong>, stock is deducted from the FEFO batch in inventory and total sales/revenue are officially added to your website and accounting.
        </p>
      </div>

      {/* Main Staff Directory Card */}
      <Card className="shadow-soft overflow-hidden border-border/80">
        <CardHeader className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b bg-card">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">Staff Directory</CardTitle>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  statusFilter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({employees.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  statusFilter === "active"
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                  statusFilter === "pending"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pending Bills ({totalPendingBillsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("disabled")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  statusFilter === "disabled"
                    ? "bg-background text-muted-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Suspended ({disabledCount})
              </button>
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email..."
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
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {query || statusFilter !== "all"
                  ? "No matching employees found"
                  : "No staff registered yet"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {query || statusFilter !== "all"
                  ? "Try adjusting your search or filter options."
                  : "Add your pharmacy counter staff or assistants to give them POS access."}
              </p>
              {!query && statusFilter === "all" && (
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
                  <TableHead className="text-xs">Employee Details</TableHead>
                  <TableHead className="text-xs">Login Credentials</TableHead>
                  <TableHead className="text-xs">Pending Approvals</TableHead>
                  <TableHead className="text-xs">Sales Completed</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp, idx) => {
                  const stats = employeeStatsMap.get(emp.id) || {
                    pendingBills: [],
                    completedBills: [],
                    totalSales: 0,
                    pendingAmount: 0,
                  };
                  const hasPending = stats.pendingBills.length > 0;

                  return (
                    <TableRow
                      key={emp.id}
                      className={cn(
                        "hover:bg-muted/60 transition-colors cursor-pointer",
                        hasPending && "bg-amber-500/5 hover:bg-amber-500/10"
                      )}
                      onClick={() => openEmployeeProfile(emp)}
                    >
                      <TableCell className="text-center text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      {/* Employee Name & Phone */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs uppercase shrink-0">
                            {emp.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                              {emp.name}
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100" />
                            </div>
                            {emp.phone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3 text-muted-foreground/70" /> {emp.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Login Credentials */}
                      <TableCell>
                        <div className="text-xs font-mono text-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {emp.email || session?.email}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {emp.email ? "Custom Staff Email" : "Uses Store Email"}
                        </span>
                      </TableCell>

                      {/* Pending Bills */}
                      <TableCell>
                        {hasPending ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold text-xs">
                            <Clock className="h-3.5 w-3.5 animate-pulse" />
                            <span>{stats.pendingBills.length} Pending</span>
                            <span className="text-[10px] opacity-80">(₹{stats.pendingAmount.toFixed(0)})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 0 Pending
                          </span>
                        )}
                      </TableCell>

                      {/* Completed Sales */}
                      <TableCell>
                        <div className="text-xs font-semibold text-foreground">
                          ₹{stats.totalSales.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {stats.completedBills.length} bills completed
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {emp.status === "active" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-medium">
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[11px] font-medium"
                          >
                            Suspended
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 shadow-xs text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => openEmployeeProfile(emp)}
                          >
                            <Eye className="h-3.5 w-3.5" /> View Profile & Bills
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => openPasswordModal(emp)}
                            title="Change Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditModal(emp)}
                            title="Edit Details"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteEmployee(emp)}
                            title="Delete Employee"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* =========================================================
          EMPLOYEE PROFILE & PENDING BILLS DIALOG / DRAWER
         ========================================================= */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center uppercase shrink-0">
                    {selectedEmployee.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-foreground">
                        {selectedEmployee.name}
                      </h2>
                      {selectedEmployee.status === "active" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                          Active Staff
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[11px]"
                        >
                          Suspended
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedEmployee.email || session?.email}
                      </span>
                      {selectedEmployee.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedEmployee.phone}
                        </span>
                      )}
                      <span className="text-[11px]">
                        Joined {new Date(selectedEmployee.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs shadow-xs"
                    onClick={() => {
                      setProfileOpen(false);
                      openPasswordModal(selectedEmployee);
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5 text-primary" /> Change Password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs shadow-xs"
                    onClick={() => {
                      setProfileOpen(false);
                      openEditModal(selectedEmployee);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              </div>

              {/* Employee KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setProfileTab("pending")}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer",
                    (selectedStats?.pendingBills.length || 0) > 0
                      ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/30"
                      : "bg-muted/30 border-border/70",
                    profileTab === "pending" && "ring-2 ring-amber-500"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Pending Approvals
                    </span>
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {selectedStats?.pendingBills.length || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Amount: ₹{(selectedStats?.pendingAmount || 0).toFixed(2)}
                  </div>
                </div>

                <div
                  onClick={() => setProfileTab("completed")}
                  className={cn(
                    "p-3.5 rounded-xl border bg-muted/30 border-border/70 transition-all cursor-pointer",
                    profileTab === "completed" && "ring-2 ring-primary border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Completed Bills
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-1">
                    {selectedStats?.completedBills.length || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Approved & Deducted
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Lifetime Sales Revenue
                    </span>
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    ₹{(selectedStats?.totalSales || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Total store revenue generated
                  </div>
                </div>
              </div>

              {/* Tabs for Pending Bills vs Completed Bills */}
              <Tabs
                value={profileTab}
                onValueChange={(val) => setProfileTab(val as any)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending" className="gap-2 text-xs font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    Pending Bills ({selectedStats?.pendingBills.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="gap-2 text-xs font-medium">
                    <ReceiptText className="h-3.5 w-3.5" />
                    Completed Sales ({selectedStats?.completedBills.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* ================= PENDING BILLS TAB ================= */}
                <TabsContent value="pending" className="space-y-3 mt-4">
                  {(!selectedStats || selectedStats.pendingBills.length === 0) ? (
                    <div className="p-8 text-center border rounded-xl bg-muted/20">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                      <h4 className="text-sm font-semibold text-foreground">
                        All Caught Up!
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        There are no pending bills from <strong>{selectedEmployee.name}</strong> waiting for confirmation.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                        <span>
                          <strong>{selectedStats.pendingBills.length} Bills</strong> waiting for your approval. Approving a bill deducts batch inventory & updates store revenue immediately.
                        </span>
                      </div>

                      {selectedStats.pendingBills.map((bill) => (
                        <div
                          key={bill.id}
                          className="p-4 rounded-xl border border-amber-500/40 bg-card hover:shadow-md transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-base text-primary">
                                {bill.number}
                              </span>
                              <Badge className="bg-amber-500 text-white text-[10px] gap-1 py-0">
                                <Clock className="h-3 w-3" /> Pending Confirmation
                              </Badge>
                              <span className="text-xs text-muted-foreground font-medium">
                                {new Date(bill.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                • {new Date(bill.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="text-right sm:text-right">
                              <div className="text-base font-bold text-foreground font-mono">
                                ₹{bill.total.toFixed(2)}
                              </div>
                              <div className="text-[11px] text-muted-foreground uppercase font-medium">
                                Payment: {bill.paymentMethod}
                              </div>
                            </div>
                          </div>

                          {/* Customer & Item details snippet */}
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                            <div>
                              <span>Customer: </span>
                              <strong className="text-foreground">
                                {bill.customerName || "Walk-in Customer"}
                              </strong>
                              {bill.customerPhone && (
                                <span className="ml-1 text-muted-foreground font-mono">
                                  ({bill.customerPhone})
                                </span>
                              )}
                            </div>
                            <div>
                              <span>Items: </span>
                              <strong className="text-foreground">
                                {bill.items.length} item{bill.items.length === 1 ? "" : "s"}
                              </strong>
                              <span className="ml-1 text-[11px] text-muted-foreground">
                                ({bill.items.map((it) => `${it.name} x${it.qty}`).join(", ")})
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: Check Details, Approve, Reject */}
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1 h-8 shadow-xs"
                              onClick={() => setInspectingBill(bill)}
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" /> Check Bill Details
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                              disabled={rejectingId === bill.id || approvingId === bill.id}
                              onClick={() => handleRejectBill(bill.id, bill.number)}
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>

                            <Button
                              size="sm"
                              className="text-xs gap-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
                              disabled={approvingId === bill.id || rejectingId === bill.id}
                              onClick={() => handleApproveBill(bill.id, bill.number)}
                            >
                              {approvingId === bill.id ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Deducting Stock...
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Approve & Confirm Sale
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ================= COMPLETED BILLS TAB ================= */}
                <TabsContent value="completed" className="space-y-3 mt-4">
                  {(!selectedStats || selectedStats.completedBills.length === 0) ? (
                    <div className="p-8 text-center border rounded-xl bg-muted/20">
                      <ReceiptText className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
                      <h4 className="text-sm font-semibold text-foreground">
                        No Completed Sales Yet
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        When you approve bills created by {selectedEmployee.name}, they will appear here.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Invoice #</TableHead>
                          <TableHead className="text-xs">Customer</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Payment</TableHead>
                          <TableHead className="text-right text-xs">Total Amount</TableHead>
                          <TableHead className="text-right text-xs">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedStats.completedBills.map((b) => (
                          <TableRow key={b.id} className="hover:bg-muted/40">
                            <TableCell className="font-mono font-bold text-xs text-primary">
                              {b.number}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium text-foreground">
                                {b.customerName || "Walk-in"}
                              </div>
                              {b.customerPhone && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {b.customerPhone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(b.createdAt).toLocaleDateString()}{" "}
                              <span className="text-[10px]">
                                {new Date(b.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-medium uppercase">
                              {b.paymentMethod}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs">
                              ₹{b.total.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-primary gap-1"
                              >
                                <Link to="/bills/$id" params={{ id: b.id }}>
                                  View Invoice <ArrowRight className="h-3 w-3" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================
          CHECK BILL DETAILS / INSPECTOR MODAL
         ========================================================= */}
      <Dialog open={!!inspectingBill} onOpenChange={(open) => !open && setInspectingBill(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {inspectingBill && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <ReceiptText className="h-5 w-5 text-primary" />
                    Review Pending Bill: <span className="font-mono text-primary">{inspectingBill.number}</span>
                  </DialogTitle>
                  <Badge className="bg-amber-500 text-white text-xs">
                    Pending Approval
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  Created by <strong>{inspectingBill.createdByName || inspectingBill.cashier || "Staff"}</strong> on{" "}
                  {new Date(inspectingBill.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              {/* Customer Info Box */}
              <div className="p-3 rounded-lg border bg-muted/30 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Customer Name: </span>
                  <strong className="text-foreground">
                    {inspectingBill.customerName || "Walk-in Customer"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer Phone: </span>
                  <strong className="font-mono text-foreground">
                    {inspectingBill.customerPhone || "N/A"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Mode: </span>
                  <strong className="uppercase text-foreground">{inspectingBill.paymentMethod}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Address: </span>
                  <span className="text-foreground">{inspectingBill.customerAddress || "N/A"}</span>
                </div>
              </div>

              {/* Bill Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs">Item Name</TableHead>
                      <TableHead className="text-xs">Batch</TableHead>
                      <TableHead className="text-center text-xs">Qty</TableHead>
                      <TableHead className="text-right text-xs">Rate</TableHead>
                      <TableHead className="text-right text-xs">Tax %</TableHead>
                      <TableHead className="text-right text-xs">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspectingBill.items.map((it, idx) => {
                      const itemSubtotal = (Number(it.price) || 0) * (Number(it.qty) || 0);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">
                            <div className="font-medium text-foreground">{it.name}</div>
                            {it.sku && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                SKU: {it.sku}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {it.batch || "Auto FEFO"}
                            {it.expiry && (
                              <div className="text-[10px]">Exp: {it.expiry}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs font-semibold">
                            {it.qty}
                            {Number(it.freeQty || 0) > 0 && (
                              <span className="text-[10px] text-emerald-600 block">
                                +{it.freeQty} free
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            ₹{Number(it.price || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {it.taxPercent || 0}%
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold">
                            ₹{itemSubtotal.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Summary Financials */}
              <div className="p-3 rounded-lg border bg-card space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{inspectingBill.subtotal.toFixed(2)}</span>
                </div>
                {Number(inspectingBill.tax || 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax Amount</span>
                    <span className="font-mono">₹{inspectingBill.tax.toFixed(2)}</span>
                  </div>
                )}
                {Number(inspectingBill.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-mono">-₹{inspectingBill.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-foreground pt-1.5 border-t">
                  <span>Total Amount</span>
                  <span className="font-mono text-primary">
                    ₹{inspectingBill.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Note on approval */}
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Stock & Revenue Impact:</strong> Approving this bill will immediately deduct all listed quantities from inventory batches and add ₹{inspectingBill.total.toFixed(2)} to total store revenue.
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInspectingBill(null)}
                >
                  Close Review
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={approvingId === inspectingBill.id || rejectingId === inspectingBill.id}
                    onClick={() => handleRejectBill(inspectingBill.id, inspectingBill.number)}
                  >
                    <X className="h-4 w-4 mr-1" /> Reject Bill
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
                    disabled={approvingId === inspectingBill.id || rejectingId === inspectingBill.id}
                    onClick={() => handleApproveBill(inspectingBill.id, inspectingBill.number)}
                  >
                    {approvingId === inspectingBill.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Deducting Stock...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" /> Approve & Confirm Sale
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================
          ADD / EDIT EMPLOYEE DIALOG
         ========================================================= */}
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

      {/* =========================================================
          CHANGE PASSWORD DIALOG
         ========================================================= */}
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
