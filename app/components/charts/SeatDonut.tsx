"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLang, t } from "../../i18n/useLang";

interface SeatDonutProps {
  mandat: number;
  lawan: number;
  others: number;
  winTarget?: number;
  size?: "sm" | "md" | "lg";
  partyName?: string;
  partyColor?: string;
}

export default function SeatDonut({ mandat, lawan, others, winTarget = 112, size = "md", partyName = "MANDAT", partyColor = "var(--cyan)" }: SeatDonutProps) {
  const lang = useLang();
  const othersLabel = t(lang, "components_charts_SeatDonut.others");
  const seatsWord = t(lang, "components_charts_SeatDonut.seats");
  const data = [
    { name: partyName, value: Math.max(0, Number.isFinite(mandat) ? mandat : 0), color: partyColor },
    { name: "PARTI LAWAN", value: Math.max(0, Number.isFinite(lawan) ? lawan : 0), color: "var(--warn-orange)" },
    { name: othersLabel, value: Math.max(0, Number.isFinite(others) ? others : 0), color: "#4a5568" },
  ];
  const totalSeats = data.reduce((total, item) => total + item.value, 0);

  const heights: Record<string, number> = { sm: 140, md: 180, lg: 220 };
  const innerRadius: Record<string, number> = { sm: 38, md: 52, lg: 65 };
  const outerRadius: Record<string, number> = { sm: 55, md: 72, lg: 90 };
  const h = heights[size];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: "100%", height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart aria-label="Pecahan kerusi parlimen">
            <Pie
              data={totalSeats ? data : [{ name: "TIADA DATA", value: 1, color: "#334155" }]}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius[size]}
              outerRadius={outerRadius[size]}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
              minAngle={totalSeats ? 2 : 0}
            >
              {(totalSeats ? data : [{ name: "TIADA DATA", value: 1, color: "#334155" }]).map((entry, index) => (
                <Cell key={index} fill={entry.color} opacity={0.9} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--panel)", border: "1px solid rgb(var(--cyan-rgb) / 0.27)", fontFamily: "'Space Mono',monospace", fontSize: "12px" }}
              formatter={(value) => [`${value} ${seatsWord}`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Center overlay text */}
      <div className="-mt-2 text-center">
        <div className="text-xs text-gold font-bold tracking-widest">{totalSeats ? `${winTarget} ${t(lang, "components_charts_SeatDonut.seats2")}` : t(lang, "TIADA DATA", "NO DATA")}</div>
        <div className="text-[11px] text-text-muted tracking-wider">{totalSeats ? t(lang, "components_charts_SeatDonut.toGovern") : t(lang, "Menunggu kiraan kerusi", "Awaiting seat count")}</div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 mt-3 w-full">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm" style={{ background: item.color }} />
              <span className="text-[12px] text-text-muted">{item.name}</span>
            </div>
            <span className="text-[12px] font-bold" style={{ color: item.color }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
