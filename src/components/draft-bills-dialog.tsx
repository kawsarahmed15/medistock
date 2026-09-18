import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  FileText,
  Trash2,
  ArrowRight,
  Clock,
  UserRound,
  Package,
  ShoppingBag,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useCart, type DraftBill } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DraftBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

export function DraftBillsDialog({ open, onOpenChange }: DraftBillsDialogProps) {
  const { drafts, loadDraft, deleteDraft, clearDrafts, activeDraftId } = useCart();
  const navigate = useNavigate();
  const [selectedDraft, setSelectedDraft] = useState<DraftBill | null>(null);

  const handleProcessDraft = (d: DraftBill) => {
    loadDraft(d.id);
    onOpenChange(false);
    toast.success(`Draft loaded into active bill`, {
      description: "Review your items and proceed to generate the bill.",
    });
    navigate({ to: "/cart" });
  };

  const handleDeleteDraft = (d: DraftBill, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDraft(d.id);
    toast.success("Draft bill removed", {
      description: "No stock was affected.",
    });
  };

  const handleClearAll = () => {
    if (!confirm("Are you sure you want to delete all saved draft bills? This action cannot be undone.")) return;
    clearDrafts();
    toast.success("All drafts deleted");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  Draft Bills
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {drafts.length}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Saved in-progress bills. Processing and generating a bill will finalize it and decrease stock.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {drafts.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="h-16 w-16 mx-auto rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                <ShoppingBag className="h-8 w-8 opacity-60" />
              </div>
              <h3 className="text-sm font-semibold">No Draft Bills</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                When you create a bill, if you refresh, log out, or click "Save as Draft", your in-progress bill is safely saved here without decreasing product stocks.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((d) => {
                const isActive = d.id === activeDraftId;
                const itemCount = d.items.reduce((s, i) => s + i.qty, 0);
                const dateStr = new Date(d.updatedAt || d.createdAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <div
                    key={d.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all relative overflow-hidden bg-card hover:border-primary/50 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4",
                      isActive && "ring-2 ring-primary/30 border-primary bg-primary/5"
                    )}
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate text-foreground">
                          {d.name}
                        </span>
                        {isActive && (
                          <Badge variant="default" className="text-[10px] h-5 bg-primary">
                            Active in Cart
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {dateStr}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {d.customer?.name ? (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <UserRound className="h-3.5 w-3.5 text-primary" />
                            {d.customer.name} {d.customer.phone ? `(${d.customer.phone})` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">No customer attached</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {itemCount} {itemCount === 1 ? "unit" : "units"} ({d.items.length} items)
                        </span>
                        <span className="font-semibold text-foreground">
                          Total: {formatMoney(d.total)}
                        </span>
                      </div>

                      {/* Items Preview */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {d.items.slice(0, 4).map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-[10px] bg-muted/80 text-foreground px-2 py-0.5 rounded-md border border-border/60"
                          >
                            {it.product.name} × {it.qty}
                          </span>
                        ))}
                        {d.items.length > 4 && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            +{d.items.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1.5 h-9 font-medium shadow-xs"
                        onClick={() => handleProcessDraft(d)}
                      >
                        <span>Process & Generate</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteDraft(d, e)}
                        title="Delete draft"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {drafts.length > 0 && (
          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClearAll}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear All Drafts
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
