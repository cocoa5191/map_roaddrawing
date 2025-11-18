const express = require('express');
const router = express.Router();

// Define a route for the home page
router.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// Add more routes as needed

module.exports = router;