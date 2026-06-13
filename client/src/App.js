import React, { useEffect, useState } from "react";
import Sender from "./components/Sender";
import Receiver from "./components/Receiver";
import "./App.css";

function App() {
  const [mode, setMode] = useState(null);
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get("room");
    if (rid) { setRoomId(rid); setMode("receiver"); }
    else { setMode("sender"); }
  }, []);

  if (!mode) return null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">DropBeam</span>
        </div>
        <p className="logo-tagline">zero-upload file teleportation</p>
      </header>
      <main className="app-main">
        {mode === "sender" ? <Sender /> : <Receiver roomId={roomId} />}
      </main>
      <footer className="app-footer">
        <p>Files travel peer-to-peer · never touch a server · end-to-end encrypted</p>
      </footer>
    </div>
  );
}

export default App;