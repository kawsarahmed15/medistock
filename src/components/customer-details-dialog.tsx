import { useEffect, useMemo, useState, type FormEvent } from "react";
import { UserRound, Search, Phone, History, MapPin, Check, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-context";
import { extractPhoneDigits, formatPhoneWithCountryCode } from "@/lib/phone-utils";
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
  const [showPicker, setShowPicker] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(-1);

  useEffect(() => {
    if (open) {
      setForm({
        ...customer,
        phone: extractPhoneDigits(customer.phone) ? formatPhoneWithCountryCode(customer.phone) : "",
      });
      setPickQuery("");
      setShowPicker(false);
      // Load saved customers in the background
      customersStore
        .list()
        .then(setSaved)
        .catch(() => setSaved([]));
    }
  }, [open, customer]);

  const matches = useMemo(() => {
    const needle = pickQuery.trim().toLowerCase();
    if (!needle) return saved.slice(0, 6);
    return saved
      .filter(
        (c) => c.name.toLowerCase().includes(needle) || c.phone.toLowerCase().includes(needle),
      )
      .slice(0, 6);
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
    setShowPicker(false);
    setPickQuery("");
    setNameFocused(false);
  };

  // Find exact matching past customer by name
  const exactNameMatch = useMemo(() => {
    const needle = form.name.trim().toLowerCase();
    if (!needle) return null;
    return saved.find((c) => c.name.toLowerCase() === needle) || null;
  }, [saved, form.name]);

  // Handle typing name: if an exact match is typed or pasted, populate details
  const handleNameChange = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    const exactMatch = trimmed ? saved.find((c) => c.name.toLowerCase() === trimmed) : null;
    
    setForm((prev) => {
      if (exactMatch) {
        return {
          name: val,
          phone: exactMatch.phone || prev.phone,
          address: exactMatch.address || prev.address,
          drugLicNo: exactMatch.drugLicNo || prev.drugLicNo,
          gstin: exactMatch.gstin || prev.gstin,
          notes: exactMatch.notes || prev.notes,
        };
      }
      return { ...prev, name: val };
    });
  };

  const nameMatches = useMemo(() => {
    const needle = form.name.trim().toLowerCase();
    if (needle.length < 1) return [];
    return saved.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 5);
  }, [saved, form.name]);

  useEffect(() => {
    setActiveMatchIdx(-1);
  }, [nameMatches]);

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

  const phoneDigits = useMemo(() => {
    return extractPhoneDigits(form.phone);
  }, [form.phone]);

  const handlePhoneChange = (val: string) => {
    setForm((prev) => ({ ...prev, phone: formatPhoneWithCountryCode(val) }));
  };

  const phoneConflict = useMemo(() => {
    if (phoneDigits.length !== 10) return null;
    const currentName = form.name.trim().toLowerCase();
    return (
      saved.find((c) => {
        const cDigits = extractPhoneDigits(c.phone);
        const cName = (c.name || "").trim().toLowerCase();
        return cDigits === phoneDigits && cName && cName !== currentName;
      }) || null
    );
  }, [saved, phoneDigits, form.name]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phoneConflict) {
      toast.error(`Phone number already exists for "${phoneConflict.name}". Please use a unique number.`);
      return;
    }
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

  const handleWalkIn = () => {
    setCustomer({
      name: "Walk-in Customer",
      phone: "",
      address: "",
      drugLicNo: "",
      gstin: "",
      notes: "",
    });
    setCustomerSubmitted(true);
    onOpenChange(false);
  };

  const skip = () => {
    handleWalkIn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" /> Customer details
          </DialogTitle>
          <DialogDescription>
            Add the customer's details for this sale, pick from past customers, or continue as a walk-in.
          </DialogDescription>
        </DialogHeader>

        {/* Walk-in Customer Card */}
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="space-y-0.5 min-w-0">
            <div className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
              <UserRound className="h-4 w-4 text-primary shrink-0" />
              <span>Walk-in Customer</span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Instant checkout without details.{" "}
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Cash & Online only
              </span>
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 px-3 text-xs font-semibold shadow-soft shrink-0"
            onClick={handleWalkIn}
          >
            Walk-in
          </Button>
        </div>

        {/* Quick-pick from past customers */}
        {saved.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Past customers ({saved.length})
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs font-medium"
                onClick={() => setShowPicker((v) => !v)}
              >
                {showPicker ? "Hide" : "Quick pick"}
              </Button>
            </div>
            {showPicker && (
              <div className="space-y-2 animate-fade-in">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pickQuery}
                    onChange={(e) => setPickQuery(e.target.value)}
                    placeholder="Search name or phone"
                    className="pl-8 h-8 text-xs bg-background"
                    autoFocus
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {matches.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2">No matches.</p>
                  ) : (
                    matches.map((c) => (
                      <button
                        key={`${c.phone}-${c.name}`}
                        type="button"
                        onClick={() => pick(c)}
                        className={cn(
                          "w-full text-left rounded-md px-2.5 py-1.5 text-xs transition-smooth",
                          "hover:bg-accent hover:text-accent-foreground",
                          "border border-transparent hover:border-border",
                        )}
                      >
                        <div className="font-medium truncate">
                          {c.name || <span className="italic text-muted-foreground">No name</span>}
                        </div>
                        {c.phone && (
                          <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" /> {c.phone} · {c.visits}{" "}
                            {c.visits === 1 ? "visit" : "visits"}
                          </div>
                        )}
                        {c.address && (
                          <div className="text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="h-3 w-3 shrink-0" /> {c.address}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5 relative">
            <Label htmlFor="cd-name" className="text-xs">
              Full name
            </Label>
            <Input
              id="cd-name"
              value={form.name}
              maxLength={100}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setTimeout(() => setNameFocused(false), 200)}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={handleNameKeyDown}
              placeholder="e.g. Asha Verma"
              autoComplete="off"
            />
            {nameFocused && nameMatches.length > 0 && (
              <div className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 top-[calc(100%+4px)] overflow-hidden">
                {nameMatches.map((c, idx) => (
                  <button
                    key={`${c.phone}-${c.name}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c);
                      setNameFocused(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors outline-none",
                      activeMatchIdx === idx ? "bg-primary/20 text-foreground font-semibold" : "hover:bg-accent"
                    )}
                  >
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.phone} {c.address ? `· ${c.address}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {exactNameMatch && (
              <div className="flex items-center justify-between text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded mt-1 animate-fade-in">
                <div className="flex items-center gap-1.5 truncate">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    Past details loaded for <strong>{exactNameMatch.name}</strong> ({exactNameMatch.phone || "No phone"})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[11px] font-medium hover:bg-primary/20 shrink-0 ml-1"
                  onClick={() => pick(exactNameMatch)}
                >
                  Reload
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-phone" className="text-xs">
              Mobile Phone
            </Label>
            <div className="flex rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring bg-background overflow-hidden relative">
              <span className="inline-flex items-center px-3 bg-muted text-xs font-bold text-muted-foreground select-none pointer-events-none border-r border-input">
                +91
              </span>
              <Input
                id="cd-phone"
                type="tel"
                inputMode="numeric"
                value={phoneDigits}
                maxLength={10}
                autoComplete="off"
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="98765 43210"
                className="border-0 focus-visible:ring-0 rounded-l-none font-medium text-xs h-9 pr-8"
              />
              {phoneDigits && (
                <button
                  type="button"
                  onClick={() => handlePhoneChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear phone number"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {phoneConflict && (
              <div className="text-destructive text-xs flex items-center justify-between gap-1 font-medium mt-1 bg-destructive/10 border border-destructive/20 p-2 rounded animate-fade-in">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="truncate">
                    Number already registered to <strong>{phoneConflict.name}</strong>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2 shrink-0 border-destructive/30 hover:bg-destructive/20"
                  onClick={() => pick(phoneConflict)}
                >
                  Use This Customer
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-address" className="text-xs">
              Address
            </Label>
            <Textarea
              id="cd-address"
              value={form.address || ""}
              maxLength={300}
              rows={2}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-drug-lic" className="text-xs">
              Drug License No. (D.L. No.)
            </Label>
            <Input
              id="cd-drug-lic"
              value={form.drugLicNo || ""}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, drugLicNo: e.target.value.toUpperCase() })}
              placeholder="e.g. DL-12345 or 20B/21B"
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-gstin" className="text-xs">
              GSTIN
            </Label>
            <Input
              id="cd-gstin"
              value={form.gstin || ""}
              maxLength={50}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              placeholder="e.g. 07AAAAA1111A1Z1 (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-notes" className="text-xs">
              Notes (prescription, age, etc.)
            </Label>
            <Textarea
              id="cd-notes"
              value={form.notes}
              maxLength={300}
              rows={3}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={skip}>
              Skip
            </Button>
            <Button type="submit" className="shadow-soft" disabled={Boolean(phoneConflict)}>
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
