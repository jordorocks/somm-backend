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
        { role: "user", content: `Given the following wine list and dish, recommend 3 wines that would pair well. Format your response as JSON with keys for 'explanation' (max 150 words), 'recommendations' (an array of objects with 'name', 'price', and 'description' (max 50 words each)), and 'conclusion' (max 50 words). Ensure all text fits within these limits. Wine list: ${text}. Dish: ${dish}` }
      ],
      max_tokens: 1000,  // Increase token limit
    });

    let recommendation = JSON.parse(completion.choices[0].message.content);

    // Truncate descriptions if they're still too long
    recommendation.recommendations = recommendation.recommendations.map(wine => ({
      ...wine,
      description: wine.description.split(' ').slice(0, 50).join(' ') + (wine.description.split(' ').length > 50 ? '...' : '')
    }));

    // Truncate explanation and conclusion if they're too long
    recommendation.explanation = recommendation.explanation.split(' ').slice(0, 150).join(' ') + (recommendation.explanation.split(' ').length > 150 ? '...' : '');
    recommendation.conclusion = recommendation.conclusion.split(' ').slice(0, 50).join(' ') + (recommendation.conclusion.split(' ').length > 50 ? '...' : '');

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