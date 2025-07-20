const express = require('express');
const app = express();

// Define a simple route for health check or welcome message
app.get('/', (req, res) => {
  res.send('Hello, Credverse Scaffold!');
});

// Export the Express app for testing
module.exports = app;

// Start the server only if this file is executed directly
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
