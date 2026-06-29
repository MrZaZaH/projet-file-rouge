'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/jwtAuth');
const FavoriteController = require('../controllers/FavoriteController');

const router = Router();

router.get('/', authenticate, FavoriteController.getMyFavorites);
router.post('/:recipeId', authenticate, FavoriteController.toggle);

module.exports = router;
