require('dotenv').config();

const express = require('express');
const app = express();
const categoryRoutes = require("./routes/category.routes");



app.use(express.json());

app.use('/api/products', require('./routes/product.routes'));
app.use("/api/categories", categoryRoutes);

module.exports = app;