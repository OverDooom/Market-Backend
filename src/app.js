require('dotenv').config();
const express = require('express');
const app = express();


const errorMiddleware = require('./middleware/error.middleware');
const ProductRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');


app.use(express.json());
app.use('/api/products', ProductRoutes);
app.use("/api/categories", categoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorMiddleware);

module.exports = app;