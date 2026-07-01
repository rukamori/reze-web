# Recreating this website from scratch

This guide explains how to build a website like `therealreze.vercel.app`: a dark glassmorphism personal portfolio with a floating music topbar, animated hero, Android/root portfolio sections, AMA box, playground games, credits, and changelog modal.

## 1. Tech stack

Use a simple static site:

- `index.html` for markup
- `style.css` for all styling and animations
- `script.js` for dynamic sections, games, music controls, AMA, changelogs, and patches
- Vercel for hosting
- Optional Firebase/Firestore for AMA questions
- Optional Vercel API routes for Telegram/Formspree notifications

## 2. File structure

```txt
Vercel-Website/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ api/
│  ├─ telegram.js
│  ├─ telegram-webhook.js
│  └─ ama-vote.js
├─ firestore.rules
├─ netlify.toml
└─ wrangler.toml
```

## 3. Base HTML layout

Create these main sections in `index.html`:

1. Intro/preloader overlay
2. Fixed floating topbar
3. Hidden/embedded music player controls
4. Hero section
5. About section
6. Skills section
7. Projects/ROM section
8. Widgets/media sections
9. Ask Me Anything section
10. Contact/social section
11. Credits section
12. Changelog modal
13. Playground section injected or rendered by JavaScript

Minimal skeleton:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>therealreze</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="intro-overlay"></div>
  <header class="topbar-container"></header>
  <section id="hero"></section>
  <section id="about"></section>
  <section id="skills"></section>
  <section id="projects"></section>
  <section id="contact"></section>
  <footer></footer>
  <script src="script.js"></script>
</body>
</html>
```

## 4. Visual design

Use these design rules:

- Dark background: `#000` or `#0c0c0c`
- Main text: off-white `#f5f2e9`
- Muted text: gray `#8d8b86`
- Cards: translucent black with border
- Border radius: 24–34px
- Topbar: fixed pill with heavy blur
- Background: subtle grid plus radial aurora blobs
- Typography: modern sans for headings, monospace for labels

Important CSS ingredients:

```css
:root {
  --bg:#000;
  --surface:#0c0c0c;
  --white:#f5f2e9;
  --gray:#8d8b86;
  --border:rgba(245,242,233,.16);
  --mono:'JetBrains Mono',monospace;
  --sans:Inter,system-ui,sans-serif;
}

body {
  background:var(--bg);
  color:var(--white);
  font-family:var(--sans);
  overflow-x:hidden;
}

.grid-bg {
  position:fixed;
  inset:0;
  pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
  background-size:56px 56px;
}
```

## 5. Hero section

Use a large animated gradient text headline:

```html
<h1 class="hero-h1">
  <span class="hero-h1-gif-text">Building Android<br>beyond stock</span>
</h1>
```

The current version intentionally removes the trailing `.` and cursor line.

## 6. Floating topbar

Create a pill-shaped fixed header with icon buttons:

- Home
- About
- Skills/projects
- Games/playground
- Contact
- Music widget
- Theme toggle

The games icon should call `gxShowGames()` or link to `#games`.

## 7. Playground games

Create a dedicated playground page/overlay with cards for:

- Snake
- Ping Pong
- Roast Quiz
- Flappy
- Minesweeper
- Reaction Test

Dodge has been removed.

Each card should have:

```html
<article class="gx-play-card" id="game-snake">
  <div class="gx-play-card-icon">♞</div>
  <h3>Snake</h3>
  <p>Classic game. High chance of self-sabotage.</p>
  <button class="gx-play-btn" data-game="snake">Play →</button>
</article>
```

The game popup is a modal:

```html
<div id="final-game-modal" class="arena-game-modal-v2">
  <div class="fgm-panel">
    <div class="fgm-head">
      <div class="fgm-title">Snake</div>
      <button class="fgm-close">×</button>
    </div>
    <div class="fgm-body">
      <div class="fgm-game"></div>
    </div>
  </div>
</div>
```

Games are drawn in canvas or rendered as buttons from JavaScript.

## 8. AMA section

The AMA box needs:

- Input row
- Refresh/send buttons
- Public answered list
- Sort pills: Top, Recent, Oldest
- Page number pills aligned to the right of the sort pills
- Upvote buttons

If using Firestore, store documents in an `amaQuestions` collection with fields:

```js
{
  id,
  name,
  question,
  answer,
  votes,
  createdAt,
  answeredAt
}
```

## 9. Credits section

Credits should contain:

- Header: `Inspired by`
- Links:
  - `sandbox.ganxsh.workers.dev`
  - `urstark.is-a.dev`
- Header: `Made using`
- Clickable badges:
  - Claude → `https://claude.ai/`
  - Arena AI → `https://arena.ai/`

## 10. Changelogs

Add a pill/button in the credits area that opens a blurred modal. Each changelog entry is an article with a date, time, and bullet list.

Example:

```html
<article class="gx-changelog-entry">
  <div class="gx-changelog-date">2026-07-01 <span>13:55 IST</span></div>
  <ul>
    <li>Removed Dodge game.</li>
    <li>Improved game modal reliability.</li>
  </ul>
</article>
```

## 11. Deployment on Vercel

1. Push your project to GitHub.
2. Go to Vercel.
3. Import the GitHub repository.
4. Framework preset: Other/static.
5. Deploy.

For API routes, keep files inside `/api`. Vercel automatically deploys them as serverless functions.

## 12. Maintenance tips

- Avoid stacking many duplicate patch blocks in `script.js`; consolidate once stable.
- Keep all game data in one array.
- Keep one modal opener only to avoid flicker.
- Use one body class for playground route state.
- Test mobile Chrome after every change.
- Clear browser cache or use an incognito tab after deployment.

