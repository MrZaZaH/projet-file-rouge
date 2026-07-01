# #16 — Export CSV

## 1. CE QUE ÇA FAIT (vue d'ensemble)

L'export CSV permet à un administrateur de télécharger la liste des recettes publiées au format CSV (Comma-Separated Values), directement ouvrable dans Excel ou LibreOffice Calc. Le fichier est généré à la volée côté serveur (pas de fichier temporaire sur le disque), envoyé avec des en-têtes HTTP spécifiques qui forcent le navigateur à télécharger le fichier plutôt qu'à afficher la réponse. Aucune librairie externe n'est utilisée : la construction du CSV se fait par concaténation de chaînes en JavaScript.

## 2. SCHÉMA DE LA TABLE

```sql
-- Table recipes (03_create_tables.sql:54)
-- L'export ne sélectionne QUE les recettes avec status = 'published'
-- et exclut les soft-deleted (WHERE deleted_at IS NULL)
CREATE TABLE IF NOT EXISTS recipes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    status              ENUM('pending', 'published', 'rejected') NOT NULL DEFAULT 'pending',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL DEFAULT NULL,
    -- ... autres colonnes non exportées dans le CSV actuel
);
```

## 3. LE CODE

### 3.1 — Contrôleur exportCSV (src/controllers/AdminController.js:424)

```javascript
static async exportCSV(req, res) {
    try {
        // ÉTAPE 1 : Récupérer les données depuis la BDD
        // Seulement les recettes publiées et non supprimées
        const [recipes] = await pool.query(
            `SELECT id, title, status, created_at
             FROM recipes
             WHERE status = 'published' AND deleted_at IS NULL`
             // On filtre dès la requête : pas besoin de filtrer en JS ensuite
        );

        // ÉTAPE 2 : Construire l'en-tête du CSV (la première ligne)
        // Champs séparés par des virgules, pas d'espace après la virgule
        let csv = 'id,title,status,created_at\n';
        // \n = nouvelle ligne (retour à la ligne)

        // ÉTAPE 3 : Ajouter chaque recette comme une ligne CSV
        recipes.forEach(r => {
            // Pour chaque ligne :
            // - id : nombre, pas besoin de guillemets
            // - title : string → entouré de guillemets au cas où il contient des virgules
            // - status : string simple
            // - created_at : date string
            csv += `${r.id},"${r.title}",${r.status},${r.created_at}\n`;
            // Les guillemets autour de r.title sont CRUCIAUX :
            // si le titre contient une virgule "Pâtes, tomates, basilic"
            // → CSV valide : "Pâtes, tomates, basilic"
            // → CSV cassé : Pâtes, tomates, basilic (Excel croit voir 4 colonnes)
        });

        // ÉTAPE 4 : En-têtes HTTP pour forcer le téléchargement
        res.header('Content-Type', 'text/csv');
        // Indique au navigateur que c'est un fichier CSV, pas du HTML

        res.attachment('recipes.csv');
        // Définit Content-Disposition: attachment; filename="recipes.csv"
        // → Le navigateur affiche la boîte de dialogue "Enregistrer sous..."
        // → Sans ça, il afficherait le texte CSV dans la fenêtre

        res.send(csv);
        // Envoie le contenu CSV dans la réponse HTTP

    } catch (error) {
        logger.error('Failed to export CSV', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
```

### 3.2 — Route export CSV (src/routes/adminRoutes.js:171-175)

```javascript
// La route est protégée (authenticate + requireAdmin)
// comme toutes les autres routes admin
router.get(
    '/export/recipes',
    AdminController.exportCSV
    // Note : pas de validation express-validator ici
    // Pourquoi ? Cette route n'a pas de paramètres utilisateur
    // → rien à valider
);
```

### 3.3 — Frontend : déclenchement du téléchargement (moderation-panel.js:266)

```javascript
function setupExport() {
    var btn = document.getElementById('export-csv-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        var token = getToken();
        fetch('/api/v1/admin/export/recipes', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(res) {
            if (!res.ok) throw new Error('Export failed');
            return res.blob();
        })
        .then(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'recettes.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        })
        .catch(function(err) {
            console.error('CSV export error:', err);
        });
    });
}
```

Pourquoi `fetch` + `Blob` au lieu de `window.open()` ?
- `window.open()` crée un **nouveau contexte de navigation** qui n'a pas accès au token JWT du localStorage
- `fetch()` s'exécute dans le contexte JS de la page courante → on injecte `Authorization: Bearer <token>` dans les headers
- Le `Blob` reçu est transformé en URL objet, un lien `<a>` cliquable est créé programmatiquement, puis le clic est simulé → le navigateur déclenche le téléchargement
- `URL.revokeObjectURL()` nettoie la mémoire allouée pour éviter les fuites

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Admin clique sur "Exporter CSV"

1. fetch('/api/v1/admin/export/recipes', { headers: { Authorization: 'Bearer <token>' } })
   → Requête AJAX avec le token JWT dans les headers (pas de nouvel onglet)

