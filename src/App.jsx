              import { API_BASE_URL } from "./config";
import { useState, useEffect, useRef } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

import {
  Sprout, LayoutDashboard, Activity, ChartNoAxesCombined, Droplets,
  Settings, Info, CircleCheck, CircleAlert, Wifi, WifiOff,
  Database, Download, Server, Monitor, Link2, Timer, Cpu,
  Waves, Zap, Bot, SlidersHorizontal, Bell, FlaskConical,
  Clock3, ShieldCheck, CodeXml, Cloud, Power
} from "lucide-react";

import "./App.css";

export default function App() {
  
const [backendStatus, setBackendStatus] = useState("Checking...");

const [backendLastUpdated, setBackendLastUpdated] = useState(null);

const [backendSensorData, setBackendSensorData] = useState(null);

const [sensorHistory, setSensorHistory] = useState([]);

const [dataSource, setDataSource] = useState("simulator");


  const [moisture, setMoisture] = useState(38);
  const [tank, setTank] = useState(76);
  const [autoMode, setAutoMode] = useState(true);
  const [pump, setPump] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
const [totalPumpSeconds, setTotalPumpSeconds] = useState(() => {
  try {
    const saved = Number(localStorage.getItem("agrosmart_pump_runtime"));
    return Number.isFinite(saved) && saved >= 0
      ? Math.floor(saved)
      : 0;
  } catch {
    return 0;
  }
});

  const [safetyAlert, setSafetyAlert] = useState("");
  
const [wateringHistory, setWateringHistory] = useState(() => {
  try {
    const savedHistory = localStorage.getItem("agrosmart_history");
    return savedHistory ? JSON.parse(savedHistory) : [];
  } catch {
    return [];
  }
});

const pumpStartedAt = useRef(null);
const timeoutLocked = useRef(false);
const hasPumpChanged = useRef(false);

  
const [history, setHistory] = useState([
  { time: "1", moisture: 35, tank: 80 },
  { time: "2", moisture: 38, tank: 79 },
  { time: "3", moisture: 36, tank: 78 },
  { time: "4", moisture: 40, tank: 77 },
  { time: "5", moisture: 38, tank: 76 }
]);

useEffect(() => {
  const interval = setInterval(() => {
    setHistory((previous) => [
      ...previous.slice(-9),
      {
        time: new Date().toLocaleTimeString(),
        moisture: moisture,
        tank: tank
      }
    ]);
  }, 3000);

  return () => clearInterval(interval);
}, [moisture, tank]);


useEffect(() => {
  if (!autoMode) {
    setPump(false);
    setSafetyAlert("");
    return;
  }

  if (tank < 15) {
    setPump(false);
    setSafetyAlert("Low water level! Pump stopped.");
    return;
  }

  if (moisture >= 60) {
    setPump(false);
    setSafetyAlert("");
    timeoutLocked.current = false;
    return;
  }

  if (moisture < 30 && !timeoutLocked.current) {
    setPump(true);
  }
}, [moisture, tank, autoMode]);

useEffect(() => {
  if (!pump) {
    pumpStartedAt.current = null;
    return;
  }

  pumpStartedAt.current = Date.now();

  const timer = setTimeout(() => {
    setPump(false);
    timeoutLocked.current = true;
    setSafetyAlert("Safety timeout! Pump stopped after 30 seconds.");
  }, 30000);

  return () => clearTimeout(timer);
}, [pump]);



useEffect(() => {
  if (!hasPumpChanged.current) {
    hasPumpChanged.current = true;
    return;
  }

  const event = {
    
id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,

    time: new Date().toLocaleTimeString(),
    action: pump ? "Pump ON" : "Pump OFF",
    mode: autoMode ? "Automatic" : "Manual",
    moisture: moisture
  };

  setWateringHistory((previous) => {
    if (previous[0]?.action === event.action) {
      return previous;
    }

    return [event, ...previous].slice(0, 20);
  });
}, [pump]);



useEffect(() => {
  localStorage.setItem(
    "agrosmart_history",
    JSON.stringify(wateringHistory)
  );
}, [wateringHistory]);

useEffect(() => {
  setLastUpdated(new Date().toLocaleTimeString());
}, [moisture, tank]);

useEffect(() => {
  if (!pump) return;

  const interval = setInterval(() => {
    setTotalPumpSeconds((previous) => previous + 1);
  }, 1000);

  return () => clearInterval(interval);
}, [pump]);

useEffect(() => {
  localStorage.setItem(
    "agrosmart_pump_runtime",
    String(totalPumpSeconds)
  );
}, [totalPumpSeconds]);


useEffect(() => {
  const fetchSensorData = () => {
    fetch(`${API_BASE_URL}/api/sensors`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend request failed");
        }
        return response.json();
      })
      .then((data) => {
        setBackendSensorData(data);
        setBackendStatus("Connected");
        
setBackendLastUpdated(new Date().toLocaleTimeString());

      })
      .catch((error) => {
        console.error("Backend connection error:", error);
        setBackendStatus("Disconnected");
        
setBackendSensorData(null);

      });
  };

  fetchSensorData();

  const interval = setInterval(fetchSensorData, 3000);

  return () => clearInterval(interval);
}, []);

      



