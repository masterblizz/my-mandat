// Party colours may be CSS variables (var(--cyan)) or rgb(); Godot and
// hex-alpha suffixes need a plain #rrggbb.

// Godot only reads hex colours; party colours may be CSS variables or rgb().
export function resolveColor(value: string): string {
  if (typeof window === "undefined" || value.startsWith("#")) return value;
  let css = value;
  const v = value.match(/^var\((--[\w-]+)\)$/);
  if (v) css = getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim() || value;
  if (css.startsWith("#")) return css;
  const probe = document.createElement("span");
  probe.style.color = css;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+/g);
  probe.remove();
  if (!rgb || rgb.length < 3) return value;
  return "#" + rgb.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

/** The colour with an alpha, valid for CSS whatever form the colour takes. */
export function withAlpha(value: string, alpha: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, alpha)) * 100);
  return `color-mix(in srgb, ${value} ${pct}%, transparent)`;
}
