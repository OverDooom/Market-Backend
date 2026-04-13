require('dotenv').config();
const errorMiddleware = require('./middleware/error.middleware');
const express = require('express');
const app = express();
const categoryRoutes = require("./routes/category.routes");



app.use(express.json());

app.use('/api/products', require('./routes/product.routes'));
app.use("/api/categories", categoryRoutes);

app.use(errorMiddleware);

module.exports = app;