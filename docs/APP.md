# Oikos - Complete Application Documentation

**Oikos** is a lightweight, self-hosted expense management system built with Express and PocketBase. It provides privacy-first transaction tracking with a clean, intuitive interface.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Getting Started](#getting-started)
5. [Database Schema](#database-schema)
6. [Frontend](#frontend)
7. [Development](#development)
8. [Deployment](#deployment)

---

## Overview

Oikos is designed to be a simple alternative to commercial expense tracking apps. It emphasizes:

- **Privacy**: All data stays on your own server
- **Simplicity**: No complex features, just expense tracking
- **Self-hosted**: Easy deployment with Docker
- **User-centric**: Regular users only see their own data; admins manage shared reference data

### Tech Stack

- **Backend**: Express.js (Node.js)
- **Database**: PocketBase
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Deployment**: Docker & Docker Compose

---

## Features

### Smart Dashboard
Quick overview of spending for the current month vs. the previous month, with aggregated totals and category breakdowns.

### Flexible Transaction Entry
Log expenses with:
- Date of transaction
- Amount
- Category (with optional subcategories)
- Store/merchant
- Payment method

### On-the-fly Creation
Create new categories, subcategories, stores, or payment methods directly in the transaction form without leaving the page (admin users only).

### Transaction Management
- Full transaction history with easy deletion
- Filter by date range, category, subcategory, store, or payment method
- Pivot-style filtering: choose custom row/column dimensions to see how data aggregates

### Reference Data Management
Manage shared reference data:
- Categories and subcategories
- Stores/merchants
- Payment methods

### User Roles
- **User**: Can only view and manage their own transactions. Can see shared reference data.
- **Admin**: Can manage all reference data and view transactions across all users. Can create reference data on-the-fly during transaction entry.

### Privacy Controls
Users can control email visibility in their account settings.

---

## Architecture

### Backend Structure

The Express server (`server.js`) handles:
- Authentication (registration, login, logout)
- User session management via cookies
- REST API endpoints for transactions and reference data
- Integration with PocketBase for data persistence

### Authentication Flow

1. User registers or logs in via `/api/auth/register` or `/api/auth/login`
2. PocketBase authenticates the user and returns an auth token
3. Token is stored in an `HttpOnly` cookie (`pb_auth`)

### Data Flow

```
Frontend (HTML/JS) 
  → Express Server 
  → PocketBase SDK 
  → PocketBase Database
```

The frontend sends requests to Express endpoints, which use the PocketBase JavaScript SDK to interact with the PocketBase database. User context is maintained via cookies.

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Or: Node.js 22+ and a running PocketBase instance

### Quick Start (Docker)

#### 1. Start the Containers

```bash
docker compose up --build
```

This builds the Express container and pulls the official PocketBase image.

#### 2. Access the Applications

- **App**: http://localhost:3000
- **PocketBase Admin**: http://localhost:8090/_/

#### 3. Create Your Admin Account

Go to the PocketBase admin UI and create your admin user account (this is a required first step).

#### 4. Initialize the Database

```bash
docker compose exec oikos npm run setup:pocketbase
```

This script creates the required collections and schema. It's idempotent, so you can run it whenever you update the app to sync your schema.

#### 5. Make Your User an Admin

```bash
docker compose exec oikos npm run make:admin
```

This promotes your current user to admin so you can manage reference data and see all transactions.

### Port Configuration

If ports 3000 (app) or 8090 (PocketBase) are in use, copy `.env.example` to `.env` and adjust:

```env
APP_PORT=3001
PB_PORT=8091
```

---

## Database Schema

### Collections (Tables)

#### `users`

Stores user accounts. Managed by PocketBase.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `email` | string | Email address (unique) |
| `password` | string | Hashed password |
| `name` | string | User's display name |
| `kind` | string | `"user"` or `"admin"` |
| `emailVisibility` | boolean | Whether email is visible to others |

#### `oikos_categories`

Main expense categories.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Category name (e.g., "Food", "Transport") |

#### `oikos_subcategories`

Subcategories under each category.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Subcategory name (e.g., "Groceries") |
| `category` | relation | Reference to `oikos_categories` |

#### `oikos_stores`

Merchants or stores where transactions occur.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Store name (e.g., "Amazon", "Trader Joe's") |

#### `oikos_payment_methods`

Payment methods used for transactions.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Method name (e.g., "Credit Card", "Cash") |

#### `oikos_transactions`

Individual expense transactions.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `date` | datetime | Transaction date |
| `amount` | number | Transaction amount |
| `category` | relation | Reference to `oikos_categories` |
| `subcategory` | relation | Reference to `oikos_subcategories` |
| `store` | relation | Reference to `oikos_stores` |
| `payment_method` | relation | Reference to `oikos_payment_methods` |
| `user` | relation | Reference to `users` (owner of transaction) |

---

## Frontend

The frontend is a single-page application built with vanilla HTML, CSS, and JavaScript.

### Main Pages

Accessed via routes in `server.js`, all serve `public/index.html` (the main app shell):

- `/` – Dashboard (home)
- `/transactions` – Transaction list with filtering
- `/categories` – Manage categories and subcategories (admin only)
- `/stores` – Manage stores (admin only)
- `/payment-methods` – Manage payment methods (admin only)
- `/users` – Manage users (admin only)
- `/me` – User profile and settings

### Static Assets

All static files are served from the `public/` folder:

| File | Purpose |
|------|---------|
| `index.html` | Main app shell and authentication gateway |
| `app.js` | Core application logic and routing |
| `layout.js` | Layout/sidebar navigation component |
| `head.js` | Header component with user info |
| `styles.css` | Application styles |
| `categories.html` | Category management template |
| `dashboard.html` | Dashboard template |
| `filter.html` | Transaction filter template |
| `me.html` | User profile template |
| `payment-methods.html` | Payment method management template |
| `stores.html` | Store management template |
| `transactions.html` | Transaction list template |
| `users.html` | User management template (admin only) |
| `sw.js` | Service Worker (offline support) |
| `manifest.json` | Web app manifest (PWA metadata) |
| `seo.config.js` | SEO configuration |

### Key JavaScript Modules

#### `app.js`

Main application controller. Handles:
- Route navigation
- Page rendering
- API communication
- State management
- UI event binding

#### `layout.js`

Navigation sidebar and layout wrapper. Shows:
- Current user info
- Navigation menu
- Links to different pages
- Admin-only sections

#### `head.js`

Header/top bar component. Shows:
- App title
- User actions (profile, logout)

### Frontend Features

**Authentication Gate**: `index.html` checks login status on load. Redirects unauthenticated users to login/register.

**Client-side Routing**: `app.js` uses URL hash or pathname to determine which page to display.

**API Integration**: Frontend communicates with Express server via `fetch()` calls to REST endpoints.

**Form Handling**: Transaction and reference data forms validate input and send POST/PUT requests.

**Responsive Design**: CSS media queries ensure usability on mobile and desktop.

---

## Development

### Prerequisites

- Node.js 22+
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file (or use defaults):

```env
PORT=3000
PB_URL=http://127.0.0.1:8090
PB_TOKEN=
COOKIE_SECURE=false
APP_PORT=3000
PB_PORT=8090
```

**Variables**:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Express server port |
| `PB_URL` | `http://127.0.0.1:8090` | PocketBase server URL |
| `PB_TOKEN` | (empty) | Optional PocketBase admin token for setup |
| `COOKIE_SECURE` | `false` | Set to `true` in HTTPS production |
| `APP_PORT` | `3000` | Docker compose app port |
| `PB_PORT` | `8090` | Docker compose PocketBase port |

### Scripts

#### Development

Start the server in watch mode:

```bash
npm run dev
```

Changes to `server.js` trigger automatic restarts.

#### Production

Start the server normally:

```bash
npm start
```

#### Linting & Checks

Validate JavaScript syntax:

```bash
npm run check
```

This checks:
- `server.js`
- `public/app.js`, `layout.js`, `head.js`, `seo.config.js`
- `scripts/*.mjs`

#### Database Setup

Initialize PocketBase collections and schema:

```bash
npm run setup:pocketbase
```

This is idempotent and can be run multiple times safely.

#### Make User an Admin

Promote a user to admin:

```bash
npm run make:admin
```

This will prompt for an email address and update the user's `kind` to `"admin"`.

---

## Deployment

### Docker Deployment

The app is designed to run in Docker with PocketBase.

#### Prerequisites

- Docker Engine
- Docker Compose

#### Dockerfile

The `Dockerfile` builds a production-ready Node.js 22 Alpine image:

```dockerfile
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY public ./public
COPY scripts ./scripts
EXPOSE 3000
CMD ["node", "server.js"]
```

#### Docker Compose

The `compose.yml` file defines two services:

- **oikos**: Express app (builds from Dockerfile)
- **pocketbase**: Official PocketBase image

**Start all services**:

```bash
docker compose up --build
```

**Stop services**:

```bash
docker compose down
```

**View logs**:

```bash
docker compose logs -f oikos
docker compose logs -f pocketbase
```

**Run setup in Docker**:

```bash
docker compose exec oikos npm run setup:pocketbase
docker compose exec oikos npm run make:admin
```

### Environment Configuration

Set environment variables in a `.env` file or via `docker compose`:

```env
APP_PORT=3000
PB_PORT=8090
COOKIE_SECURE=true
PB_URL=http://pocketbase:8090
```

### Network

- **oikos** (Express): Exposed on `APP_PORT` (default 3000)
- **pocketbase** (PocketBase): Exposed on `PB_PORT` (default 8090)
- Internal communication: Services use `http://pocketbase:8090` (Docker internal DNS)

### Data Persistence

PocketBase stores data in `pb_data/` volume (persists across container restarts).

### HTTPS / Reverse Proxy

For production HTTPS, deploy behind a reverse proxy (e.g., Nginx, Caddy) that:

1. Terminates TLS
2. Sets `COOKIE_SECURE=true` in the environment
3. Proxies requests to the app container

---

## Troubleshooting

### PocketBase Connection Error

**Error**: `Make sure PocketBase is running and run npm run setup:pocketbase once.`

**Solution**:
1. Ensure PocketBase container is running: `docker compose ps`
2. Check PocketBase logs: `docker compose logs pocketbase`
3. Reinitialize schema: `docker compose exec oikos npm run setup:pocketbase`

### Authentication Issues

**Problem**: User logged out unexpectedly.

**Possible causes**:
- PocketBase token expired
- Cookies not being sent (check `SameSite` and domain settings)
- Server restarted

**Solution**:
- Log in again
- Check browser cookie storage
- Review Express cookie settings in `server.js`

### Port Already in Use

**Error**: `Port 3000 already in use`

**Solution**:
```bash
cp .env.example .env
# Edit .env and change APP_PORT and PB_PORT
docker compose up --build
```

### Database Schema Mismatch

**Error**: `409 Conflict` on API requests

**Solution**:
```bash
docker compose exec oikos npm run setup:pocketbase
```

---

## License

See [LICENSE](../LICENSE) for license information.

---

## Support

For issues, questions, or contributions, refer to the project repository or documentation.
