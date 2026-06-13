# DropBeam 📂

A peer-to-peer file and folder sharing app that lets users transfer files directly between browsers using WebRTC — no server storage involved.

## 🚀 Features
- Direct peer-to-peer file transfer via WebRTC
- Folder sharing using `showDirectoryPicker()` API
- Real-time connection setup via Socket.io
- Zip folders automatically with JSZip
- No file size limits from server storage

## 🛠️ Tech Stack
React, Node.js, Socket.io, WebRTC, JSZip

## 📸 Screenshots

<table>
<tr>
<td align="center"><b>Home / Connect</b></td>
<td align="center"><b>File Transfer</b></td>
</tr>
<tr>
<td><img src="./screenshots/home.png" width="400"/></td>
<td><img src="./screenshots/transfer.png" width="400"/></td>
</tr>
<tr>
<td align="center"><b>Folder Sharing</b></td>
<td align="center"><b>Transfer Complete</b></td>
</tr>
<tr>
<td><img src="./screenshots/folder.png" width="400"/></td>
<td><img src="./screenshots/complete.png" width="400"/></td>
</tr>
</table>

## ⚙️ Setup Instructions

1. Clone the repository
```bash
git clone <your-repo-link>
cd dropbeam
```

2. Install dependencies (frontend & backend)
```bash
cd client && npm install
cd ../server && npm install
```

3. Set up environment variables in `server/.env`
PORT=5000

4. Run the app
```bash
# Backend
npm run dev

# Frontend (new terminal)
cd client && npm run dev
```

5. Open `http://localhost:5173` in your browser

## 🌐 Live Demo
[View Live Demo](#)

## 👤 Author
Anushri — [Anushri2717](#) 