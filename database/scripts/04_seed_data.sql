-- 04_seed_data.sql  —  DONNÉES DE TEST (local uniquement, JAMAIS en production)
--
-- ==============================================================================
-- IMPORTANT : Ce script seed les DEUX bases de données. Il est conçu pour être
-- exécuté SANS instruction USE — la base cible est passée en argument via le
-- client mysql (mysql -u user -p MA_BASE < 04_seed_data.sql).
--
-- Commande pour seed la base de dev :
--   mysql -u dev_admin -p recettes_humaines < database/scripts/04_seed_data.sql
--
-- Commande pour seed la base de test :
--   mysql -u dev_admin -p recettes_humaines_test < database/scripts/04_seed_data.sql
--
-- Les DEUX bases doivent contenir les MÊMES données de test pour que :
--   1. Le développement et les tests manuels aient des données cohérentes
--   2. Les tests Jest (Supertest) puissent TRUNCATE la base test sans impact
--      sur les données de dev
--   3. La démo/soutenance fonctionne sur n'importe laquelle des deux bases
-- ==============================================================================
--
-- Contenu du jeu de données :
--   - 5  utilisateurs  (dont 1 admin) — hash bcrypt cost 12
--   - 3  catégories    (filtres métier du projet)
--   - 8  recettes      (couvrent tous les cas de filtrage : temps, budget, statut)
--   - 30 commentaires  (dont certains invités sans compte)
--   - 29 notations     (moyennes pré-calculées dans average_rating)
--
-- Détail des personnages et leurs mots de passe :
--   admin_ovni    | admin@example.com    | Admin123!    → admin
--   mickael_b     | mickael@example.com  | User1234!    → user  (Salarié crevé)
--   sofia_r       | sofia@example.com    | User1234!    → user  (Parent épuisé)
--   jerome_k      | jerome@example.com   | User1234!    → user  (Étudiant fauché)
--   anonyme_test  | anon@example.com     | User1234!    → user  (Test modération)
-- ============================================================

-- ============================================================
-- CATEGORIES (3)
-- ============================================================
INSERT INTO categories (id, name, slug) VALUES
(1, 'Plats rapides',    'plats-rapides'),
(2, 'Budget étudiant', 'budget-etudiant'),
(3, 'Accident heureux','accident-heureux');

