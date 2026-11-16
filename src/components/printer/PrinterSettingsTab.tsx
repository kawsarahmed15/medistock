import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  PrinterSettings,
  PrinterSettingsService,
  DEFAULT_PRINTER_SETTINGS,
  PRINT_TEMPLATES,
  getTemplateById,
  ALL_PRINT_COLUMNS,
  SAMPLE_BILL_PREVIEW,
  PaperPreset,
  WorkflowMode,
  TextDensity,
  PrintColumnKey,
} from "@/lib/printer-settings";
import {
  renderBillHtml,
  printBillDocument,
  printCalibrationSheet,
} from "@/lib/print-renderer";
import { TemplateArchetypePreview } from "./TemplateArchetypePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Printer,
  Sparkles,
  Sliders,
  Type,
  LayoutGrid,
  FileCheck2,
  FileText,
  RotateCcw,
  Save,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Check,
  Compass,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { name: "Teal (Modern)", hex: "#0a5c55" },
  { name: "MediStock Teal", hex: "#1a9890" },
  { name: "Cobalt Blue", hex: "#2563eb" },
  { name: "Dark Carbon", hex: "#18232d" },
  { name: "Slate Navy", hex: "#0f172a" },
  { name: "Emerald Green", hex: "#047857" },
  { name: "Indigo Velvet", hex: "#4f46e5" },
  { name: "Crimson Rose", hex: "#e11d48" },
];

