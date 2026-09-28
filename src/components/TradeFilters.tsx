"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { TAG_CATEGORIES, type Tag } from "@/lib/types";

export default function TradeFilters({ symbols, tags }: { symbols: string[]; tags: Tag[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`?${next.toString()}`, { scroll: false });
  };
  const active = ["symbol", "from", "to", "outcome", "direction", "tag"].some((k) => sp.get(k));

  return (
    <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      <Select label="Symbol" value={sp.get("symbol") ?? ""} onChange={(v) => update("symbol", v)}>
        <option value="">All symbols</option>
        {symbols.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <div>
        <span className="label">From</span>
        <input type="date" className="input" value={sp.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} />
      </div>
      <div>
        <span className="label">To</span>
        <input type="date" className="input" value={sp.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} />
      </div>
      <Select label="Outcome" value={sp.get("outcome") ?? ""} onChange={(v) => update("outcome", v)}>
        <option value="">Wins &amp; losses</option>
        <option value="win">Wins</option>
        <option value="loss">Losses</option>
        <option value="breakeven">Breakeven</option>
      </Select>
      <Select label="Direction" value={sp.get("direction") ?? ""} onChange={(v) => update("direction", v)}>
        <option value="">Long &amp; short</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </Select>
      <Select label="Tag" value={sp.get("tag") ?? ""} onChange={(v) => update("tag", v)}>
        <option value="">Any tag</option>
        {TAG_CATEGORIES.map(({ key, label }) => (
          <optgroup key={key} label={label}>
            {tags
              .filter((t) => t.category === key)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
      {active && (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            const next = new URLSearchParams();
            for (const k of ["sort", "dir"]) if (sp.get(k)) next.set(k, sp.get(k)!);
            router.replace(`?${next.toString()}`, { scroll: false });
          }}
        >
          <X className="size-4" /> Clear
        </button>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <select className="input min-w-36" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}
