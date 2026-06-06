require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


const errorMiddleware = require('./middleware/error.middleware');
const ProductRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const reviewRoutes = require('./routes/review.routes');
const notificationRoutes = require('./routes/notification.routes');
const addressRoutes = require('./routes/address.routes');
const pricingRoutes = require('./routes/pricing.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const analyticsRoutes = require('./routes/analytics.routes');

app.use(express.json({ limit: '10kb' }));

app.use(express.json());
app.use('/api/products', ProductRoutes);
app.use("/api/categories", categoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/admin/analytics', analyticsRoutes);



app.use(errorMiddleware);

module.exports = app;