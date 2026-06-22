const { clearDatabase, closeDatabase } = require('../helpers/testDb');
const Comment = require('../../src/models/Comment');
const Recipe = require('../../src/models/Recipe');
const User = require('../../src/models/User');
const Category = require('../../src/models/Category');

describe('Comment Integration Tests', () => {
    let recipeId;

    beforeAll(async () => {
        await clearDatabase();

        const user = await User.create({
            username: 'comment_tester',
            email: 'comment_tester@example.com',
            password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
        });

        const category = await Category.create({ name: 'Comment Tests' });

        const recipe = await Recipe.create({
            user_id: user.id,
            category_id: category.id,
            title: 'Recette pour Commentaires',
            anecdote: 'Test',
            ingredients: ['test'],
            steps: ['test'],
            prep_time: 5,
            cost_per_portion: 1.00,
        });

        recipeId = recipe.id;
    });

    afterAll(async () => {
        await closeDatabase();
    });

    // ===== CREATE TESTS =====

    describe('Comment.create()', () => {
        it('should create comment with pseudo (no auth required)', async () => {
            const commentData = {
                recipe_id: recipeId,
                guest_name: 'Jean_Cuisto',
                content: 'Recette sauvée ma soirée !'
            };

            const result = await Comment.create(commentData);

            expect(result).toHaveProperty('id');
            expect(result.guest_name).toBe('Jean_Cuisto');
            expect(result.content).toBe('Recette sauvée ma soirée !');
            expect(result).toHaveProperty('created_at');
        });

        it('should reject empty pseudo', async () => {
            const commentData = {
                recipe_id: recipeId,
                guest_name: '',
                content: 'Commentaire'
            };

            await expect(Comment.create(commentData))
                .rejects
                .toThrow('Guest name is required');
        });

        it('should reject text shorter than 3 chars', async () => {
            const commentData = {
                recipe_id: recipeId,
                guest_name: 'User',
                content: 'OK'
            };

            await expect(Comment.create(commentData))
                .rejects
                .toThrow('Content must be at least 3 characters');
        });

        it('should reject if recipe_id not exists', async () => {
            const commentData = {
                recipe_id: 99999,
                guest_name: 'User',
                content: 'Commentaire valide'
            };

            await expect(Comment.create(commentData))
                .rejects
                .toThrow();
        });
    });

    // ===== READ TESTS =====

    describe('Comment.findByRecipeId()', () => {
        it('should retrieve all comments for a recipe', async () => {
            const comments = await Comment.findByRecipeId(recipeId);

            expect(Array.isArray(comments)).toBe(true);
            expect(comments.length).toBeGreaterThanOrEqual(0);
        });

        it('should not return soft-deleted comments', async () => {
            const newComment = await Comment.create({
                recipe_id: recipeId,
                guest_name: 'À Supprimer',
                content: 'Ce commentaire sera soft-deleted'
            });

            await Comment.softDelete(newComment.id);

            const comments = await Comment.findByRecipeId(recipeId);

            const deletedExists = comments.some(c => c.id === newComment.id);
            expect(deletedExists).toBe(false);
        });
    });

    // ===== DELETE TESTS =====

    describe('Comment.softDelete()', () => {
        it('should mark comment as deleted', async () => {
            const newComment = await Comment.create({
                recipe_id: recipeId,
                guest_name: 'Tester',
                content: 'Test comment pour suppression'
            });

            await Comment.softDelete(newComment.id);

            const found = await Comment.findByRecipeId(recipeId);
            const stillExists = found.some(c => c.id === newComment.id);
            expect(stillExists).toBe(false);
        });
    });
});
