// server.js
require('dotenv').config();
const express = require('express');
const request = require('request');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const port = process.env.PORT || 3000;

// 🌐 CORS for all video players (Shaka, HLS.js, Safari)
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Origin', 'Referer', 'User-Agent'],
  exposedHeaders: [
    'Content-Length',
    'Content-Range',
    'Accept-Ranges',
    'Cache-Control',
    'Date',
    'ETag',
  ],
}));

// 🎞️ Stream list (set in .env or hardcode here)
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
  heartofasia: process.env.heartofasia,
  iheartmovies: process.env.iheartmovies,
  gma: process.env.gma,
  gtv: process.env.gtv,
  kapamilyahd: process.env.kapamilyahd,
};

// 🕒 Token map (for segment URLs)
const segmentMap = new Map();

function setSegmentToken(url) {
  const token = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  segmentMap.set(token, url);
  // valid for 5 minutes
  setTimeout(() => segmentMap.delete(token), 5 * 60 * 1000);
  return token;
}

// 🧩 HLS playlist proxy (.m3u8)
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

    const modified = body.replace(/^(?!#)(.+)$/gm, (line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return line;
      const fullUrl = new URL(line, basePath).href;
      const token = setSegmentToken(fullUrl);
      return `/segment.ts?token=${token}`;
    });

    res.set({
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });

    res.send(modified);
  });
});

// 🎬 DASH manifest proxy (.mpd)
app.get('/:stream/manifest.mpd', (req, res) => {
  const key = req.params.stream;
  const streamUrl = streams[key];
  if (!streamUrl) return res.status(404).send('❌ Invalid stream key');

  const baseUrl = new URL(streamUrl);
  const basePath = baseUrl.href.substring(0, baseUrl.href.lastIndexOf('/') + 1);

  request.get(streamUrl, (err, response, body) => {
    if (err || response.statusCode !== 200) {
      console.error(`❌ Failed to fetch ${streamUrl}`);
      return res.status(502).send('❌ Failed to fetch MPD');
    }

    // Replace BaseURL and SegmentURL with proxied endpoints
    const modified = body
      .replace(/<BaseURL>(.*?)<\/BaseURL>/g, (match, url) => {
        const fullUrl = new URL(url, basePath).href;
        const token = setSegmentToken(fullUrl);
        return `<BaseURL>/segment.m4s?token=${token}</BaseURL>`;
      })
      .replace(/<SegmentURL media="(.*?)"/g, (match, url) => {
        const fullUrl = new URL(url, basePath).href;
        const token = setSegmentToken(fullUrl);
        return `<SegmentURL media="/segment.m4s?token=${token}"`;
      });

    res.set({
      'Content-Type': 'application/dash+xml',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });

    res.send(modified);
  });
});

// 🎥 Segment proxy (supports .ts and .m4s)
app.get(['/segment.ts', '/segment.m4s'], (req, res) => {
  const token = req.query.token;
  const segmentUrl = segmentMap.get(token);
  if (!segmentUrl) return res.status(400).send('❌ Invalid or expired token');

  const range = req.headers.range;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Referer': segmentUrl,
    'Origin': 'null',
  };
  if (range) headers['Range'] = range;

  request
    .get({ url: segmentUrl, headers })
    .on('response', (r) => {
      res.status(r.statusCode);
      Object.entries(r.headers).forEach(([k, v]) => {
        if (k && v) res.setHeader(k, v);
      });

      if (req.path.endsWith('.ts'))
        res.setHeader('Content-Type', 'video/mp2t');
      else if (req.path.endsWith('.m4s'))
        res.setHeader('Content-Type', 'video/mp4');
    })
    .on('error', (err) => {
      console.error(`Segment error: ${err.message}`);
      res.status(502).send('❌ Segment failed');
    })
    .pipe(res);
});

// 🧪 Built-in Shaka Player test page
app.get('/test', (req, res) => {
  res.send(`
  
  `);
});

// Root
app.get('/', (req, res) => {
  res.send(`<h2>404 error</h2><p> <a href=""></a></p>`);
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
