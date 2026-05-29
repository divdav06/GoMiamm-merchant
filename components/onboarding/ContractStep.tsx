"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

// Phase F.6 — Contract signing step. Renders a short summary of the
// counterparty info gathered so far (business + operations), the legal
// acceptances, and a signature canvas. On submit the parent action
// POSTs to the existing `restaurant-sign-contract` edge function which
// generates the executed PDF (cover page + embedded terms + signature
// page with both parties' signatures), uploads it to the
// restaurant-contracts private bucket, and returns the signed path.
//
// react-signature-canvas (signature_pad under the hood) handles DPR
// scaling on the underlying <canvas>; we use fixed pixel dimensions so
// the saved data-URL is consistent across screen densities.

export type SignContractInput = {
  signer_printed_name: string;
  signer_title: string;
  signature_data_url: string;
  accepted_esign: boolean;
  accepted_authority: boolean;
  accepted_information_correct: boolean;
};

type CounterpartySummary = {
  legal_name: string;
  dba: string;
  address: string;
  phone: string;
  tax_id: string;
  cuisine_type: string;
  email: string;
};

type Props = {
  summary: CounterpartySummary;
  onSubmit: (data: SignContractInput) => Promise<void>;
};

export function ContractStep({ summary, onSubmit }: Props) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [esign, setEsign] = useState(false);
  const [authority, setAuthority] = useState(false);
  const [infoCorrect, setInfoCorrect] = useState(false);
  // hasDrawn flips on the first stroke-end and powers the submit gate.
  // Resets when the user hits Clear so a half-signed form can't ship.
  const [hasDrawn, setHasDrawn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    signerName.trim() !== "" &&
    signerTitle.trim() !== "" &&
    esign &&
    authority &&
    infoCorrect &&
    hasDrawn &&
    !busy;

  function onClear() {
    sigRef.current?.clear();
    setHasDrawn(false);
  }

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const dataUrl = sigRef.current?.toDataURL("image/png");
    if (!dataUrl) {
      setError("Please sign in the box before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        signer_printed_name: signerName.trim(),
        signer_title: signerTitle.trim(),
        signature_data_url: dataUrl,
        accepted_esign: esign,
        accepted_authority: authority,
        accepted_information_correct: infoCorrect,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onFormSubmit}
      className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sign your partner contract</h2>
        <p className="text-sm text-gray-500 mt-1">
          The executed PDF is delivered to your email and stored under your store profile.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Counterparty summary — what gets baked into the contract cover page */}
      <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Counterparty information
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <SummaryRow label="Legal name" value={summary.legal_name} />
          <SummaryRow label="DBA" value={summary.dba || "—"} />
          <SummaryRow label="Address" value={summary.address} />
          <SummaryRow label="Phone" value={summary.phone} />
          <SummaryRow label="Tax ID" value={summary.tax_id} />
          <SummaryRow label="Cuisine" value={summary.cuisine_type || "—"} />
          <SummaryRow label="Email" value={summary.email} />
        </dl>
      </section>

      {/* Plain-language terms summary. The full contract pages are appended
          inside the generated PDF by the edge function. */}
      <section className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-700 leading-relaxed">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Key terms
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>GoMiamm collects orders, dispatches drivers, and remits net revenue to you.</li>
          <li>Standard commission rate: 12% of order subtotal (changes notified in writing).</li>
          <li>Weekly payouts every Monday at 04:00 UTC to your connected Stripe account.</li>
          <li>You retain ownership of your menu, brand, and customer relationship.</li>
          <li>Either party may terminate with 30 days&apos; written notice.</li>
        </ul>
      </section>

      {/* Signer identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Signer name" required>
          <input
            type="text"
            required
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Your full name"
            className={INPUT_CLS}
            autoComplete="name"
          />
        </Field>
        <Field label="Title" required>
          <input
            type="text"
            required
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
            placeholder="Owner, Manager, CFO…"
            className={INPUT_CLS}
            autoComplete="organization-title"
          />
        </Field>
      </div>

      {/* Signature pad */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Signature
            <span className="text-brand ml-0.5">*</span>
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
        <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
          <SignatureCanvas
            ref={(ref) => {
              sigRef.current = ref;
            }}
            penColor="#111827"
            onEnd={() => setHasDrawn(true)}
            canvasProps={{
              width: 600,
              height: 180,
              className: "w-full h-44 touch-none",
              "aria-label": "Signature pad",
            }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Draw with your mouse, trackpad, or finger. Clear and re-sign if you make a mistake.
        </p>
      </div>

      {/* Legal acceptances */}
      <div className="space-y-2.5">
        <Checkbox
          checked={esign}
          onChange={setEsign}
          label="I consent to sign electronically (E-SIGN Act)."
        />
        <Checkbox
          checked={authority}
          onChange={setAuthority}
          label="I have authority to bind this business to the agreement."
        />
        <Checkbox
          checked={infoCorrect}
          onChange={setInfoCorrect}
          label="The information above is accurate and current."
        />
      </div>

      <div className="flex items-center justify-end pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Signing…" : "Sign & complete onboarding"}
        </button>
      </div>
    </form>
  );
}

const INPUT_CLS =
  "w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
        {required && <span className="text-brand ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
      <dd className="text-gray-900 break-words">{value}</dd>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
      />
      <span>{label}</span>
    </label>
  );
}
