export type BillingInterval = "month" | "year";

// Monthly vs. annual picker for Premium checkout. Exact prices are shown on
// Stripe's checkout page (they differ for Rebuild graduates), so this only
// states the relationship: annual = 10 months' price for 12 months.
export function BillingIntervalToggle({
  value,
  onChange,
  className = "",
}: {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
}) {
  const option = (interval: BillingInterval, label: string, sub?: string) => (
    <button
      type="button"
      onClick={() => onChange(interval)}
      aria-pressed={value === interval}
      data-testid={`button-billing-${interval}`}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        value === interval ? "bg-white text-amber-900 shadow-sm" : "text-amber-800/70 hover:text-amber-900"
      }`}
    >
      {label}
      {sub && <span className="block text-[11px] font-medium text-emerald-700">{sub}</span>}
    </button>
  );

  return (
    <div className={`flex gap-1 rounded-xl bg-amber-100/70 p-1 ${className}`} role="group" aria-label="Billing period">
      {option("month", "Monthly")}
      {option("year", "Annual", "Save 2 months")}
    </div>
  );
}
