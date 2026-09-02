export const GAS_THRESHOLDS = { watch: 15, high: 30 };

export function autoGasBaseline(readings, key) {
  const values = readings
    .map((reading) => Number(reading[key]))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (values.length < 10) return null;
  return Math.round(values[Math.floor((values.length - 1) * 0.2)]);
}

export function relativeGasChange(raw, baseline) {
  if (!Number.isFinite(raw) || !Number.isFinite(baseline) || baseline <= 0) return null;
  return ((raw - baseline) / baseline) * 100;
}

export function gasStatus(change) {
  if (!Number.isFinite(change)) return { label: "LEARNING BASELINE", tone: "learning" };
  if (change >= GAS_THRESHOLDS.high) return { label: "HIGH TREND", tone: "high" };
  if (change >= GAS_THRESHOLDS.watch) return { label: "WATCH", tone: "watch" };
  return { label: "NORMAL TREND", tone: "normal" };
}
