/**
 * Integration Tests for Ratings API
 *
 * Tests POST /api/v1/recipes/:recipeId/ratings end-to-end.
 * Creates test data manually (no dependency on createFixtures).
 */

'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { clearDatabase } = require('../helpers/testDb');
const { pool } = require('../../src/database/connection');

const TEST_HASH = '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9';

let raterToken;
let authorToken;
let publishedRecipeId;

beforeEach(async () => {
    await clearDatabase();

    // Create a category directly via pool to avoid model pool issues
    const [catResult] = await pool.execute(
        'INSERT INTO categories (name, slug) VALUES (?, ?)',
        ['Plats Test', 'plats-test']
    );
    const catId = catResult.insertId;

    // Create author directly via SQL with pre-computed hash (no bcrypt)
    const [authorResult] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['author1', 'author1@test.com', TEST_HASH, 'user']
    );
    const authorId = authorResult.insertId;
    authorToken = jwt.sign(
        { id: authorId, role: 'user', username: 'author1' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    // Create rater directly via SQL
    const [raterResult] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['rater1', 'rater1@test.com', TEST_HASH, 'user']
    );
    raterToken = jwt.sign(
        { id: raterResult.insertId, role: 'user', username: 'rater1' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    // Create published recipe directly via SQL
    const [recipeResult] = await pool.execute(
        `INSERT INTO recipes (user_id, category_id, title, anecdote, ingredients, steps, prep_time, cost_per_portion, status, average_rating, rating_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', 0, 0, NOW(), NOW())`,
        [authorId, catId, 'Recette de Test', 'Une excellente recette pour les tests unitaires', JSON.stringify(['a', 'b']), JSON.stringify(['1', '2']), 10, 2.00]
    );
    publishedRecipeId = recipeResult.insertId;
});

afterAll(async () => {
    // Do NOT close the pool — other test files may still need it
});

describe('POST /api/v1/recipes/:recipeId/ratings', () => {

    test('should rate a published recipe and return 201', async () => {
        const res = await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .set('Authorization', `Bearer ${raterToken}`)
            .send({ score: 4 });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.rating.score).toBe(4);
        expect(res.body.data.isNew).toBe(true);
    });

    test('should update existing rating and return 200', async () => {
        await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .set('Authorization', `Bearer ${raterToken}`)
            .send({ score: 3 });

        const res = await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .set('Authorization', `Bearer ${raterToken}`)
            .send({ score: 5 });

        expect(res.status).toBe(200);
        expect(res.body.data.isNew).toBe(false);
        expect(res.body.data.rating.score).toBe(5);
    });

    test('should reject rating own recipe with 403', async () => {
        const res = await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .set('Authorization', `Bearer ${authorToken}`)
            .send({ score: 4 });
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    test('should reject score below 1 with 422', async () => {
        const res = await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .set('Authorization', `Bearer ${raterToken}`)
            .send({ score: 0 });

        expect(res.status).toBe(422);
    });

    test('should reject score above 5 with 422', async () => {
        const res = await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .set('Authorization', `Bearer ${raterToken}`)
            .send({ score: 6 });

        expect(res.status).toBe(422);
    });

    test('should reject missing score with 422', async () => {
        const res = await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .set('Authorization', `Bearer ${raterToken}`)
            .send({});

        expect(res.status).toBe(422);
    });

    test('should reject unauthenticated request with 401', async () => {
        const res = await request(app)
            .post(`/api/v1/recipes/${publishedRecipeId}/ratings`)
            .send({ score: 4 });

        expect(res.status).toBe(401);
    });

    test('should reject non-existent recipe with 404', async () => {
        const res = await request(app)
            .post('/api/v1/recipes/99999/ratings')
            .set('Authorization', `Bearer ${raterToken}`)
            .send({ score: 4 });

        expect(res.status).toBe(404);
    });
});
