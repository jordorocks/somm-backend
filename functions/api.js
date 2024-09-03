const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { createWorker } = require('tesseract.js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

console.log('API function loaded');

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// CORS configuration
app.use(cors({
  origin: ['https://sommai.netlify.app', 'http://localhost:3000'],
  credentials: true
}));

// Logging middleware for all requests
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper function to standardize price
function standardizePrice(price) {
  // Implementation remains the same
}

// Make sure this line is at the beginning of your routes
app.post('/submit', upload.single('wineListPhoto'), async (req, res) => {
  console.log('Received POST request to /submit');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  try {
    const { dish } = req.body;
    const wineListPhoto = req.file;

    if (!dish || !wineListPhoto) {
      return res.status(400).json({ error: "Missing dish or wine list photo" });
    }

    // OCR Processing
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(wineListPhoto.path);
    await worker.terminate();

    console.log('OCR Result:', text);

    // OpenAI Processing
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Corrected from "gpt-4o" to "gpt-4"
      messages: [
        { role: "system", content: "You are a sommelier. Recommend wines based on the dish and wine list provided." },
        { role: "user", content: `Dish: ${dish}\nWine List:\n${text}\nRecommend 2-3 wines from this list that pair well with the dish. Include the wine name, price, and a brief description of why it pairs well. Format the response as JSON with keys: explanation, recommendations (array of objects with name, price, pairing), and conclusion.` }
      ],
    });

    let recommendation = JSON.parse(completion.choices[0].message.content);

    // Standardize prices in the recommendation
    recommendation.recommendations.forEach(wine => {
      wine.price = standardizePrice(wine.price);
    });

    // Ensure the response structure matches what the front-end expects
    const formattedResponse = {
      explanation: recommendation.explanation,
      recommendations: recommendation.recommendations.map(wine => ({
        name: wine.name,
        price: wine.price,
        pairing: wine.description || wine.pairing // Ensure we use the correct key
      })),
      conclusion: recommendation.conclusion
    };

    // Add this just before sending the response
    console.log('Sending response:', JSON.stringify(formattedResponse, null, 2));

    res.json(formattedResponse);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Add a simple GET route for testing
app.get('/', (req, res) => {
  res.json({ message: "Hello from the API" });
});

// New test route
app.get('/test', (req, res) => {
  res.json({ message: "Test route success!" });
});

// Move the catch-all route to the end of your routes
app.use('*', (req, res) => {
  console.log('Catch-all route hit');
  res.json({ message: "Catch-all route" });
});

module.exports.handler = serverless(app);