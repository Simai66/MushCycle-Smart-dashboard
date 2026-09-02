export const GAS_THRESHOLDS = { watch: 15, high: 30 };
export const MIN_BASELINE_SAMPLES = 5;

export function autoGasBaseline(readings, key) {
  const values = readings
    .map((reading) => Number(reading[key]))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (values.length < MIN_BASELINE_SAMPLES) return null;
  return Math.round(values[Math.min(values.length - 1, Math.floor(values.length * 0.2))]);
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
