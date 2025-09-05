const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const cors = require('cors');
const formidable = require('formidable');

const app = express();
const tmpDir = '/tmp';

// Enable CORS
app.use(cors());

// Pastikan folder /tmp ada
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// Scrape API key
async function scrapeApiKey() {
  const { data: html } = await axios.get('https://overchat.ai/image/ghibli', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const match = html.match(/const apiKey = '([^']+)'/);
  if (match?.[1]) return match[1];
  throw new Error('API Key tidak ditemukan!');
}

// Upload ke CloudGood
async function uploadToCloudGood(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  const { data } = await axios.post('https://cloudgood.xyz/upload.php', form, {
    headers: form.getHeaders(),
  });
  return data;
}

// Endpoint /tofigure
app.post('/tofigure', async (req, res) => {
  const form = formidable({ multiples: false, uploadDir: tmpDir, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    const imageFile = files.image;
    if (!imageFile) return res.status(400).json({ success: false, message: 'No file uploaded!' });

    try {
      const prompt = fields.prompt || 'Use the SONDENO_ model to create a 1/7 scale commercialized figure of the motorcycle in the illustration, in a realistic style and environment. Place the figure on a computer desk, using a circular transparent acrylic base without any text. On the computer screen, display the ZBrush modeling process of the figure. Next to the computer';
      const apiKey = await scrapeApiKey();

      const openaiForm = new FormData();
      openaiForm.append('image', fs.createReadStream(imageFile.filepath));
      openaiForm.append('prompt', prompt);
      openaiForm.append('model', 'gpt-image-1');
      openaiForm.append('n', 1);
      openaiForm.append('size', '1024x1024');

      const response = await axios.post('https://api.openai.com/v1/images/edits', openaiForm, {
        headers: { ...openaiForm.getHeaders(), Authorization: `Bearer ${apiKey}` },
      });

      const result = response.data;
      if (!result?.data?.[0]?.b64_json) throw new Error('No image returned from API');

      const buffer = Buffer.from(result.data[0].b64_json, 'base64');
      const tmpOutput = path.join(tmpDir, `output-${Date.now()}.png`);
      fs.writeFileSync(tmpOutput, buffer);

      const cloudResponse = await uploadToCloudGood(tmpOutput);

      fs.unlinkSync(imageFile.filepath);
      fs.unlinkSync(tmpOutput);

      res.json({ success: true, message: 'Image converted successfully', result: cloudResponse });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: e.message });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
