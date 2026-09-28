export default function StatCard({
  label,
  value,
  tone,
  sub,
  children,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "profit" | "loss" | null;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col p-5 ${className}`}>
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span
        className={`mt-2 font-mono text-2xl font-semibold ${
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-ink"
        }`}
      >
        {value}
      </span>
      {sub && <span className="mt-1 text-xs text-muted">{sub}</span>}
      {children}
    </div>
  );
}

export function toneOf(n: number | null | undefined): "profit" | "loss" | null {
  if (!n) return null;
  return n > 0 ? "profit" : "loss";
}
