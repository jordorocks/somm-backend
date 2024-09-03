const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// Configure CORS
app.use(cors({
  origin: ['https://sommai.netlify.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors()); // Handle preflight requests

// Logging middleware
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`);
  next();
});

const upload = multer({ dest: '/tmp/uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function standardizePrice(price) {
  // Remove any non-numeric characters except for '/' and '.'
  price = price.replace(/[^\d./]/g, '');
  
  // Split the price if it contains a slash (for glass/bottle prices)
  const prices = price.split('/');
  
  // Format each price
  const formattedPrices = prices.map(p => {
    const num = parseFloat(p);
    return isNaN(num) ? p : `$${num.toFixed(2)}`;
  });
  
  // Join the prices back together if there were multiple
  return formattedPrices.join(' / ');
}

app.post('/', upload.single('wineListPhoto'), async (req, res) => {
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
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful sommelier assistant who uses fun, friendly mildly flirty language." },
        { role: "user", content: `Given the following wine list and dish, recommend EXACTLY 3 wines that would pair well. Your response MUST contain only 3 wine recommendations, no more and no less. NEVER give an incomplete response, all sentences must be finished. Format your response as JSON with keys for 'explanation' (max 150 words), 'recommendations' (an array of EXACTLY 3 objects with 'name', 'price', and 'description' ), and 'conclusion' (max 50 words). Ensure all text fits within these limits and that the JSON is properly formatted. Wine list: ${text}. Dish: ${dish}` }
      ],
      max_tokens: 2500,
    });

    let recommendation;
    try {
      recommendation = JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.log('Raw AI response:', completion.choices[0].message.content);
      throw new Error('AI response was not valid JSON');
    }

    console.log('Raw AI response:', recommendation);

    // Check if there are exactly 3 recommendations
    if (recommendation.recommendations.length !== 3) {
      throw new Error('AI did not provide exactly 3 recommendations');
    }

    // Safeguard: Truncate if limits are exceeded and standardize price format
    recommendation.explanation = recommendation.explanation.split(' ').slice(0, 150).join(' ') + (recommendation.explanation.split(' ').length > 150 ? '...' : '');
    recommendation.recommendations = recommendation.recommendations.slice(0, 3).map(wine => ({
      ...wine,
      description: wine.description.split(' ').slice(0, 50).join(' ') + (wine.description.split(' ').length > 50 ? '...' : ''),
      price: standardizePrice(wine.price)
    }));
    recommendation.conclusion = recommendation.conclusion.split(' ').slice(0, 50).join(' ') + (recommendation.conclusion.split(' ').length > 50 ? '...' : '');

    console.log('Processed recommendation:', recommendation);

    res.json(recommendation);
  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5003;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// For Netlify Functions
module.exports.handler = serverless(app);

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});