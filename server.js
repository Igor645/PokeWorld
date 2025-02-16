const express = require('express');
const path = require('path');
const app = express();

const staticPath = path.join(__dirname, 'dist', 'poke-world-angular', 'browser');

// Serve static files from the browser folder
app.use(express.static(staticPath));

// For all GET requests, send back index.html so that Angular can handle routing
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
