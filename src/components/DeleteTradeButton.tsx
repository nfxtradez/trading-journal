"use client";

import { Trash2 } from "lucide-react";
import { deleteTrade } from "@/app/actions";

export default function DeleteTradeButton({ id }: { id: number }) {
  return (
    <form
      action={deleteTrade.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm("Delete this trade? This cannot be undone.")) e.preventDefault();
      }}
    >
      <button type="submit" className="btn-danger">
        <Trash2 className="size-4" /> Delete
      </button>
    </form>
  );
}
