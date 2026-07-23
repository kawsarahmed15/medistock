import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  History,
  ShoppingCart,
  IndianRupee,
  Trash2,
  Pencil,
  Plus,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function parsePack(packStr?: string) {
  if (!packStr) return { stockType: "other", stockPacks: "" };

  if (packStr.toUpperCase().endsWith("ML") && !packStr.includes("x") && !packStr.includes("X")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "syp", stockPacks: val };
  }

  if (packStr.toUpperCase().endsWith("MG")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "inj", stockPacks: val, stockUnits: "MG" };
  }

  if (packStr.toUpperCase().endsWith(" ML DROP")) {
    const val = packStr.substring(0, packStr.length - 8).trim();
    return { stockType: "drop", stockPacks: val };
  }

  if (packStr.toUpperCase().endsWith(" GM")) {
    const val = packStr.substring(0, packStr.length - 3).trim();
    return { stockType: "cream", stockPacks: val };
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
    return { stockType: "tab", stockPacks: packStr };
  }

  return { stockType: "other", stockPacks: packStr };
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
  const [submitting, setSubmitting] = useState(false);

  // Edit product dialog state (medicine general details only)
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    name: "",
    category: "",
    stockType: "other",
    stockPacks: "",
    stockUnits: "",
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

  // Batch dialog state
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<any>(null); // null means creating
  const [batchForm, setBatchForm] = useState<any>({
    batchNo: "",
    expiryDate: "",
    purchasePrice: "",
    mrp: "",
    sellingPrice: "",
    availableQty: "",
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

  const startEdit = () => {
    setEditForm({
      name: product.name,
      category: product.category,
      ...parsePack(product.pack),
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
      pack: packValue || null,
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

  // Batch operations
  const openAddBatch = () => {
    setEditingBatch(null);
    setBatchForm({
      batchNo: "",
      expiryDate: "",
      purchasePrice: "",
      mrp: "",
      sellingPrice: "",
      availableQty: "",
    });
    setBatchDialogOpen(true);
  };

  const openEditBatch = (batch: any) => {
    setEditingBatch(batch);
    setBatchForm({
      batchNo: batch.batch_no,
      expiryDate: (() => {
        if (!batch.expiry_date) return "";
        const dateObj = new Date(batch.expiry_date);
        const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
        const yy = String(dateObj.getFullYear()).substring(2);
        return `${mm}/${yy}`;
      })(),
      purchasePrice: String(batch.purchase_price || 0),
      mrp: String(batch.mrp || 0),
      sellingPrice: String(batch.selling_price || 0),
      availableQty: String(batch.available_qty || 0),
    });
    setBatchDialogOpen(true);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.batchNo.trim()) return toast.error("Batch number is required");
    if (!batchForm.expiryDate.trim()) return toast.error("Expiry date is required");

    // Expiry conversion helper (from MM/YY or YYYY-MM-DD to YYYY-MM-DD)
    const formattedExpiry = (() => {
      const exp = batchForm.expiryDate.trim();
      if (exp.includes("/")) {
        const parts = exp.split("/");
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const year = 2000 + parseInt(parts[1], 10);
          const lastDay = new Date(year, month, 0).getDate();
          return `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
        }
      }
      return exp;
    })();

    const payload = {
      batchNo: batchForm.batchNo.trim().toUpperCase(),
      expiryDate: formattedExpiry,
      purchasePrice: Number(batchForm.purchasePrice) || 0,
      mrp: Number(batchForm.mrp) || 0,
      sellingPrice: Number(batchForm.sellingPrice) || 0,
      availableQty: Number(batchForm.availableQty) || 0,
    };

    setSubmitting(true);
    try {
      if (editingBatch) {
        // Edit existing batch
        await apiRequest(`/products/batches/${editingBatch.id}`, {
          method: "PATCH",
          body: payload,
          auth: true,
        });
        toast.success("Batch updated successfully");
      } else {
        // Add new batch
        await apiRequest(`/products/${id}/batches`, {
          method: "POST",
          body: payload,
          auth: true,
        });
        toast.success("Batch created successfully");
      }
      setBatchDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save batch details");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (batchId: string, batchNo: string) => {
    if (!confirm(`Are you sure you want to delete batch ${batchNo}?`)) return;
    try {
      await apiRequest(`/products/batches/${batchId}`, {
        method: "DELETE",
        auth: true,
      });
      toast.success("Batch deleted successfully");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete batch");
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

  const totalStock = product.batches
    ? product.batches.reduce((sum: number, b: any) => sum + (Number(b.available_qty) || 0), 0)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Panel */}
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
        {/* Left column details */}
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-soft">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Product Stock Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {totalStock}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {product.base_unit || "Unit"}s total
                </span>
              </div>
              {product.conversion_factor > 1 && (
                <div className="text-xs text-muted-foreground border-t pt-2">
                  Packs Equivalent: <span className="font-semibold text-foreground">{Math.floor(totalStock / product.conversion_factor)} {product.pack_unit || "Pack"}s</span>, and {totalStock % product.conversion_factor} {product.base_unit || "Unit"}s
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">Medicine Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manufacturer</span>
                <span className="font-semibold">{product.manufacturer ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">HSN / SKU Code</span>
                <span className="font-semibold">{product.sku ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax rate (GST)</span>
                <span className="font-semibold">{Number(product.tax_percent || 0).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prescription Required</span>
                <span className="font-semibold">{product.prescription ? "Yes (Rx)" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Packing unit</span>
                <span className="font-semibold">{product.pack ?? "Unit"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column batches table */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-soft">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Product Batches</CardTitle>
              <Button size="xs" onClick={openAddBatch} className="gap-1 shadow-soft h-7 px-2.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Batch
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {(!product.batches || product.batches.length === 0) ? (
                <div className="text-center text-muted-foreground py-10 text-xs font-medium">
                  No active batches for this medicine. Register stock or click Add Batch.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Batch No</TableHead>
                      <TableHead className="text-xs">Expiry</TableHead>
                      <TableHead className="text-right text-xs">Stock</TableHead>
                      <TableHead className="text-right text-xs">Purchase Price</TableHead>
                      <TableHead className="text-right text-xs">Selling Price</TableHead>
                      <TableHead className="text-right text-xs">MRP</TableHead>
                      <TableHead className="text-right text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.batches.map((b: any) => {
                      const expDate = new Date(b.expiry_date);
                      const isExpired = expDate.getTime() < Date.now();
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-semibold text-xs uppercase">{String(b.batch_no || "").toUpperCase()}</TableCell>
                           <TableCell className="text-xs">
                            <span className={isExpired ? "text-red-500 font-semibold" : ""}>
                              {(() => {
                                const mm = String(expDate.getMonth() + 1).padStart(2, "0");
                                const yy = String(expDate.getFullYear()).substring(2);
                                return `${mm}/${yy}`;
                              })()}
                              {isExpired ? " (Expired)" : ""}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs font-medium">
                            {b.available_qty}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            ₹{Number(b.purchase_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            ₹{Number(b.selling_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            ₹{Number(b.mrp).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-1.5 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary"
                              onClick={() => openEditBatch(b)}
                              title="Edit batch"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteBatch(b.id, b.batch_no)}
                              title="Delete batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Timeline audit log history */}
          <Card className="shadow-soft">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-xs">
                  No stock logs recorded yet.
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
                      <div className="flex justify-between items-start mb-1 text-xs">
                        <div>
                          <span className="font-semibold capitalize">
                            {record.action.replace("_", " ")}
                          </span>
                          <span
                            className={`ml-2 font-bold ${record.quantity > 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {record.quantity > 0 ? "+" : ""}
                            {record.quantity}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Balance total stock: {record.balance}
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

      {/* Add / Edit Batch Modal */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">{editingBatch ? "Edit Batch Details" : "Add New Batch"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Batch Number</Label>
              <Input
                value={batchForm.batchNo}
                onChange={(e) => setBatchForm({ ...batchForm, batchNo: e.target.value.toUpperCase() })}
                placeholder="e.g. ABC123XYZ"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Expiry Date (MM/YY or YYYY-MM-DD)</Label>
              <Input
                value={batchForm.expiryDate}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d/-]/g, "");
                  if (val.length === 2 && !val.includes("/") && !val.includes("-")) {
                    val = val + "/";
                  }
                  setBatchForm({ ...batchForm, expiryDate: val });
                }}
                placeholder="e.g. 10/28 or 2028-10-31"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Purchase Price (PTR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={batchForm.purchasePrice}
                  onChange={(e) => setBatchForm({ ...batchForm, purchasePrice: e.target.value })}
                  placeholder="₹0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Selling Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={batchForm.sellingPrice}
                  onChange={(e) => setBatchForm({ ...batchForm, sellingPrice: e.target.value })}
                  placeholder="₹0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">MRP</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={batchForm.mrp}
                  onChange={(e) => setBatchForm({ ...batchForm, mrp: e.target.value })}
                  placeholder="₹0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Available Stock Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={batchForm.availableQty}
                  onChange={(e) => setBatchForm({ ...batchForm, availableQty: e.target.value })}
                  placeholder="e.g. 100"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setBatchDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                Save Batch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product details (general only) Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product details</DialogTitle>
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
