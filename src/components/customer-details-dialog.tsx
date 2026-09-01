import { useEffect, useMemo, useState, type FormEvent } from "react";
import { UserRound, Search, Phone, History, MapPin, Check, X, Sparkles, UserPlus } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { customersStore, type Customer as SavedCustomer } from "@/lib/storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function CustomerDetailsDialog({ open, onOpenChange }: Props) {
  const { customer, setCustomer, setCustomerSubmitted } = useCart();
  const [form, setForm] = useState(customer);
  const [saved, setSaved] = useState<SavedCustomer[]>([]);
  const [pickQuery, setPickQuery] = useState("");
  const [showAllPicker, setShowAllPicker] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(-1);
  const [selectedExistingCustomer, setSelectedExistingCustomer] = useState<SavedCustomer | null>(null);

  useEffect(() => {
    if (open) {
      setForm(customer);
      setPickQuery("");
      setShowAllPicker(false);
      // Load saved customers
      customersStore
        .list()
        .then((list) => {
          setSaved(list);
          if (customer.phone || customer.name) {
            const found = list.find(
              (c) =>
                (customer.phone && c.phone === customer.phone) ||
                (customer.name && c.name.toLowerCase() === customer.name.toLowerCase())
            );
            if (found) setSelectedExistingCustomer(found);
          }
        })
        .catch(() => setSaved([]));
    }
  }, [open, customer]);

  const topRecentCustomers = useMemo(() => {
    return saved.slice(0, 5);
  }, [saved]);

  const searchMatches = useMemo(() => {
    const needle = pickQuery.trim().toLowerCase();
    if (!needle) return saved.slice(0, 8);
    return saved
      .filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.phone.toLowerCase().includes(needle) ||
          (c.address && c.address.toLowerCase().includes(needle))
      )
      .slice(0, 8);
  }, [saved, pickQuery]);

  const pick = (c: SavedCustomer) => {
    setForm({
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      drugLicNo: c.drugLicNo || "",
      gstin: c.gstin || "",
      notes: c.notes || "",
    });
    setSelectedExistingCustomer(c);
    setPickQuery("");
    setShowAllPicker(false);
  };

  const clearSelected = () => {
    setForm({
      name: "",
      phone: "",
      address: "",
      drugLicNo: "",
      gstin: "",
      notes: "",
    });
    setSelectedExistingCustomer(null);
  };

  // Autocomplete matching by name
  const nameMatches = useMemo(() => {
    const needle = form.name.trim().toLowerCase();
    if (needle.length < 1) return [];
    const filtered = saved.filter((c) => c.name.toLowerCase().includes(needle));
    if (filtered.length === 1 && filtered[0].name.toLowerCase() === needle) return [];
    return filtered.slice(0, 4);
  }, [saved, form.name]);

  // Autocomplete matching by phone
  const phoneMatches = useMemo(() => {
    const needle = form.phone.trim();
    if (needle.length < 2) return [];
    const filtered = saved.filter((c) => c.phone.includes(needle));
    if (filtered.length === 1 && filtered[0].phone === needle) return [];
    return filtered.slice(0, 4);
  }, [saved, form.phone]);

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
      pick(nameMatches[activeMatchIdx]);
      setNameFocused(false);
    } else if (e.key === "Escape") {
      setNameFocused(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const phone = form.phone.trim();
    if (phone && !/^[+\d][\d\s\-()]{5,19}$/.test(phone)) return;
    const cleaned = {
      name: form.name.trim().slice(0, 100),
      phone: phone.slice(0, 20),
      address: (form.address || "").trim().slice(0, 300),
      drugLicNo: (form.drugLicNo || "").trim().slice(0, 100),
      gstin: (form.gstin || "").trim().slice(0, 50),
      notes: form.notes.trim().slice(0, 300),
    };
    setCustomer(cleaned);
    setCustomerSubmitted(true);
    onOpenChange(false);
  };

  const skip = () => {
    setCustomerSubmitted(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" /> Customer Details
          </DialogTitle>
          <DialogDescription>
            Add the customer's details for this sale, or pick from past customers.
          </DialogDescription>
        </DialogHeader>

        {/* Quick Picks from Past / Existing Customers */}
        {saved.length > 0 && (
          <div className="space-y-3 rounded-xl border bg-muted/40 p-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Quick Picks from Existing Customers</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {saved.length}
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary font-medium hover:bg-primary/10"
                onClick={() => setShowAllPicker((v) => !v)}
              >
                {showAllPicker ? "Hide Search" : "Search All"}
              </Button>
            </div>

            {/* Quick Pick Chips (Top Recent Customers) */}
            <div className="flex flex-wrap gap-1.5">
              {topRecentCustomers.map((c) => {
                const isSelected =
                  (form.phone && c.phone === form.phone) ||
                  (form.name && c.name.toLowerCase() === form.name.toLowerCase());
                return (
                  <button
                    key={`chip-${c.phone}-${c.name}`}
                    type="button"
                    onClick={() => pick(c)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background hover:bg-accent text-foreground border-border hover:border-primary/40"
                    )}
                  >
                    <span className="font-semibold">{c.name || "Customer"}</span>
                    {c.phone && <span className="opacity-75 text-[10px] font-mono">({c.phone})</span>}
                    {isSelected && <Check className="h-3 w-3 ml-0.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Expanded Customer Search Picker */}
            {showAllPicker && (
              <div className="space-y-2 pt-2 border-t animate-fade-in">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pickQuery}
                    onChange={(e) => setPickQuery(e.target.value)}
                    placeholder="Search by name, phone, or address…"
                    className="pl-8 h-8 text-xs bg-background"
                    autoFocus
                  />
                  {pickQuery && (
                    <button
                      type="button"
                      onClick={() => setPickQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {searchMatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                      No matching past customers found.
                    </p>
                  ) : (
                    searchMatches.map((c) => {
                      const isSelected =
                        (form.phone && c.phone === form.phone) ||
                        (form.name && c.name.toLowerCase() === form.name.toLowerCase());
                      return (
                        <div
                          key={`list-${c.phone}-${c.name}`}
                          onClick={() => pick(c)}
                          className={cn(
                            "flex items-center justify-between gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors border",
                            isSelected
                              ? "bg-primary/10 border-primary/40 text-foreground font-medium"
                              : "bg-background hover:bg-accent border-transparent hover:border-border"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                              <span>{c.name || "Unnamed Customer"}</span>
                              {isSelected && (
                                <Badge className="bg-primary text-primary-foreground text-[9px] px-1 py-0 h-4">
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {c.phone && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Phone className="h-3 w-3" /> {c.phone}
                                </span>
                              )}
                              <span>·</span>
                              <span>{c.visits} visit{c.visits === 1 ? "" : "s"}</span>
                              {c.address && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[150px]">{c.address}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            className="h-7 text-xs px-2.5 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              pick(c);
                            }}
                          >
                            {isSelected ? "Picked" : "Pick"}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected Status / Reset Bar */}
        {selectedExistingCustomer && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">
                Using past profile for <strong className="font-semibold">{selectedExistingCustomer.name}</strong>
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelected}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear / New
            </Button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3.5 pt-1">
          <div className="space-y-1.5 relative">
            <Label htmlFor="cd-name" className="text-xs font-semibold">
              Full Name <span className="text-muted-foreground font-normal">(Optional or Search)</span>
            </Label>
            <Input
              id="cd-name"
              value={form.name}
              maxLength={100}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setTimeout(() => setNameFocused(false), 200)}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (selectedExistingCustomer && e.target.value !== selectedExistingCustomer.name) {
                  setSelectedExistingCustomer(null);
                }
              }}
              onKeyDown={handleNameKeyDown}
              placeholder="e.g. Asha Verma"
              autoComplete="off"
            />
            {nameFocused && nameMatches.length > 0 && (
              <div className="absolute z-20 w-full bg-popover border rounded-md shadow-lg mt-1 top-[calc(100%+4px)] overflow-hidden">
                <div className="p-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b">
                  Past Customers Matching "{form.name}"
                </div>
                {nameMatches.map((c, idx) => (
                  <button
                    key={`name-match-${c.phone}-${c.name}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c);
                      setNameFocused(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs transition-colors outline-none flex items-center justify-between gap-2",
                      activeMatchIdx === idx ? "bg-primary/20 text-foreground font-semibold" : "hover:bg-accent"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.phone} {c.address ? `· ${c.address}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Pick
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 relative">
            <Label htmlFor="cd-phone" className="text-xs font-semibold">
              Phone Number
            </Label>
            <Input
              id="cd-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              maxLength={20}
              autoComplete="off"
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setTimeout(() => setPhoneFocused(false), 200)}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                if (selectedExistingCustomer && e.target.value !== selectedExistingCustomer.phone) {
                  setSelectedExistingCustomer(null);
                }
              }}
              placeholder="+91 98765 43210"
            />
            {phoneFocused && phoneMatches.length > 0 && (
              <div className="absolute z-20 w-full bg-popover border rounded-md shadow-lg mt-1 top-[calc(100%+4px)] overflow-hidden">
                <div className="p-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b">
                  Past Customers with Phone "{form.phone}"
                </div>
                {phoneMatches.map((c) => (
                  <button
                    key={`phone-match-${c.phone}-${c.name}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c);
                      setPhoneFocused(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors outline-none flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{c.phone}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Pick
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-address" className="text-xs font-semibold">
              Address
            </Label>
            <Textarea
              id="cd-address"
              value={form.address || ""}
              maxLength={300}
              rows={2}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Customer's full address (optional)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cd-drug-lic" className="text-xs font-semibold">
                Drug Lic. No
              </Label>
              <Input
                id="cd-drug-lic"
                value={form.drugLicNo || ""}
                maxLength={100}
                autoComplete="off"
                onChange={(e) => setForm({ ...form, drugLicNo: e.target.value })}
                placeholder="e.g. DL-12345"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-gstin" className="text-xs font-semibold">
                GSTIN
              </Label>
              <Input
                id="cd-gstin"
                value={form.gstin || ""}
                maxLength={50}
                autoComplete="off"
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                placeholder="e.g. 07AAAAA1111A1Z1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-notes" className="text-xs font-semibold">
              Notes (Doctor name, Prescription, Age, etc.)
            </Label>
            <Textarea
              id="cd-notes"
              value={form.notes}
              maxLength={300}
              rows={2}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes or doctor remarks"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={skip}>
              Skip (Walk-in)
            </Button>
            <Button type="submit" className="shadow-soft">
              <Check className="h-4 w-4 mr-1.5" /> Apply Customer Details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
