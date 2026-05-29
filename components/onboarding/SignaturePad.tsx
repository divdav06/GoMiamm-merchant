"use client";

import { useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

// Browser-only wrapper around react-signature-canvas. ContractStep
// loads this module via next/dynamic with ssr:false, which keeps
// `react-signature-canvas` (and its `window`/`document` references in
// the UMD bundle) entirely off the server-render path.
//
// Why a callback instead of forwardRef: next/dynamic does NOT forward
// refs to the lazy-loaded component in Next.js 14. Wrapping with a
// separate forwardRef bridge works but adds two layers; passing the
// imperative handle out via an `onReady` callback is one layer with
// the same ergonomics and types correctly through dynamic without a
// cast.

export type SignaturePadHandle = {
  clear: () => void;
  toDataURL: (type?: string) => string;
  isEmpty: () => boolean;
};

type Props = {
  penColor?: string;
  onEnd?: () => void;
  onReady: (handle: SignaturePadHandle) => void;
  canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
};

export default function SignaturePad({
  penColor = "#111827",
  onEnd,
  onReady,
  canvasProps,
}: Props) {
  const sigRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    // Hand the parent a stable handle once on mount. The underlying
    // SignatureCanvas ref doesn't change identity after the canvas
    // mounts, so the wrapped methods stay valid for the component's
    // lifetime.
    onReady({
      clear: () => sigRef.current?.clear(),
      toDataURL: (type = "image/png") => sigRef.current?.toDataURL(type) ?? "",
      isEmpty: () => sigRef.current?.isEmpty() ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SignatureCanvas
      ref={(r) => {
        sigRef.current = r;
      }}
      penColor={penColor}
      onEnd={onEnd}
      canvasProps={canvasProps}
    />
  );
}
