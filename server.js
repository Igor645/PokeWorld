const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the dist folder
app.use(express.static(path.join(__dirname, 'dist', 'poke-world-angular')));

// For all GET requests, send back index.html so that PathLocationStrategy can be used
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'poke-world-angular', 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
