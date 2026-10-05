import { useState } from "react";
import { Loader2, AlertCircle, Sprout, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { PRICING, formatUsd, rebuildGradAnnualCents, standardAnnualCents } from "@shared/pricing";

const INCLUDED = [
  "7 guided days, one Heartbeat at a time",
  "A video each day, voiced by Jai",
  "Jai's personal reflection on your answers",
  "Your own saved Actionable Goal Plan on Day 7",
];

// Shown on the Rebuild overview until the one-time purchase clears.
// Explains the price and the graduate discount on Premium.
export function RebuildPurchaseCard({
  userId,
  purchaseAvailable,
  confirming,
}: {
  userId: string;
  purchaseAvailable: boolean;
  confirming: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlySavings = PRICING.standardMonthlyCents - PRICING.rebuildGradMonthlyCents;

  const handleBuy = async () => {
    setError(null);
    setLoading(true);
    try {
      const { url } = await api.createRebuildCheckout(userId);
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Could not start checkout. Please try again.");
      setLoading(false);
    }
  };

  if (confirming) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-3" data-testid="rebuild-purchase-confirming">
        <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
        <p className="text-sm text-foreground">Confirming your payment… this usually takes a few seconds.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm space-y-4" data-testid="rebuild-purchase-card">
      <div>
        <p className="font-serif text-lg font-bold text-foreground">Start your 7-Day Rebuild</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          <span className="font-semibold text-foreground">{formatUsd(PRICING.rebuildProgramCents)}</span> one time. No subscription needed.
        </p>
      </div>

      <div className="space-y-1.5">
        {INCLUDED.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-1.5" data-testid="rebuild-graduate-rate">
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 text-amber-700" />
          <p className="text-sm font-semibold text-amber-900">Finish all 7 days, unlock the graduate rate</p>
        </div>
        <p className="text-xs text-amber-900/80 leading-relaxed">
          Rebuild graduates get Premium for{" "}
          <span className="font-semibold">{formatUsd(PRICING.rebuildGradMonthlyCents)}/month</span> instead of{" "}
          {formatUsd(PRICING.standardMonthlyCents)}. That's {formatUsd(monthlySavings)} off every month. On annual, it's{" "}
          <span className="font-semibold">{formatUsd(rebuildGradAnnualCents)}/year</span> instead of {formatUsd(standardAnnualCents)}.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {purchaseAvailable ? (
        <Button
          className="w-full rounded-full h-12 text-base font-bold disabled:opacity-60"
          style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)", color: "#1a1a1a" }}
          onClick={handleBuy}
          disabled={loading}
          data-testid="button-buy-rebuild"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Starting checkout…
            </>
          ) : (
            `Start the Rebuild — ${formatUsd(PRICING.rebuildProgramCents)}`
          )}
        </Button>
      ) : (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">The Rebuild opens for purchase soon. Check back shortly.</p>
        </div>
      )}
    </div>
  );
}
