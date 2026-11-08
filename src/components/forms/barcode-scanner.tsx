"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrowserPermissionDenied } from "@/components/states/permission-denied";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts?: { formats?: string[] }) => Detector;

/**
 * Camera barcode scan (state 7a). If the camera is blocked or the browser has no BarcodeDetector,
 * explains why and falls back to typing the code.
 */
export function BarcodeScanner({ open, onOpenChange, onCode }: { open: boolean; onOpenChange: (o: boolean) => void; onCode: (code: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = React.useState(false);
  const [unsupported, setUnsupported] = React.useState(false);
  const [manual, setManual] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

    async function start() {
      if (!Ctor) {
        setUnsupported(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setDenied(true);
        return;
      }
      const v = videoRef.current;
      if (!v || stopped) return;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const detector = new Ctor({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "qr_code"] });
      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found[0]?.rawValue) {
            onCode(found[0].rawValue);
            onOpenChange(false);
            return;
          }
        } catch {
          /* frame not ready */
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onCode, onOpenChange]);

  const manualEntry = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (manual.trim()) {
          onCode(manual.trim());
          setManual("");
          onOpenChange(false);
        }
      }}
      className="flex gap-2"
    >
      <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type the barcode or SKU" aria-label="Barcode or SKU" autoFocus={denied || unsupported} />
      <Button type="submit" variant="primary">
        Use
      </Button>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Scan barcode" description="Point the camera at the barcode on the product.">
        {denied ? (
          <BrowserPermissionDenied kind="camera">{manualEntry}</BrowserPermissionDenied>
        ) : unsupported ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted">This browser cannot read barcodes from the camera. Use Chrome on Android or a USB barcode scanner, or type the code.</p>
            {manualEntry}
          </div>
        ) : (
          <div className="space-y-3">
            <video ref={videoRef} muted playsInline className="aspect-video w-full rounded border border-line bg-ink/10 object-cover" />
            <p className="text-xs text-muted">Or type it:</p>
            {manualEntry}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
