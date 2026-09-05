const express = require('express');
const path = require('path');
const app = express();

const staticPath  = path.join(__dirname, 'dist', 'poke-world-angular', 'browser');
const publicPath  = path.join(__dirname, 'public');

// Serve public/ directly so image assets don't require a rebuild
app.use(express.static(publicPath));
app.use(express.static(staticPath));

app.get('*path', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
