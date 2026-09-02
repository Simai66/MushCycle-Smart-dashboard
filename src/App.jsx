import { useEffect, useMemo, useState } from "react";
import { Activity, CircuitBoard, Cloud, Code2, Droplets, Gauge, Leaf, RefreshCw, Smartphone, Thermometer, Wifi, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiBaseUrl, fetchLiveReadings } from "./liveData.js";
import { autoGasBaseline, gasStatus, relativeGasChange } from "./gasReadings.js";

const RANGE_CONFIG = {
  "1H": { points: 13, step: 5 },
  "6H": { points: 19, step: 20 },
  "24H": { points: 25, step: 60 },
  "7D": { points: 29, step: 360 },
};

const SENSOR_META = [
  { key: "temperature", metricKey: "temperature", label: "Temperature", unit: "°C", color: "#ff3d16", icon: Thermometer },
  { key: "humidity", metricKey: "humidity", label: "Humidity", unit: "%", color: "#1769df", icon: Droplets },
  { key: "mq2", metricKey: "mq2Relative", label: "MQ-2", description: "Smoke / flammable gas", color: "#238532", icon: Cloud },
  { key: "mq9", metricKey: "mq9Relative", label: "MQ-9", description: "CO / methane trend", color: "#2865d3", icon: Cloud },
];

const GAS_KEYS = ["mq2", "mq9"];
const GAS_BASELINE_STORAGE_KEY = "mushcycle-gas-baselines";

function loadGasBaselines() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(GAS_BASELINE_STORAGE_KEY));
    return Object.fromEntries(GAS_KEYS.map((key) => [key, Number(stored?.[key]) > 0 ? Number(stored[key]) : null]));
  } catch {
    return { mq2: null, mq9: null };
  }
}

function saveGasBaselines(baselines) {
  try {
    window.localStorage.setItem(GAS_BASELINE_STORAGE_KEY, JSON.stringify(baselines));
  } catch {
    // Baseline still works for current session when browser storage is unavailable.
  }
}

function withGasMetrics(data, baselines) {
  return data.map((reading) => ({
    ...reading,
    mq2Relative: relativeGasChange(reading.mq2, baselines.mq2),
    mq9Relative: relativeGasChange(reading.mq9, baselines.mq9),
  }));
}

function makeData(range) {
  const { points, step } = RANGE_CONFIG[range];
  const anchor = new Date("2026-08-27T04:45:22+07:00");
  return Array.from({ length: points }, (_, index) => {
    const reverseIndex = points - 1 - index;
    const time = new Date(anchor.getTime() - reverseIndex * step * 60000);
    const wave = (index / Math.max(points - 1, 1)) * Math.PI * 2;
    const temperature = 27.6 + Math.sin(wave - 1.1) * 2.1 + Math.sin(wave * 2.2) * 0.55;
    const humidity = 64.7 - Math.sin(wave - 1.1) * 5.9 + Math.cos(wave * 1.8) * 1.6;
    const mq2 = 1755 + Math.sin(wave - 1.8) * 185 + Math.cos(wave * 2.3) * 72;
    const mq9 = 1215 + Math.sin(wave - 1.5) * 92 + Math.cos(wave * 2.1) * 39;
    return {
      timestamp: time.toISOString(),
      label: range === "7D"
        ? time.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        : time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      temperature: index === points - 1 ? 28.6 : Number(temperature.toFixed(1)),
      humidity: index === points - 1 ? 67.4 : Number(humidity.toFixed(1)),
      mq2: index === points - 1 ? 1834 : Math.round(mq2),
      mq9: index === points - 1 ? 1267 : Math.round(mq9),
    };
  });
}

function stats(data, key) {
  const values = data.map((item) => item[key]).filter(Number.isFinite);
  if (!values.length) return { current: "--", avg: "--", min: "--", max: "--" };
  const relative = key.endsWith("Relative");
  const decimals = key === "temperature" || key === "humidity" || relative ? 1 : 0;
  const format = (value) => {
    const formatted = value.toFixed(decimals);
    return relative ? `${value > 0 ? "+" : ""}${formatted}%` : formatted;
  };
  return {
    current: format(values.at(-1)),
    avg: format(values.reduce((sum, value) => sum + value, 0) / values.length),
    min: format(Math.min(...values)),
    max: format(Math.max(...values)),
  };
}

function StatusPill({ online }) {
  return <span className={online ? "online-pill" : "offline-pill"}><span className="status-dot" />{online ? "ONLINE" : "OFFLINE"}</span>;
}

