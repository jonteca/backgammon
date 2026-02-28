const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = 3001; // Different from both React (3000) and WildBG (8080)

// More detailed CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Test endpoint that checks WildBG connectivity
app.get('/test', async (req, res) => {
  try {
    // Try to access the Swagger UI - we know this works
    const response = await fetch('http://localhost:8080/swagger-ui');
    if (response.ok) {
      res.json({ 
        status: 'ok',
        message: 'Successfully connected to WildBG engine'
      });
    } else {
      res.status(502).json({ 
        status: 'error',
        message: 'WildBG engine responded with status: ' + response.status
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'error',
      message: 'Could not connect to WildBG engine: ' + error.message
    });
  }
});

// Proxy endpoint for WildBG
app.get('/move', async (req, res) => {
  try {
    const wildBgUrl = 'http://localhost:8080/move' + req.url.substring(req.url.indexOf('?'));
    console.log('Proxying request to:', wildBgUrl);
    
    const response = await fetch(wildBgUrl, {
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      console.error('WildBG error:', response.status, response.statusText);
      throw new Error(`WildBG responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('WildBG response:', data);
    res.json(data);
  } catch (error) {
    console.error('Error proxying to WildBG:', error.message);
    res.status(500).json({ 
      error: 'Failed to get move from WildBG',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message
  });
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
  console.log('Configured to proxy requests to WildBG at http://localhost:8080');
}); 