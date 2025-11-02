const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));

app.use(cors());
app.use(bodyParser.json());
app.use(session({
  secret: 'replace_this_with_a_random_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24*60*60*1000 }
}));

const PUBLIC_DIR = path.join(__dirname, 'public');

// Simple auth middleware for dashboard
const DASHBOARD_PASSWORD = 'axel321'; // change if needed

app.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (password === DASHBOARD_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'Unauthorized' });
});

app.get('/index.html', (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  } else {
    return res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
  }
});

// Serve other static assets
app.use(express.static(PUBLIC_DIR));

// Endpoint to receive locations
app.post('/api/location', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload.lat !== 'number' || typeof payload.lon !== 'number') {
      return res.status(400).json({ error: 'Payload invalid' });
    }
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
    history.push(payload);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    io.emit('location:update', payload);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/history', (req, res) => {
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
  res.json(history);
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
    socket.emit('history', history);
  } catch (e) {}
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
