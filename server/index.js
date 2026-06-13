const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/build")));

const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  socket.on("create-room", ({ roomId, fileName, fileSize, fileType, isFolder, folderName, fileCount }) => {
    rooms.set(roomId, { fileName, fileSize, fileType, isFolder, folderName, fileCount, senderSocketId: socket.id });
    socket.join(roomId);
    console.log(`[room] Created: ${roomId} | ${isFolder ? "Folder" : "File"}: ${fileName}`);
  });

  socket.on("join-room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) { socket.emit("room-not-found"); return; }
    socket.join(roomId);
    socket.emit("room-info", {
      fileName: room.fileName,
      fileSize: room.fileSize,
      fileType: room.fileType,
      isFolder: room.isFolder,
      folderName: room.folderName,
      fileCount: room.fileCount,
    });
    io.to(room.senderSocketId).emit("receiver-joined", { receiverSocketId: socket.id });
  });

  socket.on("offer", ({ to, offer }) => { io.to(to).emit("offer", { from: socket.id, offer }); });
  socket.on("answer", ({ to, answer }) => { io.to(to).emit("answer", { from: socket.id, answer }); });
  socket.on("ice-candidate", ({ to, candidate }) => { io.to(to).emit("ice-candidate", { from: socket.id, candidate }); });
  socket.on("transfer-complete", ({ roomId }) => { io.to(roomId).emit("transfer-complete"); });

  socket.on("disconnect", () => {
    for (const [roomId, data] of rooms.entries()) {
      if (data.senderSocketId === socket.id) {
        io.to(roomId).emit("sender-disconnected");
        rooms.delete(roomId);
      }
    }
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`\n🚀 Server running on http://localhost:${PORT}\n`));