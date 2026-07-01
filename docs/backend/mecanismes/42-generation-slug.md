# 42 — Génération de Slug (Catégories)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand une catégorie est créée ou renommée, un slug (version URL-friendly du nom) est généré automatiquement. Par exemple, le nom "Plats Rapides !" devient `plats-rapides`. Ce slug est stocké dans la colonne `slug` et est utilisé dans les URL pour identifier la catégorie de manière lisible et SEO-friendly.

Le slug garantit qu'une catégorie est accessible via une URL propre, sans espaces, accents ou caractères spéciaux.

## 2. SCHÉMA DE LA TABLE

```sql
categories (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    slug       VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL DEFAULT NULL
)
```

La colonne `slug` a une contrainte `UNIQUE` : deux catégories ne peuvent pas avoir le même slug. Si on essaie d'insérer "Desserts" et "Désserts" (avec un accent différent), le slug `desserts` serait identique pour les deux → la BDD rejettera la deuxième insertion.

## 3. LE CODE

### 3.1 — Category.js (src/models/Category.js:42-48)

```javascript
static async create({ name }) {
    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-z0-9]+/g, '-')     // non-alphanumeric → hyphen
        .replace(/^-|-$/g, '');           // trim leading/trailing hyphens
    // ...
    const [result] = await pool.execute(
        'INSERT INTO categories (name, slug) VALUES (?, ?)',
        [name, slug]
    );
    return Category.findById(result.insertId);
}
```

La même transformation est répétée dans `update(id, { name })` aux lignes 61-67.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

Prenons l'exemple du nom **"Plats Rapides !"** :

1. **`.toLowerCase()`** → `"plats rapides !"`
   - Passe tout en minuscules. Simple, mais piège : ça ne gère que les lettres basiques.

2. **`.normalize('NFD')`** → décompose les caractères accentués
   - `"é"` devient `"e" + caractère combinant accent aigu (\u0301)`
   - `"è"` devient `"e" + \u0300`
   - Résultat : la chaîne reste visuellement identique, mais les accents sont des caractères séparés.

3. **`.replace(/[\u0300-\u036f]/g, '')`** → supprime les signes diacritiques (accents)
   - La regex cible la plage Unicode des "combining diacritical marks" (U+0300 à U+036f).
   - Elle retire tous les accents, trémas, cédilles, etc.
   - `"plats rapides !"` inchangé car pas d'accents.

4. **`.replace(/[^a-z0-9]+/g, '-')`** → remplace tout ce qui n'est pas lettre ou chiffre par un tiret
   - Le `+` dans la regex coalesce les caractères consécutifs en un seul tiret.
   - L'espace et `!` deviennent `-` : `"plats-rapides-"`

5. **`.replace(/^-|-$/g, '')`** → supprime les tirets en début et fin
   - `^-` : tiret au début. `-$` : tiret à la fin. Le `|` signifie OU.
   - Résultat final : `"plats-rapides"` (le tiret final à cause du `!` est supprimé).

**Cas avec accents** : `"Déjeuner d'été"` :
- toLowerCase → `"déjeuner d'été"`
- normalize('NFD') → `"de\u0301jeuner d'e\u0301te\u0301"`
- replace diacritiques → `"dejeuner d'ete"`
- replace non-alphanum → `"dejeuner-d-ete"` (l'apostrophe devient aussi un tiret)
- trim tirets → `"dejeuner-d-ete"`

## 5. ANALOGIE

C'est comme un valet de vestiaire qui prend ton manteau (le nom de la catégorie), enlève tous les accessoires qui dépassent (les accents, les espaces, les caractères bizarres), et te rend une version pliée bien nette (le slug) qui tient parfaitement dans une URL. Pas de risques que le manteau (l'URL) se prenne les pieds dans les décorations.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Collision de slugs

Deux catégories avec des noms différents peuvent produire le même slug. Exemple : "Desserts" et "Désserts" (si quelqu'un tape mal) donnent tous les deux `desserts`. La contrainte `UNIQUE` en BDD plante. Il faut gérer cette erreur côté application (soit on refuse, soit on suffixe avec un nombre).

### Piège #2 : Oubli de normalisation

Si on saute l'étape `.normalize('NFD')`, la regex `[\u0300-\u036f]` ne trouve rien à supprimer et les accents restent dans le slug. Le `[^a-z0-9]` va alors remplacer les caractères accentués par des tirets, produisant des slugs comme `d-jeuner-d-t-` au lieu de `dejeuner-d-ete`.

### Piège #3 : Duplication du code slug

La logique de génération est dupliquée entre `create()` et `update()`. Si on modifie la règle de slugification (ex: on ajoute une gestion des collisions), il faut penser à changer les deux endroits. Une fonction utilitaire dédiée (`generateSlug(name)`) éviterait ce risque.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Utiliser une bibliothèque comme `slugify`** : `npm install slugify` et on appelle `slugify(name, { lower: true, strict: true })`. Moins de code à maintenir, gestion des edge cases (langues, caractères spéciaux) plus robuste. Mais ajoute une dépendance pour quelque chose de trivial — la version maison fait 4 lignes et est parfaitement lisible pour un projet de cette taille.

**Générer le slug en SQL** : On pourrait utiliser une fonction MySQL/MariaDB pour générer le slug dans la requête INSERT. Mais ça mélange les responsabilités (le SQL ne devrait pas faire de transformation métier) et c'est quasi-impossible à déboguer.

## 8. CHECKLIST POUR LE JURY

- [ ] Comprendre que `normalize('NFD')` décompose les accents pour pouvoir les isoler et les supprimer
- [ ] Savoir expliquer pourquoi la plage `\u0300-\u036f` correspond aux accents en Unicode
- [ ] Justifier la contrainte `UNIQUE` sur `slug` : empêcher les doublons en BDD
- [ ] Être capable de tracer manuellement la transformation d'un nom en slug (papier + crayon)
- [ ] Expliquer pourquoi le slug est stocké en base plutôt que calculé à chaque requête (performance, pas de calcul répété, indexable)
- [ ] Connaître le risque de collision et comment on pourrait le résoudre (suffixe numérique)
