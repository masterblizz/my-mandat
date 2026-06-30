export function formatNumber(value: number | string, maximumFractionDigits = 2): string {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(numericValue);
}

export function formatPercent(value: number | string, maximumFractionDigits = 2): string {
  return `${formatNumber(value, maximumFractionDigits)}%`;
}

export function formatSignedNumber(value: number, maximumFractionDigits = 2): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, maximumFractionDigits)}`;
}

export function formatSignedPercent(value: number, maximumFractionDigits = 2): string {
  return `${formatSignedNumber(value, maximumFractionDigits)}%`;
}
