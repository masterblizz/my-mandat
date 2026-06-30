"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatPercent } from "../../utils/format";

interface TrendLineProps {
  data: Record<string, string | number>[];
  lines: { key: string; color: string; label: string }[];
  xKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export default function TrendLine({
  data,
  lines,
  xKey = "month",
  height = 160,
  showGrid = true,
  showLegend = false,
}: TrendLineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="2 4" stroke="var(--bar-empty)" vertical={false} />
        )}
        <XAxis
          dataKey={xKey}
          tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "'Space Mono',monospace" }}
          axisLine={{ stroke: "var(--bar-empty)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "'Space Mono',monospace" }}
          axisLine={false}
          tickLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "var(--panel)",
            border: "1px solid rgb(var(--cyan-rgb) / 0.27)",
            fontFamily: "'Space Mono',monospace",
            fontSize: "12px",
            padding: "6px 10px",
          }}
          labelStyle={{ color: "var(--gold)", marginBottom: "4px" }}
          formatter={(value, name) => [formatPercent(value as number), String(name).toUpperCase()]}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: "11px", fontFamily: "'Space Mono',monospace" }}
          />
        )}
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            stroke={l.color}
            strokeWidth={1.5}
            dot={{ fill: l.color, r: 2, strokeWidth: 0 }}
            activeDot={{ r: 4, strokeWidth: 0 }}
            name={l.label}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
