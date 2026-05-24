import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from '@phosphor-icons/react';

export function ISBNScannerModal({ isOpen, onClose, onScan }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "isbn-reader",
      { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Stop scanning upon success
        scanner.clear();
        onScan(decodedText);
      },
      (error) => {
        // Ignore normal scan failures (happens every frame when no barcode is found)
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-background-secondary border border-foreground-tertiary/20 shadow-xl rounded-none relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-foreground-tertiary hover:text-foreground z-10"
        >
          <X size={24} weight="thin" />
        </button>
        <div className="p-6">
          <h3 className="text-xl font-serif text-foreground mb-4 text-center">Scan Barcode</h3>
          <p className="text-sm text-foreground-tertiary font-sans text-center mb-6">
            Point your camera at the ISBN barcode on the back of the book.
          </p>
          <div id="isbn-reader" className="w-full overflow-hidden border border-foreground-tertiary/20"></div>
        </div>
      </div>
    </div>
  );
}
