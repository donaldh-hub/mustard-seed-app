// Single source of truth for the product's display name. Trademark clearance
// on the final brand is still pending — never hardcode a name string
// anywhere else in the app; import PRODUCT_NAME instead.
export const PRODUCT_NAME = process.env.BILL_ADVOCACY_PRODUCT_NAME || "Health Billing Advocacy";

// Contingency fee range agreed with the client, as a percent of confirmed
// savings. The actual rate for a given case lives on billAdvocacyCases.feePercentAgreed.
export const CONTINGENCY_FEE_MIN_PERCENT = 20;
export const CONTINGENCY_FEE_MAX_PERCENT = 35;
