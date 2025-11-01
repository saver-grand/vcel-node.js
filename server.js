// server.js
require('dotenv').config();
const express = require('express');
const request = require('request');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const port = process.env.PORT || 3000;

// 🌐 Allow CORS (Video.js, HLS.js, Shaka, Safari, etc.)
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));

// 🧠 HLS stream environment-based map
const streams = {
  nba1: process.env.nba1,
  nba2: process.env.nba2,
  nba3: process.env.nba3,
  nba4: process.env.nba4,
  nba5: process.env.nba5,
  nba6: process.env.nba6,
  nba7: process.env.nba7,
  nba8: process.env.nba8,
  nba9: process.env.nba9,
  nba10: process.env.nba10,
  nba11: process.env.nba11,
  nba12: process.env.nba12,
};

// 🔒 Memory-safe segment URL storage
const segmentMap = new Map();

// 🧩 M3U8 playlist proxy
app.get('/:stream/index.m3u8', (req, res) => {
  const key = req.params.stream;
  const streamUrl = streams[key];
  if (!streamUrl) return res.status(404).send('❌ Invalid stream key');

  const baseUrl = new URL(streamUrl);
  const basePath = baseUrl.href.substring(0, baseUrl.href.lastIndexOf('/') + 1);

  request.get(streamUrl, (err, response, body) => {
    if (err || response.statusCode !== 200) {
      console.error(`❌ Failed to fetch ${streamUrl}`);
      return res.status(502).send('❌ Failed to fetch playlist');
    }

    let i = 0;
    const modified = body.replace(/^(?!#)(.+)$/gm, (line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return line;
      const fullUrl = new URL(line, basePath).href;

      const token = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i++}`;
      segmentMap.set(token, fullUrl);

      setTimeout(() => segmentMap.delete(token), 60000); // 60s expiry

      return `/segment.ts?token=${token}`;
    });

    res.set({
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length,Content-Range',
    });

    res.send(modified);
  });
});

// 🎬 Segment proxy (supports all video players)
app.get('/segment.ts', (req, res) => {
  const token = req.query.token;
  const segmentUrl = segmentMap.get(token);

  if (!segmentUrl) return res.status(400).send('❌ Invalid or expired token');

  request
    .get({
      url: segmentUrl,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (SmartTV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SmartTV Safari/537.36',
        'Referer': segmentUrl,
        'Origin': 'null',
      },
    })
    .on('response', (r) => {
      res.status(r.statusCode);
      Object.entries(r.headers).forEach(([k, v]) => {
        if (k && v) res.setHeader(k, v);
      });
    })
    .on('error', (err) => {
      console.error(`Segment error: ${err.message}`);
      res.status(502).send('❌ Segment failed');
    })
    .pipe(res);
});

// 🌍 Root page
app.get('/', (req, res) => {
  res.send(`
    <h2>404 NOT FOUND</h2>
    <p>Example: <code></code></p>
  `);
});

// 🚀 Start the server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
