# 46 — A-Bar : Fourchette & Cuillère sur le "a" de "anormales"

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Un SVG inline de fourchette et cuillère croisées est positionné par-dessus la lettre "a" dans le mot "anormales" du titre hero sur la page d'accueil. Le "a" reste visible en transparence (opacity 0.3, puis retiré pour laisser la couleur accent pleine). L'effet visuel : les couverts "cachent" désespérément le "a" pour faire apparaître "normales" — un clin d'œil au ton humoristique du projet (les situations "anormales" sont en fait des situations normales du quotidien).

C'est purement CSS + SVG inline. Pas de JavaScript, pas de chargement externe.

## 2. SCHÉMA DE LA TABLE

Pas de table. Zéro impact BDD.

## 3. LE CODE

### 3.1 — frontend/public/index.html:65 (dans le `<h1>` hero)

```html
<h1 id="hero-title">Des recettes inventées<br>par des gens <em>normaux</em><br>
  dans des situations <em>
    <span class="a-bar">
      <span class="a-letter">a</span>
      <svg viewBox="0 0 24 34" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <g transform="translate(12,22) rotate(-30) translate(-12,-22)">
          <ellipse cx="12" cy="10" rx="4.5" ry="6.5"/>
          <line x1="12" y1="16.5" x2="12" y2="32"/>
        </g>
        <g transform="translate(12,22) rotate(30) translate(-12,-22)">
          <line x1="12" y1="16" x2="12" y2="32"/>
          <rect x="8" y="13" width="8" height="4" rx="1"/>
          <line x1="9" y1="13" x2="9" y2="7"/>
          <line x1="12" y1="13" x2="12" y2="7"/>
          <line x1="15" y1="13" x2="15" y2="7"/>
        </g>
      </svg>
    </span>normales
  </em>
</h1>
```

**Structure du SVG :**

- `viewBox="0 0 24 34"` — espace de coordonnées 24×34 unités
- Premier `<g>` : cuillère, tournée de −30° autour du point (12, 22)
  - `<ellipse>` : le cuilleron (rx=4.5, ry=6.5)
  - `<line>` : le manche (de y=16.5 à y=32)
- Deuxième `<g>` : fourchette, tournée de +30° autour du point (12, 22)
  - `<line>` : le manche (de y=16 à y=32)
  - `<rect>` : la base des dents (8×4, coins arrondis rx=1)
  - 3 `<line>` : les dents (de y=13 à y=7)
- `stroke="currentColor"` : hérite de la couleur du texte environnant (--accent via `<em>`)
- `aria-hidden="true"` : invisible pour les lecteurs d'écran (le "a" est lu via `<span class="a-letter">`)

### 3.2 — frontend/public/css/styles.css:288-304

```css
/* ---------- 3b. A-BAR (fork & spoon desperately hiding the a) ---------- */
.a-bar {
    position: relative;
    display: inline-block;
}
.a-letter {
    color: var(--accent);
}
.a-bar svg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 1.6em;
    height: 1.6em;
    z-index: 1;
}
```

**Rôle de chaque propriété :**

| Propriété | Rôle |
|---|---|
| `.a-bar` `position: relative` | Ancre le SVG en absolu dans le bon périmètre |
| `.a-bar` `display: inline-block` | La barre prend la largeur du "a" (pas de dimension fixe) |
| `.a-letter` `color: var(--accent)` | Force la couleur accent (redondant avec `<em>`, mais explicite) |
| `.a-bar svg` `position: absolute` | Sort le SVG du flux pour le superposer au "a" |
| `top/left 50% + translate(-50%, -50%)` | Centre parfaitement le SVG sur le "a" |
| `width/height: 1.6em` | Taille du SVG relative à la police courante |
| `z-index: 1` | Passe au-dessus du texte du "a" |

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. Le navigateur charge `index.html` et rencontre le `<h1>` hero.
2. Dans le `<em>` contenant "anormales", il rencontre `<span class="a-bar">`.
3. À l'intérieur : `<span class="a-letter">a</span>` (le "a" visible en couleur accent) et le `<svg>` (fourchette + cuillère).
4. Le CSS positionne le SVG en absolu, centré sur le "a", avec `z-index: 1` — il se superpose donc par-dessus la lettre.
5. Le "a" est toujours là dans le DOM, visible sous les couverts. Visuellement, on voit une fourchette et une cuillère croisées à l'emplacement du "a".
6. Les lecteurs d'écran lisent `<span class="a-letter">a</span>normales` → "anormales" normalement (le SVG est `aria-hidden`).
7. Le mot "normales" (sans le "a") suit immédiatement dans le même `<em>`.