function Sparkline({ data, dataKey, color }) {
  return (
    <div className="sparkline" aria-label={`${dataKey} recent trend`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReadingStrip({ data, baselines }) {
  const latest = data.at(-1);
  return (
    <section className="reading-strip" aria-labelledby="right-now-title">
      <div className="strip-title" id="right-now-title">RIGHT NOW</div>
      {SENSOR_META.map((sensor) => {
        const { key, metricKey, label, unit, color, icon: Icon } = sensor;
        const gas = GAS_KEYS.includes(key);
        const ready = !gas || Number.isFinite(baselines[key]);
        const current = stats(data, ready ? metricKey : key).current;
        const status = gasStatus(ready ? relativeGasChange(latest?.[key], baselines[key]) : null);
        return (
        <article className="reading-item" key={key} style={{ "--sensor-color": color }}>
          <Icon className="reading-icon" aria-hidden="true" />
          <div className="reading-copy">
            <div className="reading-label">{label} <span>{gas ? (ready ? "% FROM BASE" : "AUTO BASELINE") : unit}</span></div>
            <div className="reading-value dot-number">{current}</div>
            {gas && <div className={`reading-note ${status.tone}`}>{status.label} · RAW {latest?.[key] ?? "--"}</div>}
          </div>
          <Sparkline data={data.slice(-10)} dataKey={ready ? metricKey : key} color={color} />
        </article>
        );
      })}
    </section>
  );
}

function RangePicker({ range, setRange }) {
  return (
    <div className="range-picker" aria-label="Historical time range">
      {Object.keys(RANGE_CONFIG).map((item) => (
        <button key={item} type="button" aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>
      ))}
    </div>
  );
}

function SensorSummary({ data, sensor, baselines, onRelearn }) {
  const { key, metricKey, label, description, unit, color, icon: Icon } = sensor;
  const gas = GAS_KEYS.includes(key);
  const baseline = baselines[key];
  const ready = !gas || Number.isFinite(baseline);
  const values = stats(data, ready ? metricKey : key);
  const rawCurrent = data.at(-1)?.[key];
  const status = gasStatus(ready ? relativeGasChange(rawCurrent, baseline) : null);
  return (
    <article className="sensor-summary" style={{ "--sensor-color": color }}>
      <div className="sensor-heading"><Icon aria-hidden="true" /><span>{label}</span><small>{gas ? (ready ? "% FROM BASE" : "ADC RAW") : unit}</small></div>
      {description && <div className="sensor-description">{description}</div>}
      <div className="summary-value dot-number">{values.current}</div>
      {gas && (
        <div className="gas-context">
          <span className={`gas-status ${status.tone}`}>{status.label}</span>
          <span>RAW {rawCurrent ?? "--"} · BASE {baseline ?? "--"}</span>
          <button type="button" onClick={() => onRelearn(key)}>Relearn baseline</button>
        </div>
      )}
      <div className="summary-rule" />
      <dl className="stat-row">
        {Object.entries(values).map(([name, value]) => (
          <div key={name}><dt>{name.toUpperCase()}</dt><dd className={name === "current" ? "accent-value dot-number" : "dot-number"}>{value}</dd></div>
        ))}
      </dl>
    </article>
  );
}

function HistoryChart({ data, type, baselines }) {
  const isClimate = type === "climate";
  const gasReady = GAS_KEYS.every((key) => Number.isFinite(baselines[key]));
  return (
    <div className="chart-wrap" role="img" aria-label={isClimate ? "Temperature and humidity history" : "MQ-2 and MQ-9 relative trend history"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#d8d8d8" strokeDasharray="5 5" vertical />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#555" }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#b8b8b8" }} />
          <YAxis yAxisId={0} domain={isClimate ? [24, 32] : gasReady ? ["auto", "auto"] : [0, 4095]} tick={{ fontSize: 11, fill: isClimate ? "#ff3d16" : "#238532" }} tickLine={false} axisLine={false} width={44} />
          {isClimate && <YAxis yAxisId={1} domain={[40, 80]} orientation="right" tick={{ fontSize: 11, fill: "#1769df" }} tickLine={false} axisLine={false} width={36} />}
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #dedede", boxShadow: "none" }} />
          <Legend iconType="plainline" align="left" verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
          {isClimate && <Area yAxisId={0} type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#ff3d16" fill="none" strokeWidth={2} isAnimationActive={false} />}
          {isClimate && <Area yAxisId={1} type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#1769df" fill="none" strokeWidth={2} isAnimationActive={false} />}
          {!isClimate && <Area yAxisId={0} type="monotone" dataKey={gasReady ? "mq2Relative" : "mq2"} name={`MQ-2 (${gasReady ? "% from base" : "learning baseline"})`} stroke="#238532" fill="none" strokeWidth={2} isAnimationActive={false} />}
          {!isClimate && <Area yAxisId={0} type="monotone" dataKey={gasReady ? "mq9Relative" : "mq9"} name={`MQ-9 (${gasReady ? "% from base" : "learning baseline"})`} stroke="#2865d3" fill="none" strokeWidth={2} isAnimationActive={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DataSection({ kind, data, range, setRange, baselines, onRelearn }) {
  const climate = kind === "climate";
  const sensors = climate ? SENSOR_META.slice(0, 2) : SENSOR_META.slice(2);
  return (
    <section className="data-section">
      <div className="section-heading">
        <div className="section-mark">{climate ? <Leaf aria-hidden="true" /> : <Gauge aria-hidden="true" />}</div>
        <div><h2>{climate ? "Climate" : "Gas sensors"}</h2><p>{climate ? "Understanding your environment." : "Relative trend only — not ppm or a safety alarm."}</p></div>
        {climate && <RangePicker range={range} setRange={setRange} />}
      </div>
      <div className="section-body">
        <div className="chart-column">
          <h3>{climate ? "Environment History" : "Gas Sensor Trend"}</h3>
          <HistoryChart data={data} type={kind} baselines={baselines} />
        </div>
        <div className="summary-grid">
          {sensors.map((sensor) => <SensorSummary key={sensor.key} data={data} sensor={sensor} baselines={baselines} onRelearn={onRelearn} />)}
        </div>
      </div>
    </section>
  );
}

async function sendControlCommand(target, value) {
  const baseUrl = apiBaseUrl();
  let pin = window.sessionStorage.getItem("mushcycle-control-pin");
  if (!pin) {
    pin = window.prompt("Control PIN");
    if (!pin) throw new Error("Control cancelled");
    window.sessionStorage.setItem("mushcycle-control-pin", pin);
  }

  const response = await fetch(`${baseUrl}/api/v1/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Control-Pin": pin },
    body: JSON.stringify({ target, value }),
  });

  if (!response.ok) {
    if (response.status === 401) window.sessionStorage.removeItem("mushcycle-control-pin");
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Control API returned HTTP ${response.status}`);
  }
  return response.json().catch(() => ({}));
}

function SystemRail({ reading, online, demoEnabled }) {
  const [controls, setControls] = useState({
    auto: reading?.mode !== "MANUAL",
    pump: Boolean(reading?.pump),
    relay4: Boolean(reading?.relay4),
  });
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reading) return;
    setControls({ auto: reading.mode !== "MANUAL", pump: reading.pump, relay4: reading.relay4 });
  }, [reading?.timestamp]);

  async function toggle(target) {
    const nextValue = !controls[target];
    setPending(target);
    setError("");
    try {
      if (!demoEnabled) await sendControlCommand(target, nextValue);
      setControls((current) => ({ ...current, [target]: nextValue }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Control command failed");
    } finally {
      setPending(null);
    }
  }

  const items = [
    { key: "auto", label: "AUTO", value: controls.auto ? "ON" : "OFF", icon: RefreshCw, interactive: true },
    { key: "pump", label: "Pump", value: controls.pump ? "ON" : "OFF", icon: Droplets, interactive: true },
    { key: "relay4", label: "Relay 4", value: controls.relay4 ? "ON" : "OFF", icon: Zap, interactive: true },
    { key: "esp32", label: "ESP32", value: online ? "ONLINE" : "OFFLINE", icon: CircuitBoard },
    { key: "wifi", label: "Wi-Fi/Data", value: online ? "CONNECTED" : "OFFLINE", icon: Wifi },
    { key: "controller", label: "Controller", value: reading?.version ? `v${reading.version}` : "UNKNOWN", icon: Code2 },
    { key: "device", label: "Device", value: "MushCycle-ESP32", icon: Smartphone },
  ];

  return (
    <footer className="system-area" aria-label="Control and system status">
      <div className="system-rail">
        {items.map(({ key, label, value, icon: Icon, interactive }) => {
          const isOn = value === "ON" || value === "ONLINE" || value === "CONNECTED";
          const content = (
            <>
              <Icon aria-hidden="true" />
              <span>{label}<strong className={isOn ? "dot-number" : ""}>{pending === key ? "SENDING…" : value}</strong></span>
            </>
          );
          return interactive ? (
            <button
              className={`system-item control-item ${isOn ? "active" : ""}`}
              key={key}
              type="button"
              aria-pressed={Boolean(controls[key])}
              disabled={pending !== null}
              onClick={() => toggle(key)}
            >
              {content}
            </button>
          ) : (
            <div className={`system-item ${isOn ? "active" : ""}`} key={key}>{content}</div>
          );
        })}
      </div>
      {error && <div className="control-error" role="alert">{error}</div>}
    </footer>
  );
}

function StateMessage({ state }) {
  if (state === "loading") return <div className="state-message"><Activity /><h2>Loading sensor data</h2><p>Connecting to MushCycle-ESP32…</p></div>;
  if (state === "empty") return <div className="state-message"><Cloud /><h2>No sensor data available</h2><p>Waiting for data from MushCycle-ESP32</p></div>;
  if (state === "error") return <div className="state-message"><Zap /><h2>Unable to load sensor data</h2><button type="button" onClick={() => window.location.reload()}>Retry</button></div>;
  return null;
}

export function App() {
  const [range, setRange] = useState("24H");
  const demoEnabled = import.meta.env.DEV || new URLSearchParams(window.location.search).get("demo") === "1";
  const demoData = useMemo(() => makeData(range), [range]);
  const [liveData, setLiveData] = useState([]);
  const [gasBaselines, setGasBaselines] = useState(loadGasBaselines);
  const [liveState, setLiveState] = useState(demoEnabled ? "ready" : "loading");
  const queryState = new URLSearchParams(window.location.search).get("state");
  const specialState = ["loading", "empty", "error"].includes(queryState) ? queryState : null;
  const data = demoEnabled ? demoData : liveData;
  const metricData = useMemo(() => withGasMetrics(data, gasBaselines), [data, gasBaselines]);
  const latest = data.at(-1);
  const online = demoEnabled || Boolean(latest && Date.now() - new Date(latest.timestamp).getTime() <= 30000);
  const visibleState = specialState || (liveState === "ready" ? null : liveState);
  const offline = queryState === "offline" || !online;
  const lastUpdate = latest ? new Date(latest.timestamp) : null;

  useEffect(() => {
    if (demoEnabled) return undefined;
    let active = true;

    async function load() {
      try {
        const readings = await fetchLiveReadings(range);
        if (!active) return;
        setLiveData(readings);
        setLiveState(readings.length ? "ready" : "empty");
      } catch {
        if (!active) return;
        setLiveData((current) => {
          setLiveState(current.length ? "ready" : "error");
          return current;
        });
      }
    }

    setLiveState("loading");
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [demoEnabled, range]);

  useEffect(() => {
    if (!data.length || GAS_KEYS.every((key) => Number.isFinite(gasBaselines[key]))) return;
    const learned = {
      mq2: gasBaselines.mq2 ?? autoGasBaseline(data, "mq2"),
      mq9: gasBaselines.mq9 ?? autoGasBaseline(data, "mq9"),
    };
    if (!Number.isFinite(learned.mq2) || !Number.isFinite(learned.mq9)) return;
    setGasBaselines(learned);
    saveGasBaselines(learned);
  }, [data, gasBaselines]);

  function relearnBaseline(key) {
    const baseline = autoGasBaseline(data, key);
    if (!Number.isFinite(baseline)) return;
    setGasBaselines((current) => {
      const next = { ...current, [key]: baseline };
      saveGasBaselines(next);
      return next;
    });
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><img className="brand-mark" src="/mushcycle-mark.png" alt="" /><h1>MushCycle Smart</h1></div>
        <StatusPill online={online} />
        <div className="last-update"><span>Last update</span><strong className="dot-number">{lastUpdate ? lastUpdate.toLocaleTimeString("en-GB") : "--:--:--"}</strong></div>
        <time dateTime={lastUpdate?.toISOString()}>{lastUpdate ? lastUpdate.toLocaleDateString("en-CA") : "---- -- --"}</time>
      </header>
      {visibleState ? <StateMessage state={visibleState} /> : (
        <>
          {offline && <div className="offline-banner"><strong>DEVICE OFFLINE</strong><span>Showing last recorded values</span></div>}
          <ReadingStrip data={metricData} baselines={gasBaselines} />
          <DataSection kind="climate" data={metricData} range={range} setRange={setRange} baselines={gasBaselines} onRelearn={relearnBaseline} />
          <DataSection kind="gas" data={metricData} range={range} setRange={setRange} baselines={gasBaselines} onRelearn={relearnBaseline} />
          <SystemRail reading={latest} online={online} demoEnabled={demoEnabled} />
        </>
      )}
    </main>
  );
}
