import { useEffect, useState } from "react";
import { Lightbulb, Power } from "lucide-react";
import "./App.css";

const API_URL = "/api/led";

export default function App() {
  const [isOn, setIsOn] = useState(false);
  const [busy, setBusy] = useState(true);
  const [online, setOnline] = useState(false);

  async function readState() {
    try {
      const response = await fetch(API_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("LED API unavailable");
      const data = await response.json();
      setIsOn(Boolean(data.on));
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Initial network synchronization is intentionally started by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    readState();
    const interval = setInterval(readState, 3000);
    return () => clearInterval(interval);
  }, []);

  async function toggleLed() {
    setBusy(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: !isOn, pin: "D10" }),
      });

      if (!response.ok) throw new Error("LED update failed");
      const data = await response.json();
      setIsOn(Boolean(data.on));
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="device-header">
        <div className="brand-icon"><Lightbulb size={18} /></div>
        <span>ESP32 LED</span>
        <span className={`connection ${online ? "online" : ""}`}>
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      <section className={`control-card ${isOn ? "active" : ""}`}>
        <div className="led-orb" aria-hidden="true">
          <Lightbulb size={74} strokeWidth={1.25} />
        </div>

        <span className="label">D10 · GPIO9</span>
        <h1>{isOn ? "ON" : "OFF"}</h1>

        <button
          className={`power-button ${isOn ? "active" : ""}`}
          onClick={toggleLed}
          disabled={busy}
          aria-label={isOn ? "Turn LED off" : "Turn LED on"}
        >
          <Power size={20} />
          {busy ? "Updating" : isOn ? "Turn off" : "Turn on"}
        </button>
      </section>
    </main>
  );
}
