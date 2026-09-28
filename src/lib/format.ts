export function money(n: number | null | undefined, opts: { sign?: boolean; cents?: boolean } = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const { sign = false, cents = true } = opts;
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  if (n < 0) return `-$${abs}`;
  return `${sign && n > 0 ? "+" : ""}$${abs}`;
}

/** Compact money for tight spaces: +$1.2k */
export function moneyShort(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : abs.toFixed(0);
  return `${n < 0 ? "-" : n > 0 ? "+" : ""}$${s}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function pnlColor(n: number | null | undefined): string {
  if (!n) return "text-ink-2";
  return n > 0 ? "text-profit" : "text-loss";
}

export function price(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** "2025-06-03T09:44:18" -> "Jun 3, 2025 9:44 AM" (no timezone conversion). */
export function dateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const [d, t = "00:00"] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const dt = new Date(y, m - 1, day, hh, mm);
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function dateOnly(s: string): string {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function duration(from: string, to: string | null): string {
  if (!to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
