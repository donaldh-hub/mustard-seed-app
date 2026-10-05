import { Sprout } from "lucide-react";
import { PRICING, formatUsd, rebuildGradAnnualCents } from "@shared/pricing";

// Shown to Rebuild graduates wherever they can subscribe. Graduates only
// ever see their own rate. The standard price is intentionally not shown.
export function GraduateRateNote({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-amber-50 border border-amber-200 p-3 text-left ${className}`} data-testid="graduate-rate-note">
      <div className="flex items-center gap-2">
        <Sprout className="w-4 h-4 text-amber-700 shrink-0" />
        <p className="text-sm font-semibold text-amber-900">Your Rebuild graduate rate</p>
      </div>
      <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
        <span className="font-semibold">{formatUsd(PRICING.rebuildGradMonthlyCents)}/month</span> or{" "}
        <span className="font-semibold">{formatUsd(rebuildGradAnnualCents)}/year</span>. It's saved to your account,
        so it's yours whenever you're ready.
      </p>
    </div>
  );
}
