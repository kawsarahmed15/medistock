import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingCart,
  IndianRupee,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function parsePack(packStr?: string) {
  if (!packStr) return { stockType: "other", stockPacks: "", stockUnits: "" };

  if (packStr.toUpperCase().endsWith("ML") && !packStr.includes("x") && !packStr.includes("X")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "syp", stockPacks: val, stockUnits: "ML" };
  }

  if (packStr.toUpperCase().endsWith("MG")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "inj", stockPacks: val, stockUnits: "MG" };
  }

  if (packStr.toUpperCase().endsWith(" ML DROP")) {
    const val = packStr.substring(0, packStr.length - 8).trim();
    return { stockType: "drop", stockPacks: val, stockUnits: "ML" };
  }

  if (packStr.toUpperCase().endsWith(" GM")) {
    const val = packStr.substring(0, packStr.length - 3).trim();
    return { stockType: "cream", stockPacks: val, stockUnits: "GM" };
  }

  if (packStr.toUpperCase().endsWith("GM")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "inj", stockPacks: val, stockUnits: "GM" };
  }

  if (
    packStr.includes("x") ||
    packStr.includes("X") ||
    packStr.includes("*") ||
    packStr.toUpperCase() === "CAP"
  ) {
    return { stockType: "tab", stockPacks: packStr, stockUnits: "" };
  }

  return { stockType: "other", stockPacks: packStr, stockUnits: "" };
}

export const Route = createFileRoute("/_app/inventory_/$id")({
  component: ProductDetails,
});

