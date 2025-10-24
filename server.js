const express = require('express');
const path = require('path');
const app = express();

const staticPath = path.join(__dirname, 'dist', 'poke-world-angular', 'browser');

app.use(express.static(staticPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
