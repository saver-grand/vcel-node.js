export default async function handler(req, res) {
  const { path } = req.query;

  // Map of your redirect streams
  const streams = {
    "1": "https://nami.videobss.com/live/hd-en-2-3866852.m3u8",
    // Add more: "2": "https://example.com/stream2.m3u8"
  };

  const target = streams[path];

  if (!target) {
    return res.status(404).send("Stream not found");
  }

  // Redirect to the real m3u8 link
  res.writeHead(302, { Location: target });
  res.end();
}
