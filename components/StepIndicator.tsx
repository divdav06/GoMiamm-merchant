"use client";

// Onboarding step bar — 4 phases the merchant walks through. Source of
// truth for the status → step number mapping lives here so future
// callers (e.g. an "Resume where you left off" CTA on the dashboard
// home) can import the same `currentStepFor()` helper.

export type OnboardingStatus =
  | "not_started"
  | "business_info"
  | "operations"
  | "banking"
  | "contract_pending"
  | "completed";

type Step = { num: 1 | 2 | 3 | 4; key: "business" | "operations" | "banking" | "contract" };
const STEP_KEYS: Step[] = [
  { num: 1, key: "business" },
  { num: 2, key: "operations" },
  { num: 3, key: "banking" },
  { num: 4, key: "contract" },
];

export type StepLabels = {
  business: string;
  operations: string;
  banking: string;
  contract: string;
};

const DEFAULT_LABELS: StepLabels = {
  business: "Business",
  operations: "Operations",
  banking: "Banking",
  contract: "Contract",
};

// Phase F.2 mapping (per spec):
//   not_started + business_info → step 1 (Business)
//   operations                  → step 2 (Operations)
//   banking                     → step 3 (Banking)
//   contract_pending            → step 4 (Contract)
//   completed                   → 5 (past the end; nothing "current")
export function currentStepFor(status: OnboardingStatus): number {
  switch (status) {
    case "not_started":
    case "business_info":
      return 1;
    case "operations":
      return 2;
    case "banking":
      return 3;
    case "contract_pending":
      return 4;
    case "completed":
      return 5;
  }
}

type Tone = "complete" | "current" | "upcoming";
function toneFor(stepNum: number, current: number): Tone {
  if (stepNum < current) return "complete";
  if (stepNum === current) return "current";
  return "upcoming";
}

export function StepIndicator({
  status,
  copy,
}: {
  status: OnboardingStatus;
  copy?: StepLabels;
}) {
  const current = currentStepFor(status);
  const labels = copy ?? DEFAULT_LABELS;

  return (
    <ol className="flex items-center">
      {STEP_KEYS.map((s, idx) => {
        const tone = toneFor(s.num, current);
        const isLast = idx === STEP_KEYS.length - 1;
        return (
          <li key={s.num} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex items-center gap-2 shrink-0">
              <Circle tone={tone} num={s.num} />
              <span
                className={[
                  "text-sm",
                  tone === "current" ? "text-brand font-semibold" :
                  tone === "complete" ? "text-gray-900 font-medium" :
                  "text-gray-400 font-medium",
                ].join(" ")}
              >
                {labels[s.key]}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden="true"
                className={`h-px mx-3 flex-1 ${s.num < current ? "bg-brand" : "bg-gray-200"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Circle({ tone, num }: { tone: Tone; num: number }) {
  if (tone === "complete") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
    );
  }
  if (tone === "current") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white text-xs font-bold shadow-sm">
        {num}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold border border-gray-200">
      {num}
    </span>
  );
}