**Rendu final dans le hero :**
```
Des recettes inventées
par des gens normaux
dans des situations [svg]normales
```

## 5. ANALOGIE

C'est comme un correcteur qui passe devant une lettre pour la cacher — sauf que le correcteur, c'est une fourchette et une cuillère qui font le "stop" avec leurs bras. La lettre est toujours là derrière (le "a" est visible en accent), mais les couverts font semblant de la bloquer. C'est absurde, c'est culinaire, c'est OVNI Culinaire.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Le SVG déborde sur la ligne du dessus

Si les coordonnées Y des couverts sont trop hautes (cuilleron ou dents de fourchette trop proches du y=0 du viewBox), le SVG dépasse du cadre et chevauche la ligne au-dessus. Solution : le centre de rotation est à y=22 et les dents commencent à y=13 — assez bas pour éviter le débordement.

### Piège #2 : Opacity sur le "a" dénature la couleur

Appliquer `opacity: 0.3` sur `.a-letter` donne au "a" une teinte différente du reste du mot "normales" (qui est en `var(--accent)` plein). Le correctif : supprimer l'opacity et laisser la couleur accent pleine. Les couverts sur le dessus suffisent à créer l'effet de "cache".

### Piège #3 : Taille inadaptée sur mobile

`width: 1.6em` est relatif à `font-size`. Sur un `<h1>` avec `clamp(2rem, 5vw, 3.2rem)`, le SVG s'adapte automatiquement. Vérifier sur très petit écran que les couverts restent lisibles (pas de breakpoint spécifique nécessaire pour l'instant).

### Piège #4 : Accessibilité

Le SVG a `aria-hidden="true"` pour ne pas polluer la lecture vocale. Mais le "a" doit rester dans le DOM (pas de `display: none` ou `visibility: hidden` qui le cacheraient aussi des lecteurs d'écran). `aria-label` n'est pas nécessaire car la phrase se lit naturellement : "a" + "normales" = "anormales".

## 7. ET SI ON FAISAIT AUTREMENT ?

**Emoji Unicode** : On aurait pu utiliser ✂️ (ciseaux) ou 🥪 (sandwich) en `::before`/`::after` sur le "a". Mais un emoji n'est pas personnalisable (taille, couleur, rotation) et son rendu varie selon l'OS. Le SVG inline garantit le même rendu partout.

**Image PNG externe** : Une image `<img src="fork-spoon.png">` avec `position: absolute` aurait fonctionné, mais ajoute un chargement réseau, une requête HTTP supplémentaire, et n'hérite pas de `currentColor`. Le SVG inline est zéro requête, zéro dépendance.

**Remplacer le "a" par un `text-decoration: line-through`** : Moins drôle. La blague, c'est les couverts qui se mettent devant — pas une simple barre de correction.

## 8. CHECKLIST POUR LE JURY

- [ ] Comprendre le positionnement absolu du SVG par-dessus le "a" (parent `position: relative`, enfant `position: absolute`)
- [ ] Expliquer pourquoi `currentColor` est utilisé dans le SVG (héritage de la couleur du texte parent)
- [ ] Justifier `aria-hidden="true"` sur le SVG et l'impact accessibilité (le "a" est encore lu par les lecteurs d'écran)
- [ ] Savoir pourquoi `width: 1.6em` plutôt qu'une valeur fixe en pixels (adaptatif à la taille de police)
- [ ] Expliquer les coordonnées du viewBox SVG (24×34) et le système de rotation (translate → rotate → translate)
- [ ] Connaître les alternatives et pourquoi le SVG inline a été choisi (universalité, pas de requête HTTP, pas de variation OS)
