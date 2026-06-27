# 🛒 Market Backend

A production-ready RESTful API for a full-featured e-commerce platform, built with **Node.js**, **Express**, and **PostgreSQL**. Designed with clean architecture, security best practices, and a comprehensive feature set covering everything from auth to analytics.

---

## ✨ Features

- **Authentication & Security** — JWT access tokens with opaque refresh token rotation, reuse detection, family-based session invalidation, and bcrypt password hashing
- **Product Catalog** — Products with soft-delete, multi-variant support, attribute system (color, size, etc.), auto-generated SKUs, and image handling
- **Cart & Checkout** — Row-locked cart checkout, stock validation, atomic order creation with full inventory ledger entries
- **Order Management** — Strict status state machine (`pending → paid → shipped → delivered / cancelled`), self-cancel for customers, full status history log
- **Promotions Engine** — Percentage & fixed discounts, automatic or coupon-required promotions, stackable rules, product/category/user targeting, per-user and global usage limits, first-order-only logic
- **Reviews** — One review per user per product, rating validation, admin moderation
- **Wishlist** — Add/remove/check/clear, upsert-safe
- **Notifications** — Real-time push via **Socket.io**, mark-as-read, admin broadcast to all users or targeted user lists
- **Analytics Dashboard** — Revenue trends, top products/categories, user growth, promotion performance, inventory health, review analytics
- **Admin Panel** — Full CRUD over users, orders, reviews, notifications, promotions, and coupons
- **Inventory Ledger** — Every stock movement (checkout, cancellation, restock, admin edit) is recorded with reason, reference, and actor
- **Rate Limiting** — Login/register/refresh endpoints protected against brute-force with `express-rate-limit`
- **Address Book** — Multiple saved addresses per user, validated and scoped per user

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | PostgreSQL (via `pg` connection pool) |
| Auth | JWT (access) + opaque tokens (refresh) |
| Real-time | Socket.io |
| Security | Helmet, CORS, bcrypt, rate limiting |
| Testing | Jest + Supertest |

---

## 🏗️ Architecture

The project follows a clean **layered architecture**:

```
src/
├── routes/        # Express routers — URL mapping only
├── controllers/   # Request/response handling, input validation
├── services/      # Business logic, DB queries
├── middleware/    # Auth, roles, rate limiting, error handling
├── utils/         # JWT, hashing, sanitization, SKU generation
├── config/        # Database pool
└── socket/        # Socket.io initialization and auth
```

Controllers stay thin — they parse inputs and delegate entirely to services. Services own all business logic and SQL. This keeps each layer independently testable and easy to reason about.

---

## 🔐 Auth Flow

```
POST /api/auth/register   → hashed password stored, user created
POST /api/auth/login      → access token (15m) + refresh token (7d) issued
POST /api/auth/refresh    → old refresh token revoked, new pair issued (rotation)
POST /api/auth/logout     → single token revoked
POST /api/auth/logout-all → all tokens for user revoked
```

**Refresh token security highlights:**
- Tokens stored as SHA-256 hashes — never in plaintext
- Token families: replaying a used token revokes the entire family and forces re-login
- Automatic cleanup service for expired/revoked tokens

---

## 🛍️ Order State Machine

```
pending ──▶ paid ──▶ shipped ──▶ delivered
   │           │
   └───────────┴──▶ cancelled
```

- Customers can self-cancel `pending` orders only
- Admins can advance or cancel at any allowed transition
- Cancelled orders from `pending` or `paid` automatically restore stock
- Every transition is logged in `order_status_history` with actor, timestamp, and notes

---

## 💸 Promotions Engine

Promotions support a rich set of conditions evaluated at checkout:

| Feature | Supported |
|---|---|
| Percentage discount | ✅ |
| Fixed amount discount | ✅ |
| Automatic (no coupon needed) | ✅ |
| Coupon-gated | ✅ |
| Stackable promotions | ✅ |
| Min cart total | ✅ |
| First order only | ✅ |
| Global usage limit | ✅ |
| Per-user usage limit | ✅ |
| Product targeting | ✅ |
| Category targeting | ✅ |
| User targeting | ✅ |

When multiple promotions apply, the best non-stackable promotion wins. Stackable promotions always apply on top.

---

## 📡 Real-time Notifications

Notifications are pushed live to connected clients via Socket.io:

```js
// Client side
socket.emit('join', accessToken);
socket.on('notification', (notification) => { /* handle */ });
```

Triggered automatically on order status changes, and can be sent manually by admins to individual users or broadcast to all users.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
git clone https://github.com/OverDooom/Market-Backend.git
cd Market-Backend
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/market_db
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### Run

```bash
# Development
npm run dev

# Production
npm start
```

The server starts on port **3000**.

---

## 🧪 Testing

The test suite uses **Jest** and **Supertest** with an isolated test database.

```bash
npm test
```

Tests run sequentially (`--runInBand`) to avoid race conditions on shared DB state. Rate limiting is automatically disabled in the test environment.

Test files cover: auth, products, variants, categories, cart, orders, reviews, wishlist, notifications, address, pricing, and admin endpoints.

---

## 📋 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register a new user |
| POST | `/api/auth/login` | — | Login, receive token pair |
| POST | `/api/auth/refresh` | — | Rotate refresh token |
| POST | `/api/auth/logout` | — | Revoke refresh token |
| POST | `/api/auth/logout-all` | Bearer | Revoke all sessions |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | — | List products (paginated, search, filter) |
| GET | `/api/products/:id` | Optional | Get product with variants |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Soft-delete product |
| GET | `/api/products/:id/variants` | — | List variants for product |
| POST | `/api/products/:id/variants` | Admin | Create variant |
| PUT | `/api/products/:id/variants/:variantId` | Admin | Update variant |
| DELETE | `/api/products/:id/variants/:variantId` | Admin | Delete variant |

