import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, type FormEvent } from "react";
import {
  UserRound,
  Search,
  Phone,
  MapPin,
  FileText,
  ArrowRight,
  ShoppingCart,
  Clock,
  Check,
  Building2,
  FileCheck,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { customersStore, type Customer as SavedCustomer } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DraftBillsDialog } from "@/components/draft-bills-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/new-sale")({
  component: NewSaleCustomerPage,
});

export function NewSaleCustomerPage() {
  const { customer, setCustomer, setCustomerSubmitted, drafts } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState(customer);
  const [saved, setSaved] = useState<SavedCustomer[]>([]);
  const [pickQuery, setPickQuery] = useState("");
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(-1);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    customersStore
      .list()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);

  useEffect(() => {
    // Focus customer name input on mount
    nameInputRef.current?.focus();
  }, []);

  // Filter saved customers matching quick-search query
  const matches = useMemo(() => {
    const needle = pickQuery.trim().toLowerCase();
    if (!needle) return saved.slice(0, 6);
    return saved
      .filter(
        (c) => c.name.toLowerCase().includes(needle) || c.phone.toLowerCase().includes(needle),
      )
      .slice(0, 6);
  }, [saved, pickQuery]);

  // Name autocomplete matches
  const nameMatches = useMemo(() => {
    const needle = form.name.trim().toLowerCase();
    if (needle.length < 1) return [];
    return saved.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 5);
  }, [saved, form.name]);

  useEffect(() => {
    setActiveMatchIdx(-1);
  }, [nameMatches]);

  const pickCustomer = (c: SavedCustomer, proceedImmediately = false) => {
    const next = {
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      drugLicNo: c.drugLicNo || "",
      gstin: c.gstin || "",
      notes: c.notes || "",
    };
    setForm(next);
    setNameFocused(false);
    setPickQuery("");

    if (proceedImmediately) {
      setCustomer(next);
      setCustomerSubmitted(true);
      toast.success(`Selected customer: ${c.name}`);
      navigate({ to: "/cart" });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (nameMatches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveMatchIdx((prev) => (prev + 1) % nameMatches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveMatchIdx((prev) => (prev - 1 + nameMatches.length) % nameMatches.length);
    } else if (e.key === "Enter" && activeMatchIdx >= 0) {
      e.preventDefault();
      pickCustomer(nameMatches[activeMatchIdx]);
      setNameFocused(false);
    } else if (e.key === "Escape") {
      setNameFocused(false);
    }
  };

  const handleProceedAsWalkIn = () => {
    setCustomer({
      name: "Walk-in Customer",
      phone: "",
      address: "",
      drugLicNo: "",
      gstin: "",
      notes: "",
    });
    setCustomerSubmitted(true);
    toast.success("Proceeding as Walk-in Customer");
    navigate({ to: "/cart" });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();

    // If completely empty, treat as walk-in
    if (!name && !phone) {
      handleProceedAsWalkIn();
      return;
    }

    if (phone && !/^[+\d][\d\s\-()]{5,19}$/.test(phone)) {
      toast.error("Please enter a valid phone number (digits only)");
      return;
    }

    const cleaned = {
      name: (name || "Walk-in Customer").slice(0, 100),
      phone: phone.slice(0, 20),
      address: (form.address || "").trim().slice(0, 300),
      drugLicNo: (form.drugLicNo || "").trim().slice(0, 100),
      gstin: (form.gstin || "").trim().slice(0, 50),
      notes: (form.notes || "").trim().slice(0, 300),
    };

    setCustomer(cleaned);
    setCustomerSubmitted(true);
    toast.success(`Customer set: ${cleaned.name}`);
    navigate({ to: "/cart" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="h-6 w-6" />
            </span>
            New Sale
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Step 1 of 2: Enter customer details or proceed as walk-in to start adding items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {drafts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraftsOpen(true)}
              className="gap-1.5 border-dashed"
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Saved Drafts</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                {drafts.length}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      {/* Prominent Walk-in Quick Card */}
      <Card className="border-primary/30 bg-primary/5 shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-base text-foreground">
              <UserRound className="h-5 w-5 text-primary" />
              <span>Walk-in Customer (Fast Billing)</span>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                Instant
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Skip customer details and proceed directly to cart.{" "}
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                (Cash &amp; Online sales only; credit sales require registered customer)
              </span>
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto shadow-soft shrink-0 gap-2 font-semibold"
            onClick={handleProceedAsWalkIn}
          >
            <span>Proceed as Walk-in</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Customer Entry Form */}
        <Card className="shadow-soft">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" /> Customer Details
            </CardTitle>
            <CardDescription className="text-xs">
              Fill in customer info for the tax invoice and credit ledger.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Name */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="cust-name" className="text-xs font-semibold">
                  Customer Name
                </Label>
                <Input
                  id="cust-name"
                  ref={nameInputRef}
                  placeholder="e.g. John Doe / Apex Clinic"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setNameFocused(true);
                  }}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setTimeout(() => setNameFocused(false), 200)}
                  onKeyDown={handleNameKeyDown}
                  className="font-medium"
                  autoComplete="off"
                />

                {/* Auto-suggest dropdown */}
                {nameFocused && nameMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-popover text-popover-foreground rounded-lg border shadow-lg z-50 overflow-hidden divide-y divide-border">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
                      Existing Customers (Press Enter or click to fill)
                    </div>
                    {nameMatches.map((m, idx) => (
                      <button
                        key={m.phone || m.name}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-muted/80 transition-colors",
                          activeMatchIdx === idx && "bg-muted font-semibold",
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickCustomer(m);
                        }}
                      >
                        <div className="truncate pr-2">
                          <span className="font-medium text-foreground">{m.name}</span>
                          {m.phone && (
                            <span className="text-muted-foreground ml-2">({m.phone})</span>
                          )}
                        </div>
                        {m.balance > 0 && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                            Credit: ₹{m.balance.toFixed(0)}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone & Address in two columns */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-phone" className="text-xs font-semibold">
                    Mobile Phone
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cust-phone"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cust-address" className="text-xs font-semibold">
                    Address / Location
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cust-address"
                      placeholder="e.g. MG Road, Ward 4"
                      value={form.address || ""}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Optional B2B fields: GSTIN & Drug License */}
              <div className="grid sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-gstin" className="text-xs text-muted-foreground">
                    GSTIN <span className="text-[10px] font-normal">(Optional B2B)</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cust-gstin"
                      placeholder="e.g. 19ABCDE1234F1Z5"
                      value={form.gstin || ""}
                      onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                      className="pl-9 uppercase font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cust-dl" className="text-xs text-muted-foreground">
                    Drug License No. <span className="text-[10px] font-normal">(Optional B2B)</span>
                  </Label>
                  <div className="relative">
                    <FileCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cust-dl"
                      placeholder="e.g. DL-20B/1234"
                      value={form.drugLicNo || ""}
                      onChange={(e) => setForm({ ...form, drugLicNo: e.target.value.toUpperCase() })}
                      className="pl-9 uppercase font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Notes / Remarks */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="cust-notes" className="text-xs text-muted-foreground">
                  Prescription / Sale Remarks <span className="text-[10px] font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="cust-notes"
                  rows={2}
                  placeholder="Doctor name, Rx reference, or special delivery notes..."
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="text-xs"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button type="submit" size="lg" className="w-full sm:flex-1 shadow-soft gap-2 font-semibold">
                  <span>Continue to Cart</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleProceedAsWalkIn}
                  className="w-full sm:w-auto"
                >
                  Skip &amp; Walk-in
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Quick Pick Returning Customers Side Panel */}
        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Recent Customers</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {saved.length} registered
                </span>
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter name or phone..."
                  value={pickQuery}
                  onChange={(e) => setPickQuery(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>
            </CardHeader>

            <CardContent className="px-3 pb-3 space-y-1.5 max-h-[380px] overflow-y-auto">
              {matches.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  {saved.length === 0 ? "No registered customers yet." : "No matching customers."}
                </p>
              ) : (
                matches.map((c) => (
                  <button
                    key={c.phone || c.name}
                    type="button"
                    onClick={() => pickCustomer(c, true)}
                    className="w-full text-left p-2.5 rounded-lg border bg-card hover:bg-muted/60 transition-colors text-xs space-y-1 block group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {c.name}
                      </span>
                      {c.balance > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 font-mono py-0 px-1"
                        >
                          Due: ₹{c.balance.toFixed(0)}
                        </Badge>
                      )}
                    </div>
                    {c.phone && (
                      <div className="text-muted-foreground text-[11px] flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </div>
                    )}
                    {c.address && (
                      <div className="text-muted-foreground text-[11px] truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DraftBillsDialog open={draftsOpen} onOpenChange={setDraftsOpen} />
    </div>
  );
}
