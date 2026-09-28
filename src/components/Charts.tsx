"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateOnly, money, moneyShort } from "@/lib/format";

const ACCENT = "#3b82f6";
const PROFIT = "#22c55e";
const LOSS = "#ef4444";
const GRID = "#262a33";
const AXIS = { fill: "#8b919e", fontSize: 11 };

function Tip({
  active,
  payload,
  label,
  valueLabel,
  labelFmt = (l) => dateOnly(String(l)),
}: {
  active?: boolean;
  payload?: { value: number; payload: Record<string, unknown> }[];
  label?: string | number;
  valueLabel: string;
  labelFmt?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const extra = payload[0].payload.trades as number | undefined;
  return (
    <div className="rounded-lg border border-line bg-card-2 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 text-muted">{label !== undefined ? labelFmt(label) : ""}</div>
      <div className="flex items-center gap-2">
        <span className="text-ink-2">{valueLabel}</span>
        <span className={`font-mono font-semibold ${v >= 0 ? "text-profit" : "text-loss"}`}>{money(v, { sign: true })}</span>
      </div>
      {extra !== undefined && <div className="mt-0.5 text-muted">{extra} trades</div>}
    </div>
  );
}

/** Cumulative P&L. `mini` hides axes for the dashboard tile. */
export function EquityChart({
  data,
  mini = false,
  height = 300,
}: {
  data: { date: string; cumulative: number }[];
  mini?: boolean;
  height?: number;
}) {
  if (data.length === 0) return <Empty height={height} />;
  // Start the curve at zero so the first day's move is visible.
  const series = [{ date: "", cumulative: 0 }, ...data];
  const last = data[data.length - 1].cumulative;
  const color = mini ? (last >= 0 ? PROFIT : LOSS) : ACCENT;
  const id = `eq-${mini ? "m" : "f"}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={mini ? { top: 4, right: 0, bottom: 0, left: 0 } : { top: 10, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {!mini && <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />}
        <XAxis
          dataKey="date"
          hide={mini}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={(d) => (d ? dateOnly(d).replace(/, \d{4}$/, "") : "")}
          minTickGap={32}
        />
        <YAxis hide={mini} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => moneyShort(v)} width={64} />
        <ReferenceLine y={0} stroke="#3a3f4a" />
        <Tooltip
          cursor={{ stroke: "#4b5563", strokeDasharray: "3 3" }}
          content={<Tip valueLabel="Cumulative" labelFmt={(l) => (l ? dateOnly(String(l)) : "Start")} />}
        />
        <Area type="monotone" dataKey="cumulative" stroke={color} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "#15171c" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DailyPnlChart({ data, height = 260 }: { data: { date: string; pnl: number; trades?: number }[]; height?: number }) {
  if (data.length === 0) return <Empty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(d) => dateOnly(d).replace(/, \d{4}$/, "")} minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => moneyShort(v)} width={64} />
        <ReferenceLine y={0} stroke="#3a3f4a" />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<Tip valueLabel="Day P&L" />} />
        <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.pnl >= 0 ? PROFIT : LOSS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars of net P&L per group (symbol, tag, weekday…). */
export function GroupPnlChart({ data, height }: { data: { key: string; netPnl: number; trades: number }[]; height?: number }) {
  if (data.length === 0) return <Empty height={height ?? 200} />;
  const h = height ?? Math.max(120, data.length * 38 + 30);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v) => moneyShort(v)} />
        <YAxis type="category" dataKey="key" tick={{ ...AXIS, fill: "#c9ccd3" }} tickLine={false} axisLine={false} width={120} />
        <ReferenceLine x={0} stroke="#3a3f4a" />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<Tip valueLabel="Net P&L" labelFmt={(l) => String(l)} />} />
        <Bar dataKey="netPnl" radius={4} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.netPnl >= 0 ? PROFIT : LOSS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div className="grid place-items-center text-sm text-muted" style={{ height }}>
      No closed trades yet
    </div>
  );
}
