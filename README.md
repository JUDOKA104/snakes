# Snake (Astro + React + Tailwind)

Un Snake moderne, prêt pour GitHub Pages.

## Fonctions
- Canvas avec wrap-around
- Sons WebAudio (manger, pas, mort)
- Glow + shake animation (framer-motion)
- Sélecteur de taille des cases
- Vitesse ajustable
- Leaderboard **local** (localStorage)
- Thème sombre type “ROG”

## Démarrage
```bash
npm i
npm run dev
```
Puis ouvrez `http://localhost:4321`.

## Build
```bash
npm run build
npm run preview
```

## Déploiement GitHub Pages
1. Dans `astro.config.mjs`, définissez :
   - `site: 'https://<USERNAME>.github.io'`
   - `base: '/<REPO>'` (ex.: `/snake` si votre repo s’appelle `snake`).
2. Poussez sur la branche par défaut et activez **Pages** (depuis `/docs` si vous utilisez GitHub Actions Astro, sinon depuis `dist` via Pages).

> Si vous déployez à la racine (repo `<USERNAME>.github.io`), laissez `base: '/'`.
