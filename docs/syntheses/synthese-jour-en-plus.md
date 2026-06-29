# Synthèse Jour en + — Rafraîchissement front-end

## Ce qu'on a fait

### 1. Suppression du "Surprends-moi" redondant dans le hero

- **`index.html`** : retiré `<a href="#" class="btn-cta" id="hero-surprise">Surprends-moi !</a>` de la section hero (ligne 62)
- **`js/home.js`** : retiré `const heroSurprise` + l'event listener associé (lignes 8, 120-125)
- Le bouton du header (`#surprise-btn`) reste présent sur toutes les pages, connecté via `app.js:initShared()` — aucun changement de comportement

### 2. Externalisation des scripts inline HTML

Trois pages avaient leur JavaScript inline dans le HTML, cassant la cohérence architecturale du projet (les autres pages utilisent des fichiers `.js` dédiés) :

| Page | Fichier créé | Lignes extraites |
|------|-------------|-------------------|
| `submit.html` | `js/submit.js` | 181-271 (91 lignes) |
| `login.html` | `js/login.js` | 113-155 (43 lignes) |
| `register.html` | `js/register.js` | 128-184 (57 lignes) |

Chaque fichier suit la convention existante : en-tête commenté, dépendances documentées, `auth.js` + `app.js` chargés avant dans le HTML.

## Problèmes rencontrés

- Aucun. Simple extraction de code existant sans modification de logique.

## Décisions techniques prises

- **Hero supprimé, pas le header** : le bouton header est accessible depuis toutes les pages. Le hero n'était que sur l'index. La redondance n'apportait rien.
- **Fichiers dédiés (submit.js, login.js, register.js)** plutôt que fusion dans `app.js` : chaque fichier a un scope et des dépendances spécifiques. Les mettre dans `app.js` l'aurait alourdi inutilement. Le nommage ne collisionne avec aucun fichier existant.
- **Aucune modif de logique** : refactor zéro-risque. Le comportement est strictement identique avant/après.

## Ce qui reste

- Jour 30 : revue finale front-end (audit Lighthouse, optimisation, documentation RNCP)
- Nettoyage des fichiers legacy (`*1.js` dans `src/`) avant rendu
- Contenu statique dans le hero ("Numéro 47 · Juin 2026", histoire featured) à rendre dynamique si le temps le permet