const activeMoisture =
  dataSource === "simulator"
    ? moisture
    : backendStatus === "Connected" && backendSensorData
      ? backendSensorData.soil_moisture
      : null;

const activeTank =
  dataSource === "simulator"
    ? tank
    : backendStatus === "Connected" && backendSensorData
      ? backendSensorData.tank_level
      : null;


useEffect(() => {
  const fetchHistory = () => {
    fetch(`${API_BASE_URL}/api/history`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("History request failed");
        }
        return response.json();
      })
      .then((data) => {
        setSensorHistory(data);
      })
      .catch((error) => {
        console.error("Sensor History Error:", error);
        setSensorHistory([]);
      });
  };

  fetchHistory();

  const interval = setInterval(fetchHistory, 5000);

  return () => clearInterval(interval);
}, []);

const historicalChartData = [...sensorHistory]
  .reverse()
  .map((reading) => ({
    time: reading.recorded_at,
    moisture: reading.soil_moisture,
    tank: reading.tank_level
  }));

const systemHealth =
  backendStatus === "Connected"
    ? "Backend Healthy"
    : backendStatus === "Checking..."
      ? "Checking Backend..."
      : "Backend Offline";

  const drySoil = moisture < 30;
  const lowWater = tank < 15;

  function togglePump() {
    if (autoMode) {
      alert("Switch to Manual Mode first.");
      return;
    }
    if (lowWater && !pump) {
      alert("Cannot start pump: Water tank is low!");
      return;
    }
    setPump(!pump);
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2><Sprout size={22} style={{ verticalAlign: "middle", marginRight: 8 }} /> AgroSmart</h2>
        <p>IoT Irrigation System</p>
        <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }} className="active" href="#dashboard-overview"><LayoutDashboard size={17} /> Dashboard</a>
          <a style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }} href="#live-monitoring"><Activity size={17} /> Live Monitoring</a>
          <a style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }} href="#analytics"><ChartNoAxesCombined size={17} /> Analytics</a>
          <a style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }} href="#irrigation"><Droplets size={17} /> Irrigation</a>
          <a style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }} href="#sensor-source"><Settings size={17} /> Data Source</a>
          <a style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }} href="#about-project"><Info size={17} /> About</a>
        </nav>
        <div className="sidebar-bottom"><CircleCheck size={14} /> Demo Mode</div>
      </aside>

      <main className="main" id="dashboard-overview">
        <header>
          <div>
            <h1>Smart Irrigation Dashboard</h1>
            <p>Monitor and manage your irrigation system</p>
          </div>
          <span className="status"><CircleCheck size={14} /> System Online (Demo)</span>
        </header>

        <div className="welcome">
          <h2>Welcome to AgroSmart</h2>
          <p>Intelligent water management for smarter farming.</p>
        </div>

