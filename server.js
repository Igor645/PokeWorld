const express = require('express');
const path = require('path');
const app = express();

// Define the static folder for client assets
const staticPath = path.join(__dirname, 'dist', 'poke-world-angular', 'browser');

// Serve static files first
app.use(express.static(staticPath));

// Fallback to index.html for any other routes (for Angular's routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
