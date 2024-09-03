const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// Logging
console.log('Function loaded');

// CORS configuration
app.use(cors({
  origin: '*', // Be more restrictive in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`);
  next();
});

const upload = multer({ dest: '/tmp/uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Your existing helper functions here (e.g., standardizePrice)

app.post('/', upload.single('wineListPhoto'), handleRequest);
app.post('/:path', upload.single('wineListPhoto'), handleRequest);

async function handleRequest(req, res) {
  console.log('Request received:', req.method, req.url);
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);

  try {
    const { dish } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Your existing logic here (OCR, OpenAI call, etc.)
    // ...

    res.json(recommendation);
  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8888;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports.handler = serverless(app);