function ProductDetails() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/_app/inventory_/$id" });
  const [product, setProduct] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock action dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"stock_in" | "stock_out" | "purchase">("stock_in");
  const [unitType, setUnitType] = useState<"base" | "pack">("base");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Price action dialog state
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [newPackPrice, setNewPackPrice] = useState("");
  const [newPackCostPrice, setNewPackCostPrice] = useState("");

  // Edit product state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    name: "",
    category: "",
    costPrice: "",
    price: "",
    mrp: "",
    stockType: "other",
    stockPacks: "",
    stockUnits: "",
    expiry: "",
    batch: "",
    manufacturer: "",
    sku: "",
    taxPercent: "12",
    prescription: false,
    baseUnit: "Unit",
    packUnit: "Pack",
    conversionFactor: "1",
    packPrice: "",
    packCostPrice: "",
  });

  async function loadData() {
    try {
      const pRes = await apiRequest(`/products/${id}`, { auth: true });
      setProduct(pRes);

      const hRes = await apiRequest(`/products/${id}/history`, { auth: true });
      setHistory(hRes);
    } catch (err) {
      toast.error("Failed to load product details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    const handleBackspace = (e: KeyboardEvent) => {
      if (dialogOpen || priceDialogOpen || editOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable;

      if (e.key === "Backspace" && !inField) {
        e.preventDefault();
        navigate({ to: "/inventory" });
      }
    };

    window.addEventListener("keydown", handleBackspace);
    return () => window.removeEventListener("keydown", handleBackspace);
  }, [navigate, dialogOpen, priceDialogOpen, editOpen]);

  const startEdit = () => {
    setEditForm({
      name: product.name,
      category: product.category,
      costPrice: product.cost_price != null ? String(product.cost_price) : "",
      price: String(product.price),
      mrp: product.mrp != null ? String(product.mrp) : "",
      ...parsePack(product.pack),
      expiry: (() => {
        if (!product.expiry) return "";
        const parts = product.expiry.split("-");
        if (parts.length >= 2) {
          return `${parts[1]}/${parts[0].substring(2)}`;
        }
        return product.expiry;
      })(),
      batch: product.batch ?? "",
      manufacturer: product.manufacturer ?? "",
      sku: product.sku ?? "",
      taxPercent: String(product.tax_percent ?? 0),
      prescription: !!product.prescription,
      baseUnit: product.base_unit ?? "Unit",
      packUnit: product.pack_unit ?? "Pack",
      conversionFactor: String(product.conversion_factor ?? 1),
      packPrice: product.pack_price != null ? String(product.pack_price) : "",
      packCostPrice: product.pack_cost_price != null ? String(product.pack_cost_price) : "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let packValue: string | undefined = undefined;
    if (editForm.stockType === "tab" || editForm.stockType === "cap" || editForm.stockType === "other") {
      if (editForm.stockPacks) {
        packValue = editForm.stockPacks;
      }
    } else if (editForm.stockType === "syp") {
      if (editForm.stockPacks) {
        packValue = `${editForm.stockPacks}ML`;
      }
    } else if (editForm.stockType === "inj") {
      if (editForm.stockPacks) {
        packValue = `${editForm.stockPacks}${editForm.stockUnits || "ML"}`;
      }
    } else if (editForm.stockType === "cream") {
      if (editForm.stockPacks) {
        packValue = `${editForm.stockPacks} GM`;
      }
    } else if (editForm.stockType === "drop") {
      if (editForm.stockPacks) {
        packValue = `${editForm.stockPacks} ML Drop`;
      }
    }

    const payload = {
      name: editForm.name.trim().toUpperCase(),
      category: editForm.category.trim().toUpperCase() || "GENERAL",
      costPrice: editForm.costPrice === "" ? null : Number(editForm.costPrice),
      price: Number(editForm.price),
      mrp: editForm.mrp === "" ? null : Number(editForm.mrp),
      pack: packValue || null,
      expiry: (() => {
        if (!editForm.expiry) return "";
        const parts = editForm.expiry.split("/");
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const year = 2000 + parseInt(parts[1], 10);
          const lastDay = new Date(year, month, 0).getDate();
          return `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
        }
        return editForm.expiry;
      })(),
      batch: editForm.batch.trim() || null,
      manufacturer: editForm.manufacturer.trim() ? editForm.manufacturer.trim().toUpperCase() : null,
      sku: editForm.sku.trim() || null,
      taxPercent: Number(editForm.taxPercent) || 0,
      prescription: editForm.prescription ? 1 : 0,
      baseUnit: editForm.baseUnit.trim() || "Unit",
      packUnit: editForm.packUnit.trim() || "Pack",
      conversionFactor: Number(editForm.conversionFactor) || 1,
      packPrice: editForm.packPrice === "" ? null : Number(editForm.packPrice),
      packCostPrice: editForm.packCostPrice === "" ? null : Number(editForm.packCostPrice),
    };

    setSubmitting(true);
    try {
      await apiRequest(`/products/${id}`, {
        method: "PATCH",
        body: payload,
        auth: true,
      });
      toast.success("Product updated successfully");
      setEditOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${product?.name}? This action cannot be undone.`)) return;
    try {
      await apiRequest(`/products/${id}`, { method: "DELETE", auth: true });
      toast.success("Product deleted successfully");
      navigate({ to: "/inventory" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product");
    }
  };

  const handleStockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) return toast.error("Quantity must be greater than 0");

    let finalQty = qty;
    let finalNotes = notes;
    if (unitType === "pack" && product.conversion_factor > 1) {
      finalQty = qty * product.conversion_factor;
      const unitText = actionType === "stock_out" ? "Removed" : "Added";
      finalNotes = `(${unitText} ${qty} ${product.pack_unit || "Pack"}s) ${notes}`.trim();
    }

    setSubmitting(true);
    try {
      await apiRequest(`/products/${id}/stock`, {
        method: "POST",
        body: {
          action: actionType,
          quantity: finalQty,
          notes: finalNotes,
          supplierName: actionType !== "stock_out" ? supplierName : undefined,
          supplierPhone: actionType !== "stock_out" ? supplierPhone : undefined,
          supplierInvoice: actionType !== "stock_out" ? supplierInvoice : undefined,
        },
        auth: true,
      });
      if (actionType !== "stock_out") {
        if (supplierName.trim()) localStorage.setItem("lastSupplierName", supplierName.trim());
        if (supplierPhone.trim()) localStorage.setItem("lastSupplierPhone", supplierPhone.trim());
      }
      toast.success("Stock updated successfully");
      setDialogOpen(false);
      setQuantity("");
      setNotes("");
      setSupplierName("");
      setSupplierPhone("");
      setSupplierInvoice("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update stock");
    } finally {
      setSubmitting(false);
    }
  };

  const openAction = (type: "stock_in" | "stock_out" | "purchase") => {
    setActionType(type);
    setUnitType("base");
    setSupplierName(localStorage.getItem("lastSupplierName") || "");
    setSupplierPhone(localStorage.getItem("lastSupplierPhone") || "");
    setSupplierInvoice("");
    setDialogOpen(true);
  };

  const openPriceAction = () => {
    setNewPrice(product?.price != null ? String(product.price) : "");
    setNewCostPrice(product?.cost_price != null ? String(product.cost_price) : "");
    setNewPackPrice(product?.pack_price != null ? String(product.pack_price) : "");
    setNewPackCostPrice(product?.pack_cost_price != null ? String(product.pack_cost_price) : "");
    setPriceDialogOpen(true);
  };

  const handlePriceAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest(`/products/${id}`, {
        method: "PATCH",
        body: {
          price: newPrice,
          costPrice: newCostPrice,
          packPrice: product?.conversion_factor > 1 ? newPackPrice : null,
          packCostPrice: product?.conversion_factor > 1 ? newPackCostPrice : null,
        },
        auth: true,
      });
      toast.success("Prices updated successfully");
      setPriceDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update prices");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center mt-12">
        <h2 className="text-2xl font-bold">Product not found</h2>
        <Link to="/inventory" className="text-primary hover:underline mt-4 inline-block">
          Return to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-lg border shadow-soft">
        <div className="flex items-center gap-4">
          <Link to="/inventory">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-sm text-muted-foreground">{product.category}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={startEdit}
            className="gap-2 shadow-soft"
          >
            <Pencil className="w-4 h-4" /> Edit Product
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="gap-2 shadow-soft hover:bg-destructive/90"
          >
            <Trash2 className="w-4 h-4" /> Delete Product
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Current Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {product.stock}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {product.base_unit || "Unit"}s
                </span>
              </div>
              {product.conversion_factor > 1 && (
                <div className="text-sm text-muted-foreground mt-1">
                  ({Math.floor(product.stock / product.conversion_factor)}{" "}
                  {product.pack_unit || "Pack"}s, {product.stock % product.conversion_factor}{" "}
                  {product.base_unit || "Unit"}s)
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  onClick={() => openAction("purchase")}
                  variant="default"
                  className="w-full gap-2"
                >
                  <ShoppingCart className="w-4 h-4" /> Add Purchase
                </Button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    onClick={() => openAction("stock_in")}
                    variant="outline"
                    className="gap-2"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-emerald-500" /> Stock In
                  </Button>
                  <Button
                    onClick={() => openAction("stock_out")}
                    variant="outline"
                    className="gap-2"
                  >
                    <ArrowUpFromLine className="w-4 h-4 text-rose-500" /> Stock Out
                  </Button>
                </div>
                <Button onClick={openPriceAction} variant="outline" className="w-full gap-2 mt-2">
                  <IndianRupee className="w-4 h-4 text-blue-500" /> Price Adjustment
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price (MRP)</span>
                <span className="font-medium">
                  ₹{Number(product.price).toFixed(2)} / {product.base_unit || "Unit"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Price</span>
                <span className="font-medium">
                  ₹{Number(product.cost_price || 0).toFixed(2)} / {product.base_unit || "Unit"}
                </span>
              </div>
              {product.conversion_factor > 1 && (
                <>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-muted-foreground">Pack Price</span>
                    <span className="font-medium">
                      ₹{Number(product.pack_price || 0).toFixed(2)} / {product.pack_unit || "Pack"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pack Cost</span>
                    <span className="font-medium">
                      ₹{Number(product.pack_cost_price || 0).toFixed(2)} /{" "}
                      {product.pack_unit || "Pack"}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-muted-foreground">Tax (GST)</span>
                <span className="font-medium">{Number(product.tax_percent || 0).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry</span>
                <span className="font-medium">{new Date(product.expiry).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Timeline History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No history recorded for this product yet.
                </div>
              ) : (
                <div className="relative border-l border-border ml-3 space-y-6 pb-4">
                  {history.map((record: any) => (
                    <div key={record.id} className="relative pl-6">
                      <div
                        className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${
                          record.action === "sale" || record.action === "stock_out"
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-medium capitalize text-sm">
                            {record.action.replace("_", " ")}
                          </span>
                          <span
                            className={`ml-2 text-xs font-bold ${record.quantity > 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {record.quantity > 0 ? "+" : ""}
                            {record.quantity}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Balance after: {record.balance}
                        {record.notes && (
                          <p className="mt-1 text-foreground italic">"{record.notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType.replace("_", " ")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStockAction} className="space-y-4 mt-4">
            {product?.conversion_factor > 1 && (
              <div className="flex gap-4 mb-4">
                <Button
                  type="button"
                  variant={unitType === "base" ? "default" : "outline"}
                  onClick={() => setUnitType("base")}
                  className="flex-1"
                >
                  By {product.base_unit || "Unit"}
                </Button>
                <Button
                  type="button"
                  variant={unitType === "pack" ? "default" : "outline"}
                  onClick={() => setUnitType("pack")}
                  className="flex-1"
                >
                  By {product.pack_unit || "Pack"}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>
                Quantity (
                {unitType === "pack" ? product?.pack_unit || "Pack" : product?.base_unit || "Unit"})
              </Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder={`Enter number of ${unitType === "pack" ? product?.pack_unit + "s" || "Packs" : product?.base_unit + "s" || "Units"}...`}
              />
            </div>
            {actionType !== "stock_out" && (
              <>
                <div className="space-y-2">
                  <Label>Supplier Name (Optional)</Label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Enter supplier name..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supplier Phone (Optional)</Label>
                    <Input
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      placeholder="e.g. +91 9999999999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Number (Optional)</Label>
                    <Input
                      value={supplierInvoice}
                      onChange={(e) => setSupplierInvoice(e.target.value)}
                      placeholder="e.g. INV-12345"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  actionType === "purchase"
                    ? "Invoice #, Supplier info..."
                    : "Reason for adjustment..."
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                Confirm
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Price Adjustment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePriceAction} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Selling Price (per {product?.base_unit || "Unit"})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Cost Price (per {product?.base_unit || "Unit"})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCostPrice}
                  onChange={(e) => setNewCostPrice(e.target.value)}
                />
              </div>
            </div>

            {product?.conversion_factor > 1 && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-2">
                  <Label>Pack Price (per {product?.pack_unit || "Pack"})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPackPrice}
                    onChange={(e) => setNewPackPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pack Cost Price (per {product?.pack_unit || "Pack"})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPackCostPrice}
                    onChange={(e) => setNewPackCostPrice(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setPriceDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                Save Prices
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" className="col-span-full">
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
                required
              />
            </Field>
            <Field label="Category">
              <Input
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value.toUpperCase() })}
                placeholder="e.g. Antibiotic"
              />
            </Field>
            <Field label="Manufacturer">
              <Input
                value={editForm.manufacturer}
                onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Buying price">
              <Input
                type="number"
                step="0.01"
                value={editForm.costPrice}
                onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                placeholder="Cost per unit"
                required
              />
            </Field>
            <Field label="Selling price">
              <Input
                type="number"
                step="0.01"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                required
              />
            </Field>
            <Field label="MRP">
              <Input
                type="number"
                step="0.01"
                value={editForm.mrp}
                onChange={(e) => setEditForm({ ...editForm, mrp: e.target.value })}
                placeholder="Printed price"
              />
            </Field>
            <Field label="Stock Type">
              <select
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editForm.stockType}
                onChange={(e) => {
                  const type = e.target.value;
                  setEditForm({
                    ...editForm,
                    stockType: type,
                    stockPacks: "",
                    stockUnits: type === "inj" ? "ML" : "",
                  });
                }}
              >
                <option value="other">General / Other</option>
                <option value="tab">Tablet (Tab)</option>
                <option value="cap">Capsule (Cap)</option>
                <option value="syp">Syrup (Syp)</option>
                <option value="inj">Injection (Inj)</option>
                <option value="cream">Cream</option>
                <option value="drop">Drop</option>
              </select>
            </Field>
            {editForm.stockType === "other" && (
              <Field label="Pack Options">
                <Input
                  placeholder="e.g. 10X10, ML, GM..."
                  value={editForm.stockPacks}
                  onChange={(e) => setEditForm({ ...editForm, stockPacks: e.target.value })}
                />
              </Field>
            )}
            {(editForm.stockType === "tab" || editForm.stockType === "cap") && (
              <Field label="Pack Format">
                <Input
                  placeholder="e.g. 10x10, 10X1X10, CAP"
                  value={editForm.stockPacks}
                  onChange={(e) => setEditForm({ ...editForm, stockPacks: e.target.value })}
                  required
                />
              </Field>
            )}
            {editForm.stockType === "syp" && (
              <Field label="Pack (ML)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="ML Amount"
                    value={editForm.stockPacks}
                    onChange={(e) => setEditForm({ ...editForm, stockPacks: e.target.value })}
                    required
                  />
                  <span className="text-muted-foreground text-sm font-medium">ML</span>
                </div>
              </Field>
            )}
            {editForm.stockType === "inj" && (
              <Field label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={editForm.stockPacks}
                    onChange={(e) => setEditForm({ ...editForm, stockPacks: e.target.value })}
                    required
                  />
                  <select
                    className="flex h-9 w-24 items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editForm.stockUnits || "ML"}
                    onChange={(e) => setEditForm({ ...editForm, stockUnits: e.target.value })}
                  >
                    <option value="ML">ML</option>
                    <option value="MG">MG</option>
                    <option value="GM">GM</option>
                  </select>
                </div>
              </Field>
            )}
            {editForm.stockType === "cream" && (
              <Field label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={editForm.stockPacks}
                    onChange={(e) => setEditForm({ ...editForm, stockPacks: e.target.value })}
                    required
                  />
                  <span className="text-muted-foreground text-sm font-medium">GM</span>
                </div>
              </Field>
            )}
            {editForm.stockType === "drop" && (
              <Field label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={editForm.stockPacks}
                    onChange={(e) => setEditForm({ ...editForm, stockPacks: e.target.value })}
                    required
                  />
                  <span className="text-muted-foreground text-sm font-medium">ML</span>
                </div>
              </Field>
            )}
            <Field label="Expiry">
              <Input
                type="text"
                placeholder="MM/YY"
                maxLength={5}
                value={editForm.expiry}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d/]/g, "");
                  if (val.length === 2 && !val.includes("/")) {
                    val = val + "/";
                  }
                  setEditForm({ ...editForm, expiry: val });
                }}
                required
              />
            </Field>
            <Field label="Batch">
              <Input
                value={editForm.batch}
                onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })}
              />
            </Field>
            <Field label="HSN / SKU code">
              <Input
                value={editForm.sku}
                onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
              />
            </Field>
            <Field label="GST %">
              <select
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editForm.taxPercent}
                onChange={(e) => setEditForm({ ...editForm, taxPercent: e.target.value })}
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </Field>
            <div className="col-span-full border-t border-border pt-4 mt-2">
              <h4 className="text-sm font-medium mb-3">Unit Conversion Options</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Base Unit (e.g. Tab)">
                  <Input
                    placeholder="e.g. Tab, Cap"
                    value={editForm.baseUnit}
                    onChange={(e) => setEditForm({ ...editForm, baseUnit: e.target.value })}
                  />
                </Field>
                <Field label="Pack Unit (e.g. Box)">
                  <Input
                    placeholder="e.g. Box, Strip"
                    value={editForm.packUnit}
                    onChange={(e) => setEditForm({ ...editForm, packUnit: e.target.value })}
                  />
                </Field>
                <Field label="Conversion (e.g. 10)">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty in 1 pack"
                    value={editForm.conversionFactor}
                    onChange={(e) => setEditForm({ ...editForm, conversionFactor: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            {Number(editForm.conversionFactor) > 1 && (
              <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                <Field label={`Pack Selling Price (per ${editForm.packUnit || "Pack"})`}>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.packPrice}
                    onChange={(e) => setEditForm({ ...editForm, packPrice: e.target.value })}
                  />
                </Field>
                <Field label={`Pack Buying Price (per ${editForm.packUnit || "Pack"})`}>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.packCostPrice}
                    onChange={(e) => setEditForm({ ...editForm, packCostPrice: e.target.value })}
                  />
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 col-span-full border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
