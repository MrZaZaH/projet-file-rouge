// src/routes/userRoutes.js
//
// User dashboard routes — protected endpoints for the authenticated user.
// GET /me/profile  — user info + aggregate stats
// GET /me/recipes  — user's recipes with statuses

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/jwtAuth');
const UserController = require('../controllers/UserController');

const router = Router();

router.get('/me/profile', authenticate, UserController.getProfile);
router.get('/me/recipes', authenticate, UserController.getMyRecipes);

module.exports = router;
