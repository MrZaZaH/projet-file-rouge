# Projet File Rouge — Community Recipe Platform

A community-driven recipe platform focused on authentic, everyday cooking.
No chef recipes, no perfect photos — just real dishes from real people,
with the story behind each one.

---

## Prerequisites

- [Node.js LTS](https://nodejs.org/) (v24.x)
- [MariaDB](https://mariadb.org/) (v10.x or higher)
- [Git](https://git-scm.com/)

## Installation

```bash
git clone https://github.com/trezaz/projet-file-rouge.git
cd projet-file-rouge
npm install
cp .env.example .env
```

Edit `.env` and fill in your local values (database credentials, JWT secret, etc.).

## Database Setup

1. Create the databases:

```sql
CREATE DATABASE recettes_humaines;
CREATE DATABASE recettes_humaines_test;
```

2. Run the SQL scripts in order:

```bash
mysql -u root -p < database/scripts/01_create_database.sql
mysql -u root -p < database/scripts/02_create_users.sql
mysql -u root -p < database/scripts/03_create_tables.sql
mysql -u root -p < database/scripts/04_seed_data.sql
mysql -u root -p < database/scripts/05_add_image_url.sql
mysql -u root -p < database/scripts/06_indexes.sql
```

Or run them through your database client (DBeaver, MySQL Workbench, etc.).

## Running the Project

```bash
npm run dev
```

Server starts on http://localhost:3000

Health check: http://localhost:3000/health

## Running Tests

```bash
npm test
```

## Environment Variables

See `.env.example` for all available variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `localhost` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | Application database | `recettes_humaines` |
| `DB_USER` | App DB user (runtime) | `dev_app` |
| `DB_PASSWORD` | App DB password | — |
| `DB_ADMIN_USER` | Admin DB user (migrations) | `dev_admin` |
| `DB_ADMIN_PASSWORD` | Admin DB password | — |
| `DB_TEST_NAME` | Test database name | `recettes_humaines_test` |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |
| `LOG_LEVEL` | Winston log level | `debug` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000,http://localhost:5500` |

## Project Architecture

See [`docs/specs/architecture.md`](docs/specs/architecture.md) for the complete technical overview.

## Project Specifications

All project specs, documentation, and planning files are in the [`docs/`](docs/) directory.

## Author

trezaz — training project, 2025
