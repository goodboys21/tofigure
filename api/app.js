import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

/**
 * Upload image -> convert via apizell.web.id
 * Endpoint: /api/convert?imageUrl=...
 */
app.get("/api/convert", async (req, res) => {
  try {
    const { imageUrl } = req.query;
    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl parameter required" });
    }

    const prompt =
      "Use the SONDENO_ model to create a 1/7 scale commercialized figure of the motorcycle in the illustration, in a realistic style and environment. Place the figure on a computer desk, using a circular transparent acrylic base without any text.On the computer screen, display the ZBrush modeling process of the figure. Next to the computer";

    const apiUrl = `https://apizell.web.id/ai/editimg?imageUrl=${encodeURIComponent(
      imageUrl
    )}&prompt=${encodeURIComponent(prompt)}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(500).json({ error: "Conversion failed at API" });
    }

    // Pipe blob result ke browser
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Error proxying:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default app;
