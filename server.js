// server.js
require('dotenv').config();
const express = require('express');
const request = require('request');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const port = process.env.PORT || 3000;

// 🌐 Allow only your site to use this API
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*", // e.g. "https://yourdomain.com"
}));

// ✅ Stream channel map (use environment variables, not hardcoded)
const streams = {
  gma7: process.env.GMA7_URL,
  cinemoph: process.env.CINEMOPH_URL,
  kapamilyachannelHD: process.env.KAPAMILYA_URL,
  gtv: process.env.GTV_URL,
  cinemaoneph: process.env.CINEMAONE_URL,
  alltv2: process.env.ALLTV_URL,
  net25: process.env.NET25_URL,
};

// 🔒 Temporary segment token map
const segmentMap = new Map();

// 📺 Proxy M3U8 playlists
app.get('/:stream/playlist.m3u8', (req, res) => {
  const key = req.params.stream;
  const streamUrl = streams[key];
  if (!streamUrl) return res.status(404).send('❌ Invalid stream key');

  const baseUrl = new URL(streamUrl);
  const basePath = baseUrl.href.substring(0, baseUrl.href.lastIndexOf('/') + 1);

  request.get(streamUrl, (err, response, body) => {
    if (err || response.statusCode !== 200) {
      return res.status(502).send('❌ Failed to fetch playlist');
    }

    let i = 0;
    const modified = body.replace(/^(?!#)(.+)$/gm, (line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return line;
      const fullUrl = new URL(line, basePath).href;

      // 🔑 Generate a unique token
      const token = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i++}`;
      segmentMap.set(token, fullUrl);

      // Auto-expire token after 60s
      setTimeout(() => segmentMap.delete(token), 60000);

      return `/segment.ts?token=${token}`;
    });

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(modified);
  });
});

// 🎬 Proxy segment.ts with token lookup
app.get('/segment.ts', (req, res) => {
  const token = req.query.token;
  const segmentUrl = segmentMap.get(token);

  if (!segmentUrl) return res.status(400).send('❌ Invalid or expired token');

  request
    .get(segmentUrl)
    .on('response', (r) => res.set(r.headers))
    .on('error', () => res.status(502).send('❌ Segment failed'))
    .pipe(res);
});

// 🌐 Root
app.get('/', (req, res) => {
  res.send('404 NOT FOUND');
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
