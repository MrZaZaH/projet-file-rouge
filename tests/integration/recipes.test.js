const Recipe = require('../../src/models/Recipe');
const TestDatabase = require('../helpers/testDb');

describe('Recipe Integration Tests', () => {
    let fixtures;

    beforeAll(async () => {
        await TestDatabase.clearDatabase();
        fixtures = await TestDatabase.createFixtures();
    });

    afterAll(async () => {
        await TestDatabase.closeDatabase();
    });

    // ===== CREATE TESTS =====
    describe('Recipe.create()', () => {
        it('should create recipe with valid data', async () => {
            const recipeData = {
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: 'Pâtes d\'Urgence',
                anecdote: 'Inventée un jeudi soir',
                ingredients: 'pâtes,tomate,parmesan',
                steps: '1. Cuire pâtes\n2. Ajouter sauce',
                prep_time: 20,
                cost_per_portion: 3.00,
                image_url: 'https://example.com/image.jpg'
            };

            const result = await Recipe.create(recipeData);

            expect(result).toHaveProperty('id');
            expect(result.title).toBe('Pâtes d\'Urgence');
            expect(result.prep_time).toBe(20);
            expect(result.cost_per_portion).toBe(3.00);
        });

        it('should reject negative cost per portion', async () => {
            const recipeData = {
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: 'Recette Gratuite',
                anecdote: 'Test',
                ingredients: 'rien',
                steps: 'néant',
                prep_time: 5,
                cost_per_portion: -1.00  // ❌ Invalid
            };

            await expect(Recipe.create(recipeData)).rejects.toThrow(
                'Cost per portion must be >= 0'
            );
        });

        it('should reject if user_id not exists', async () => {
            const recipeData = {
                user_id: 99999,  // Non-existent user
                category_id: fixtures.categoryId,
                title: 'Recette Orpheline',
                anecdote: 'Test',
                ingredients: 'test',
                steps: 'test',
                prep_time: 10,
                cost_per_portion: 2.00
            };

            await expect(Recipe.create(recipeData)).rejects.toThrow(
                'User or Category not found'
            );
        });

        it('should reject empty title', async () => {
            const recipeData = {
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: '',  // ❌ Empty
                anecdote: 'Test',
                ingredients: 'test',
                steps: 'test',
                prep_time: 10,
                cost_per_portion: 2.00
            };

            await expect(Recipe.create(recipeData)).rejects.toThrow(
                'Title is required'
            );
        });
    });

    // ===== FIND BY ID TESTS =====
    describe('Recipe.findById()', () => {
        it('should retrieve recipe by ID with author', async () => {
            const recipe = await Recipe.findById(fixtures.recipeId);

            expect(recipe).not.toBeNull();
            expect(recipe.id).toBe(fixtures.recipeId);
            expect(recipe.title).toBe('Œufs en Sauce Urgente');
            expect(recipe.username).toBeDefined();
        });

        it('should return null for inexistent recipe', async () => {
            const recipe = await Recipe.findById(99999);
            expect(recipe).toBeNull();
        });

        it('should not return soft-deleted recipe', async () => {
            // Create a recipe
            const recipeData = {
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: 'À Supprimer',
                anecdote: 'Test soft delete',
                ingredients: 'test',
                steps: 'test',
                prep_time: 5,
                cost_per_portion: 1.00
            };

            const created = await Recipe.create(recipeData);

            // Soft delete it
            await Recipe.softDelete(created.id);

            // Should not find it
            const found = await Recipe.findById(created.id);
            expect(found).toBeNull();
        });
    });

    // ===== FILTERS TESTS =====
    describe('Recipe.findAllWithFilters()', () => {
        beforeAll(async () => {
            // Create additional test recipes with varying costs/times
            await Recipe.create({
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: 'Rapide et Pas Cher',
                anecdote: 'Budget 2€',
                ingredients: 'oeufs,beurre',
                steps: '1. Cuire',
                prep_time: 10,
                cost_per_portion: 2.00
            });

            await Recipe.create({
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: 'Recette Chère',
                anecdote: 'Budget élevé',
                ingredients: 'homard,champagne',
                steps: '1. Luxe',
                prep_time: 60,
                cost_per_portion: 25.00
            });
        });

        it('should filter recipes by max_prep_time', async () => {
            const recipes = await Recipe.findAllWithFilters({ max_prep_time: 15 });

            expect(recipes.length).toBeGreaterThan(0);
            recipes.forEach(r => {
                expect(r.prep_time).toBeLessThanOrEqual(15);
            });
        });

        it('should filter recipes by max_cost', async () => {
            const recipes = await Recipe.findAllWithFilters({ max_cost: 3.00 });

            recipes.forEach(r => {
                expect(r.cost_per_portion).toBeLessThanOrEqual(3.00);
            });
        });

        it('should filter recipes by category_id', async () => {
            const recipes = await Recipe.findAllWithFilters({
                category_id: fixtures.categoryId
            });

            recipes.forEach(r => {
                expect(r.category_id).toBe(fixtures.categoryId);
            });
        });

        it('should combine multiple filters', async () => {
            const recipes = await Recipe.findAllWithFilters({
                max_prep_time: 30,
                max_cost: 5.00,
                category_id: fixtures.categoryId
            });

            recipes.forEach(r => {
                expect(r.prep_time).toBeLessThanOrEqual(30);
                expect(r.cost_per_portion).toBeLessThanOrEqual(5.00);
                expect(r.category_id).toBe(fixtures.categoryId);
            });
        });
    });

    // ===== UPDATE TESTS =====
    describe('Recipe.update()', () => {
        it('should update recipe title and cost', async () => {
            const original = await Recipe.findById(fixtures.recipeId);

            await Recipe.update(fixtures.recipeId, {
                title: 'Œufs Améliorés',
                cost_per_portion: 3.50
            });

            const updated = await Recipe.findById(fixtures.recipeId);
            expect(updated.title).toBe('Œufs Améliorés');
            expect(updated.cost_per_portion).toBe(3.50);
        });

        it('should reject invalid cost on update', async () => {
            await expect(
                Recipe.update(fixtures.recipeId, { cost_per_portion: -5.00 })
            ).rejects.toThrow('Cost per portion must be >= 0');
        });
    });

    // ===== SOFT DELETE TESTS =====
    describe('Recipe.softDelete()', () => {
        it('should mark recipe as deleted without removing row', async () => {
            const created = await Recipe.create({
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: 'À Supprimer',
                anecdote: 'Sera soft-deleted',
                ingredients: 'test',
                steps: 'test',
                prep_time: 5,
                cost_per_portion: 1.00
            });

            await Recipe.softDelete(created.id);

            // Row still exists in DB but with deleted_at set
            const found = await Recipe.findById(created.id);
            expect(found).toBeNull(); // But hidden from queries
        });

        it('should exclude deleted recipes from findAll', async () => {
            const allBefore = await Recipe.findAllWithFilters({});
            const countBefore = allBefore.length;

            const created = await Recipe.create({
                user_id: fixtures.userId,
                category_id: fixtures.categoryId,
                title: 'À Exclure',
                anecdote: 'Test exclusion',
                ingredients: 'test',
                steps: 'test',
                prep_time: 5,
                cost_per_portion: 1.00
            });

            // Before delete: should be included
            const allAfterCreate = await Recipe.findAllWithFilters({});
            expect(allAfterCreate.length).toBe(countBefore + 1);

            // Delete it
            await Recipe.softDelete(created.id);

            // After delete: should be excluded
            const allAfterDelete = await Recipe.findAllWithFilters({});
            expect(allAfterDelete.length).toBe(countBefore);
        });
    });
});
