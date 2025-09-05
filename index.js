const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const cors = require('cors'); // <-- import cors

const app = express();
const tmpDir = '/tmp';

// === Enable CORS untuk semua origin ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === pastikan folder /tmp ada ===
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const upload = multer({ dest: tmpDir });

// === Scrape API Key dari overchat.ai ===
async function scrapeApiKey() {
  const targetUrl = 'https://overchat.ai/image/ghibli';
  const { data: htmlContent } = await axios.get(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });
  const apiKeyRegex = /const apiKey = '([^']+)'/;
  const match = htmlContent.match(apiKeyRegex);
  if (match?.[1]) return match[1];
  throw new Error('API Key tidak ditemukan!');
}

// === Upload ke CloudGood ===
async function uploadToCloudGood(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  const { data } = await axios.post('https://cloudgood.xyz/upload.php', form, {
    headers: form.getHeaders(),
  });
  return data;
}

// === Endpoint API ===
app.post('/tofigure', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded!' });

    const prompt = req.body.prompt || 'Use the SONDENO_ model to create a 1/7 scale commercialized figure of the motorcycle in the illustration, in a realistic style and environment. Place the figure on a computer desk, using a circular transparent acrylic base without any text. On the computer screen, display the ZBrush modeling process of the figure. Next to the computer';
    const apiKey = await scrapeApiKey();

    const apiUrl = 'https://api.openai.com/v1/images/edits';
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));
    form.append('prompt', prompt);
    form.append('model', 'gpt-image-1');
    form.append('n', 1);
    form.append('size', '1024x1024');

    const response = await axios.post(apiUrl, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
    });
    const result = response.data;

    if (!result?.data?.[0]?.b64_json)
      return res.status(500).json({ success: false, message: 'No image returned from API' });

    // simpan sementara untuk upload ke CloudGood
    const buffer = Buffer.from(result.data[0].b64_json, 'base64');
    const tmpOutput = path.join(tmpDir, `output-${Date.now()}.png`);
    fs.writeFileSync(tmpOutput, buffer);

    const cloudResponse = await uploadToCloudGood(tmpOutput);

    // hapus file sementara
    fs.unlinkSync(req.file.path);
    fs.unlinkSync(tmpOutput);

    return res.json({ success: true, message: 'Image converted successfully', result: cloudResponse });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// === Jalankan server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
