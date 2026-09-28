"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
import { importTradingView, type ImportResult } from "@/app/actions";
import { parseTradingViewCsv, type ParseResult } from "@/lib/tradingview";
import { dateTime, money, pnlColor, price } from "@/lib/format";
import type { Tag } from "@/lib/types";

export default function ImportPanel({ tags }: { tags: Tag[] }) {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [tagId, setTagId] = useState("");
  const [pending, startTransition] = useTransition();

  const load = async (file: File | undefined) => {
    if (!file) return;
    const t = await file.text();
    setText(t);
    setFileName(file.name);
    setPreview(parseTradingViewCsv(t));
    setResult(null);
  };

  const total = preview?.trades.reduce((a, t) => a + t.pnl, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="card p-5 sm:p-6">
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted transition hover:border-accent hover:text-ink-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            load(e.dataTransfer.files[0]);
          }}
        >
          <FileUp className="size-6" />
          <span>{fileName || "Drop your TradingView CSV here, or click to choose a file"}</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
        </label>

        <details className="mt-4 text-sm text-muted">
          <summary className="cursor-pointer text-ink-2">How to export from TradingView</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Open the Trading Panel at the bottom of the chart and select <b>Paper Trading</b>.</li>
            <li>
              Go to the <b>History</b> tab (filled orders) — recommended, since it has exact entry and exit times.
              The <b>Account History</b> tab also works but only has close times.
            </li>
            <li>Click the export / download icon at the right of the panel and save the CSV.</li>
            <li>Drop it here. Re-importing the same or an overlapping file is safe — duplicates are skipped.</li>
          </ol>
        </details>
      </div>

      {result && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            result.error ? "border-loss/40 bg-loss/10 text-loss" : "border-profit/40 bg-profit/10 text-profit"
          }`}
        >
          {result.error ? <AlertTriangle className="mt-0.5 size-4" /> : <CheckCircle2 className="mt-0.5 size-4" />}
          <div>
            {result.error ?? (
              <>
                Imported {result.imported} trade{result.imported === 1 ? "" : "s"}
                {result.duplicates > 0 && `, skipped ${result.duplicates} already in your journal`}.{" "}
                <Link href="/journal" className="underline">View journal →</Link>
              </>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-2">
                Preview · {preview.trades.length} trade{preview.trades.length === 1 ? "" : "s"}
                {preview.format !== "unknown" && (
                  <span className="ml-2 text-muted">({preview.format === "orders" ? "order history" : "account history"} format)</span>
                )}
              </h2>
              {preview.trades.length > 0 && (
                <p className="mt-1 text-sm text-muted">
                  Net <span className={pnlColor(total)}>{money(total, { sign: true })}</span>
                </p>
              )}
            </div>
            {preview.trades.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="input w-auto">
                  <option value="">No tag</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      Tag all: {t.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-primary"
                  disabled={pending || !text}
                  onClick={() =>
                    startTransition(async () => {
                      setResult(await importTradingView(text!, tagId ? [Number(tagId)] : []));
                    })
                  }
                >
                  {pending ? "Importing…" : `Import ${preview.trades.length} trades`}
                </button>
              </div>
            )}
          </div>

          {preview.warnings.map((w) => (
            <p key={w} className="mb-2 flex items-start gap-2 text-sm text-amber-300/90">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
            </p>
          ))}

          {preview.trades.length > 0 && (
            <div className="mt-3 max-h-[480px] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-card-2 text-left text-xs text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Entry</th>
                    <th className="px-3 py-2 font-medium">Exit</th>
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Entry px</th>
                    <th className="px-3 py-2 text-right font-medium">Exit px</th>
                    <th className="px-3 py-2 text-right font-medium">P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.trades.map((t) => (
                    <tr key={t.external_id} className="border-t border-line/60">
                      <td className="px-3 py-2 whitespace-nowrap text-ink-2">{dateTime(t.entry_time)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-ink-2">{dateTime(t.exit_time)}</td>
                      <td className="px-3 py-2 font-medium">{t.symbol}</td>
                      <td className={`px-3 py-2 text-xs font-semibold uppercase ${t.direction === "long" ? "text-profit" : "text-loss"}`}>
                        {t.direction}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{t.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{price(t.entry_price)}</td>
                      <td className="px-3 py-2 text-right font-mono">{price(t.exit_price)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${pnlColor(t.pnl)}`}>{money(t.pnl, { sign: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
