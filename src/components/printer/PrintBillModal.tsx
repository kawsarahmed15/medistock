import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PrinterSettings,
  PrinterSettingsService,
  PRINT_TEMPLATES,
  getTemplateById,
  PaperPreset,
} from "@/lib/printer-settings";
import { renderBillHtml, printBillDocument } from "@/lib/print-renderer";
import { downloadBillPdf } from "@/lib/bill-pdf";
import { Printer, Download, Eye, X, ZoomIn, ZoomOut, Check, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PrintBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: any;
  initialTemplateId?: string;
  pharmacyInfo?: {
    pharmacyName?: string;
    pharmacyPhone?: string;
    pharmacyAddress?: string;
    gstNumber?: string;
    drugLicNo?: string;
    billColor?: string;
    signature?: string;
  };
}

export const PrintBillModal: React.FC<PrintBillModalProps> = ({
  isOpen,
  onClose,
  bill,
  initialTemplateId,
  pharmacyInfo,
}) => {
  const [baseSettings, setBaseSettings] = useState<PrinterSettings>(() =>
    PrinterSettingsService.getSettings(),
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplateId || baseSettings.customization.templateId || "tmpl-ref-2-modern-ledger",
  );

  const [paperPreset, setPaperPreset] = useState<PaperPreset>(
    baseSettings.paperPreset || "HALF_A4_SINGLE",
  );

  const [copies, setCopies] = useState<number>(baseSettings.autoCopies || 1);
  const [zoom, setZoom] = useState<number>(85);
  const [isPrinting, setIsPrinting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Merge bill with pharmacy info if needed
  const enrichedBill = useMemo(() => {
    if (!bill) return null;
    return {
      ...bill,
      pharmacyName: pharmacyInfo?.pharmacyName || bill.pharmacyName,
      pharmacyPhone: pharmacyInfo?.pharmacyPhone || bill.pharmacyPhone,
      pharmacyAddress: pharmacyInfo?.pharmacyAddress || bill.pharmacyAddress,
      pharmacyGstNumber: pharmacyInfo?.gstNumber || bill.pharmacyGstNumber,
      pharmacyDrugLicNo: pharmacyInfo?.drugLicNo || bill.pharmacyDrugLicNo,
    };
  }, [bill, pharmacyInfo]);

  // Combined settings for this preview session
  const activeSettings = useMemo<PrinterSettings>(() => {
    return {
      ...baseSettings,
      paperPreset,
      customization: {
        ...baseSettings.customization,
        templateId: selectedTemplateId,
        paperPreset,
        primaryColor: pharmacyInfo?.billColor || baseSettings.customization.primaryColor,
      },
    };
  }, [baseSettings, selectedTemplateId, paperPreset, pharmacyInfo]);

  const htmlContent = useMemo(() => {
    if (!enrichedBill) return "";
    return renderBillHtml(enrichedBill, activeSettings, { copies });
  }, [enrichedBill, activeSettings, copies]);

  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [htmlContent]);

  if (!bill) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printBillDocument(enrichedBill, activeSettings);
      toast.success("Bill sent to printer spooler.");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger print.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadOriginalPdf = () => {
    try {
      void downloadBillPdf(enrichedBill, {
        pharmacyName: pharmacyInfo?.pharmacyName,
        pharmacyPhone: pharmacyInfo?.pharmacyPhone,
        pharmacyAddress: pharmacyInfo?.pharmacyAddress,
        gstNumber: pharmacyInfo?.gstNumber,
        drugLicNo: pharmacyInfo?.drugLicNo,
        billColor: pharmacyInfo?.billColor,
        signature: pharmacyInfo?.signature,
        print: false,
      });
      toast.success("Original PDF downloaded.");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="px-5 py-3 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Print Invoice &amp; Template Selector</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                  {bill.number}
                </span>
              </DialogTitle>
              <div className="text-xs text-muted-foreground">
                Select your desired bill format or print using the original standard layout.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadOriginalPdf}
              className="text-xs gap-1.5 shadow-2xs"
              title="Download using original standard layout"
            >
              <Download className="h-3.5 w-3.5" />
              Original Classic PDF
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="text-xs font-bold gap-1.5 shadow-soft"
            >
              <Printer className="h-3.5 w-3.5" />
              {isPrinting ? "Printing..." : "Print Bill"}
            </Button>
          </div>
        </DialogHeader>

        {/* Toolbar Controls */}
        <div className="px-5 py-2.5 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Template Selector */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Format:</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="text-xs font-semibold rounded-md border border-input bg-background px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                {PRINT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.number} {t.name} ({t.tag.split(" ")[0]})
                  </option>
                ))}
              </select>
            </div>

            {/* Paper Preset Selector */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Paper:</span>
              <select
                value={paperPreset}
                onChange={(e) => setPaperPreset(e.target.value as PaperPreset)}
                className="text-xs font-semibold rounded-md border border-input bg-background px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="HALF_A4_SINGLE">Half A4 (A5 Landscape)</option>
                <option value="A4_DUAL_COPY">A4 Dual Copy (2 on 1 Page)</option>
                <option value="A4_PORTRAIT">Full A4 Portrait</option>
                <option value="THERMAL_80MM">3-Inch Thermal Receipt (80mm)</option>
              </select>
            </div>

            {/* Copies */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Copies:</span>
              <input
                type="number"
                min="1"
                max="5"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-12 text-xs text-center font-mono rounded border border-input bg-background py-1"
              />
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md overflow-hidden bg-background shadow-2xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="px-2 py-1 text-xs hover:bg-muted"
                title="Zoom Out"
              >
                <ZoomOut className="h-3 w-3" />
              </button>
              <span className="px-2 text-xs font-mono font-bold text-muted-foreground">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(130, z + 10))}
                className="px-2 py-1 text-xs hover:bg-muted"
                title="Zoom In"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex-1 overflow-auto bg-slate-200/70 dark:bg-slate-950 p-6 flex justify-center items-start">
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease",
            }}
            className="shadow-2xl rounded-md overflow-hidden bg-white border border-slate-300"
          >
            <iframe
              ref={iframeRef}
              title="Print Document Preview"
              className="border-0 bg-white"
              style={{
                width: paperPreset === "THERMAL_80MM" ? "320px" : "800px",
                height:
                  paperPreset === "A4_PORTRAIT" ||
                  selectedTemplateId === "tmpl-original-a4" ||
                  paperPreset === "A4_DUAL_COPY"
                    ? "1120px"
                    : "570px",
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