<div className="card" id="sensor-source">
  <h3><Database size={19} /> Sensor Data Source</h3>

  <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
    <button
      onClick={() => setDataSource("simulator")}
      className={dataSource === "simulator" ? "active" : ""}
    >
      <SlidersHorizontal size={16} /> Demo Simulator
    </button>

    <button
      onClick={() => setDataSource("backend")}
      className={dataSource === "backend" ? "active" : ""}
    >
      <Link2 size={16} /> Flask Backend
    </button>
  </div>

  <p style={{ marginTop: "12px" }}>
    Selected Source:{" "}
    <strong>
      {dataSource === "simulator" ? "Demo Simulator" : "Flask Backend"}
    </strong>
  </p>
</div>

{dataSource === "backend" && backendStatus !== "Connected" && (
  <div
    className="card"
    style={{
      border: "1px solid #ef4444",
      marginBottom: "16px"
    }}
  >
    <h3 style={{ color: "#ef4444" }}>
      <CircleAlert size={18} /> Backend Offline
    </h3>
    <p>
      Flask Backend is not connected.
      Sensor readings are currently unavailable.
    </p>
  </div>
)}

<section className="card" style={{ marginBottom: "20px" }}>
  <h3><Database size={19} /> Sensor Reading History</h3>
  
<a
  href={`${API_BASE_URL}/api/export-csv`}
  download="AgroSmart_Report.csv"
  style={{
    display: "inline-block",
    marginTop: "12px",
    marginBottom: "12px",
    padding: "10px 18px",
    backgroundColor: "#16a34a",
    color: "white",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold"
  }}
>
  <Download size={16} /> Download CSV Report
