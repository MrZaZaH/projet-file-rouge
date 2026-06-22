/**
 * Unit Tests for Recipe Model
 *
 * Tests each Recipe model method against the test database:
 * - create() with validation and input normalization
 * - findById() with edge cases (not found, soft-deleted)
 * - findAllWithFilters() with various filter combinations
 * - update() with partial updates and validation
 * - softDelete() with idempotency
 * - findRandom() with published-only constraint
 *
 * Pattern: clearDatabase() before each test, create data inline.
 * This guarantees test isolation — no state leaks between tests.
 */

'use strict';

const { clearDatabase, closeDatabase } = require('../helpers/testDb');
const Recipe = require('../../src/models/Recipe');
const User = require('../../src/models/User');
const Category = require('../../src/models/Category');

let testUser;
let testCategory;

beforeAll(async () => {
    console.log('\n Starting Recipe Model Tests...');
});

beforeEach(async () => {
    await clearDatabase();

    testUser = await User.create({
        username: 'recipe_tester',
        email: 'recipe_tester@example.com',
        password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
    });

    testCategory = await Category.create({ name: 'Plats Rapides' });
});

afterAll(async () => {
    await closeDatabase();
});

describe('Recipe Model', () => {

    // ================================================================
    //  CREATE
    // ================================================================

    describe('create()', () => {

        test('should create a recipe with valid array data', async () => {
            const data = {
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Pâtes Carbonara',
                anecdote: 'Une recette de fin de mois',
                ingredients: ['pâtes', 'œufs', 'lardons', 'parmesan'],
                steps: ['Cuire les pâtes', 'Mélanger les œufs', 'Assembler'],
                prep_time: 20,
                cost_per_portion: 3.50,
            };

            const recipe = await Recipe.create(data);

            expect(recipe).toBeDefined();
            expect(recipe.id).toBeDefined();
            expect(recipe.title).toBe('Pâtes Carbonara');
            expect(recipe.anecdote).toBe('Une recette de fin de mois');
            expect(recipe.ingredients).toEqual(['pâtes', 'œufs', 'lardons', 'parmesan']);
            expect(recipe.steps).toEqual(['Cuire les pâtes', 'Mélanger les œufs', 'Assembler']);
            expect(recipe.prep_time).toBe(20);
            expect(recipe.cost_per_portion).toBe(3.50);
            expect(recipe.status).toBe('pending');
            expect(recipe.average_rating).toBe(0);
            expect(recipe.rating_count).toBe(0);
            expect(recipe.username).toBe('recipe_tester');
        });

        test('should create a recipe with comma-separated ingredients string', async () => {
            const data = {
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Salade Simple',
                anecdote: 'Test format string',
                ingredients: 'laitue,tomate,concombre',
                steps: ['Laver', 'Couper', 'Mélanger'],
                prep_time: 10,
                cost_per_portion: 2.00,
            };

            const recipe = await Recipe.create(data);

            expect(recipe.ingredients).toEqual(['laitue', 'tomate', 'concombre']);
        });

        test('should create a recipe with newline-separated steps string', async () => {
            const data = {
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Omelette',
                anecdote: 'Test steps string',
                ingredients: ['œufs', 'beurre', 'sel'],
                steps: 'Battre les œufs\nFaire chauffer le beurre\nVerser et cuire',
                prep_time: 5,
                cost_per_portion: 1.50,
            };

            const recipe = await Recipe.create(data);

            expect(recipe.steps).toEqual([
                'Battre les œufs',
                'Faire chauffer le beurre',
                'Verser et cuire'
            ]);
        });

        test('should reject empty title', async () => {
            await expect(
                Recipe.create({
                    user_id: testUser.id,
                    category_id: testCategory.id,
                    title: '',
                    anecdote: 'Test',
                    ingredients: ['test'],
                    steps: ['test'],
                    prep_time: 5,
                    cost_per_portion: 1.00,
                })
            ).rejects.toThrow('Title is required');
        });

        test('should reject empty anecdote', async () => {
            await expect(
                Recipe.create({
                    user_id: testUser.id,
                    category_id: testCategory.id,
                    title: 'Test',
                    anecdote: '',
                    ingredients: ['test'],
                    steps: ['test'],
                    prep_time: 5,
                    cost_per_portion: 1.00,
                })
            ).rejects.toThrow('Anecdote is required');
        });

        test('should reject missing ingredients', async () => {
            await expect(
                Recipe.create({
                    user_id: testUser.id,
                    category_id: testCategory.id,
                    title: 'Test',
                    anecdote: 'Test',
                    ingredients: [],
                    steps: ['test'],
                    prep_time: 5,
                    cost_per_portion: 1.00,
                })
            ).rejects.toThrow('Ingredients are required and non-empty');
        });

        test('should reject missing steps', async () => {
            await expect(
                Recipe.create({
                    user_id: testUser.id,
                    category_id: testCategory.id,
                    title: 'Test',
                    anecdote: 'Test',
                    ingredients: ['test'],
                    steps: [],
                    prep_time: 5,
                    cost_per_portion: 1.00,
                })
            ).rejects.toThrow('Steps are required and non-empty');
        });

        test('should reject negative cost', async () => {
            await expect(
                Recipe.create({
                    user_id: testUser.id,
                    category_id: testCategory.id,
                    title: 'Test',
                    anecdote: 'Test',
                    ingredients: ['test'],
                    steps: ['test'],
                    prep_time: 5,
                    cost_per_portion: -1.00,
                })
            ).rejects.toThrow('Cost per portion must be >= 0');
        });

        test('should reject negative prep_time', async () => {
            await expect(
                Recipe.create({
                    user_id: testUser.id,
                    category_id: testCategory.id,
                    title: 'Test',
                    anecdote: 'Test',
                    ingredients: ['test'],
                    steps: ['test'],
                    prep_time: -5,
                    cost_per_portion: 1.00,
                })
            ).rejects.toThrow('Prep time must be non-negative number');
        });

        test('should reject non-existent user_id', async () => {
            await expect(
                Recipe.create({
                    user_id: 99999,
                    category_id: testCategory.id,
                    title: 'Test',
                    anecdote: 'Test',
                    ingredients: ['test'],
                    steps: ['test'],
                    prep_time: 5,
                    cost_per_portion: 1.00,
                })
            ).rejects.toThrow('User or Category not found');
        });

        test('should reject non-existent category_id', async () => {
            await expect(
                Recipe.create({
                    user_id: testUser.id,
                    category_id: 99999,
                    title: 'Test',
                    anecdote: 'Test',
                    ingredients: ['test'],
                    steps: ['test'],
                    prep_time: 5,
                    cost_per_portion: 1.00,
                })
            ).rejects.toThrow('User or Category not found');
        });

        test('should accept zero cost (free recipe)', async () => {
            const recipe = await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Recette Gratuite',
                anecdote: 'Trouvé dans la nature',
                ingredients: ['herbes'],
                steps: ['Cueillir'],
                prep_time: 1,
                cost_per_portion: 0,
            });

            expect(recipe.cost_per_portion).toBe(0);
        });

        test('should accept zero prep_time', async () => {
            const recipe = await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Instantané',
                anecdote: 'Pas de préparation',
                ingredients: ['pain'],
                steps: ['Manger'],
                prep_time: 0,
                cost_per_portion: 1.00,
            });

            expect(recipe.prep_time).toBe(0);
        });
    });

    // ================================================================
    //  FIND BY ID
    // ================================================================

    describe('findById()', () => {

        test('should retrieve a recipe by ID', async () => {
            const created = await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'À retrouver',
                anecdote: 'Test findById',
                ingredients: ['test'],
                steps: ['test'],
                prep_time: 5,
                cost_per_portion: 1.00,
            });

            const found = await Recipe.findById(created.id);

            expect(found).toBeDefined();
            expect(found.id).toBe(created.id);
            expect(found.title).toBe('À retrouver');
            expect(found.username).toBe('recipe_tester');
            expect(found.user).toBeDefined();
            expect(found.user.username).toBe('recipe_tester');
            expect(found.category.name).toBe('Plats Rapides');
        });

        test('should return null for non-existent ID', async () => {
            const found = await Recipe.findById(99999);
            expect(found).toBeNull();
        });

        test('should return null for soft-deleted recipe', async () => {
            const created = await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'À supprimer',
                anecdote: 'Test soft findById',
                ingredients: ['test'],
                steps: ['test'],
                prep_time: 5,
                cost_per_portion: 1.00,
            });

            await Recipe.softDelete(created.id);

            const found = await Recipe.findById(created.id);
            expect(found).toBeNull();
        });
    });

    // ================================================================
    //  FIND ALL WITH FILTERS
    // ================================================================

    describe('findAllWithFilters()', () => {

        beforeEach(async () => {
            await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Recette Rapide',
                anecdote: 'Moins de 15 min',
                ingredients: ['oeufs'],
                steps: ['Cuire'],
                prep_time: 10,
                cost_per_portion: 2.00,
            });

            await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Recette Lente',
                anecdote: 'Plus longue',
                ingredients: ['riz'],
                steps: ['Cuire longuement'],
                prep_time: 30,
                cost_per_portion: 5.00,
            });

            await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Recette Chère',
                anecdote: 'Haut de gamme',
                ingredients: ['homard'],
                steps: ['Griller'],
                prep_time: 30,
                cost_per_portion: 25.00,
            });
        });

        test('should return all recipes when no filters', async () => {
            const recipes = await Recipe.findAllWithFilters({});
            expect(recipes.length).toBe(3);
        });

        test('should filter by max_prep_time', async () => {
            const recipes = await Recipe.findAllWithFilters({ max_prep_time: 15 });
            expect(recipes.length).toBe(1);
            expect(recipes[0].title).toBe('Recette Rapide');
        });

        test('should filter by max_cost', async () => {
            const recipes = await Recipe.findAllWithFilters({ max_cost: 3.00 });
            expect(recipes.length).toBe(1);
            expect(recipes[0].title).toBe('Recette Rapide');
        });

        test('should filter by max_cost_per_portion alias', async () => {
            const recipes = await Recipe.findAllWithFilters({ max_cost_per_portion: 3.00 });
            expect(recipes.length).toBe(1);
        });

        test('should combine multiple filters', async () => {
            const recipes = await Recipe.findAllWithFilters({
                max_prep_time: 35,
                max_cost: 10.00,
            });
            expect(recipes.length).toBe(2);
        });

        test('should respect limit parameter', async () => {
            const recipes = await Recipe.findAllWithFilters({ limit: 2 });
            expect(recipes.length).toBeLessThanOrEqual(2);
        });

        test('should respect offset parameter', async () => {
            const first = await Recipe.findAllWithFilters({ limit: 1, offset: 0 });
            const second = await Recipe.findAllWithFilters({ limit: 1, offset: 1 });

            expect(first.length).toBe(1);
            expect(second.length).toBe(1);
            expect(first[0].id).not.toBe(second[0].id);
        });

        test('should filter by status', async () => {
            const pending = await Recipe.findAllWithFilters({ status: 'pending' });
            expect(pending.length).toBe(3);

            const published = await Recipe.findAllWithFilters({ status: 'published' });
            expect(published.length).toBe(0);
        });
    });

    // ================================================================
    //  UPDATE
    // ================================================================

    describe('update()', () => {

        let createdRecipe;

        beforeEach(async () => {
            createdRecipe = await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Original',
                anecdote: 'Version originale',
                ingredients: ['a', 'b'],
                steps: ['1', '2'],
                prep_time: 10,
                cost_per_portion: 2.00,
            });
        });

        test('should update title', async () => {
            const updated = await Recipe.update(createdRecipe.id, { title: 'Modifié' });
            expect(updated.title).toBe('Modifié');
        });

        test('should update multiple fields', async () => {
            const updated = await Recipe.update(createdRecipe.id, {
                title: 'Nouveau Titre',
                anecdote: 'Nouvelle anecdote',
                prep_time: 30,
                cost_per_portion: 5.00,
            });

            expect(updated.title).toBe('Nouveau Titre');
            expect(updated.anecdote).toBe('Nouvelle anecdote');
            expect(updated.prep_time).toBe(30);
            expect(updated.cost_per_portion).toBe(5.00);
        });

        test('should reject negative cost on update', async () => {
            await expect(
                Recipe.update(createdRecipe.id, { cost_per_portion: -5.00 })
            ).rejects.toThrow('Cost per portion must be >= 0');
        });

        test('should reject negative prep_time on update', async () => {
            await expect(
                Recipe.update(createdRecipe.id, { prep_time: -1 })
            ).rejects.toThrow('Prep time must be non-negative number');
        });

        test('should return null when updating non-existent recipe', async () => {
            const result = await Recipe.update(99999, { title: 'Nope' });
            expect(result).toBeNull();
        });

        test('should return current state when updating with empty object', async () => {
            const updated = await Recipe.update(createdRecipe.id, {});
            expect(updated.title).toBe('Original');
        });
    });

    // ================================================================
    //  SOFT DELETE
    // ================================================================

    describe('softDelete()', () => {

        test('should mark recipe as deleted and hide from queries', async () => {
            const created = await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'À supprimer',
                anecdote: 'Test softDelete',
                ingredients: ['test'],
                steps: ['test'],
                prep_time: 5,
                cost_per_portion: 1.00,
            });

            const result = await Recipe.softDelete(created.id);
            expect(result).toBe(true);

            const found = await Recipe.findById(created.id);
            expect(found).toBeNull();
        });

        test('should return false when deleting non-existent recipe', async () => {
            const result = await Recipe.softDelete(99999);
            expect(result).toBe(false);
        });

        test('should be idempotent (second delete returns false)', async () => {
            const created = await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Double delete',
                anecdote: 'Test idempotence',
                ingredients: ['test'],
                steps: ['test'],
                prep_time: 5,
                cost_per_portion: 1.00,
            });

            const first = await Recipe.softDelete(created.id);
            expect(first).toBe(true);

            const second = await Recipe.softDelete(created.id);
            expect(second).toBe(false);
        });
    });

    // ================================================================
    //  FIND RANDOM
    // ================================================================

    describe('findRandom()', () => {

        test('should return a random published recipe', async () => {
            const data = {
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Recette Aléatoire',
                anecdote: 'Test findRandom',
                ingredients: ['test'],
                steps: ['test'],
                prep_time: 5,
                cost_per_portion: 1.00,
                status: 'published',
            };

            const created = await Recipe.create(data);

            const random = await Recipe.findRandom();

            expect(random).toBeDefined();
            expect(random.title).toBe('Recette Aléatoire');
            expect(random.status).toBe('published');
            expect(random.username).toBeDefined();
        });

        test('should return null when no published recipes exist', async () => {
            await Recipe.create({
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'En attente',
                anecdote: 'Pas encore publiée',
                ingredients: ['test'],
                steps: ['test'],
                prep_time: 5,
                cost_per_portion: 1.00,
            });

            const random = await Recipe.findRandom();
            expect(random).toBeNull();
        });

        test('should not return soft-deleted recipes', async () => {
            const data = {
                user_id: testUser.id,
                category_id: testCategory.id,
                title: 'Publiée puis supprimée',
                anecdote: 'Test findRandom soft-deleted',
                ingredients: ['test'],
                steps: ['test'],
                prep_time: 5,
                cost_per_portion: 1.00,
                status: 'published',
            };

            const created = await Recipe.create(data);
            await Recipe.softDelete(created.id);

            const random = await Recipe.findRandom();
            expect(random).toBeNull();
        });
    });
});
