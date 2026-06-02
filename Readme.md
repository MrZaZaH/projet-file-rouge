# Projet File Rouge – Community Recipe Platform

A community-driven recipe platform focused on authentic, everyday cooking.
No chef recipes, no perfect photos — just real dishes from real people,
with the story behind each one.

---

## Tech Stack

**Backend**
- Node.js v24.14.1
- Express
- MariaDB + mysql2
- JWT (jsonwebtoken) + bcryptjs
- helmet, cors, express-rate-limit
- express-validator
- winston (logging)
- jest + supertest (testing)

**Frontend**
- HTML5 (semantic)
- CSS3 vanilla (mobile-first, Flexbox, Grid)
- JavaScript vanilla — no frameworks, no external libraries

---

## Prerequisites

Before running this project, make sure you have installed:
- [Node.js LTS](https://nodejs.org/) (v24.x)
- [MariaDB](https://mariadb.org/) (v10.x or higher)
- [Git](https://git-scm.com/)

---

## Installation

```bash
git clone https://github.com/trezaz/projet-file-rouge.git
cd projet-file-rouge
npm install
cp .env.example .env
```
Then open .env and fill in your local values (database credentials, JWT secret, etc.).

## Database Setup
Create the databases first:
```sql
CREATE DATABASE recettes_humaines;
CREATE DATABASE recettes_humaines_test;
```
Then run the SQL scripts in order:
database/scripts/01_create_tables.sql
database/scripts/02_create_users.sql
database/scripts/03_seed_data.sql

## Running the Project
```bash
npm run dev
```
Server starts on http://localhost:3000

Health check available at http://localhost:3000/health

## Project Structure
```text
projet-file-rouge/
├── src/
│   ├── config/         # Environment and app configuration
│   ├── controllers/    # Route handlers
│   ├── database/       # DB connection pool
│   ├── middlewares/    # Auth, validation, error handling
│   ├── models/         # Data access layer
│   └── routes/         # Express routers
├── database/
│   └── scripts/        # SQL scripts (schema, seed data)
├── docs/               # Technical documentation
├── tests/              # Jest test suites
├── .env.example        # Environment variables template
└── README.md
```
## Author

trezaz — training project, 2025