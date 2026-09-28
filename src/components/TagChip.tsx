import type { Tag } from "@/lib/types";

const STYLE: Record<string, string> = {
  setup: "bg-accent/15 text-accent",
  mistake: "bg-loss/15 text-loss",
  strategy: "bg-violet-400/15 text-violet-300",
};

export default function TagChip({ tag }: { tag: Pick<Tag, "name" | "category"> }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STYLE[tag.category]}`}>
      {tag.name}
    </span>
  );
}
