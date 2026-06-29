import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, ShieldCheck, FileText, Palette, FileImage, Trash2, Edit, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const PRESETS = [
  { name: "Teal (Default)", hex: "#1a9890" },
  { name: "Blue (Trust)", hex: "#2563eb" },
  { name: "Indigo (Premium)", hex: "#4f46e5" },
  { name: "Purple (Royal)", hex: "#7c3aed" },
  { name: "Emerald (Organic)", hex: "#059669" },
  { name: "Rose (Modern)", hex: "#e11d48" },
  { name: "Dark (Carbon)", hex: "#1f2937" },
];

function SettingsPage() {
  const { session, updateSession } = useAuth();
  const [pharmacyName, setPharmacyName] = useState(session?.pharmacyName ?? "");
  const [pharmacyAddress, setPharmacyAddress] = useState(session?.pharmacyAddress ?? "");
  const [gstNumber, setGstNumber] = useState(session?.gstNumber ?? "");
  const [billColor, setBillColor] = useState(session?.billColor ?? "#1a9890");
  const [signature, setSignature] = useState(session?.signature ?? "");
  const [expiryDays, setExpiryDays] = useState(session?.expiryDays ?? 60);
  const [defaultTax, setDefaultTax] = useState(session?.defaultTax ?? 12);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      if (session.pharmacyName) setPharmacyName(session.pharmacyName);
      if (session.pharmacyAddress) setPharmacyAddress(session.pharmacyAddress);
      if (session.gstNumber) setGstNumber(session.gstNumber);
      if (session.billColor) setBillColor(session.billColor);
      if (session.signature) setSignature(session.signature);
      if (session.expiryDays) setExpiryDays(session.expiryDays);
      if (session.defaultTax !== undefined) setDefaultTax(session.defaultTax);
    }
  }, [session]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 800 * 1024) {
      toast.error("Signature image should be smaller than 800KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSignature(reader.result);
        toast.success("Signature loaded successfully!");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/auth/profile", {
        method: "PATCH",
        body: {
          pharmacyName: pharmacyName.trim() || null,
          pharmacyAddress: pharmacyAddress.trim() || null,
          gstNumber: gstNumber.trim() || null,
          billColor: billColor,
          signature: signature || null,
          expiryDays: Number(expiryDays) || 60,
          defaultTax: Number(defaultTax),
        },
        auth: true,
      });

      updateSession({
        pharmacyName: pharmacyName.trim() || undefined,
        pharmacyAddress: pharmacyAddress.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
        billColor: billColor,
        signature: signature || undefined,
        expiryDays: Number(expiryDays) || 60,
        defaultTax: Number(defaultTax),
      });

      toast.success("Billing preferences saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const clearSignature = () => {
    setSignature("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("Signature cleared. Remember to save changes.");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your pharmacy profile, tax settings, and invoice layout template.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid md:grid-cols-3 gap-6">
        {/* Main Configuration Card */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-soft border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Pharmacy Details
              </CardTitle>
              <CardDescription>
                These details will be printed directly in the header of your bills.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pharmacy-name">Pharmacy / Clinic Name</Label>
                <Input
                  id="pharmacy-name"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  placeholder="e.g. Care Pharmacy & Wellness Centre"
                  className="font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pharmacy-address">Pharmacy Address</Label>
                <Input
                  id="pharmacy-address"
                  value={pharmacyAddress}
                  onChange={(e) => setPharmacyAddress(e.target.value)}
                  placeholder="e.g. 123 Health Ave, Medical District, NY 10001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst-number">GST / Tax Identification Number</Label>
                <Input
                  id="gst-number"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="e.g. 27AAAAA1111A1Z1"
                  className="font-mono uppercase"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                Bill Theme Colors
              </CardTitle>
              <CardDescription>
                Choose the brand color that represents your clinic on printed invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => setBillColor(p.hex)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-200",
                      billColor === p.hex
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 scale-105"
                        : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: p.hex }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="custom-color" className="text-xs text-muted-foreground">
                    Custom Color Picker
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="custom-color"
                      type="color"
                      value={billColor}
                      onChange={(e) => setBillColor(e.target.value)}
                      className="w-12 h-10 p-0.5 border cursor-pointer rounded-lg"
                    />
                    <Input
                      type="text"
                      value={billColor}
                      onChange={(e) => setBillColor(e.target.value)}
                      className="w-28 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Inventory Preferences
              </CardTitle>
              <CardDescription>
                Customize settings related to stock and expiring products.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="expiry-days">"Expiring Soon" Threshold</Label>
                <select
                  id="expiry-days"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={120}>120 Days</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Products expiring within this timeframe will be highlighted as "Expiring Soon".
                </p>
              </div>

              <div className="space-y-2 max-w-sm mt-4">
                <Label htmlFor="default-tax">Default Tax %</Label>
                <Input
                  id="default-tax"
                  type="number"
                  step="0.01"
                  value={defaultTax}
                  onChange={(e) => setDefaultTax(Number(e.target.value))}
                  placeholder="e.g. 12"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default tax percentage applied when adding new products.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Signature & Preview Sidebar */}
        <div className="space-y-6">
          <Card className="shadow-soft border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileImage className="h-5 w-5 text-primary" />
                Authorized Signature
              </CardTitle>
              <CardDescription>
                Upload an official signature image. If multiple pages, it appears on the last page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              {signature ? (
                <div className="space-y-3">
                  <div className="relative group rounded-xl border border-dashed p-4 bg-muted/40 flex items-center justify-center min-h-[140px] overflow-hidden">
                    <img
                      src={signature}
                      alt="Authorized Signature Preview"
                      className="max-h-24 object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 gap-1.5"
                      >
                        <Edit className="h-3.5 w-3.5" /> Change
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={clearSignature}
                        className="h-8 gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-center text-muted-foreground">
                    Signature will be rendered on the invoice template.
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px]"
                >
                  <FileImage className="h-8 w-8 text-muted-foreground mb-2 stroke-[1.5]" />
                  <span className="text-xs font-semibold text-foreground">Upload Signature</span>
                  <span className="text-[10px] text-muted-foreground mt-1">PNG, JPG, SVG up to 800KB</span>
                  <span className="text-[10px] text-primary/80 font-medium mt-3 border rounded-md px-2 py-0.5 bg-primary/10">
                    Manual sign space left if blank
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Invoice Design Preview */}
          <Card className="shadow-soft border-border/80 overflow-hidden">
            <div className="h-2" style={{ backgroundColor: billColor }} />
            <CardHeader className="py-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invoice Template Design
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs pb-4">
              <div className="border rounded p-3 space-y-2 bg-muted/20">
                <div className="flex justify-between items-center pb-2 border-b">
                  <div className="flex flex-col max-w-[150px]">
                    <div className="font-semibold text-foreground truncate">
                      {pharmacyName || "MediStock Pharmacy"}
                    </div>
                    {pharmacyAddress && (
                      <div className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-tight mt-0.5">
                        {pharmacyAddress}
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground">INV-0001</div>
                </div>
                {gstNumber && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    GSTIN: <span className="uppercase">{gstNumber}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span>Paracetamol 650mg x 2</span>
                    <span className="font-semibold">Rs. 30.00</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>Amoxicillin 500mg x 1</span>
                    <span className="font-semibold">Rs. 95.00</span>
                  </div>
                </div>
                <div className="border-t pt-1.5 flex justify-between font-bold text-foreground">
                  <span>Grand Total</span>
                  <span style={{ color: billColor }}>Rs. 125.00</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-3 border-t pt-6">
        <Button
          type="button"
          onClick={() => handleSave(new Event("submit") as any)}
          className="shadow-soft min-w-[120px]"
          disabled={saving}
          style={{ backgroundColor: billColor }}
        >
          {saving ? "Saving Changes…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
