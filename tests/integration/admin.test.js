/**
 * Integration Tests for Admin API
 *
 * Tests all admin-protected routes under /api/v1/admin.
 * Creates test data manually (no dependency on createFixtures).
 */

'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { clearDatabase } = require('../helpers/testDb');
const { pool } = require('../../src/database/connection');

const TEST_HASH = '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9';

let adminToken;
let userToken;
let recipeId;

beforeEach(async () => {
    await clearDatabase();

    // Create category via raw SQL to avoid model pool dependency
    const [catResult] = await pool.execute(
        'INSERT INTO categories (name, slug) VALUES (?, ?)',
        ['Admin Test Cat', 'admin-test-cat']
    );
    const catId = catResult.insertId;

    // Create admin user directly via SQL with pre-computed hash (no bcrypt)
    const [adminResult] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['admin_test', 'admin_test@test.com', TEST_HASH, 'admin']
    );
    adminToken = jwt.sign(
        { id: adminResult.insertId, role: 'admin', username: 'admin_test' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    // Create normal user for 403 tests
    const [userResult] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['normal_test', 'normal_test@test.com', TEST_HASH, 'user']
    );
    userToken = jwt.sign(
        { id: userResult.insertId, role: 'user', username: 'normal_test' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    // Create recipe author + pending recipe directly via SQL
    const [authorResult] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['author_test', 'author_test@test.com', TEST_HASH, 'user']
    );
    const authorId = authorResult.insertId;

    const [recipeResult] = await pool.execute(
        `INSERT INTO recipes (user_id, category_id, title, anecdote, ingredients, steps, prep_time, cost_per_portion, status, average_rating, rating_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, NOW(), NOW())`,
        [authorId, catId, 'Recette à Modérer', 'Une recette qui attend la validation du modérateur', JSON.stringify(['x', 'y']), JSON.stringify(['1', '2']), 15, 3.00]
    );
    recipeId = recipeResult.insertId;
});

afterAll(async () => {
    // Do NOT close the pool — other test files may still need it
    // Pool will be cleaned up on process exit
});

describe('Admin API — Authentication & Authorization', () => {

    test('should reject unauthenticated request with 401', async () => {
        const res = await request(app)
            .get('/api/v1/admin/recipes');

        expect(res.status).toBe(401);
    });

    test('should reject non-admin user with 403', async () => {
        const res = await request(app)
            .get('/api/v1/admin/recipes')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
    });

    test('should allow admin user', async () => {
        const res = await request(app)
            .get('/api/v1/admin/recipes')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('Admin API — GET /admin/recipes', () => {

    test('should return recipes', async () => {
        const res = await request(app)
            .get('/api/v1/admin/recipes')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].title).toBe('Recette à Modérer');
    });

    test('should filter recipes by status', async () => {
        const res = await request(app)
            .get('/api/v1/admin/recipes?status=pending')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
    });
});

describe('Admin API — PATCH /admin/recipes/:id/status', () => {

    test('should publish a pending recipe', async () => {
        const res = await request(app)
            .patch(`/api/v1/admin/recipes/${recipeId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'published' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('should reject invalid status with 400', async () => {
        const res = await request(app)
            .patch(`/api/v1/admin/recipes/${recipeId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'invalid' });

        expect(res.status).toBe(400);
    });

    test('should reject non-existent recipe with 404', async () => {
        const res = await request(app)
            .patch('/api/v1/admin/recipes/99999/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'published' });

        expect(res.status).toBe(404);
    });
});

describe('Admin API — DELETE /admin/recipes/:id', () => {

    test('should soft delete a recipe', async () => {
        const res = await request(app)
            .delete(`/api/v1/admin/recipes/${recipeId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});  // Send empty JSON body (controller destructures req.body.reason)

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify the recipe is no longer accessible
        const deleted = await request(app)
            .get(`/api/v1/recipes/${recipeId}`);
        expect(deleted.status).toBe(404);
    });

    test('should reject non-existent recipe with 404', async () => {
        const res = await request(app)
            .delete('/api/v1/admin/recipes/99999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(res.status).toBe(404);
    });
});

describe('Admin API — GET /admin/stats', () => {

    test('should return platform statistics', async () => {
        const res = await request(app)
            .get('/api/v1/admin/stats')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.recipes).toBe(1);
        expect(res.body.data.users).toBe(3); // admin + normal + author
    });
});

describe('Admin API — GET /admin/logs', () => {

    test('should return empty logs initially', async () => {
        const res = await request(app)
            .get('/api/v1/admin/logs')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });

    test('should contain log after admin action', async () => {
        await request(app)
            .patch(`/api/v1/admin/recipes/${recipeId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'published' });

        const res = await request(app)
            .get('/api/v1/admin/logs')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].action).toBe('recipe_published');
    });
});

describe('Admin API — GET /admin/recipes/top', () => {

    test('should return top recipes', async () => {
        const res = await request(app)
            .get('/api/v1/admin/recipes/top')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('Admin API — GET /admin/dashboard', () => {

    test('should return dashboard data', async () => {
        const res = await request(app)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('recipes');
        expect(res.body.data).toHaveProperty('users');
        expect(res.body.data).toHaveProperty('top_viewed');
        expect(res.body.data).toHaveProperty('top_categories');
    });
});

describe('Admin API — GET /admin/export/recipes', () => {

    test('should export CSV', async () => {
        const res = await request(app)
            .get('/api/v1/admin/export/recipes')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/csv');
    });
});
