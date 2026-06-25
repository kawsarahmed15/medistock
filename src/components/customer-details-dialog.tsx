import { useEffect, useMemo, useState, type FormEvent } from "react";
import { UserRound, Search, Phone, History } from "lucide-react";
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
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.phone.toLowerCase().includes(needle),
      )
      .slice(0, 6);
  }, [saved, pickQuery]);

  const pick = (c: SavedCustomer) => {
    setForm({
      name: c.name,
      phone: c.phone,
      notes: c.notes ?? "",
    });
    setShowPicker(false);
    setPickQuery("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const phone = form.phone.trim();
    if (phone && !/^[+\d][\d\s\-()]{5,19}$/.test(phone)) return;
    const cleaned = {
      name: form.name.trim().slice(0, 100),
      phone: phone.slice(0, 20),
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
                    <p className="text-xs text-muted-foreground px-2 py-2">
                      No matches.
                    </p>
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
                          {c.name || (
                            <span className="italic text-muted-foreground">
                              No name
                            </span>
                          )}
                        </div>
                        {c.phone && (
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone} ·{" "}
                            {c.visits} {c.visits === 1 ? "visit" : "visits"}
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
          <div className="space-y-1.5">
            <Label htmlFor="cd-name" className="text-xs">
              Full name
            </Label>
            <Input
              id="cd-name"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Asha Verma"
            />
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
