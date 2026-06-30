import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Keyboard } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
};

export function SkuScanner({ open, onOpenChange, onDetected }: Props) {
  const containerId = "sku-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [manual, setManual] = useState("");

  const pickPreferredCamera = async () => {
    const cameras = await Html5Qrcode.getCameras();
    if (cameras.length === 0) {
      throw new DOMException("No camera was found on this device.", "NotFoundError");
    }

    const preferred = cameras.find((camera) => {
      const label = camera.label.toLowerCase();
      return (
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("environment") ||
        label.includes("triple") ||
        label.includes("wide")
      );
    });

    return preferred?.id ?? cameras[0].id;
  };

  // Cleanup on unmount or when closed
  useEffect(() => {
    if (!open) {
      void stopScanner();
      setError(null);
      setRunning(false);
      setStarting(false);
      setManual("");
    }
    return () => {
      // Ensure we stop the camera if the component unmounts
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopScanner = async () => {
    const s = scannerRef.current;
    if (!s) return;
    scannerRef.current = null;
    try {
      if (s.isScanning) {
        await s.stop();
      }
      await s.clear();
    } catch (e) {
      console.warn("Scanner stop/clear error:", e);
    }
  };

  // Must be invoked DIRECTLY from a user click for browsers to allow camera.
  const startScanner = async () => {
    if (running || starting) return;
    setError(null);

    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setError(
        "Camera needs HTTPS. Open the site over https:// (or use the manual entry below).",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser doesn't support camera access. Type the HSN manually below.",
      );
      return;
    }

    setStarting(true);
    try {
      const cameraId = await pickPreferredCamera();

      // Ensure container exists
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error("Scanner container not found");
      }

      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 240, height: 140 } },
        (decoded) => {
          onDetected(decoded.trim());
          void stopScanner();
          onOpenChange(false);
        },
        () => {
          /* per-frame failures ignored */
        },
      );
      setRunning(true);
    } catch (e) {
      const err = e as DOMException & { name?: string; message?: string };
      let msg = err?.message || "Unable to start camera.";
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        msg =
          "Camera permission was blocked. Click the lock icon in the address bar → Site settings → Allow Camera, then try again.";
      } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
        msg = "No camera was found on this device.";
      } else if (err?.name === "NotReadableError") {
        msg = "Another app is using the camera. Close it and retry.";
      } else if (msg.includes("Unable to access camera")) {
        msg =
          "Camera could not start in this browser. Allow camera access, then tap Start camera again. If it still fails, use the manual HSN entry below.";
      }
      setError(msg);
      void stopScanner();
    } finally {
      setStarting(false);
    }
  };

  const submitManual = () => {
    const v = manual.trim();
    if (!v) return;
    onDetected(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Scan HSN / barcode
          </DialogTitle>
          <DialogDescription>
            Point the camera at the product barcode. We&apos;ll auto-fill the HSN
            and match an existing product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 
            ISOLATION: The div with containerId is kept EMPTY so React doesn't manage its children.
            This prevents "NotFoundError: Failed to execute 'removeChild' on 'Node'" 
            when html5-qrcode and React both try to manipulate the same DOM nodes.
          */}
          <div className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center border">
            {/* Force centering of injected video and canvas elements */}
            <style>
              {`
                #${containerId} {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                }
                #${containerId} video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                }
                #${containerId} canvas {
                  position: absolute !important;
                  left: 50% !important;
                  top: 50% !important;
                  transform: translate(-50%, -50%) !important;
                }
              `}
            </style>
            <div
              id={containerId}
              className="absolute inset-0 w-full h-full"
            />
            
            {!running && !starting && (
              <Button
                type="button"
                onClick={() => void startScanner()}
                className="shadow-soft z-10"
              >
                <Camera className="h-4 w-4" /> Start camera
              </Button>
            )}
            
            {starting && (
              <div className="text-xs text-muted-foreground animate-pulse z-10">
                Requesting camera…
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2 leading-relaxed">
              {error}
            </div>
          )}

          {/* Always-available fallback so users are never stuck */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" /> Or enter HSN manually
            </div>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Type or paste HSN / barcode"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitManual();
                  }
                }}
              />
              <Button
                type="button"
                onClick={submitManual}
                disabled={!manual.trim()}
              >
                Use
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
