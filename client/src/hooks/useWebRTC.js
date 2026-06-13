import { useEffect, useRef, useCallback } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const CHUNK_SIZE = 64 * 1024; // 64 KB

export function useSenderWebRTC(socket, roomId, file, onStatus, onProgress) {
  const pcRef = useRef(null);
  const channelRef = useRef(null);

  const startTransfer = useCallback(async (receiverSocketId) => {
    if (!file || !socket) return;
    onStatus("connecting");

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    const channel = pc.createDataChannel("file-transfer", { ordered: true });
    channelRef.current = channel;

    let offset = 0;
    let lastTime = Date.now();
    let lastBytes = 0;

    channel.onopen = () => { onStatus("transferring"); sendNextChunk(); };

    channel.onmessage = (e) => { if (e.data === "ack") sendNextChunk(); };

    channel.onerror = () => onStatus("error");

    channel.onclose = () => {
      if (offset >= file.size) { onStatus("done"); socket.emit("transfer-complete", { roomId }); }
    };

    function sendNextChunk() {
      if (offset >= file.size) {
        channel.send("__EOF__");
        onStatus("done");
        socket.emit("transfer-complete", { roomId });
        return;
      }

      if (channel.bufferedAmount > 16 * 1024 * 1024) {
        setTimeout(sendNextChunk, 50);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (channel.readyState !== "open") return;
        channel.send(e.target.result);
        offset += e.target.result.byteLength;

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.5) {
          const speed = (offset - lastBytes) / elapsed;
          lastTime = now; lastBytes = offset;
          onProgress(Math.round((offset / file.size) * 100), speed);
        } else {
          onProgress(Math.round((offset / file.size) * 100), null);
        }
      };
      reader.readAsArrayBuffer(file.slice(offset, offset + CHUNK_SIZE));
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { to: receiverSocketId, candidate: e.candidate });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: receiverSocketId, offer });

    const handleAnswer = async ({ answer }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      socket.off("answer", handleAnswer);
    };
    socket.on("answer", handleAnswer);

    socket.on("ice-candidate", async ({ candidate }) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
    });

  }, [file, socket, roomId, onStatus, onProgress]);

  useEffect(() => {
    return () => {
      if (channelRef.current) channelRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  return { startTransfer };
}

export function useReceiverWebRTC(socket, onStatus, onProgress, onComplete) {
  const pcRef = useRef(null);
  const bufferRef = useRef([]);
  const receivedRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ from, offer }) => {
      onStatus("connecting");

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("ice-candidate", { to: from, candidate: e.candidate });
      };

      pc.ondatachannel = (e) => {
        const channel = e.channel;
        channel.onopen = () => onStatus("transferring");

        channel.onmessage = (e) => {
          if (e.data === "__EOF__") { channel.send("eof-ack"); onComplete(bufferRef.current); return; }
          bufferRef.current.push(e.data);
          receivedRef.current += e.data.byteLength;
          channel.send("ack");
          const pct = Math.min(99, Math.round((receivedRef.current / (window.__fileSize || 1)) * 100));
          onProgress(pct);
        };

        channel.onerror = () => onStatus("error");
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer });
    };

    const handleIce = async ({ candidate }) => {
      try { if (pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
    };

    socket.on("offer", handleOffer);
    socket.on("ice-candidate", handleIce);

    return () => {
      socket.off("offer", handleOffer);
      socket.off("ice-candidate", handleIce);
      if (pcRef.current) pcRef.current.close();
    };
  }, [socket, onStatus, onProgress, onComplete]);
}