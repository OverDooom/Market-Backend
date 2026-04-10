require('dotenv').config();

const express = require('express');
const app = express();



app.use(express.json());

app.use('/api/products', require('./routes/product.routes'));

module.exports = app;