import Link from "next/link";
import { Download, LogOut, Plus, Upload, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SettingsForm from "@/components/SettingsForm";
import TagChip from "@/components/TagChip";
import { createTag, removeTag } from "@/app/actions";
import { getSettings, listTags, tagUsage } from "@/lib/trades";
import { POINT_VALUES } from "@/lib/instruments";
import { DATA_DIR, REMOTE } from "@/lib/db";
import { authEnabled } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { TAG_CATEGORIES } from "@/lib/types";
import { ready } from "@/lib/session";

export default async function SettingsPage() {
  await ready();
  const settings = getSettings();
  const tags = listTags();
  const usage = tagUsage();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Settings" />

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-2">Account</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Used for the account balance and return % on the dashboard.</p>
        <SettingsForm startingBalance={settings.startingBalance} />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-2">Tags</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Categorize trades by setup, mistakes and strategy. Deleting a tag removes it from all trades.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {TAG_CATEGORIES.map(({ key, label }) => (
            <div key={key}>
              <span className="label">{label}</span>
              <ul className="space-y-1.5">
                {tags
                  .filter((t) => t.category === key)
                  .map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <TagChip tag={t} />
                        <span className="text-xs text-muted">{usage.get(t.id) ?? 0}</span>
                      </span>
                      <form action={removeTag.bind(null, t.id)}>
                        <button className="rounded p-1 text-muted hover:bg-loss/15 hover:text-loss" title="Delete tag">
                          <X className="size-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
              <form action={createTag} className="mt-3 flex gap-2">
                <input type="hidden" name="category" value={key} />
                <input name="name" required maxLength={60} placeholder={`Add ${label.toLowerCase()} tag`} className="input py-1.5 text-xs" />
                <button className="btn-ghost px-2.5 py-1.5" title="Add tag">
                  <Plus className="size-4" />
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-2">Import</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Bring in trades from a TradingView Paper Trading CSV export.</p>
        <Link href="/journal/import" className="btn-primary">
          <Upload className="size-4" /> Import TradingView CSV
        </Link>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-2">Contract specs</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Dollar value per point, used to auto-calculate P&amp;L.</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(POINT_VALUES).map(([sym, v]) => (
            <span key={sym} className="rounded-md border border-line bg-bg px-2.5 py-1 font-mono text-xs text-ink-2">
              {sym} <span className="text-muted">${v}/pt</span>
            </span>
          ))}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-2">Data</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          {REMOTE ? (
            <>Your journal is stored in Netlify Blobs. Download a backup now and then to keep a copy.</>
          ) : (
            <>
              Stored locally in <code className="text-ink-2">{DATA_DIR}</code> (journal.db + uploads/).
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup" className="btn-ghost">
            <Download className="size-4" /> Download backup (.db)
          </a>
          {authEnabled() && (
            <form action={logout}>
              <button className="btn-ghost">
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