2. Middleware authenticate → valide le JWT
3. Middleware requireAdmin → vérifie le rôle admin

4. AdminController.exportCSV() :
   a. pool.query('SELECT id, title, status, created_at FROM recipes
                  WHERE status = 'published' AND deleted_at IS NULL')
   b. Construction de la chaîne CSV :
      - Ligne 1 : "id,title,status,created_at\n" (en-têtes)
      - Lignes suivantes : "1,"Titre de la recette",published,2024-01-15\n"
   c. res.header('Content-Type', 'text/csv')
   d. res.attachment('recipes.csv')
   e. res.send(csv)

5. Le fetch reçoit le blob → création d'un URL objet → lien <a> programmatique
   → clic simulé → le navigateur déclenche "Enregistrer sous"
   → URL.revokeObjectURL() libère la mémoire

6. L'utilisateur ouvre le fichier dans Excel :
   - 4 colonnes : id, title, status, created_at
   - Chaque titre est correctement échappé (guillemets)
```

## 5. ANALOGIE

Tu tiens un stand de légumes. Un client (l'admin) demande la liste de tout ce que tu as vendu aujourd'hui.

- Tu prends ton cahier de ventes (la BDD)
- Tu recopies les infos sur une feuille propre (construction du CSV)
- Tu mets la feuille dans une pochette avec une étiquette "Ventes du jour" (en-têtes HTTP)
- Tu donnes la pochette au client, il l'emporte dans son bureau (téléchargement)
- Il peut l'ouvrir dans son tableur Excel pour faire des calculs

Tu n'as pas utilisé de machine sophistiquée — juste un stylo et du papier (JavaScript string concatenation).

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier les guillemets autour des champs texte

Un titre de recette comme "Pâtes, ail, huile d'olive" contient des virgules. Sans guillemets, Excel interprète chaque virgule comme un séparateur de colonne.

**MAUVAIS :**
```javascript
csv += `${r.id},${r.title},${r.status},${r.created_at}\n`;
// "Pâtes, ail, huile d'olive" → 4 colonnes alors qu'il n'y en a qu'une
```

**BON :**
```javascript
csv += `${r.id},"${r.title}",${r.status},${r.created_at}\n`;
```

### Piège #2 : Oublier Content-Disposition

Sans `res.attachment()`, le navigateur affiche le texte CSV brut dans la fenêtre au lieu de proposer le téléchargement.

**MAUVAIS :**
```javascript
res.header('Content-Type', 'text/csv');
res.send(csv);
// Le navigateur affiche "1,Titre,status,2024-01-15" en texte dans l'onglet
```

**BON :**
```javascript
res.header('Content-Type', 'text/csv');
res.attachment('recipes.csv'); // ← détermine le comportement "téléchargement"
res.send(csv);
```

### Piège #3 : Utiliser une librairie externe pour un truc simple

Pour 4 colonnes et quelques dizaines de lignes, une librairie comme `csv-stringify` est overkill.

**MAUVAIS :**
```bash
npm install csv-stringify
```

**BON :**
```javascript
let csv = 'id,title,status,created_at\n';
recipes.forEach(r => {
    csv += `${r.id},"${r.title}",${r.status},${r.created_at}\n`;
});
// 3 lignes de code. Zéro dépendance.
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Générer un fichier Excel (.xlsx) avec une librairie

- Comment ça marche : Utiliser `exceljs` ou `xlsx` pour générer un vrai fichier Excel avec colonnes formatées
- Avantage : Plus professionnel, l'utilisateur peut ouvrir le fichier directement sans configurer le séparateur CSV
- Inconvénient : Dépendance externe à ajouter, code plus complexe, poids du fichier plus important
- Notre cas : CSV suffit pour l'export de données brutes. Excel demande une config utilisateur (séparateur régional) mais c'est une opération ponctuelle d'admin.

### Option B : Streamer le CSV plutôt que de tout construire en mémoire

- Comment ça marche : Utiliser `pipe()` ou des WriteStream pour envoyer ligne par ligne
- Avantage : Ne consomme pas de RAM si la table contient 100 000 recettes
- Inconvénient : Plus de code, plus complexe. Pour un MVP avec quelques centaines de recettes maximum, inutile.
- Notre cas : Construction en mémoire = simple, lisible, parfait pour le volume actuel

## 8. CHECKLIST POUR LE JURY

- [ ] Le fichier téléchargé a l'extension .csv
- [ ] L'en-tête `Content-Type` est `text/csv`
- [ ] L'en-tête `Content-Disposition` contient `attachment; filename="recipes.csv"`
- [ ] Les titres avec des virgules sont entourés de guillemets
- [ ] Seules les recettes `published` et non soft-deletées sont exportées
- [ ] La route est protégée (authenticate + requireAdmin)
- [ ] Le frontend télécharge via `fetch` + `Blob` avec le token JWT dans le header `Authorization`
