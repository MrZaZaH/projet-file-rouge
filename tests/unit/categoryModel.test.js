/**
 * Unit Tests for Category Model
 *
 * Tests CRUD operations for categories against the test database.
 * Category is the simplest model — pure CRUD with soft delete.
 *
 * Key behaviours:
 * - create() auto-generates slug from name (lowercase, no accents, hyphens)
 * - update() re-generates slug
 * - delete() is soft delete (deleted_at IS NULL hides it)
 * - findAll() returns only active categories
 */

'use strict';

const { clearDatabase, closeDatabase } = require('../helpers/testDb');
const Category = require('../../src/models/Category');

beforeAll(async () => {
    console.log('\n Starting Category Model Tests...');
});

beforeEach(async () => {
    await clearDatabase();
});

afterAll(async () => {
    await closeDatabase();
});

describe('Category Model', () => {

    // ================================================================
    //  CREATE
    // ================================================================

    describe('create()', () => {

        test('should create a category with auto-generated slug', async () => {
            const category = await Category.create({ name: 'Plats Végétariens' });

            expect(category).toBeDefined();
            expect(category.id).toBeDefined();
            expect(category.name).toBe('Plats Végétariens');
            expect(category.slug).toBe('plats-vegetariens');
        });

        test('should generate slug from accented name', async () => {
            const category = await Category.create({ name: 'Déssert Glacé' });

            expect(category.slug).toBe('dessert-glace');
        });

        test('should handle single-word name', async () => {
            const category = await Category.create({ name: 'Soupes' });

            expect(category.slug).toBe('soupes');
        });

        test('should handle name with special characters', async () => {
            const category = await Category.create({ name: '100% Bio & Épicé' });

            expect(category.slug).toBe('100-bio-epice');
        });
    });

    // ================================================================
    //  FIND BY ID
    // ================================================================

    describe('findById()', () => {

        test('should retrieve a category by ID', async () => {
            const created = await Category.create({ name: 'Salades' });

            const found = await Category.findById(created.id);

            expect(found).toBeDefined();
            expect(found.id).toBe(created.id);
            expect(found.name).toBe('Salades');
        });

        test('should return null for non-existent ID', async () => {
            const found = await Category.findById(99999);
            expect(found).toBeNull();
        });

        test('should return null for soft-deleted category', async () => {
            const created = await Category.create({ name: 'À supprimer' });

            await Category.delete(created.id);

            const found = await Category.findById(created.id);
            expect(found).toBeNull();
        });
    });

    // ================================================================
    //  FIND ALL
    // ================================================================

    describe('findAll()', () => {

        test('should return empty array when no categories exist', async () => {
            const categories = await Category.findAll();
            expect(categories).toEqual([]);
        });

        test('should return all active categories sorted by name', async () => {
            await Category.create({ name: 'Desserts' });
            await Category.create({ name: 'Apéros' });
            await Category.create({ name: 'Entrées' });

            const categories = await Category.findAll();

            expect(categories.length).toBe(3);
            // Sorted alphabetically: Apéros, Desserts, Entrées
            expect(categories[0].name).toBe('Apéros');
            expect(categories[1].name).toBe('Desserts');
            expect(categories[2].name).toBe('Entrées');
        });

        test('should exclude soft-deleted categories', async () => {
            const cat1 = await Category.create({ name: 'Garder' });
            const cat2 = await Category.create({ name: 'Supprimer' });

            await Category.delete(cat2.id);

            const categories = await Category.findAll();
            expect(categories.length).toBe(1);
            expect(categories[0].name).toBe('Garder');
        });
    });

    // ================================================================
    //  UPDATE
    // ================================================================

    describe('update()', () => {

        test('should update category name and regenerate slug', async () => {
            const created = await Category.create({ name: 'Plats' });

            const updated = await Category.update(created.id, { name: 'Plats Principaux' });

            expect(updated.name).toBe('Plats Principaux');
            expect(updated.slug).toBe('plats-principaux');
        });

        test('should return null for non-existent category', async () => {
            const result = await Category.update(99999, { name: 'Nouveau' });
            expect(result).toBeNull();
        });
    });

    // ================================================================
    //  DELETE (soft)
    // ================================================================

    describe('delete()', () => {

        test('should soft delete a category and return true', async () => {
            const created = await Category.create({ name: 'Supprimer' });

            const result = await Category.delete(created.id);

            expect(result).toBe(true);
        });

        test('should return false when deleting non-existent category', async () => {
            const result = await Category.delete(99999);
            expect(result).toBe(false);
        });

        test('should be idempotent (second delete returns false)', async () => {
            const created = await Category.create({ name: 'Double delete' });

            const first = await Category.delete(created.id);
            expect(first).toBe(true);

            const second = await Category.delete(created.id);
            expect(second).toBe(false);
        });
    });
});
