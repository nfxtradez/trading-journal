"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TAG_CATEGORIES, type Tag } from "@/lib/types";

const CATEGORY_STYLE: Record<string, string> = {
  setup: "border-accent/50 bg-accent/15 text-accent",
  mistake: "border-loss/50 bg-loss/15 text-loss",
  strategy: "border-violet-400/50 bg-violet-400/15 text-violet-300",
};

export default function TagPicker({ tags, selected = [] }: { tags: Tag[]; selected?: number[] }) {
  const [chosen, setChosen] = useState<Set<number>>(new Set(selected));
  const toggle = (id: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {[...chosen].map((id) => (
        <input key={id} type="hidden" name="tag_ids" value={id} />
      ))}
      {TAG_CATEGORIES.map(({ key, label }) => (
        <div key={key}>
          <span className="label">{label}</span>
          <div className="flex flex-wrap gap-1.5">
            {tags
              .filter((t) => t.category === key)
              .map((t) => {
                const on = chosen.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                      on ? CATEGORY_STYLE[key] : "border-line text-muted hover:border-muted/60 hover:text-ink-2"
                    }`}
                  >
                    {on && <Check className="size-3" />}
                    {t.name}
                  </button>
                );
              })}
          </div>
          <input
            name={`new_tags_${key}`}
            className="input mt-2 py-1.5 text-xs"
            placeholder={`New ${label.toLowerCase()} tags, comma separated`}
          />
        </div>
      ))}
    </div>
  );
}
