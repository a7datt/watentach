import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    readerRef.current = codeReader;

    if (videoRef.current) {
      codeReader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, err) => {
          if (result) {
            onScan(result.getText());
            codeReader.reset();
            onClose();
          }
        }
      ).catch(console.error);
    }

    return () => {
      codeReader.reset();
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div 
        className="relative w-full max-w-[400px] bg-white rounded-2xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <h3 className="font-bold text-lg">مسح الباركود</h3>
          <button onClick={onClose} className="text-danger font-bold px-4 py-1 bg-red-50 rounded-lg">إلغاء</button>
        </div>
        <div className="relative aspect-square bg-black overflow-hidden">
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover" 
            autoPlay 
            playsInline 
            muted 
          />
          {/* Scanner Overlay UI */}
          <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none z-10 w-full h-full box-border"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-1/2 border-2 border-green-500 rounded-lg pointer-events-none z-20"></div>
        </div>
        <div className="p-4 text-center text-sm text-gray-500 bg-white">
          قم بتوجيه الكاميرا نحو الباركود
        </div>
      </div>
    </div>
  );
}