const FONT_OPTIONS = [
  { label: "Segoe UI / Modern Sans (Recommended)", value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  { label: "Arial / Helvetica (Standard Clean)", value: "Arial, Helvetica, sans-serif" },
  { label: "Inter / System Sans (Modern Tech)", value: "'Inter', -apple-system, sans-serif" },
  { label: "Roboto (Clean Condensed)", value: "'Roboto', sans-serif" },
  { label: "Courier / Dot-Matrix (POS Receipt)", value: "'Courier New', Courier, monospace" },
];

export const PrinterSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<PrinterSettings>(() =>
    PrinterSettingsService.getSettings(),
  );
  const [kioskDialogOpen, setKioskDialogOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(85);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [isPrintingCalibration, setIsPrintingCalibration] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const activeTemplate = useMemo(
    () => getTemplateById(settings.customization.templateId),
    [settings.customization.templateId],
  );

  // Generate live preview HTML
  const previewHtml = useMemo(() => {
    return renderBillHtml(SAMPLE_BILL_PREVIEW, settings, { isSample: true });
  }, [settings]);

  // Update preview iframe
  useEffect(() => {
    if (previewIframeRef.current) {
      const doc = previewIframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  const handleSave = () => {
    PrinterSettingsService.saveSettings(settings);
    toast.success("Print & Calibration settings saved successfully!", {
      description: `Default template is set to "${activeTemplate.name}".`,
    });
  };

  const handleReset = () => {
    if (confirm("Reset all printer and format settings back to default values?")) {
      const def = PrinterSettingsService.resetToDefaults();
      setSettings(def);
      toast.info("Reset print settings to factory defaults.");
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const tmpl = getTemplateById(templateId);
    setSettings((prev) => ({
      ...prev,
      defaultTemplates: {
        ...prev.defaultTemplates,
        saleCash: templateId,
      },
      customization: {
        ...prev.customization,
        templateId,
      },
    }));
    toast.success(`Selected "${tmpl.name}" as print template.`);
  };

  const handleColumnToggle = (key: PrintColumnKey) => {
    setSettings((prev) => {
      const cur = prev.customization.columns[key];
      return {
        ...prev,
        customization: {
          ...prev.customization,
          columns: {
            ...prev.customization.columns,
            [key]: !cur,
          },
        },
      };
    });
  };

  const handleTestPrint = async () => {
    setIsPrintingTest(true);
    try {
      await printBillDocument(SAMPLE_BILL_PREVIEW, settings);
      toast.success("Test bill dispatched to printer spooler.");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger test print.");
    } finally {
      setIsPrintingTest(false);
    }
  };

  const handlePrintCalibration = async () => {
    setIsPrintingCalibration(true);
    try {
      await printCalibrationSheet(settings);
      toast.success("Calibration sheet dispatched to printer.");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger calibration print.");
    } finally {
      setIsPrintingCalibration(false);
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* ─── Top Header Card ─── */}
      <div className="bg-card border border-border/80 rounded-xl p-5 shadow-soft space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                Bill Print Engine &amp; Hardware Alignment Setup
              </h2>
              <span className="text-[11px] font-mono font-semibold bg-muted px-2 py-0.5 rounded-md border text-muted-foreground">
                v1.4 Spec • Integer Engine
              </span>
              <span className="text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                Active: {activeTemplate.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure default invoice layouts, customize colors, typography, signatures, columns, and tune printer hardware alignment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setKioskDialogOpen(true)}
              className="text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              ⚡ Kiosk Silent Print Guide
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintCalibration}
              disabled={isPrintingCalibration}
              className="text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <Compass className="h-3.5 w-3.5 text-blue-500" />
              📐 Print Calibration Sheet
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
              disabled={isPrintingTest}
              className="text-xs font-semibold gap-1.5 shadow-2xs text-primary border-primary/30 hover:bg-primary/5"
            >
              <Printer className="h-3.5 w-3.5" />
              🖨️ Test Print Current Bill
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="text-xs font-bold gap-1.5 shadow-soft"
            >
              <Save className="h-3.5 w-3.5" />
              Save Print Preferences
            </Button>
          </div>
        </div>

        {/* ─── SECTION 1: Template Selection Gallery ─── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4 text-primary" />
                1. Layout &amp; Template Selection (A5 Landscape / Dual Half-A4 / Classic A4 / Thermal)
              </h3>
              <p className="text-xs text-muted-foreground">
                Choose a bill format. Your original billing system remains 100% safe and available at any time.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {PRINT_TEMPLATES.map((tmpl) => {
              const isSelected = settings.customization.templateId === tmpl.id;
              return (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={cn(
                    "cursor-pointer rounded-xl border p-2.5 transition-all duration-200 flex flex-col justify-between gap-2 group relative bg-card",
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 shadow-soft bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30",
                  )}
                >
                  <TemplateArchetypePreview
                    archetype={tmpl.archetype}
                    color={settings.customization.primaryColor}
                    isSelected={isSelected}
                  />

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[9px] font-bold text-muted-foreground">
                        #{tmpl.number}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.25 rounded-md bg-muted text-muted-foreground font-semibold truncate">
                        {tmpl.category}
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {tmpl.name}
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                      {tmpl.description}
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {tmpl.tag.split(" ")[0]}
                    </span>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                        <Check className="h-2.5 w-2.5" /> Active
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-primary hover:underline">
                        Set Default
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Detailed Customization Controls ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/80">
          {/* A. Typography & Accent Color */}
          <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <Type className="h-4 w-4 text-primary" />
              🎨 Typography &amp; Primary Accent Color
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Font Family</Label>
              <select
                value={settings.customization.fontFamily}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    customization: { ...prev.customization, fontFamily: e.target.value },
                  }))
                }
                className="w-full text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Text Density / Size</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["compact", "regular", "comfortable"] as TextDensity[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        customization: { ...prev.customization, fontSize: d },
                      }))
                    }
                    className={cn(
                      "text-[10px] font-medium py-1 px-1.5 rounded border capitalize transition-all",
                      settings.customization.fontSize === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Primary Accent Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.name}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        customization: { ...prev.customization, primaryColor: c.hex },
                      }))
                    }
                    className={cn(
                      "h-6 w-6 rounded-md border flex items-center justify-center transition-all",
                      settings.customization.primaryColor === c.hex
                        ? "ring-2 ring-primary ring-offset-1 scale-110"
                        : "opacity-80 hover:opacity-100",
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {settings.customization.primaryColor === c.hex && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="color"
                  value={settings.customization.primaryColor}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, primaryColor: e.target.value },
                    }))
                  }
                  className="w-8 h-7 p-0.5 border rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.customization.primaryColor}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, primaryColor: e.target.value },
                    }))
                  }
                  className="font-mono text-xs h-7 uppercase"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* B. Table Columns (Show/Hide) */}
          <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="font-semibold text-xs flex items-center justify-between text-foreground">
              <span className="flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-primary" />
                📊 Invoice Table Columns
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">Show / Hide</span>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {ALL_PRINT_COLUMNS.map((col) => {
                const isChecked = col.required
                  ? true
                  : settings.customization.columns[col.key] !== false;

                return (
                  <label
                    key={col.key}
                    className={cn(
                      "flex items-center justify-between p-1.5 rounded-md text-xs cursor-pointer border transition-colors",
                      isChecked
                        ? "bg-background border-border/80 text-foreground"
                        : "bg-muted/40 border-transparent text-muted-foreground opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={col.required}
                        onChange={() => handleColumnToggle(col.key)}
                        className="rounded border-slate-300 text-primary accent-primary"
                      />
                      <span className="font-medium text-[11px]">{col.header}</span>
                    </div>
                    {col.required && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1 py-0.25 rounded">
                        Required
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* C. Signatures & Authorizations */}
          <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <FileCheck2 className="h-4 w-4 text-primary" />
              ✍️ Signatures &amp; Authorizations
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sig-pharma" className="text-[11px]">
                  Pharmacist Sign Line
                </Label>
                <Switch
                  id="sig-pharma"
                  checked={settings.customization.showPharmacistSign}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, showPharmacistSign: checked },
                    }))
                  }
                />
              </div>
              {settings.customization.showPharmacistSign && (
                <Input
                  value={settings.customization.pharmacistTitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, pharmacistTitle: e.target.value },
                    }))
                  }
                  placeholder="e.g. Registered Pharmacist"
                  className="text-xs h-7"
                />
              )}

              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="sig-auth" className="text-[11px]">
                  Authorized Signatory
                </Label>
                <Switch
                  id="sig-auth"
                  checked={settings.customization.showAuthorisedSign}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, showAuthorisedSign: checked },
                    }))
                  }
                />
              </div>
              {settings.customization.showAuthorisedSign && (
                <Input
                  value={settings.customization.authorisedTitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, authorisedTitle: e.target.value },
                    }))
                  }
                  placeholder="e.g. Authorized Signatory"
                  className="text-xs h-7"
                />
              )}

              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="sig-doc" className="text-[11px]">
                  Doctor / Prescriber Line
                </Label>
                <Switch
                  id="sig-doc"
                  checked={settings.customization.showDoctorSign}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, showDoctorSign: checked },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="sig-qr" className="text-[11px]">
                  Print QR Code (Scan to Verify)
                </Label>
                <Switch
                  id="sig-qr"
                  checked={settings.customization.showQrCode}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, showQrCode: checked },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* D. Header, Terms & Greeting */}
          <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              📄 Header &amp; Terms &amp; Greetings
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px]">Print Store DL No.</span>
                <Switch
                  checked={settings.customization.showStoreDl}
                  onCheckedChange={(c) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, showStoreDl: c },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px]">Print Store GSTIN</span>
                <Switch
                  checked={settings.customization.showStoreGstin}
                  onCheckedChange={(c) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, showStoreGstin: c },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px]">Patient &amp; Dr Strip</span>
                <Switch
                  checked={settings.customization.showPatientDoctor}
                  onCheckedChange={(c) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, showPatientDoctor: c },
                    }))
                  }
                />
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-[10px] text-muted-foreground">Invoice Terms &amp; Conditions</Label>
                <Textarea
                  value={settings.customization.termsText}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, termsText: e.target.value },
                    }))
                  }
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Footer Greeting</Label>
                <Input
                  value={settings.customization.footerGreeting}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      customization: { ...prev.customization, footerGreeting: e.target.value },
                    }))
                  }
                  placeholder="e.g. Thank you for your visit!"
                  className="text-xs h-7"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 2: Paper Preset & Formats ─── */}
        <div className="pt-4 border-t border-border/80 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            2. Paper Preset &amp; Sheet Formats
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                id: "HALF_A4_SINGLE",
                name: "Half-A4 Single (A5 Landscape)",
                desc: "Standard 210×148 mm pharmacy invoice. Fast & economic.",
              },
              {
                id: "A4_DUAL_COPY",
                name: "A4 Dual Copy (Customer + Store)",
                desc: "2 identical bills printed together on 1 A4 sheet.",
              },
              {
                id: "A4_PORTRAIT",
                name: "A4 Portrait (Full Page)",
                desc: "210×297 mm full page for large enterprise / B2B orders.",
              },
              {
                id: "THERMAL_80MM",
                name: "3-Inch Thermal Receipt (80mm)",
                desc: "Continuous roll slip format for POS thermal printers.",
              },
            ].map((preset) => {
              const isSelected = settings.paperPreset === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      paperPreset: preset.id as PaperPreset,
                      customization: {
                        ...prev.customization,
                        paperPreset: preset.id as PaperPreset,
                      },
                    }))
                  }
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-soft"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground">{preset.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{preset.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── SECTION 3: Margins & Hardware Calibration ─── */}
        <div className="pt-4 border-t border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                3. Margins &amp; Hardware Calibration Offsets (±10 mm)
              </h3>
              <p className="text-xs text-muted-foreground">
                Compensate for physical printer feed misalignments by fine-tuning X and Y offsets in millimeters.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl border border-border/80 bg-muted/20">
            {/* Margins */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-foreground">Sheet Edge Margins (mm)</div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Top</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.marginsMm.top}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        marginsMm: { ...prev.marginsMm, top: Number(e.target.value) || 0 },
                      }))
                    }
                    className="text-xs h-8 text-center font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Bottom</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.marginsMm.bottom}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        marginsMm: { ...prev.marginsMm, bottom: Number(e.target.value) || 0 },
                      }))
                    }
                    className="text-xs h-8 text-center font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Left</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.marginsMm.left}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        marginsMm: { ...prev.marginsMm, left: Number(e.target.value) || 0 },
                      }))
                    }
                    className="text-xs h-8 text-center font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Right</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.marginsMm.right}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        marginsMm: { ...prev.marginsMm, right: Number(e.target.value) || 0 },
                      }))
                    }
                    className="text-xs h-8 text-center font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Calibration Sliders */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-foreground">X Offset (Horizontal Shift):</span>
                  <span className="font-mono text-primary font-bold">
                    {settings.calibrationMm.xOffset > 0 ? `+` : ""}
                    {settings.calibrationMm.xOffset.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="-10.0"
                  max="10.0"
                  step="0.5"
                  value={settings.calibrationMm.xOffset}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      calibrationMm: {
                        ...prev.calibrationMm,
                        xOffset: parseFloat(e.target.value) || 0,
                      },
                    }))
                  }
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>-10 mm (Left)</span>
                  <span>0 mm (Center)</span>
                  <span>+10 mm (Right)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-foreground">Y Offset (Vertical Shift):</span>
                  <span className="font-mono text-primary font-bold">
                    {settings.calibrationMm.yOffset > 0 ? `+` : ""}
                    {settings.calibrationMm.yOffset.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="-10.0"
                  max="10.0"
                  step="0.5"
                  value={settings.calibrationMm.yOffset}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      calibrationMm: {
                        ...prev.calibrationMm,
                        yOffset: parseFloat(e.target.value) || 0,
                      },
                    }))
                  }
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>-10 mm (Up)</span>
                  <span>0 mm (Center)</span>
                  <span>+10 mm (Down)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 4: Cashier Workflow & Trigger Mode ─── */}
        <div className="pt-4 border-t border-border/80 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            4. Cashier Workflow &amp; Printer Destination
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Printer Name</Label>
              <Input
                value={settings.printerName}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, printerName: e.target.value }))
                }
                placeholder="e.g. HP LaserJet Pro M404"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Print Action Trigger Mode</Label>
              <select
                value={settings.workflowMode}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    workflowMode: e.target.value as WorkflowMode,
                  }))
                }
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="PREVIEW_MODAL">Interactive Virtual Preview Modal (Recommended)</option>
                <option value="DIRECT_PRINT">Direct / Silent Spooler Printing</option>
                <option value="DOWNLOAD_PDF">Direct PDF Download</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Copies per Invoice</Label>
              <Input
                type="number"
                min="1"
                max="5"
                value={settings.autoCopies}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoCopies: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* ─── Action Buttons Footer ─── */}
        <div className="pt-4 border-t border-border/80 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Factory Defaults
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            className="text-xs font-bold gap-1.5 shadow-soft"
          >
            <Save className="h-4 w-4" />
            Save Print Preferences
          </Button>
        </div>
      </div>

      {/* ─── SECTION 5: Real-Time Interactive Live Bill Preview ─── */}
      <div className="bg-card border border-border/80 rounded-xl p-5 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              📄 Real-Time Bill Preview Canvas
            </h3>
            <p className="text-xs text-muted-foreground">
              Live simulation of the printed invoice reflecting your selected template, custom columns, colors, and margins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="px-2 py-1 text-xs hover:bg-muted"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 py-0.5 text-xs font-mono font-bold text-muted-foreground">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="px-2 py-1 text-xs hover:bg-muted"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
              disabled={isPrintingTest}
              className="text-xs font-semibold gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Test Bill
            </Button>
          </div>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-900/50 rounded-xl p-4 overflow-x-auto flex justify-center border border-border/60">
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease",
            }}
            className="shadow-lg rounded-md overflow-hidden bg-white border border-slate-300"
          >
            <iframe
              ref={previewIframeRef}
              title="Bill Live Preview"
              className="border-0 bg-white"
              style={{
                width: settings.paperPreset === "THERMAL_80MM" ? "320px" : "800px",
                height:
                  settings.paperPreset === "A4_PORTRAIT" ||
                  settings.customization.templateId === "tmpl-original-a4" ||
                  settings.paperPreset === "A4_DUAL_COPY"
                    ? "1120px"
                    : "570px",
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── KIOSK SILENT PRINT GUIDE MODAL ─── */}
      <Dialog open={kioskDialogOpen} onOpenChange={setKioskDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              ⚡ Kiosk Silent Printing Setup Guide
            </DialogTitle>
            <DialogDescription>
              How to configure automatic instant printing without showing the browser print dialog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs leading-relaxed text-muted-foreground pt-2">
            <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1.5">
              <div className="font-semibold text-foreground">Option 1: Chrome / Edge Silent Kiosk Flag</div>
              <p>Launch Chrome or Microsoft Edge with the following command-line flags on your POS terminal:</p>
              <div className="bg-slate-900 text-slate-100 font-mono text-[11px] p-2.5 rounded-md overflow-x-auto">
                chrome.exe --kiosk --kiosk-printing "https://medistock.teklin.in"
              </div>
              <p className="text-[11px]">
                When <code className="text-foreground">--kiosk-printing</code> is enabled, any bill print immediately bypasses the system print confirmation and sends straight to your default printer spooler.
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1.5">
              <div className="font-semibold text-foreground">Option 2: Browser Print Preview Workflow</div>
              <p>
                If you prefer to preview before printing, keep the <strong>"Interactive Virtual Preview Modal"</strong> trigger enabled in Section 4. This provides a crystal clear preview, allows quick template switching, and prints on confirmation.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => setKioskDialogOpen(false)}>
                Got It
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
