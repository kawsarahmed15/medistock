import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Banknote,
  FileWarning,
  Minus,
  Plus,
  Smartphone,
  ShoppingCart,
  Trash2,
  UserRound,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { billsStore, productsStore } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerDetailsDialog } from "@/components/customer-details-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cart")({
  component: CartPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function CartPage() {
  const cart = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [customerOpen, setCustomerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const rxItems = cart.items.filter((i) => i.product.prescription);
  const hasRx = rxItems.length > 0;
  const prescriptionRef = (cart.customer.prescriptionRef ?? "").trim();
  const prescriptionPhoto = (cart.customer.prescriptionPhoto ?? "").trim();
  const rxBlocked = hasRx && !prescriptionRef && !prescriptionPhoto;

  const checkout = async () => {
    if (cart.items.length === 0 || submitting) return;
    if (rxBlocked) {
      toast.error(
        "Prescription reference is required for Rx items. Add it below.",
      );
      return;
    }
    setSubmitting(true);
    try {
      // Persist Rx info into the bill notes so it appears on invoices.
      const baseNotes = (cart.customer.notes || "").trim();
      const rxParts: string[] = [];
      if (hasRx && prescriptionRef) rxParts.push(`Rx ref: ${prescriptionRef}`);
      if (hasRx && prescriptionPhoto) rxParts.push("Rx photo: attached");
      const combinedNotes = [baseNotes, ...rxParts].filter(Boolean).join("\n");

      const bill = await billsStore.add({
        customerName: cart.customer.name || undefined,
        customerPhone: cart.customer.phone || undefined,
        customerNotes: combinedNotes || undefined,
        cashier: session?.name,
        paymentMethod: cart.paymentMethod,
        items: cart.items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          price: i.product.price,
          costPrice: i.product.costPrice,
          qty: i.qty,
          taxPercent: i.product.taxPercent ?? 0,
          mrp: i.product.mrp,
          pack: i.product.pack,
        })),
        subtotal: cart.subtotal,
        tax: cart.tax,
        total: cart.total,
      });
      // Decrement stock for each line (sequential to keep RLS-safe simple writes)
      await Promise.all(
        cart.items.map((i) => productsStore.decrementStock(i.product.id, i.qty)),
      );
      cart.clear();
      toast.success(`Bill ${bill.number} generated`);
      navigate({ to: "/bills/$id", params: { id: bill.id } });
    } catch (e) {
      toast.error((e as Error).message || "Failed to generate bill");
    } finally {
      setSubmitting(false);
    }
  };

  const hasCustomer =
    cart.customer.name.trim() || cart.customer.phone.trim() || cart.customer.notes.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Cart
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review items, choose payment, and finalize the sale.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/sell">Add more products</Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">
              Items {cart.count > 0 ? `(${cart.count})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.items.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                <Button asChild size="sm">
                  <Link to="/sell">Browse products</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {cart.items.map((i) => (
                  <div
                    key={i.product.id}
                    className="flex items-center gap-3 py-3 animate-fade-in"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {i.product.name}
                        {i.product.prescription && (
                          <span
                            className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive shrink-0"
                            title="Prescription required"
                          >
                            Rx
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {i.isFree ? (
                          <span className="font-semibold text-primary">Free</span>
                        ) : (
                          <>{formatMoney(i.product.price)} · {i.product.taxPercent ?? 0}% tax</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={i.isFree ? "default" : "outline"}
                        size="sm"
                        className="text-[10px] h-8 px-2"
                        onClick={() => cart.toggleFree(i.product.id)}
                      >
                        Free
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => cart.setQty(i.product.id, i.qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm tabular-nums">{i.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => cart.setQty(i.product.id, i.qty + 1)}
                        disabled={i.qty >= i.product.stock}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-24 text-right tabular-nums font-medium">
                      {i.isFree ? "₹0.00" : formatMoney(i.product.price * i.qty)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => cart.remove(i.product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" /> Customer
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomerOpen(true)}
                disabled={cart.items.length === 0}
              >
                <Pencil className="h-3.5 w-3.5" /> {hasCustomer ? "Edit" : "Add"}
              </Button>
            </CardHeader>
            <CardContent className="text-sm">
              {hasCustomer ? (
                <div className="space-y-1">
                  {cart.customer.name && (
                    <div className="font-medium">{cart.customer.name}</div>
                  )}
                  {cart.customer.phone && (
                    <div className="text-muted-foreground">{cart.customer.phone}</div>
                  )}
                  {cart.customer.notes && (
                    <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                      {cart.customer.notes}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Walk-in customer.</p>
              )}
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <PayChoice
                  label="Cash"
                  Icon={Banknote}
                  active={cart.paymentMethod === "cash"}
                  onClick={() => cart.setPaymentMethod("cash")}
                />
                <PayChoice
                  label="Online"
                  Icon={Smartphone}
                  active={cart.paymentMethod === "online"}
                  onClick={() => cart.setPaymentMethod("online")}
                />
              </div>
            </CardContent>
          </Card>

          {hasRx && (
            <Card className="shadow-soft border-destructive/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <FileWarning className="h-4 w-4" /> Prescription required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  This sale contains {rxItems.length} Rx item
                  {rxItems.length === 1 ? "" : "s"}:{" "}
                  <span className="font-medium text-foreground">
                    {rxItems.map((i) => i.product.name).join(", ")}
                  </span>
                  . Provide the prescription as a photo <em>or</em> reference
                  text to continue.
                </p>
                <RxInput
                  refValue={cart.customer.prescriptionRef ?? ""}
                  photoValue={cart.customer.prescriptionPhoto ?? ""}
                  onChange={(patch) =>
                    cart.setCustomer({ ...cart.customer, ...patch })
                  }
                />
              </CardContent>
            </Card>
          )}

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatMoney(cart.subtotal)} />
              <Row label="Tax" value={formatMoney(cart.tax)} />
              <div className="border-t pt-2">
                <Row label="Total" value={formatMoney(cart.total)} bold />
              </div>
              <Button
                className="w-full shadow-soft mt-3"
                size="lg"
                onClick={() => void checkout()}
                disabled={cart.items.length === 0 || submitting || rxBlocked}
              >
                {submitting
                  ? "Generating…"
                  : rxBlocked
                    ? "Add Rx photo or reference"
                    : "Generate bill"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerDetailsDialog open={customerOpen} onOpenChange={setCustomerOpen} />
    </div>
  );
}

function PayChoice({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-smooth",
        active
          ? "border-primary bg-primary/10 text-primary shadow-soft"
          : "border-border hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-base" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function RxInput({
  refValue,
  photoValue,
  onChange,
}: {
  refValue: string;
  photoValue: string;
  onChange: (patch: { prescriptionRef?: string; prescriptionPhoto?: string }) => void;
}) {
  const [tab, setTab] = useState<"text" | "photo">(photoValue ? "photo" : "text");

  const onFile = (file: File | null) => {
    if (!file) {
      onChange({ prescriptionPhoto: "" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ prescriptionPhoto: String(reader.result ?? "") });
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setTab("text")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-smooth",
            tab === "text"
              ? "bg-background shadow-soft text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Reference text
        </button>
        <button
          type="button"
          onClick={() => setTab("photo")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-smooth",
            tab === "photo"
              ? "bg-background shadow-soft text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Upload photo
        </button>
      </div>

      {tab === "text" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Prescription / Rx reference</Label>
          <Input
            placeholder="e.g. Dr. Mehta · RX-2025-0421"
            value={refValue}
            onChange={(e) => onChange({ prescriptionRef: e.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Prescription photo</Label>
          {photoValue ? (
            <div className="space-y-2">
              <img
                src={photoValue}
                alt="Prescription"
                className="max-h-40 w-full object-contain rounded-md border bg-muted"
              />
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="block text-center text-xs px-2 py-1.5 rounded-md border cursor-pointer hover:bg-accent">
                    Replace
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ prescriptionPhoto: "" })}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <label className="block">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <span className="flex flex-col items-center justify-center gap-1 px-3 py-6 rounded-md border-2 border-dashed text-xs text-muted-foreground cursor-pointer hover:bg-accent/40">
                <span className="font-medium text-foreground">Tap to upload</span>
                <span>JPG / PNG · under 4 MB</span>
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
