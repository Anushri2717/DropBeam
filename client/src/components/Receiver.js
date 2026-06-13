import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useReceiverWebRTC } from "../hooks/useWebRTC";
import { formatBytes, getFileIcon } from "../utils/helpers";

const SOCKET_URL = process.env.REACT_APP_SERVER_URL || "";

export default function Receiver({ roomId }) {
  const [status, setStatus] = useState("loading");
  const [fileInfo, setFileInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const socketRef = useRef(null);
  const downloadedRef = useRef(false);

  const handleStatus = useCallback((s) => setStatus(s), []);
  const handleProgress = useCallback((pct) => setProgress(pct), []);

  const handleComplete = useCallback((chunks) => {
    setProgress(100);
    setStatus("done");
    downloadedRef.current = true;
    const blob = new Blob(chunks, { type: fileInfo?.fileType || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileInfo?.fileName || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [fileInfo]);

  useReceiverWebRTC(socketRef.current, handleStatus, handleProgress, handleComplete);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => { socket.emit("join-room", { roomId }); });
    socket.on("room-info", ({ fileName, fileSize, fileType }) => {
      setFileInfo({ fileName, fileSize, fileType });
      window.__fileSize = fileSize;
      setStatus("ready");
    });
    socket.on("room-not-found", () => setStatus("not-found"));
    socket.on("sender-disconnected", () => { if (!downloadedRef.current) setStatus("sender-gone"); });
    socket.on("transfer-complete", () => setStatus("done"));

    return () => socket.disconnect();
  }, [roomId]);

  const statusBars = {
    connecting:    { cls: "status-connecting",  dot: true,  text: "Connecting directly to sender…" },
    transferring:  { cls: "status-transferring", dot: false, text: "Receiving file…" },
    error:         { cls: "status-error",        dot: false, text: "Connection error. Try reloading." },
    "sender-gone": { cls: "status-error",        dot: false, text: "Sender closed their tab." },
  };

  if (status === "loading") return (
    <div className="card" style={{ textAlign: "center", padding: "60px 40px" }}>
      <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1s linear infinite", display: "inline-block" }}>◌</div>
      <p style={{ color: "var(--text2)", fontSize: 14 }}>Looking up transfer…</p>
    </div>
  );

  if (status === "not-found") return (
    <div className="card" style={{ textAlign: "center", padding: "60px 40px" }}>
      <span style={{ fontSize: 56, display: "block", marginBottom: 16 }}>🔍</span>
      <h2 className="section-heading">Link not found</h2>
      <p style={{ color: "var(--text2)", fontSize: 14, marginTop: 8 }}>This link may have expired or the sender closed their tab.</p>
      <button className="btn btn-outline" style={{ marginTop: 24 }} onClick={() => window.location.href = "/"}>Go home</button>
    </div>
  );

  if (status === "done") return (
    <div className="card">
      <div className="success-animation">
        <span className="success-icon">⬇️</span>
        <h2 className="success-title">Download started!</h2>
        <p className="success-sub" style={{ marginBottom: 4 }}><strong>{fileInfo?.fileName}</strong></p>
        <p className="success-sub">{formatBytes(fileInfo?.fileSize)} received peer-to-peer</p>
        <div className="progress-section" style={{ marginBottom: 24, marginTop: 16 }}>
          <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: "100%" }} /></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>If the download didn't start, check your browser's download bar.</p>
        <button className="btn btn-outline" style={{ marginTop: 0 }} onClick={() => window.location.href = "/"}>Send your own file</button>
      </div>
    </div>
  );

  const bar = statusBars[status];

  return (
    <div className="card" style={{ animation: "slide-up 0.4s ease" }}>
      <div className="receiver-file-card">
        <span className="receiver-icon">{getFileIcon(fileInfo?.fileType, fileInfo?.fileName)}</span>
        <h2 className="receiver-title">{fileInfo?.fileName || "Incoming file"}</h2>
        <p className="receiver-meta">
          <strong>{formatBytes(fileInfo?.fileSize)}</strong>
          {fileInfo?.fileType && <> · {fileInfo.fileType.split("/")[1]?.toUpperCase()}</>}
        </p>

        {status === "ready" && (
          <>
            <div className="badge badge-blue" style={{ margin: "0 auto 20px", display: "inline-flex" }}>◈ Direct transfer — no upload</div>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 }}>
              This file will be sent <strong style={{ color: "var(--text)" }}>directly</strong> from the sender's browser to yours. Nothing is stored on any server.
            </p>
            <button className="btn btn-primary" onClick={() => setStatus("connecting")}>⬇ Accept &amp; receive file</button>
          </>
        )}

        {bar && (
          <div className={"status-row " + bar.cls} style={{ marginTop: 20 }}>
            {bar.dot ? <span className="status-dot" /> : <span>◈</span>}
            <span>{bar.text}</span>
          </div>
        )}

        {(status === "transferring" || status === "connecting") && (
          <div className="progress-section" style={{ marginTop: 20 }}>
            <div className="progress-header">
              <span className="progress-label">Receiving</span>
              <span className="progress-pct">{progress}%</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: progress + "%" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}