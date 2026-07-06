import { useEffect, useMemo, useState, type FormEvent } from "react";
import { UserRound, Search, Phone, History, MapPin } from "lucide-react";
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
      setForm(customer);
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
    setForm((prev) => ({
      name: c.name,
      phone: c.phone || prev.phone,
      address: c.address || prev.address,
      drugLicNo: c.drugLicNo || prev.drugLicNo,
      notes: c.notes || prev.notes,
    }));
    setShowPicker(false);
    setPickQuery("");
  };

  const nameMatches = useMemo(() => {
    const needle = form.name.trim().toLowerCase();
    if (needle.length < 1) return [];
    const filtered = saved.filter((c) => c.name.toLowerCase().includes(needle));
    if (filtered.length === 1 && filtered[0].name.toLowerCase() === needle) return [];
    return filtered.slice(0, 4);
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const phone = form.phone.trim();
    if (phone && !/^[+\d][\d\s\-()]{5,19}$/.test(phone)) return;
    const cleaned = {
      name: form.name.trim().slice(0, 100),
      phone: phone.slice(0, 20),
      address: (form.address || "").trim().slice(0, 300),
      drugLicNo: (form.drugLicNo || "").trim().slice(0, 100),
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" /> Customer details
          </DialogTitle>
          <DialogDescription>
            Add the customer's details for this sale, or pick from past customers.
          </DialogDescription>
        </DialogHeader>

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
                className="h-6 px-2 text-xs"
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
                    className="pl-8 h-8 text-xs"
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
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                      activeMatchIdx === idx ? "bg-accent text-accent-foreground" : "hover:bg-accent"
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-phone" className="text-xs">
              Phone number
            </Label>
            <Input
              id="cd-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              maxLength={20}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
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
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-drug-lic" className="text-xs">
              Drug.lic.no
            </Label>
            <Input
              id="cd-drug-lic"
              value={form.drugLicNo || ""}
              maxLength={100}
              onChange={(e) => setForm({ ...form, drugLicNo: e.target.value })}
              placeholder="e.g. DL-12345"
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
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={skip}>
              Skip
            </Button>
            <Button type="submit" className="shadow-soft">
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
