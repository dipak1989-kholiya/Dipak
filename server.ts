import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { spawn } from "child_process";
import http from "http";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-in-production";

const db = new Database("streaming.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS destinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    protocol TEXT NOT NULL,
    serverUrl TEXT NOT NULL,
    streamKey TEXT NOT NULL,
    enabled INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// Create default admin if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('Created default user: admin / admin123');
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  const PORT = 3000;

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(401).json({ error: "Invalid token" });
      req.user = user;
      next();
    });
  };

  // API Routes
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  });

  app.get("/api/destinations", authenticateToken, (req, res) => {
    const rows = db.prepare("SELECT * FROM destinations").all();
    res.json(rows.map((row: any) => ({ ...row, enabled: !!row.enabled })));
  });

  app.post("/api/destinations", authenticateToken, (req, res) => {
    const { id, name, protocol, serverUrl, streamKey, enabled } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO destinations (id, name, protocol, serverUrl, streamKey, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, protocol, serverUrl, streamKey, enabled ? 1 : 0);
    res.json({ success: true });
  });

  app.delete("/api/destinations/:id", authenticateToken, (req, res) => {
    db.prepare("DELETE FROM destinations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  // WebSocket Server for RTMP Bridge
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    console.log("New WebSocket connection for streaming");
    
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    let rtmpUrl = url.searchParams.get("rtmpUrl");
    const token = url.searchParams.get("token");
    
    if (!token) {
      console.error("No auth token provided");
      ws.close(1008, "Unauthorized");
      return;
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.error("Invalid auth token for WebSocket");
      ws.close(1008, "Unauthorized");
      return;
    }
    
    if (!rtmpUrl) {
      console.error("No RTMP URL provided");
      ws.close(1008, "RTMP URL required");
      return;
    }

    // Upgrade YouTube RTMP to RTMPS to bypass outbound port 1935 blocks
    if (rtmpUrl.startsWith("rtmp://a.rtmp.youtube.com") || rtmpUrl.startsWith("rtmp://b.rtmp.youtube.com")) {
      rtmpUrl = rtmpUrl.replace("rtmp://", "rtmps://").replace(".rtmp.", ".rtmps.");
    }

    console.log(`Starting FFmpeg for: ${rtmpUrl}`);

    // FFmpeg command to take webm/vp8/opus from stdin and convert to flv/h264/aac for RTMP
    const ffmpeg = spawn("ffmpeg", [
      "-thread_queue_size", "512",
      "-i", "-", // Read from stdin
      "-c:v", "libx264", 
      "-preset", "veryfast", 
      "-tune", "zerolatency",
      "-r", "30", // Force constant frame rate
      "-g", "60", // Keyframe interval (2 seconds at 30fps)
      "-pix_fmt", "yuv420p", // Most compatible pixel format
      "-c:a", "aac", 
      "-ar", "44100", 
      "-b:a", "128k",
      "-flvflags", "no_duration_filesize",
      "-f", "flv",
      rtmpUrl
    ]);

    ffmpeg.on("error", (err) => {
      console.error("Failed to start FFmpeg:", err);
      ws.close(1011, "Internal Server Error: FFmpeg not found");
    });

    ffmpeg.on("close", (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      ws.terminate();
    });

    ffmpeg.stdin.on("error", (e) => {
      console.error("FFmpeg stdin error:", e);
    });

    ffmpeg.stderr.on("data", (data) => {
      console.log(`FFmpeg [${rtmpUrl}]: ${data}`);
    });

    ws.on("message", (data) => {
      if (ffmpeg.stdin.writable) {
        try {
          ffmpeg.stdin.write(data);
        } catch (e) {
          console.error("FFmpeg write error:", e);
        }
      }
    });

    ws.on("close", () => {
      console.log("WebSocket closed, killing FFmpeg");
      ffmpeg.kill("SIGINT");
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      ffmpeg.kill("SIGINT");
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
