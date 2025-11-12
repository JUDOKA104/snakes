# Portfolio Astro + React + Tailwind (GitHub Pages)

Un starter minimaliste, dark & propre, pensé pour déployer gratuitement sur **GitHub Pages**.

## 1) Installer
```bash
# Node 20 recommandé
npm i
```

## 2) Développement local
```bash
npm run dev
```

## 3) Build
```bash
npm run build
npm run preview
```

## 4) Déploiement GitHub Pages
1. Crée un repo **public** sur GitHub (ex: `enzo-portfolio`).
2. Pousse ce code:
```bash
git init
git add .
git commit -m "feat: portfolio starter"
git branch -M main
git remote add origin https://github.com/<ton-user>/<ton-repo>.git
git push -u origin main
```
3. Va dans **Settings → Pages** : Source = **GitHub Actions**.
4. L'action CI va construire et publier le site.

### Base path (optionnel)
Si l'URL finale est `https://<user>.github.io/<repo>`, ajoute dans `astro.config.mjs` :
```js
export default defineConfig({
  base: '/<repo>',
  site: 'https://<user>.github.io/<repo>',
  // ...
})
```
Et relance un build/commit.

## Personnalisation rapide
- Modifie ta palette dans `tailwind.config.cjs` (`brand.bg`, `brand.accent`).
- Mets tes projets dans `src/data/projects.json`.
- Édite le contenu des pages dans `src/pages/*`.
- Change l'email et tes liens dans `/contact`.

## Pourquoi Astro ?
- Sortie **statique** ultra‑rapide (parfaite pour Pages).
- **Islands/React** uniquement où nécessaire → perf.
- Code **TypeScript** possible partout.

Bonne création !


## Jeu Snake
- Page: `/snake`
- React + Astro, sons via WebAudio, leaderboard localStorage.
