/**
 * Unit Tests for Rating Model
 *
 * Tests the Rating model methods against the test database:
 * - rate() with insert and update paths
 * - Gamification: points awarded to recipe author on score >= 4
 * - findByUserAndRecipe() for duplicate detection
 * - findByRecipeId() for recipe-level aggregation
 *
 * Key behaviours verified:
 * - First rating on a recipe triggers Recipe.updateRating() and may award points
 * - Second rating from same user = update path (no points, no average recalc)
 * - Score < 4 means no points awarded
 */

'use strict';

const { clearDatabase, closeDatabase } = require('../helpers/testDb');
const Rating = require('../../src/models/Rating');
const Recipe = require('../../src/models/Recipe');
const User = require('../../src/models/User');
const Category = require('../../src/models/Category');

let author;
let rater;
let category;
let recipe;

beforeAll(async () => {
    console.log('\n Starting Rating Model Tests...');
});

beforeEach(async () => {
    await clearDatabase();

    author = await User.create({
        username: 'author',
        email: 'author@example.com',
        password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
    });

    rater = await User.create({
        username: 'rater',
        email: 'rater@example.com',
        password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
    });

    category = await Category.create({ name: 'Desserts' });

    recipe = await Recipe.create({
        user_id: author.id,
        category_id: category.id,
        title: 'Tiramisu',
        anecdote: 'Recette de mamie',
        ingredients: ['mascarpone', 'café', 'biscuits'],
        steps: ['Préparer la crème', 'Tremper les biscuits', 'Monter le tiramisu'],
        prep_time: 30,
        cost_per_portion: 4.00,
    });
});

afterAll(async () => {
    await closeDatabase();
});

describe('Rating Model', () => {

    // ================================================================
    //  findByUserAndRecipe
    // ================================================================

    describe('findByUserAndRecipe()', () => {

        test('should return null when user has not rated', async () => {
            const existing = await Rating.findByUserAndRecipe(rater.id, recipe.id);
            expect(existing).toBeNull();
        });

        test('should return existing rating after user rates', async () => {
            await Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 4 });

            const existing = await Rating.findByUserAndRecipe(rater.id, recipe.id);
            expect(existing).not.toBeNull();
            expect(existing.score).toBe(4);
        });
    });

    // ================================================================
    //  findByRecipeId
    // ================================================================

    describe('findByRecipeId()', () => {

        test('should return empty array when recipe has no ratings', async () => {
            const ratings = await Rating.findByRecipeId(recipe.id);
            expect(ratings).toEqual([]);
        });

        test('should return all ratings for a recipe', async () => {
            await Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 5 });

            const ratings = await Rating.findByRecipeId(recipe.id);
            expect(ratings.length).toBe(1);
            expect(ratings[0].score).toBe(5);
            expect(ratings[0].user_id).toBe(rater.id);
        });
    });

    // ================================================================
    //  rate() — INSERT path
    // ================================================================

    describe('rate() — first rating (INSERT)', () => {

        test('should return isNew: true on first rating', async () => {
            const result = await Rating.rate({
                userId: rater.id,
                recipeId: recipe.id,
                score: 4,
            });

            expect(result.isNew).toBe(true);
            expect(result.rating.score).toBe(4);
        });

        test('should update recipe average_rating and rating_count', async () => {
            await Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 4 });

            const updated = await Recipe.findById(recipe.id);
            expect(updated.average_rating).toBe(4.0);
            expect(updated.rating_count).toBe(1);
        });

        test('should award points to recipe author when score >= 4', async () => {
            const result = await Rating.rate({
                userId: rater.id,
                recipeId: recipe.id,
                score: 4,
            });

            expect(result.pointsAwarded).toBe(true);

            const authorUpdated = await User.findById(author.id);
            expect(authorUpdated.points).toBe(5);
        });

        test('should NOT award points when score < 4', async () => {
            const result = await Rating.rate({
                userId: rater.id,
                recipeId: recipe.id,
                score: 3,
            });

            expect(result.pointsAwarded).toBe(false);

            const authorUpdated = await User.findById(author.id);
            expect(authorUpdated.points).toBe(0);
        });

        test('should compute correct average with multiple ratings', async () => {
            const user3 = await User.create({
                username: 'rater2',
                email: 'rater2@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            await Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 4 });
            await Rating.rate({ userId: user3.id, recipeId: recipe.id, score: 5 });

            const updated = await Recipe.findById(recipe.id);
            expect(updated.average_rating).toBe(4.5);
            expect(updated.rating_count).toBe(2);
        });

        test('should reject score below 1 via DB constraint', async () => {
            await expect(
                Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 0 })
            ).rejects.toThrow();
        });

        test('should reject score above 5 via DB constraint', async () => {
            await expect(
                Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 6 })
            ).rejects.toThrow();
        });
    });

    // ================================================================
    //  rate() — UPDATE path
    // ================================================================

    describe('rate() — update existing (UPDATE)', () => {

        beforeEach(async () => {
            await Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 3 });
        });

        test('should return isNew: false on second rating', async () => {
            const result = await Rating.rate({
                userId: rater.id,
                recipeId: recipe.id,
                score: 5,
            });

            expect(result.isNew).toBe(false);
            expect(result.pointsAwarded).toBe(false);
        });

        test('should NOT award points on update even with high score', async () => {
            const result = await Rating.rate({
                userId: rater.id,
                recipeId: recipe.id,
                score: 5,
            });

            expect(result.pointsAwarded).toBe(false);

            const authorUpdated = await User.findById(author.id);
            expect(authorUpdated.points).toBe(0);
        });

        test('should NOT recalculate average_rating on update', async () => {
            await Rating.rate({ userId: rater.id, recipeId: recipe.id, score: 5 });

            const updated = await Recipe.findById(recipe.id);
            // average_rating should still be based on the first rating (3.0)
            // because updateRating() is NOT called on update path
            expect(updated.average_rating).toBe(3.0);
            expect(updated.rating_count).toBe(1);
        });
    });
});
