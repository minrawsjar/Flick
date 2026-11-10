// Plain helpers, usable from server and client components alike.

export const usd = (n: number) => `$${n.toFixed(2)}`;
/** An amount in any currency, e.g. "₹801.00". */
export const money = (n: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