-- ============================================================
-- USERS (5)
-- Hash bcrypt générés avec bcryptjs, cost factor 12.
--   Admin123! → $2b$12$w89hz/RaFW14c5wMgfiuH.M1q36gagS8DJuA6mX9j5zEdY7mx6Xoa
--   User1234! → $2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.
-- ============================================================
INSERT INTO users (id, username, email, password_hash, role) VALUES
(1, 'mickael_b',    'mickael@example.com', '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(2, 'sofia_r',      'sofia@example.com',   '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(3, 'jerome_k',     'jerome@example.com',  '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(4, 'anonyme_test', 'anon@example.com',    '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(5, 'admin_ovni',   'admin@example.com',   '$2b$12$w89hz/RaFW14c5wMgfiuH.M1q36gagS8DJuA6mX9j5zEdY7mx6Xoa', 'admin');

-- ============================================================
-- RECIPES (8)
-- Covers all filter test cases:
--   A, B → prep_time < 15 AND cost < 3.00  (must appear in both filters)
--   C, D → prep_time < 15 AND cost > 3.00  (excluded by budget filter)
--   E, F → prep_time > 15 AND cost < 3.00  (excluded by speed filter)
--   G    → status = 'pending'              (invisible to public)
--   H    → status = 'rejected'             (invisible to public)
--
-- average_rating and rating_count are pre-calculated from seed ratings below.
-- In production these are updated by the application on each rating insert.
-- ============================================================
INSERT INTO recipes (
    id, user_id, category_id, title, anecdote,
    ingredients, steps,
    prep_time, cost_per_portion, status,
    average_rating, rating_count
) VALUES

-- A — prep_time < 15, cost < 3.00, published
(1, 1, 3,
 'Raisin au miel',
 'Un soir de fridge-raid total. Plus rien dans le placard, une grappe de raisin qui traîne et un pot de miel. Résultat : le snack le plus simple et le plus efficace de ma vie. Surtout quand les raisins sont aigres — le miel balance tout.',
 '["raisin", "miel"]',
 '["Verser du miel dans un bol.", "Tremper les raisins dans le miel.", "Manger immédiatement."]',
 2, 0.80, 'published', 4.25, 4),

-- B — prep_time < 15, cost < 3.00, published
(2, 2, 2,
 'Houmous express',
 'Invités à l\'improviste dans 10 minutes. Un placard avec des pois chiches en boîte et du tahini acheté par curiosité trois mois plus tôt. Tout le monde a cru que j\'avais commandé.',
 '["1 boîte de pois chiches", "tahini (pâte de sésame)", "1 gousse d\'ail", "1 citron", "huile d\'olive", "cumin"]',
 '["Égoutter et rincer les pois chiches.", "Tout mettre dans un mixeur : pois chiches, tahini, ail, jus de citron.", "Mixer en ajoutant de l\'eau pour la consistance voulue.", "Saler et saupoudrer de cumin.", "Arroser d\'huile d\'olive pour servir."]',
 5, 1.50, 'published', 4.25, 4),

-- C — prep_time < 15, cost > 3.00 (excluded by budget filter), published
(3, 1, 1,
 'Toast cream cheese, saumon et concombre',
 'Un dimanche matin où j\'avais envie de faire genre. Le saumon fumé c\'est le seul ingrédient qui te fait passer pour quelqu\'un de sophistiqué sans aucun effort. Le pain pumpernickel est non négociable.',
 '["pain noir type pumpernickel", "cream cheese", "saumon fumé", "concombre", "aneth", "câpres"]',
 '["Tartiner le pain noir de cream cheese.", "Rouler le saumon en rosaces et disposer.", "Ajouter des rondelles de concombre.", "Parsemer d\'aneth frais et de câpres.", "Finir avec du poivre noir et un zeste de citron."]',
 5, 5.50, 'published', 4.00, 3),

-- D — prep_time < 15, cost > 3.00 (excluded by budget filter), published
(4, 3, 1,
 'Bowl César rapide',
 'Lundi midi, restes de poulet rôti du dimanche, une salade romaine qui commence à se demander ce qu\'elle fait là. Cinq minutes plus tard, un bowl présentable. La sauce César du commerce fait le boulot, ne mentez pas.',
 '["salade romaine", "poulet cuit (rôti ou émincé)", "parmesan", "croûtons", "sauce César du commerce"]',
 '["Couper la salade en morceaux.", "Trancher le poulet.", "Disposer dans un bol.", "Ajouter les croûtons et le parmesan.", "Verser la sauce César et mélanger."]',
 5, 4.20, 'published', 3.67, 3),

-- E — prep_time > 15, cost < 3.00 (excluded by speed filter), published
(5, 2, 2,
 'Curry de lentilles',
 'Fin du mois, compte en berne, frigo quasi vide. Les lentilles corail c\'est la solution à tous les problèmes financiers d\'un étudiant. Cette recette nourrit deux personnes pour moins de 4€ total et réchauffe vraiment.',
 '["lentilles corail", "1 boîte de tomates pelées", "lait de coco", "curry en poudre", "1 oignon", "2 gousses d\'ail"]',
 '["Faire revenir l\'oignon et l\'ail émincés.", "Ajouter le curry et mélanger 1 minute.", "Ajouter les lentilles, les tomates et le lait de coco.", "Couvrir d\'eau à hauteur.", "Cuire 20 minutes à feu moyen jusqu\'à ce que les lentilles soient tendres."]',
 25, 1.80, 'published', 4.25, 4),

-- F — prep_time > 15, cost < 3.00 (excluded by speed filter), published
(6, 3, 3,
 'Feta Pasta au four',
 'Oui c\'est la recette TikTok. Non je n\'ai aucune honte. Elle est là depuis 2021, elle marche à chaque fois, et avec des tomates du jardin en été c\'est une autre dimension. Guillaume peut dire ce qu\'il veut.',
 '["1 bloc de feta (200g)", "tomates cerises", "huile d\'olive", "3 gousses d\'ail", "basilic frais", "pâtes (penne ou rigatoni)"]',
 '["Préchauffer le four à 200°C.", "Mettre le bloc de feta au centre d\'un plat.", "Entourer de tomates cerises et d\'ail.", "Arroser généreusement d\'huile d\'olive.", "Enfourner 30 minutes jusqu\'à ce que la feta soit dorée.", "Écraser la feta et mélanger avec les tomates.", "Incorporer les pâtes cuites al dente.", "Ajouter le basilic frais."]',
 35, 2.60, 'published', 4.20, 5),

-- G — pending (not visible to public, tests moderation pipeline)
(7, 4, 3,
 'Poires en conserve façon comme les pro',
 'Recette de Mickaël. Un soir de date un peu désespéré, plus rien dans le frigo sauf des poires en conserve et une demi plaquette de chocolat. Ça a marché. Elle est revenue.',
 '["poires en conserve", "1/2 plaquette de chocolat", "10cl de lait"]',
 '["Faire fondre le chocolat dans le lait au micro-ondes.", "Verser le résultat sur les poires.", "Servir immédiatement — effet chaud/froid garanti.", "Supplément chantilly pour les plus gourmands.", "Variante : tester avec une banane."]',
 5, 2.00, 'pending', 4.00, 3),

-- H — rejected (tests rejection pipeline and admin moderation)
(8, 4, 3,
 'Quesadilla dessert Nutella, fraise et marshmallow',
 'Recette rejetée pour doublon — présente dans deux sources différentes sous des noms légèrement différents. Cas réaliste de rejet éditorial.',
 '["tortillas", "nutella", "fraises", "marshmallows miniatures"]',
 '["Étaler du nutella sur une tortilla.", "Disposer les fraises tranchées et les marshmallows sur une moitié.", "Replier la tortilla.", "Faire dorer dans une poêle sans matière grasse, 2 minutes de chaque côté.", "Couper en triangles et servir chaud."]',
 8, 2.20, 'rejected', 3.75, 4);

-- ============================================================
-- COMMENTS (30)
-- user_id mapping:
--   mickael_b    (id 1) ← user_007, user_042, user_091, user_019, user_003
--   sofia_r      (id 2) ← user_334, user_205, user_089, user_228, user_144
--   jerome_k     (id 3) ← user_118, user_712, user_567, user_381
--   anonyme_test (id 4) ← user_456, user_502
--   guest comments      ← user_id NULL, guest_name filled
-- ============================================================
INSERT INTO comments (id, recipe_id, user_id, guest_name, content) VALUES

-- Recipe A — Raisin au miel
(1,  1, 1,    NULL,          'Testé ce matin avec du raisin muscat, c\'est divin. Le miel balance parfaitement l\'acidité. Je recommande un miel de châtaignier pour les amateurs de caractère.'),
(2,  1, NULL, 'Marie-Laure', 'Sympa mais bon... c\'est juste du raisin trempé dans du miel haha. Pratique quand on a rien dans le frigo mais j\'attendais plus d\'une recette.'),
(3,  1, 3,    NULL,          'Mes enfants adorent. Je rajoute une pincée de cannelle et ça devient vraiment top. Ultra rapide après l\'école.'),
(4,  1, NULL, 'Théo',        'Fonctionne aussi avec du raisin congelé, texture étrange mais trop bonne. Combo parfait avec du fromage blanc.'),

-- Recipe B — Houmous express
(5,  2, 1,    NULL,          'Honnêtement meilleur que celui du supermarché. J\'ai ajouté un peu de paprika fumé sur le dessus, visuellement c\'est top aussi.'),
(6,  2, NULL, 'Camille',     'Je fais cette recette chaque semaine depuis 2 mois. Le secret c\'est de peler les pois chiches un par un, la texture devient soyeuse comme dans les restos libanais.'),
(7,  2, 2,    NULL,          'Correct mais sans tahini de qualité ça ne vaut vraiment pas grand chose. Investissez dans un bon tahini, ça change tout.'),
(8,  2, 1,    NULL,          'Parfait pour les apéros improvisés. J\'ai doublé la dose d\'ail et ajouté du piment d\'Espelette. Succès garanti à chaque fois.'),

-- Recipe C — Toast saumon
(9,  3, NULL, 'Juliette M.', 'Présenté à un brunch dominical, tout le monde a cru que j\'avais commandé chez un traiteur. Le pain pumpernickel est indispensable, ne pas substituer.'),
(10, 3, 2,    NULL,          'Très bon mais effectivement le saumon fumé qualité ça coûte un bras. J\'ai testé avec du saumon marinade maison, résultat honnête pour moins cher.'),
(11, 3, NULL, 'Patrick',     'Trop salé pour moi entre le saumon, le cream cheese et les câpres. À doser avec parcimonie. Bien pour une occasion spéciale mais pas du quotidien.'),

-- Recipe D — Bowl César
(12, 4, 4,    NULL,          'Rapide, goûteux, rassasiant. Je prépare le poulet rôti en double quantité le dimanche pour avoir de quoi faire ce bowl toute la semaine.'),
(13, 4, NULL, 'Nora',        'Très bien mais attention au prix si on prend un vrai parmesan reggiano. Avec du parmesan standard ça reste abordable mais la différence se sent.'),
(14, 4, 2,    NULL,          'Déçu franchement. La sauce César du commerce c\'est vraiment pas terrible, trop sucrée et trop vinaigrée. Avec une sauce maison ce serait une autre histoire.'),

-- Recipe E — Curry de lentilles
(15, 5, 3,    NULL,          'Ma recette de batch cooking numéro 1. Je triple les quantités, ça se congèle parfaitement. Moins de 2€ par portion c\'est imbattable niveau budget.'),
(16, 5, NULL, 'Sandra K.',   'Ajouté du garam masala en fin de cuisson et une pointe de citron. Franchement niveau restaurant. Mon copain qui détestait les lentilles en a repris deux fois.'),
(17, 5, 1,    NULL,          'Excellent. Petite astuce : faire griller les épices à sec 30 secondes avant d\'ajouter l\'oignon, ça développe vraiment les arômes.'),
(18, 5, NULL, 'Alexis',      'Bon mais un peu monotone. J\'ai dû rajouter beaucoup d\'épices supplémentaires, la recette de base manque un peu de profondeur à mon goût.'),

-- Recipe F — Feta Pasta
(19, 6, 2,    NULL,          'La recette qui a envahi mon FYI TikTok et pour cause. C\'est vraiment excellent. Je rajoute des olives kalamata dans le plat au four, encore meilleur.'),
(20, 6, NULL, 'Léa',         'Super recette mais attention, la feta doit être en bloc entier, pas émiettée. Si vous utilisez de la feta bas de gamme la texture est décevante.'),
(21, 6, 3,    NULL,          'Fait avec des tomates du jardin cet été, c\'était à tomber. En hiver avec des tomates cerises du commerce c\'est déjà très bien quand même.'),
(22, 6, NULL, 'Guillaume',   'Honnêtement surévalué à cause du buzz TikTok. C\'est bon hein, mais pas non plus la révolution culinaire que tout le monde annonce. Reste un plat de pâtes.'),
(23, 6, 2,    NULL,          'Testé avec du fromage de chèvre à la place de la feta, résultat différent mais tout aussi délicieux. Plus doux, plus crémeux.'),

-- Recipe G — Poires (pending)
(24, 7, NULL, 'Bernard',     'Trop bon ! J\'ai essayé et ma femme a adoré. Simple mais efficace, le chaud du chocolat avec le froid des poires c\'est vraiment une super idée.'),
(25, 7, 1,    NULL,          'Ajouté une boule de glace vanille pour encore plus de contraste chaud/froid. Le genre de dessert rapide qui impressionne sans effort.'),
(26, 7, NULL, 'Isabelle T.', 'C\'est sympa mais le chocolat au lait c\'est trop sucré avec les poires en conserve qui sont déjà sucrées. Je referai avec du chocolat noir 70%.'),

-- Recipe H — Quesadilla (rejected)
(27, 8, 3,    NULL,          'Une tuerie pour le goûter des enfants. Les marshmallows qui fondent c\'est visuellement magnifique en plus d\'être délicieux.'),
(28, 8, NULL, 'Chloé',       'Testé un soir de flemme, j\'avais tous les ingrédients sous la main. Vraiment satisfaisant. Je coupe en mini triangles pour servir à table, c\'est plus sympa.'),
(29, 8, 4,    NULL,          'Trop sucré, trop lourd. Le nutella + marshmallow c\'est l\'overdose de sucre. Avec juste nutella et banane ce serait plus équilibré.'),
(30, 8, NULL, 'Tom B.',      'Simple et efficace pour un dessert express. J\'ai remplacé les fraises par des framboises surgelées, le côté acidulé compense bien le sucre du nutella.');

-- ============================================================
-- RATINGS
-- One row per user per recipe (enforced by UNIQUE constraint).
-- Scores used to pre-calculate average_rating in recipes above.
-- Distribution:
--   Recipe A (4 ratings): 5+3+4+5 = 17 / 4 = 4.25
--   Recipe B (4 ratings): 4+5+3+5 = 17 / 4 = 4.25
--   Recipe C (3 ratings): 5+4+3   = 12 / 3 = 4.00
--   Recipe D (3 ratings): 5+4+2   = 11 / 3 = 3.67
--   Recipe E (4 ratings): 5+5+4+3 = 17 / 4 = 4.25
--   Recipe F (5 ratings): 5+4+5+3+4 = 21 / 5 = 4.20
--   Recipe G (3 ratings): 5+4+3   = 12 / 3 = 4.00
--   Recipe H (4 ratings): 5+4+2+4 = 15 / 4 = 3.75
-- Guest comments have no rating row (ratings require a user_id).
-- Each user rates each recipe at most once — constraint enforced at DB level.
-- ============================================================
INSERT INTO ratings (recipe_id, user_id, score) VALUES

-- Recipe A
(1, 1, 5),  -- mickael_b
(1, 2, 3),  -- sofia_r     (guest Marie-Laure commented but cannot rate)
(1, 3, 4),  -- jerome_k
(1, 4, 5),  -- anonyme_test (guest Théo commented but cannot rate)

-- Recipe B
(2, 1, 4),  -- mickael_b
(2, 2, 3),  -- sofia_r
(2, 3, 5),  -- jerome_k    (guest Camille commented but cannot rate)
(2, 4, 5),  -- anonyme_test

-- Recipe C
(3, 2, 4),  -- sofia_r
(3, 3, 5),  -- jerome_k    (guest Juliette M. commented but cannot rate)
(3, 4, 3),  -- anonyme_test (guest Patrick commented but cannot rate)

-- Recipe D
(4, 1, 5),  -- mickael_b   (mapped from user_456)
(4, 2, 2),  -- sofia_r     (mapped from user_089)
(4, 3, 4),  -- jerome_k    (guest Nora commented but cannot rate)

-- Recipe E
(5, 1, 4),  -- mickael_b
(5, 2, 5),  -- sofia_r     (guest Sandra K. commented but cannot rate)
(5, 3, 5),  -- jerome_k    (mapped from user_712)
(5, 4, 3),  -- anonyme_test (guest Alexis commented but cannot rate)

-- Recipe F
(6, 1, 5),  -- mickael_b
(6, 2, 4),  -- sofia_r     (mapped from user_228)
(6, 3, 5),  -- jerome_k    (mapped from user_567)
(6, 4, 3),  -- anonyme_test (guest Guillaume commented but cannot rate)
-- 5th rating needs a 5th user — using admin_ovni (valid user_id, no rule against it in MVP)
(6, 5, 4),  -- admin_ovni

-- Recipe G (pending — ratings exist, tests that pending recipes accumulate ratings)
(7, 1, 5),  -- mickael_b   (mapped from user_019)
(7, 3, 4),  -- jerome_k
(7, 4, 3),  -- anonyme_test (guest Isabelle T. commented but cannot rate)

-- Recipe H (rejected — ratings exist, tests that rejected recipes keep their data)
(8, 3, 5),  -- jerome_k    (mapped from user_381)
(8, 4, 2),  -- anonyme_test (mapped from user_502)
(8, 1, 4),  -- mickael_b
(8, 2, 4);  -- sofia_r     (guest Tom B. commented but cannot rate)
