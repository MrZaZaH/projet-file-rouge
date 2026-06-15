const TestDatabase = require('../helpers/testDb');
const Comment = require('../../src/models/Comment');

describe('Comment Integration Tests', () => {
    let fixtures;
    let pool; // ✅ récupérer depuis TestDatabase

    beforeAll(async () => {
        await TestDatabase.cleanup();
        fixtures = await TestDatabase.createFixtures();
        pool = TestDatabase.getPool(); // ✅ IMPORTANT
    });

    afterAll(async () => {
        await TestDatabase.closeDatabase(); // ✅ remplace pool.end()
    });

    // ===== CREATE TESTS =====

    describe('Comment.create()', () => {
        it('should create comment with pseudo (no auth required)', async () => {
            const commentData = {
                recipe_id: fixtures.recipeId,
                pseudo: 'Jean_Cuisto',
                text: 'Recette sauvée ma soirée !'
            };

            const result = await Comment.create(commentData);

            expect(result).toHaveProperty('id');
            expect(result.pseudo).toBe('Jean_Cuisto');
            expect(result.text).toBe('Recette sauvée ma soirée !');
            expect(result).toHaveProperty('created_at');
        });

        it('should reject empty pseudo', async () => {
            const commentData = {
                recipe_id: fixtures.recipeId,
                pseudo: '',
                text: 'Commentaire'
            };

            await expect(Comment.create(commentData))
                .rejects
                .toThrow('Pseudo is required');
        });

        it('should reject text shorter than 3 chars', async () => {
            const commentData = {
                recipe_id: fixtures.recipeId,
                pseudo: 'User',
                text: 'OK'
            };

            await expect(Comment.create(commentData))
                .rejects
                .toThrow('Text must be at least 3 characters');
        });

        it('should reject if recipe_id not exists', async () => {
            const commentData = {
                recipe_id: 99999,
                pseudo: 'User',
                text: 'Commentaire valide'
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
            expect(comments[0]).toHaveProperty('pseudo');
            expect(comments[0]).toHaveProperty('text');
        });

        it('should not return soft-deleted comments', async () => {
            await pool.query(
                'UPDATE comments SET deleted_at = NOW() WHERE id = ?',
                [fixtures.commentId]
            );

            const comments = await Comment.findByRecipeId(fixtures.recipeId);

            const deletedExists = comments.some(c => c.id === fixtures.commentId);
            expect(deletedExists).toBe(false);
        });
    });

    // ===== DELETE TESTS =====

    describe('Comment.softDelete()', () => {
        it('should mark comment as deleted', async () => {
            const [result] = await pool.query(`
                INSERT INTO comments (recipe_id, pseudo, text)
                VALUES (?, ?, ?)
            `, [fixtures.recipeId, 'Tester', 'Test comment']);

            const commentId = result.insertId;

            await Comment.softDelete(commentId);

            const [rows] = await pool.query(
                'SELECT deleted_at FROM comments WHERE id = ?',
                [commentId]
            );

            expect(rows[0].deleted_at).not.toBeNull();
        });
    });
});
