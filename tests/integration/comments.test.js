const TestDatabase = require('../helpers/testDb');
const Comment = require('../../src/models/Comment');

describe('Comment Integration Tests', () => {
    let fixtures;

    beforeAll(async () => {
        await TestDatabase.clearDatabase();
        fixtures = await TestDatabase.createFixtures();
    });

    afterAll(async () => {
        await TestDatabase.closeDatabase();
    });

    // ===== CREATE TESTS =====

    describe('Comment.create()', () => {
        it('should create comment with pseudo (no auth required)', async () => {
            const commentData = {
                recipe_id: fixtures.recipeId,
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
                recipe_id: fixtures.recipeId,
                guest_name: '',
                content: 'Commentaire'
            };

            await expect(Comment.create(commentData))
                .rejects
                .toThrow('Guest name is required');
        });

        it('should reject text shorter than 3 chars', async () => {
            const commentData = {
                recipe_id: fixtures.recipeId,
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
            const comments = await Comment.findByRecipeId(fixtures.recipeId);

            expect(Array.isArray(comments)).toBe(true);
            expect(comments.length).toBeGreaterThanOrEqual(1);
            expect(comments[0]).toHaveProperty('guest_name');
            expect(comments[0]).toHaveProperty('content');
        });

        it('should not return soft-deleted comments', async () => {
            // Create a comment to delete
            const newComment = await Comment.create({
                recipe_id: fixtures.recipeId,
                guest_name: 'À Supprimer',
                content: 'Ce commentaire sera soft-deleted'
            });

            // Soft delete it
            await Comment.softDelete(newComment.id);

            // Retrieve comments for recipe
            const comments = await Comment.findByRecipeId(fixtures.recipeId);

            // Deleted comment should not appear
            const deletedExists = comments.some(c => c.id === newComment.id);
            expect(deletedExists).toBe(false);
        });
    });

    // ===== DELETE TESTS =====

    describe('Comment.softDelete()', () => {
        it('should mark comment as deleted', async () => {
            const newComment = await Comment.create({
                recipe_id: fixtures.recipeId,
                guest_name: 'Tester',
                content: 'Test comment pour suppression'
            });

            await Comment.softDelete(newComment.id);

            // After soft delete, should not be retrievable
            const found = await Comment.findByRecipeId(fixtures.recipeId);
            const stillExists = found.some(c => c.id === newComment.id);
            expect(stillExists).toBe(false);
        });
    });
});
