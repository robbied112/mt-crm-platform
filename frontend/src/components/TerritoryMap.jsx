/**
 * TerritoryMap — simple US state map colored by territory assignment.
 *
 * SVG-based with state abbreviation labels. Each state is colored by its
 * territory group. Unassigned states are neutral gray.
 */

import { useMemo } from "react";
import { ROLE_COLORS } from "../config/roles";

// Territory palette — distinct colors for up to 8 territories
const TERRITORY_COLORS = [
  "#6B1E1E", // Deep Burgundy
  "#1F865A", // Vineyard Green
  "#B87333", // Warm Copper
  "#2E6B9E", // Steel Blue
  "#8B5E3C", // Saddle Brown
  "#7B4B94", // Plum
  "#C07B01", // Amber
  "#2E8B8B", // Teal
];

// Simplified US state positions (row, col grid) for a clean layout
const STATE_GRID = {
  ME: [0, 10], VT: [1, 9], NH: [1, 10], WA: [1, 0], MT: [1, 2], ND: [1, 4], MN: [1, 5], WI: [2, 5], MI: [2, 7], NY: [2, 9], MA: [2, 10],
  OR: [2, 0], ID: [2, 1], SD: [2, 4], IA: [3, 5], IL: [3, 6], IN: [3, 7], OH: [3, 8], PA: [3, 9], CT: [3, 10], RI: [3, 11],
  NV: [3, 0], WY: [2, 2], NE: [3, 4], CO: [4, 2], KS: [4, 4], MO: [4, 5], KY: [4, 7], WV: [4, 8], VA: [4, 9], NJ: [4, 10], DE: [4, 11], MD: [5, 10],
  CA: [4, 0], UT: [3, 1], NM: [5, 2], OK: [5, 4], AR: [5, 5], TN: [5, 7], NC: [5, 9], DC: [5, 11],
  AZ: [5, 1], TX: [6, 3], LA: [6, 5], MS: [6, 6], AL: [6, 7], GA: [6, 8], SC: [6, 9],
  FL: [7, 9], HI: [7, 0], AK: [7, 1],
};

export default function TerritoryMap({ territories = {} }) {
  const { stateColors, legend } = useMemo(() => {
    const colors = {};
    const legendItems = [];
    const names = Object.keys(territories);

    names.forEach((name, i) => {
      const color = TERRITORY_COLORS[i % TERRITORY_COLORS.length];
      legendItems.push({ name, color, count: (territories[name] || []).length });
      for (const st of territories[name] || []) {
        colors[st] = color;
      }
    });

    return { stateColors: colors, legend: legendItems };
  }, [territories]);

  if (Object.keys(territories).length === 0) return null;

  const cellW = 36;
  const cellH = 28;
  const cols = 12;
  const rows = 8;

  return (
    <div>
      <svg
        width={cols * cellW + 8}
        height={rows * cellH + 8}
        viewBox={`0 0 ${cols * cellW + 8} ${rows * cellH + 8}`}
        style={{ display: "block", margin: "0 auto" }}
      >
        {Object.entries(STATE_GRID).map(([st, [row, col]]) => {
          const x = col * cellW + 4;
          const y = row * cellH + 4;
          const fill = stateColors[st] || "#F5EDE3";
          const textColor = stateColors[st] ? "#fff" : "#6B6B6B";

          return (
            <g key={st}>
              <rect
                x={x}
                y={y}
                width={cellW - 2}
                height={cellH - 2}
                rx={4}
                fill={fill}
                stroke="#fff"
                strokeWidth={1}
              />
              <text
                x={x + (cellW - 2) / 2}
                y={y + (cellH - 2) / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={600}
                fontFamily="Inter, -apple-system, sans-serif"
                fill={textColor}
              >
                {st}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}>
        {legend.map(({ name, color, count }) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: "inline-block" }} />
            <span style={{ fontWeight: 600, color: "#2E2E2E" }}>{name}</span>
            <span style={{ color: "#6B6B6B" }}>({count} states)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