### Cart
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | Bearer | Get cart with items |
| POST | `/api/cart/items` | Bearer | Add item to cart |
| DELETE | `/api/cart/items/:itemId` | Bearer | Remove item |
| DELETE | `/api/cart` | Bearer | Clear cart |

### Orders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/orders/checkout` | Bearer | Checkout cart → create order |
| GET | `/api/orders` | Bearer | Get my orders |
| GET | `/api/orders/:id` | Bearer | Get order detail |
| POST | `/api/orders/:id/cancel` | Bearer | Cancel pending order |
| GET | `/api/orders/:id/history` | Bearer | Status change history |
| PUT | `/api/orders/:id/status` | Admin | Update order status |

### Reviews
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/reviews/product/:productId` | Bearer | Create review |
| GET | `/api/reviews/product/:productId` | — | Get product reviews |
| PUT | `/api/reviews/:id` | Bearer | Update own review |
| DELETE | `/api/reviews/:id` | Bearer | Delete own review |

### Pricing
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/pricing/cart` | Bearer | Preview cart total with coupons |

### Wishlist
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/wishlist` | Bearer | Get wishlist |
| POST | `/api/wishlist` | Bearer | Add product |
| GET | `/api/wishlist/:productId/check` | Bearer | Check if in wishlist |
| DELETE | `/api/wishlist/:productId` | Bearer | Remove product |
| DELETE | `/api/wishlist` | Bearer | Clear wishlist |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET/PUT/DELETE | `/api/admin/users/:id` | Manage users |
| GET | `/api/admin/orders` | List all orders (filterable) |
| GET/DELETE | `/api/admin/reviews` | Moderate reviews |
| GET/POST/DELETE | `/api/admin/notifications` | Manage & broadcast notifications |
| GET | `/api/admin/wishlist/stats` | Most-wishlisted products |
| CRUD | `/api/admin/promotions` | Manage promotions and coupons |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/analytics/dashboard` | Aggregated dashboard data |
| GET | `/api/admin/analytics/revenue` | Revenue over time (daily/weekly/monthly/yearly) |
| GET | `/api/admin/analytics/orders` | Order volume and status breakdown |
| GET | `/api/admin/analytics/top-products` | Best-selling products |
| GET | `/api/admin/analytics/top-categories` | Revenue by category |
| GET | `/api/admin/analytics/users` | User growth and top customers |
| GET | `/api/admin/analytics/inventory` | Low stock, out of stock, restock history |
| GET | `/api/admin/analytics/reviews` | Rating distribution and top/lowest rated |
| GET | `/api/admin/analytics/promotions` | Promotion usage and coupon performance |

---

## 🗄️ Database Schema Highlights

The schema is designed for correctness and auditability:

- **`refresh_tokens`** — stores token hashes, family IDs, expiry, revocation timestamp, and the hash of the replacement token for full audit trail
- **`order_status_history`** — immutable log of every status transition with actor and notes
- **`inventory_transactions`** — ledger of every stock movement with reason, reference, and actor
- **`promotion_usage`** — records every discount applied per order, enabling accurate analytics and usage-limit enforcement
- **`user_activity`** — fire-and-forget log of key user actions (login, logout, place order, cancel order)
- **`product_views`** — per-user product view tracking for future recommendation features

---

## 📁 Project Structure

```
overdooom-market-backend/
├── src/
│   ├── app.js                    # Express setup, middleware, routes
│   ├── server.js                 # HTTP server + Socket.io init
│   ├── config/db.js              # PostgreSQL pool
│   ├── controllers/              # Route handlers
│   ├── services/                 # Business logic & DB access
│   ├── middleware/               # Auth, roles, rate limiting, errors
│   ├── routes/                   # Express routers
│   ├── socket/socket.js          # Socket.io with JWT auth
│   └── utils/                    # JWT, hashing, sanitize, SKU
└── tests/                        # Jest + Supertest test suites
```

---

## 🔒 Security Practices

- Passwords hashed with **bcrypt** (10 salt rounds)
- Refresh tokens stored as **SHA-256 hashes** — raw token only ever sent to client
- **Token family invalidation** on replay detection
- **Helmet** sets secure HTTP headers
- **CORS** restricted to configured origin
- Request body size limited to **10kb**
- Input sanitization and length validation on all user-supplied strings
- Role-based access control via `auth` + `role` middleware chain
- Rate limiting on auth endpoints to prevent brute-force

---

## 📄 License

ISC

---

## 📝 A Note on This Repository

**On AI assistance:** This project was built with the help of AI tools (primarily Claude by Anthropic). AI was used as a learning aid and coding assistant throughout development — helping reason through design decisions, catch bugs, and write boilerplate. The architecture, feature set, and all design choices were driven by me. I believe being transparent about AI use is more valuable than pretending otherwise, especially as AI-assisted development becomes a standard part of the industry.

**On `.env` and `node_modules`:** In a production repository these would never be committed — `.env` files contain secrets and `node_modules` belongs in `.gitignore`. They are included here intentionally because this repo is connected live to [Render.com](https://render.com) for deployment convenience, and the project is primarily educational. I'm aware of the best practice and have made a deliberate trade-off for ease of demonstration.
