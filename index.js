const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Summer Camp is running!')
})

app.listen(port, () => {
  console.log(`summer camp listening on port ${port}`)
})