</a>

  <p>Last 20 readings saved in SQLite Database</p>

  <div style={{ overflowX: "auto", marginTop: "15px" }}>
    <table style={{ width: "100%", textAlign: "left" }}>
      <thead>
        <tr>
          <th>ID</th>
          <th>Soil Moisture</th>
          <th>Tank Level</th>
          <th>Pump</th>
          <th>Recorded At</th>
        </tr>
      </thead>

      <tbody>
        {sensorHistory.length === 0 ? (
          <tr>
            <td colSpan="5">No saved readings available.</td>
          </tr>
        ) : (
          sensorHistory.map((reading) => (
            <tr key={reading.id}>
              <td>{reading.id}</td>
              <td>{reading.soil_moisture}%</td>
              <td>{reading.tank_level}%</td>
              <td>{reading.pump_status ? "ON" : "OFF"}</td>
              <td>{reading.recorded_at} UTC</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</section>

<section className="card" style={{ marginBottom: "20px" }}>
  <h3><ChartNoAxesCombined size={19} /> Historical Sensor Analytics</h3>
  <p>Last 20 sensor readings from SQLite Database</p>

  <div style={{ width: "100%", height: "300px", marginTop: "20px" }}>
    {historicalChartData.length === 0 ? (
      <p>No historical data available.</p>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={historicalChartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" hide />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="moisture"
            name="Soil Moisture (%)"
            stroke="#22c55e"
            strokeWidth={3}
            dot={false}
          />

          <Line
            type="monotone"
            dataKey="tank"
            name="Tank Level (%)"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    )}
  </div>

  <small>Data source: SQLite Database (Demo)</small>
</section>

<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
    padding: "14px 18px",
    borderRadius: "12px",
    background: "#152238",
    border: "1px solid #334155"
  }}
>
  <div>
    <strong><Sprout size={22} style={{ verticalAlign: "middle", marginRight: 8 }} /> AgroSmart Monitoring System</strong>
    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
      Software Demo v1.0 | React + Flask + SQLite
    </div>
  </div>

  <span
    style={{
      color: backendStatus === "Connected" ? "#4ade80" : "#f87171",
      fontWeight: "bold"
    }}
  >
    {backendStatus === "Connected"
      ? "Backend Online"
      : "Backend Offline"}
  </span>
</div>

        <section className="cards" id="live-monitoring">
        
<div className="card">
  <div className="card-icon"><Monitor size={24} /></div>
  <p>System Health</p>

  <h2>{systemHealth}</h2>

  <span
    className={
      backendStatus === "Connected"
        ? "tag green"
        : "tag"
    }
  >
    {backendStatus === "Connected"
      ? "Online"
      : "Offline"}
  </span>

  <small>Flask Backend Connection Status</small>
</div>

<div className="card">
  <div className="card-icon"><Link2 size={24} /></div>
  <p>Flask Backend API</p>

  <h2>{backendStatus}</h2>

<small>
  Last Updated: {backendLastUpdated || "Waiting..."}
</small>

  <p>
    Soil Moisture:{" "}
    {backendSensorData
      ? `${backendSensorData.soil_moisture}%`
      : "--"}
  </p>

  <p>
    Tank Level:{" "}
    {backendSensorData
      ? `${backendSensorData.tank_level}%`
      : "--"}
  </p>

  <small>
    {backendSensorData?.mode === "demo"
      ? "Demo API Data"
      : "Waiting for backend data"}
  </small>
</div>

<div className="card">
  <div className="card-icon"><Timer size={24} /></div>
  <p>Total Pump Runtime</p>

  <h2>
    {Math.floor(totalPumpSeconds / 60)}m{" "}
    {totalPumpSeconds % 60}s
  </h2>

  <span className={pump ? "tag green" : "tag"}>
    {pump ? "Counting..." : "Paused"}
  </span>

  <small>Demo session runtime</small>
</div>

        
<div className="card">
  <div className="card-icon"><Wifi size={24} /></div>
  <p>ESP32 Device Status</p>

  <h2>{deviceConnected ? "ONLINE" : "OFFLINE"}</h2>

  <span className={deviceConnected ? "tag green" : "tag"}>
    {deviceConnected ? "Connected" : "Not Connected"}
  </span>

  <small>
    {deviceConnected
      ? "Receiving real sensor data"
      : "Demo Mode - Hardware not connected"}
  </small>
  
<small>
  Last Demo Update: {lastUpdated || "Waiting..."}
</small>

</div>

          <div className="card">
            <div className="card-icon"><Droplets size={24} /></div>
            <p>Soil Moisture</p>
            <h2>

{activeMoisture === null ? "--" : `${activeMoisture}%`}

</h2>
            <div className="progress">
              <div style={{ width: `${moisture}%` }} />
            </div>
            <small>{drySoil ? "Dry Soil" : "Moisture Normal"}</small>
          </div>

          <div className="card">
            <div className="card-icon"><Waves size={24} /></div>
            <p>Water Tank Level</p>
            <h2>

{activeTank === null ? "--" : `${activeTank}%`}

</h2>
            <div className="progress">
              <div style={{ width: `${tank}%` }} />
            </div>
            <small>{lowWater ? "Low Water" : "Water Available"}</small>
          </div>

          <div className="card">
            <div className="card-icon"><Zap size={24} /></div>
            <p>Water Pump</p>
            <h2>{pump ? "ON" : "OFF"}</h2>
            <span className={pump ? "tag green" : "tag"}>
              {pump ? "Running" : "Stopped"}
            </span>
          </div>

          <div className="card">
            <div className="card-icon"><Bot size={24} /></div>
            <p>Irrigation Mode</p>
            <h2>{autoMode ? "AUTO" : "MANUAL"}</h2>
            <span className="tag green">Demo System</span>
          </div>
        </section>

        <section className="panels" id="irrigation">
          <div className="panel">
            <h3><SlidersHorizontal size={19} /> Irrigation Control</h3>
            <p>Choose the operating mode</p>

            <div className="buttons">
              <button
                className={autoMode ? "selected" : ""}
                onClick={() => {
                  setAutoMode(true);
                  setPump(false);
                }}
              >
                Automatic
              </button>
              <button
                className={!autoMode ? "selected" : ""}
                onClick={() => {
                  setAutoMode(false);
                  setPump(false);
                }}
              >
                Manual
              </button>
            </div>

            <h3>Pump Control</h3>
            <button className="pump-btn" onClick={togglePump}>
              {pump ? "Turn Pump OFF" : "Turn Pump ON"}
            </button>
            <small>Demo controls only — no hardware connected</small>
          </div>

          <div className="panel">
            <h3><Bell size={19} /> Smart Alerts</h3>
            {safetyAlert && (
  <div className="alert"><CircleAlert size={16} /> {safetyAlert}</div>
)}
            {drySoil && <div className="alert"><CircleAlert size={16} /> Soil moisture is low!</div>}
            {lowWater && <div className="alert"><CircleAlert size={16} /> Water tank is low!</div>}
            {!drySoil && !lowWater && (
              <div className="success"><CircleCheck size={16} /> All sensor levels are normal</div>
            )}
            <p className="hint">Alerts update with demo sensor values.</p>
          </div>
        </section>

        <section className="panel simulator">
          <h3><FlaskConical size={19} /> Sensor Simulator</h3>
          <p>Test the dashboard before ESP32 arrives.</p>

          <label>Soil Moisture: {moisture}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={moisture}
            onChange={(e) => setMoisture(Number(e.target.value))}
          />

          <label>Water Tank: {tank}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={tank}
            onChange={(e) => setTank(Number(e.target.value))}
          />
        </section>

<section className="panel watering-history">
  <h3><Droplets size={19} /> Watering Activity History</h3>
  <p>Recent pump activity and irrigation events</p>

  <div className="history-scroll">
    <table className="history-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Action</th>
          <th>Mode</th>
          <th>Soil Moisture</th>
        </tr>
      </thead>
      <tbody>
        {wateringHistory.length === 0 ? (
          <tr>
            <td colSpan="4">No activity recorded yet.</td>
          </tr>
        ) : (
          wateringHistory.map((item) => (
            <tr key={item.id}>
              <td>{item.time}</td>
              <td>
                <span className={
                  item.action === "Pump ON"
                    ? "history-on"
                    : "history-off"
                }>
                  {item.action}
                </span>
              </td>
              <td>{item.mode}</td>
              <td>{item.moisture}%</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</section>


<section className="panel" id="about-project" style={{ marginTop: 24, marginBottom: 24 }}>
  <h3><Info size={20} /> About AgroSmart</h3>
  <p>AgroSmart is an IoT-based Smart Irrigation System prototype designed to support efficient water usage through soil moisture monitoring, tank level monitoring and intelligent irrigation control.</p>
  <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 18 }}>
    <div className="card">
      <h3><ShieldCheck size={18} /> Key Features</h3>
      <p>Sensor monitoring, automatic/manual demo controls, low-water safety alerts, pump timeout simulation, history, analytics and CSV export.</p>
    </div>
    <div className="card">
      <h3><Server size={18} /> Software Stack</h3>
      <p>React, Vite, JavaScript, Python Flask, SQLite, CodeXml and Render cloud hosting.</p>
    </div>
    <div className="card">
      <h3><Cpu size={18} /> Hardware Plan</h3>
      <p>ESP32, soil moisture sensor, water-level sensing, relay module and water pump. Physical hardware integration is pending.</p>
    </div>
    <div className="card">
      <h3><Info size={18} /> Project Details</h3>
      <p><strong>Project:</strong> AgroSmart — Smart Irrigation System</p>
      <p><strong>Type:</strong> Diploma ICT Minor Project</p>
      <p><strong>Dashboard Development:</strong> Heliba Jadeja</p>
      <p><strong>Project Team:</strong> Group project (team names can be added here)</p>
      <p><strong>Current Status:</strong> Online software demo; real ESP32 integration pending</p>
    </div>
  </div>
</section>

        <footer>
          
<section className="panel analytics" id="analytics">
  <h3><ChartNoAxesCombined size={19} /> Real-Time Sensor Analytics</h3>
  <p>Live soil moisture and water tank monitoring</p>

  <div style={{ width: "100%", height: 320 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={history}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="time" stroke="#94a3b8" />
        <YAxis domain={[0, 100]} stroke="#94a3b8" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#172338",
            border: "1px solid #334155",
            color: "#ffffff"
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="moisture"
          name="Soil Moisture (%)"
          stroke="#34d399"
          strokeWidth={3}
          dot={false}
          isAnimationActive={true}
        />
        <Line
          type="monotone"
          dataKey="tank"
          name="Tank Level (%)"
          stroke="#38bdf8"
          strokeWidth={3}
          dot={false}
          isAnimationActive={true}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
</section>

          AgroSmart IoT • Smart Irrigation Monitoring • Prototype v1.0
        </footer>
      </main>
    </div>
  );
}
