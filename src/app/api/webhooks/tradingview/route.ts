import { parseAlert, processAlert, secretMatches } from "@/lib/automation";

// TradingView alert webhook. Public URL (no login cookie) — authenticated by the "secret" field in the
// alert message, which must equal the TV_WEBHOOK_SECRET environment variable.
export async function POST(req: Request) {
  if (!process.env.TV_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: "Webhook is not configured (TV_WEBHOOK_SECRET is not set)." }, { status: 503 });
  }
  const body = (await req.text()).slice(0, 10_000);
  let alert;
  try {
    alert = parseAlert(body);
  } catch (e) {
    // Don't reveal parsing details before the caller has proven it knows the secret.
    const secretOk = (() => {
      try {
        return secretMatches(String(JSON.parse(body)?.secret ?? ""));
      } catch {
        return false;
      }
    })();
    return Response.json({ ok: false, error: secretOk ? (e as Error).message : "Unauthorized" }, { status: secretOk ? 400 : 401 });
  }
  if (!secretMatches(alert.secret)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const outcome = await processAlert(alert, "tradingview", body);
  return Response.json({ ok: outcome.status === "submitted", ...outcome }, { status: outcome.status === "error" ? 502 : 200 });
}
