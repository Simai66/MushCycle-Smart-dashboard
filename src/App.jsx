import { useMemo, useState } from "react";
import { Activity, CircuitBoard, Cloud, Code2, Droplets, Fan, Gauge, Leaf, RefreshCw, Smartphone, Thermometer, Wifi, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const RANGE_CONFIG = {
  "1H": { points: 13, step: 5 },
  "6H": { points: 19, step: 20 },
  "24H": { points: 25, step: 60 },
  "7D": { points: 29, step: 360 },
};

const SENSOR_META = [
  { key: "temperature", label: "Temperature", unit: "°C", color: "#ff3d16", icon: Thermometer },
  { key: "humidity", label: "Humidity", unit: "%", color: "#1769df", icon: Droplets },
  { key: "mq2", label: "MQ-2", unit: "ADC RAW", color: "#238532", icon: Cloud },
  { key: "mq9", label: "MQ-9", unit: "ADC RAW", color: "#2865d3", icon: Cloud },
];

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
  const decimals = key === "temperature" || key === "humidity" ? 1 : 0;
  return {
    current: values.at(-1).toFixed(decimals),
    avg: (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(decimals),
    min: Math.min(...values).toFixed(decimals),
    max: Math.max(...values).toFixed(decimals),
  };
}

function StatusPill() {
  return <span className="online-pill"><span className="status-dot" />ONLINE</span>;
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

function ReadingStrip({ data }) {
  return (
    <section className="reading-strip" aria-labelledby="right-now-title">
      <div className="strip-title" id="right-now-title">RIGHT NOW</div>
      {SENSOR_META.map(({ key, label, unit, color, icon: Icon }) => (
        <article className="reading-item" key={key} style={{ "--sensor-color": color }}>
          <Icon className="reading-icon" aria-hidden="true" />
          <div className="reading-copy">
            <div className="reading-label">{label} <span>{unit}</span></div>
            <div className="reading-value dot-number">{stats(data, key).current}</div>
          </div>
          <Sparkline data={data.slice(-10)} dataKey={key} color={color} />
        </article>
      ))}
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

function SensorSummary({ data, sensor }) {
  const { key, label, unit, color, icon: Icon } = sensor;
  const values = stats(data, key);
  return (
    <article className="sensor-summary" style={{ "--sensor-color": color }}>
      <div className="sensor-heading"><Icon aria-hidden="true" /><span>{label}</span><small>{unit}</small></div>
      <div className="summary-value dot-number">{values.current}</div>
      <div className="summary-rule" />
      <dl className="stat-row">
        {Object.entries(values).map(([name, value]) => (
          <div key={name}><dt>{name.toUpperCase()}</dt><dd className={name === "current" ? "accent-value dot-number" : "dot-number"}>{value}</dd></div>
        ))}
      </dl>
    </article>
  );
}

function HistoryChart({ data, type }) {
  const isClimate = type === "climate";
  return (
    <div className="chart-wrap" role="img" aria-label={isClimate ? "Temperature and humidity history" : "MQ-2 and MQ-9 ADC history"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#d8d8d8" strokeDasharray="5 5" vertical />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#555" }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#b8b8b8" }} />
          <YAxis yAxisId={0} domain={isClimate ? [24, 32] : [0, 2400]} tick={{ fontSize: 11, fill: isClimate ? "#ff3d16" : "#238532" }} tickLine={false} axisLine={false} width={44} />
          {isClimate && <YAxis yAxisId={1} domain={[40, 80]} orientation="right" tick={{ fontSize: 11, fill: "#1769df" }} tickLine={false} axisLine={false} width={36} />}
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #dedede", boxShadow: "none" }} />
          <Legend iconType="plainline" align="left" verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
          {isClimate && <Area yAxisId={0} type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#ff3d16" fill="none" strokeWidth={2} isAnimationActive={false} />}
          {isClimate && <Area yAxisId={1} type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#1769df" fill="none" strokeWidth={2} isAnimationActive={false} />}
          {!isClimate && <Area yAxisId={0} type="monotone" dataKey="mq2" name="MQ-2 (ADC RAW)" stroke="#238532" fill="none" strokeWidth={2} isAnimationActive={false} />}
          {!isClimate && <Area yAxisId={0} type="monotone" dataKey="mq9" name="MQ-9 (ADC RAW)" stroke="#2865d3" fill="none" strokeWidth={2} isAnimationActive={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DataSection({ kind, data, range, setRange }) {
  const climate = kind === "climate";
  const sensors = climate ? SENSOR_META.slice(0, 2) : SENSOR_META.slice(2);
  return (
    <section className="data-section">
      <div className="section-heading">
        <div className="section-mark">{climate ? <Leaf aria-hidden="true" /> : <Gauge aria-hidden="true" />}</div>
        <div><h2>{climate ? "Climate" : "Gas sensors"}</h2><p>{climate ? "Understanding your environment." : "Tracking gas sensor activity."}</p></div>
        {climate && <RangePicker range={range} setRange={setRange} />}
      </div>
      <div className="section-body">
        <div className="chart-column">
          <h3>{climate ? "Environment History" : "Gas Sensor Trend"}</h3>
          <HistoryChart data={data} type={kind} />
        </div>
        <div className="summary-grid">
          {sensors.map((sensor) => <SensorSummary key={sensor.key} data={data} sensor={sensor} />)}
        </div>
      </div>
    </section>
  );
}

const systemItems = [
  { label: "AUTO", value: "", icon: RefreshCw, tone: "orange" },
  { label: "Fan 1", value: "OFF", icon: Fan },
  { label: "Fan 2", value: "OFF", icon: Fan },
  { label: "Pump", value: "ON", icon: Droplets, tone: "green" },
  { label: "Relay 4", value: "OFF", icon: Zap },
  { label: "ESP32", value: "ONLINE", icon: CircuitBoard, tone: "orange" },
  { label: "Wi-Fi/Data", value: "CONNECTED", icon: Wifi, tone: "green" },
  { label: "Controller", value: "v2.2.0", icon: Code2 },
  { label: "Device", value: "MushCycle-ESP32", icon: Smartphone },
];

function SystemRail() {
  return (
    <footer className="system-rail" aria-label="Read-only auto control and system status">
      {systemItems.map(({ label, value, icon: Icon, tone }) => (
        <div className={`system-item ${tone || ""}`} key={label}>
          <Icon aria-hidden="true" />
          <span>{label}<strong className={value === "ON" || value === "ONLINE" || value === "CONNECTED" ? "dot-number" : ""}>{value}</strong></span>
        </div>
      ))}
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
  const data = useMemo(() => makeData(range), [range]);
  const queryState = new URLSearchParams(window.location.search).get("state");
  const specialState = ["loading", "empty", "error"].includes(queryState) ? queryState : null;
  const demoEnabled = import.meta.env.DEV || import.meta.env.VITE_USE_DEMO_DATA === "true";
  const visibleState = specialState || (!demoEnabled ? "empty" : null);
  const offline = queryState === "offline";

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><img className="brand-mark" src="/mushcycle-mark.png" alt="" /><h1>MushCycle Smart</h1></div>
        {offline ? <span className="offline-pill"><span className="status-dot" />OFFLINE</span> : <StatusPill />}
        <div className="last-update"><span>Last update</span><strong className="dot-number">04.45.22</strong></div>
        <time dateTime="2026-08-27">2026-08-27</time>
      </header>
      {visibleState ? <StateMessage state={visibleState} /> : (
        <>
          {offline && <div className="offline-banner"><strong>DEVICE OFFLINE</strong><span>Last data received 04:45:22 · Values below are the last recorded values</span></div>}
          <ReadingStrip data={data} />
          <DataSection kind="climate" data={data} range={range} setRange={setRange} />
          <DataSection kind="gas" data={data} range={range} setRange={setRange} />
          <SystemRail />
        </>
      )}
    </main>
  );
}
