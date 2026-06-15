export default function SparkBars({ points, maxVal, color = "#6ee7b7", height = 48 }) {
  if (!points?.length) return <p className="properties-hint">No trend data yet.</p>;
  const max = maxVal || Math.max(...points.map((p) => p.value), 1);
  const w = 280;
  const barW = w / points.length - 2;
  return (
    <svg className="obs-spark" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Trend chart">
      {points.map((p, i) => {
        const h = Math.max(2, (p.value / max) * (height - 8));
        return (
          <rect
            key={p.key || i}
            x={i * (barW + 2)}
            y={height - h}
            width={barW}
            height={h}
            fill={p.color || color}
            rx={2}
          >
            <title>{`${p.label || ""}: ${p.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
