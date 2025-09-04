import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
const upload = multer({ dest: "/tmp" }); // tmp biar kompatibel di Vercel

app.post("/api/tofigur", upload.single("photo"), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const filePath = req.file.path;
    const imageBytes = fs.readFileSync(filePath).toString("base64");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Use the SONDENO_ model to create a 1/7 scale commercialized figure of the motorcycle in the illustration..."
                },
                {
                  inline_data: { mime_type: "image/png", data: imageBytes }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();
    if (!data.candidates) return res.status(500).json({ success: false });

    const parts = data.candidates[0].content.parts;
    const imagePart = parts.find((p) => p.inline_data);
    if (!imagePart) return res.status(500).json({ success: false });

    res.json({
      success: true,
      result: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default app;
