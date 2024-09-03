const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// Replace the existing CORS configuration with this:
app.use(cors({
  origin: 'https://sommai.netlify.app',
  credentials: true
}));

// Add a simple GET route
app.get('/', (req, res) => {
  res.json({ message: "Hello from the API" });
});

// Add a catch-all route
app.use('*', (req, res) => {
  res.json({ message: "Catch-all route" });
});

// Export the serverless function
module.exports.handler = serverless(app);