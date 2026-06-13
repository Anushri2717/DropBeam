import React, { useState, useRef, useCallback, useEffect } from "react";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { useSenderWebRTC } from "../hooks/useWebRTC";
import {
  formatBytes, formatSpeed, getFileIcon,
  buildShareLink, readDirectoryFiles, zipFiles
} from "../utils/helpers";

const SOCKET_URL = process.env.REACT_APP_SERVER_URL || "";

export default function Sender() {
  const [file, setFile] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [shareLink, setShareLink] = useState("");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zipProgress, setZipProgress] = useState(null); // null | 0-100
  const socketRef = useRef(null);

  const handleStatus = useCallback((s) => setStatus(s), []);
  const handleProgress = useCallback((pct, spd) => {
    setProgress(pct);
    if (spd !== null) setSpeed(spd);
  }, []);

  const { startTransfer } = useSenderWebRTC(
    socketRef.current, roomId, file, handleStatus, handleProgress
  );

  useEffect(() => {
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  function pickFile(f) {
    if (!f) return;
    setFile(f);
    setStatus("ready");
    setProgress(0); setSpeed(null); setRoomId(null); setShareLink(""); setZipProgress(null);
  }

  async function pickFolder() {
    try {
      const dirHandle = await window.showDirectoryPicker();
      setStatus("zipping");
      setZipProgress(0);

      const entries = await readDirectoryFiles(dirHandle);
      if (entries.length === 0) { alert("Folder is empty!"); setStatus("idle"); return; }

      const totalSize = entries.reduce((sum, e) => sum + e.file.size, 0);
      const zipBlob = await zipFiles(dirHandle.name, entries, setZipProgress);

      // Convert blob to File object
      const zipFile = new File([zipBlob], `${dirHandle.name}.zip`, { type: "application/zip" });
      zipFile._isFolder = true;
      zipFile._folderName = dirHandle.name;
      zipFile._fileCount = entries.length;
      zipFile._originalSize = totalSize;

      setFile(zipFile);
      setStatus("ready");
      setZipProgress(null);
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
      setStatus("idle");
      setZipProgress(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  function createRoom() {
    const rid = uuidv4();
    setRoomId(rid);
    setShareLink(buildShareLink(rid));

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("create-room", {
        roomId: rid,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isFolder: !!file._isFolder,
        folderName: file._folderName || null,
        fileCount: file._fileCount || null,
      });
      setStatus("waiting");
    });

    socket.on("receiver-joined", ({ receiverSocketId }) => { startTransfer(receiverSocketId); });
    socket.on("transfer-complete", () => { setProgress(100); setStatus("done"); });
    socket.on("disconnect", () => { if (status !== "done") setStatus("error"); });
  }

  function reset() {
    if (socketRef.current) socketRef.current.disconnect();
    setFile(null); setRoomId(null); setShareLink("");
    setStatus("idle"); setProgress(0); setSpeed(null); setZipProgress(null);
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusConfig = {
    waiting:      { cls: "status-waiting",      dot: true,  text: "Waiting for receiver to open the link…" },
    connecting:   { cls: "status-connecting",   dot: true,  text: "Establishing direct connection…" },
    transferring: { cls: "status-transferring", dot: false, text: "Transferring directly…" },
    done:         { cls: "status-done",         dot: false, text: "Transfer complete! 🎉" },
    error:        { cls: "status-error",        dot: false, text: "Connection lost. Please try again." },
  };

  const isDone = status === "done";
  const isActive = ["waiting","connecting","transferring","done"].includes(status);
  const isZipping = status === "zipping";
  const folderSupported = "showDirectoryPicker" in window;

  return (
    <div className="card" style={{ animation: "slide-up 0.4s ease" }}>
      {!isDone ? (
        <>
          <h1 className="section-heading">Send a file or folder</h1>
          <p className="section-sub">Drop a file or pick an entire folder. Your recipient gets a direct link — no uploads, no accounts.</p>

          {/* Drop zone */}
          {(status === "idle" || status === "ready") && (
            <label
              className={`dropzone${dragOver ? " drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input type="file" onChange={(e) => pickFile(e.target.files[0])} />
              <span className="dz-icon">
                {status === "ready" ? getFileIcon(file?.type, file?.name) : "⬆️"}
              </span>
              <p className="dz-title">{status === "ready" ? "Ready to share" : "Drop your file here"}</p>
              <p className="dz-sub">
                {status === "ready"
                  ? <span style={{ color: "var(--accent2)" }}>Click to swap file</span>
                  : <><strong>click to browse</strong> or drag &amp; drop</>}
              </p>
            </label>
          )}

          {/* Folder picker button */}
          {(status === "idle" || status === "ready") && folderSupported && (
            <button className="btn btn-outline" style={{ marginTop: 10 }} onClick={pickFolder}>
              📁 Pick a folder instead
            </button>
          )}

          {!folderSupported && status === "idle" && (
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, textAlign: "center" }}>
              Folder picking requires Chrome/Edge — use file upload on other browsers
            </p>
          )}

          {/* Zipping progress */}
          {isZipping && (
            <div className="progress-section" style={{ marginTop: 20 }}>
              <div className="progress-header">
                <span className="progress-label">📦 Zipping folder in browser…</span>
                <span className="progress-pct">{zipProgress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${zipProgress}%` }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>This happens locally — nothing is uploaded</p>
            </div>
          )}

          {/* File/folder info */}
          {file && !isZipping && (
            <div className="file-preview">
              <span className="file-icon">
                {file._isFolder ? "📁" : getFileIcon(file.type, file.name)}
              </span>
              <div className="file-info">
                <div className="file-name">
                  {file._isFolder ? file._folderName : file.name}
                  {file._isFolder && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>
                      ({file._fileCount} files → zipped)
                    </span>
                  )}
                </div>
                <div className="file-size">
                  {formatBytes(file.size)}
                  {file._isFolder && file._originalSize && (
                    <span style={{ marginLeft: 6, color: "var(--text3)" }}>
                      (original: {formatBytes(file._originalSize)})
                    </span>
                  )}
                </div>
              </div>
              {!isActive && (
                <button className="file-remove" onClick={() => { setFile(null); setStatus("idle"); }}>✕</button>
              )}
            </div>
          )}

          {/* Generate link */}
          {status === "ready" && (
            <button className="btn btn-primary" onClick={createRoom}>◈ Generate share link</button>
          )}

          {/* Share link */}
          {shareLink && (
            <div className="share-section">
              <p className="share-label">Your share link</p>
              <div className="link-box">
                <input className="link-input" type="text" readOnly value={shareLink} onClick={(e) => e.target.select()} />
                <button className={`copy-btn${copied ? " copied" : ""}`} onClick={copyLink}>
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          {statusConfig[status] && (
            <div className={`status-row ${statusConfig[status].cls}`}>
              {statusConfig[status].dot ? <span className="status-dot" /> : <span>◈</span>}
              <span>{statusConfig[status].text}</span>
            </div>
          )}

          {/* Transfer progress */}
          {(status === "transferring" || status === "done") && (
            <div className="progress-section">
              <div className="progress-header">
                <span className="progress-label">Transfer progress</span>
                <span className="progress-pct">{progress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              {speed && <div className="progress-speed">{formatSpeed(speed)}</div>}
            </div>
          )}

          {isActive && status !== "done" && (
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 14, textAlign: "center" }}>Keep this tab open while sharing</p>
          )}
        </>
      ) : (
        <div className="success-animation">
          <span className="success-icon">{file?._isFolder ? "📁" : "✅"}</span>
          <h2 className="success-title">{file?._isFolder ? "Folder delivered!" : "File delivered!"}</h2>
          <p className="success-sub" style={{ marginBottom: 8 }}>
            <strong>{file?._isFolder ? file._folderName : file?.name}</strong>
          </p>
          <p className="success-sub">{formatBytes(file?.size)} transferred peer-to-peer</p>
          <div className="progress-section" style={{ marginBottom: 24 }}>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: "100%" }} />
            </div>
          </div>
          <button className="btn btn-outline" onClick={reset} style={{ marginTop: 0 }}>Send another</button>
        </div>
      )}

      {status === "idle" && (
        <>
          <div className="divider" />
          <div className="how-it-works">
            {[
              { title: "Drop a file or pick a folder", desc: "Folders get zipped locally in your browser before sending." },
              { title: "Share the link", desc: "Send the generated link via chat, email, or DM." },
              { title: "They open it", desc: "Direct encrypted connection. Receiver gets a .zip they can extract." },
            ].map((s, i) => (
              <div className="how-step" key={i}>
                <div className="step-num">{i + 1}</div>
                <div className="step-text">
                  <div className="step-title">{s.title}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}