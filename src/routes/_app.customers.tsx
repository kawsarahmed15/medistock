import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { Users, Search, Phone, ShoppingCart, ReceiptText, Calendar, Pencil } from "lucide-react";
import { customersStore, billsStore, type Customer, type Bill } from "@/lib/storage";
import { useCart } from "@/lib/cart-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "", drugLicNo: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerBills, setCustomerBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const viewCustomerDetails = async (c: Customer) => {
    setSelectedCustomer(c);
    setLoadingBills(true);
    try {
      const allBills = await billsStore.list();
      const filtered = allBills.filter(b => b.customerPhone === c.phone || (b.customerName && b.customerName.toLowerCase() === c.name.toLowerCase()));
      setCustomerBills(filtered);
    } catch (err) {
      toast.error("Failed to load customer bills");
    } finally {
      setLoadingBills(false);
    }
  };

  const navigate = useNavigate();
  const cart = useCart();

  const loadData = () => {
    let alive = true;
    let from, to;
    const now = new Date();

    if (period === "today") {
      from = now.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (period === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    } else if (period === "this_year") {
      from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
    } else if (period === "custom") {
      if (!customFrom || !customTo) return;
      from = customFrom;
      to = customTo;
    }

    setCustomers(null);
    customersStore
      .list(from, to)
      .then((c) => alive && setCustomers(c))
      .catch((e) => toast.error((e as Error).message || "Failed to load customers"));
    return () => {
      alive = false;
    };
  };

  useEffect(() => {
    return loadData();
  }, [period, customFrom, customTo]);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.phone.toLowerCase().includes(needle),
    );
  }, [customers, q]);

  // Keyboard navigation
  const [focusedIdx, setFocusedIdx] = useState(0);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (focusedIdx >= filtered.length) setFocusedIdx(0);
  }, [filtered.length, focusedIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (editingCustomer || selectedCustomer) return;
      if (filtered.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.min(filtered.length - 1, i + 1);
          rowRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.max(0, i - 1);
          rowRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === "Enter") {
        const c = filtered[focusedIdx];
        if (c) {
          e.preventDefault();
          viewCustomerDetails(c);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIdx, editingCustomer, selectedCustomer]);

  const totalSales = useMemo(() => {
    return filtered.reduce((acc, c) => acc + c.totalSpent, 0);
  }, [filtered]);

  const useForNextSale = (c: Customer) => {
    cart.setCustomer({
      name: c.name,
      phone: c.phone,
      address: c.address ?? "",
      notes: c.notes ?? "",
      prescriptionRef: "",
      prescriptionPhoto: "",
    });
    cart.setCustomerSubmitted(true);
    toast.success(`Selected ${c.name || c.phone} for next sale`);
    navigate({ to: "/sell" });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editForm.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    setIsSaving(true);
    try {
      await customersStore.update(editingCustomer.phone, editForm);
      toast.success("Customer details updated");
      setEditingCustomer(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update customer");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-saved from your past bills. Pick one to pre-fill the next sale.
          </p>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <div className="text-xs font-medium text-muted-foreground">Search</div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or phone"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5 w-full sm:w-48">
            <div className="text-xs font-medium text-muted-foreground">Period</div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex gap-2 items-end w-full sm:w-auto">
              <div className="space-y-1.5 flex-1 sm:w-36">
                <div className="text-xs font-medium text-muted-foreground">From</div>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 flex-1 sm:w-36">
                <div className="text-xs font-medium text-muted-foreground">To</div>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {customers === null
              ? "Loading…"
              : `${filtered.length} ${filtered.length === 1 ? "customer" : "customers"}`}
          </CardTitle>
          {customers !== null && (
            <div className="text-sm font-medium">
              Total Sale: <span className="text-primary">{formatMoney(totalSales)}</span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {customers === null ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">
                {customers.length === 0
                  ? "No customers found for this period."
                  : "No matches for your search."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((c, idx) => (
                <li
                  key={`${c.phone}-${c.name}`}
                  ref={(el) => (rowRefs.current[idx] = el)}
                  tabIndex={0}
                  onClick={() => setFocusedIdx(idx)}
                  className={`flex flex-wrap items-center gap-3 py-3 animate-fade-in outline-none rounded-lg px-2 transition-colors ${
                    focusedIdx === idx ? "bg-muted/50 border-primary/20" : "hover:bg-muted/30"
                  }`}
                >
                  <div 
                    className="flex-1 min-w-0 cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      viewCustomerDetails(c);
                    }}
                  >
                    <div className="font-medium truncate">
                      {c.name || <span className="text-muted-foreground italic">No name</span>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <ReceiptText className="h-3 w-3" /> {c.visits}{" "}
                        {c.visits === 1 ? "visit" : "visits"}
                      </span>
                      <span>· Last {formatDate(c.lastVisit)}</span>
                    </div>
                  </div>
                  <div className="text-right tabular-nums font-medium min-w-[120px]">
                    <div className="text-sm">Total: {formatMoney(c.totalSpent)}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => useForNextSale(c)}>
                      <ShoppingCart className="h-3.5 w-3.5" /> Use
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCustomer(c);
                        setEditForm({
                          name: c.name,
                          phone: c.phone,
                          address: c.address || "",
                          drugLicNo: c.drugLicNo || "",
                          notes: c.notes || "",
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingCustomer} onOpenChange={(v) => !v && setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update details for this customer.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Customer Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (Required)</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Phone Number"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Customer Address"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Drug Lic No</Label>
              <Input
                value={editForm.drugLicNo}
                onChange={(e) => setEditForm({ ...editForm, drugLicNo: e.target.value })}
                placeholder="Drug License Number"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Any special notes..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditingCustomer(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCustomer} onOpenChange={(v) => !v && setSelectedCustomer(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>
              Comprehensive summary and purchase history for this customer.
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Customer Name</span>
                  <span className="font-semibold">{selectedCustomer.name || "N/A"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Phone</span>
                  <span className="font-semibold">{selectedCustomer.phone}</span>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-xs text-muted-foreground block">Address</span>
                  <p className="text-sm bg-muted/30 p-2 rounded border">{selectedCustomer.address || "No address on file."}</p>
                </div>
                {selectedCustomer.notes && (
                  <div className="space-y-1 col-span-2">
                    <span className="text-xs text-muted-foreground block">Notes</span>
                    <p className="text-sm bg-amber-500/5 p-2 rounded border border-amber-500/10 text-amber-600/90">{selectedCustomer.notes}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                <div className="bg-muted/30 p-3 rounded text-center">
                  <span className="text-[10px] uppercase text-muted-foreground block">Visits</span>
                  <span className="text-xl font-bold">{selectedCustomer.visits}</span>
                </div>
                <div className="bg-muted/30 p-3 rounded text-center">
                  <span className="text-[10px] uppercase text-muted-foreground block">Total Spent</span>
                  <span className="text-xl font-bold text-primary">{formatMoney(selectedCustomer.totalSpent)}</span>
                </div>
                <div className="bg-muted/30 p-3 rounded text-center">
                  <span className="text-[10px] uppercase text-muted-foreground block">Total Credit</span>
                  <span className="text-xl font-bold text-destructive">{formatMoney(selectedCustomer.totalCredit)}</span>
                </div>
                <div className="bg-muted/30 p-3 rounded text-center">
                  <span className="text-[10px] uppercase text-muted-foreground block">Outstanding Bal</span>
                  <span className={`text-xl font-bold ${selectedCustomer.balance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {formatMoney(selectedCustomer.balance)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-semibold text-sm">Purchase History / Bills</h3>
                {loadingBills ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : customerBills.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">No bills found under this customer's phone/name.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill No.</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerBills.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">{b.number}</TableCell>
                          <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="capitalize text-xs">{b.paymentMethod}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatMoney(b.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
