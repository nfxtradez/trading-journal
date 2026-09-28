import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { authEnabled } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · TradeLog" };

export default function LoginPage() {
  if (!authEnabled()) redirect("/");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-accent">
            <TrendingUp className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-semibold">TradeLog</div>
            <div className="text-xs text-muted">Sign in to your journal</div>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
