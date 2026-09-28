"use client";

import { useActionState } from "react";
import { saveSettings, type FormState } from "@/app/actions";

export default function SettingsForm({ startingBalance }: { startingBalance: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="startingBalance" className="label">Starting balance ($)</label>
        <input id="startingBalance" name="startingBalance" type="number" step="any" min="0" defaultValue={startingBalance} className="input w-48" />
        {state.fieldErrors?.startingBalance && <p className="mt-1.5 text-xs text-loss">{state.fieldErrors.startingBalance}</p>}
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
