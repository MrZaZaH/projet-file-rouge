// tests/integration/auth.test.js
//
// Integration tests for authentication routes.
// Tests the full request → middleware → controller → model → DB chain.
// Does NOT test token validity on protected routes (belongs to each route's test file).

'use strict';

const request = require('supertest');
const app = require('../../app');
const { clearDatabase, closeDatabase } = require('../helpers/testDb');

afterAll(async () => {
    await closeDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/register
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {

    beforeEach(async () => {
        await clearDatabase();
    });

    const validUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'ValidPass123!',
    };

    test('should register a new user, return 201, and provide a JWT token', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send(validUser);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe(validUser.email);
        expect(res.body.data.user.username).toBe(validUser.username);
        // password_hash must never appear in the response
        expect(res.body.data.user.password_hash).toBeUndefined();
        // JWT token must be present and well-formed
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    });

    test('should return 409 when email already exists', async () => {
        // First registration
        await request(app)
            .post('/api/v1/auth/register')
            .send(validUser);

        // Second registration with same email
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...validUser, username: 'otherusername' });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });

    test('should return 422 when email is missing', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ username: 'testuser', password: 'ValidPass123!' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
    });

    test('should return 422 when password is missing', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ username: 'testuser', email: 'test@example.com' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
    });

    test('should return 422 when username is missing', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'test@example.com', password: 'ValidPass123!' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {

    // Create a user once before all login tests (login is read-only, no isolation needed)
    beforeAll(async () => {
        await clearDatabase();
        await request(app)
            .post('/api/v1/auth/register')
            .send({
                username: 'loginuser',
                email: 'login@example.com',
                password: 'ValidPass123!',
            });
    });

    test('should login with valid credentials and return 200', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'login@example.com', password: 'ValidPass123!' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.user.password_hash).toBeUndefined();
    });

    test('should return 401 with wrong password', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'login@example.com', password: 'WrongPassword!' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('should return 401 with non-existent email', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'nobody@example.com', password: 'ValidPass123!' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('should return 422 when email is missing', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ password: 'ValidPass123!' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
    });
});
