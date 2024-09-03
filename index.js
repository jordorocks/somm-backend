const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ['https://sommai.netlify.app', 'http://localhost:3000']
}));

app.use(express.json());

const upload = multer({ dest: '/tmp/uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/submit', upload.single('wineListPhoto'), async (req, res) => {
  try {
    const { dish } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(req.file.path);
    await worker.terminate();

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful sommelier assistant." },
        { role: "user", content: `Given the following wine list and dish, recommend 3 wines that would pair well. Format your response as JSON with keys for 'explanation', 'recommendations' (an array of objects with 'name', 'price', and 'description'), and 'conclusion'. Wine list: ${text}. Dish: ${dish}` }
      ],
    });

    const recommendation = JSON.parse(completion.choices[0].message.content);

    res.json(recommendation);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5003;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// For Netlify Functions
module.exports.handler = serverless(app);