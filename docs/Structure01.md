PROJET-FILE-ROUGE/
├── Admin/
│   ├── export/
│   │   └── recipesCSV.js
│   ├── recipes/
│   │   └── top.js
│   └── stats.js
├── coverage/
│   ├── lcov-report/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── base.css
│   │   ├── block-navigation.js
│   │   ├── favicon.png
│   │   ├── index.html
│   │   ├── prettify.css
│   │   ├── prettify.js
│   │   ├── sort-arrow-sprite.png
│   │   └── sorter.js
│   ├── clover.xml
│   ├── coverage-final.json
│   └── lcov.info
├── database/scripts/
│   ├── 01_create_database.sql
│   ├── 02_create_users.sql
│   ├── 03_create_tables.sql
│   ├── 04_seed_data.sql
│   ├── 05_add_image_url.sql
│   └── 06_indexes.sql
├── docs/
│   ├── Api.md
│   ├── Backend-report.md
│   ├── BONNES_PRATIQUES.md
│   ├── DATABASE_DESIGN.md
│   ├── Readme.md
│   ├── Structure01.md
│   └── TEST_CASES.md
├── logs/
│   ├── .gitkeep
│   ├── combined.log
│   └── error.log
├── node_modules/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── constants/
│   │   └── filters.js
│   ├── controllers/
│   │   ├── AdminController.js
│   │   ├── AuthController.js
│   │   ├── AuthController1.js          ← doublon
│   │   ├── CommentController.js
│   │   ├── CommentController1.js       ← doublon
│   │   ├── RatingController.js
│   │   ├── RatingController1.js        ← doublon
│   │   ├── RecipeController.js
│   │   └── RecipeController1.js        ← doublon
│   ├── database/
│   │   └── connection.js
│   ├── middlewares/
│   │   ├── errorHandler.js
│   │   ├── errorHandler1.js            ← doublon
│   │   ├── jwtAuth.js
│   │   ├── jwtAuth2.js                 ← doublon
│   │   ├── logger.js
│   │   ├── requireAdmin.js
│   │   └── security.js
│   ├── models/
│   │   ├── Category.js
│   │   ├── comment.js
│   │   ├── comment1.js                 ← doublon
│   │   ├── Rating.js
│   │   ├── Recipe.js
│   │   ├── Recipe1.js                  ← doublon
│   │   └── User.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── commentRoutes.js
│   │   ├── ratingRoutes.js
│   │   └── recipeRoutes.js
│   └── utils/
│       └── apiResponse.js
├── test-scripts/
│   ├── test-comment-rating.js
│   ├── test-full-chain.js
│   ├── test-models.js
│   └── test-recipe-model.js
├── tests/
│   ├── helpers/
│   │   └── testDb.js
│   ├── integration/
│   │   ├── auth.test.js
│   │   ├── comments.test.js
│   │   └── recipes.test.js
│   └── unit/
│       ├── recipeModel.test.js
│       └── userModel.test.js
│   └── setup.js
├── .env
├── .env.example
├── .env.test
├── .env.test.example
├── .gitignore
├── app.js
├── jest.config.js
├── package-lock.json
├── package.json
└── server.js
