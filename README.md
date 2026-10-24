# UI Portfolio · Game Experience

The portfolio of **Angelo Rosa, Product Designer**, built as a platformer you can play.

The page *is* the level: paragraphs, cards, titles and images become platforms, every section is a stage
with a hole in its floor leading to the next one, and the camera is the page scroll. Jump on a pipe and
press ↓ to open a case study. Prefer to just read? Scroll as usual; the game is a layer on top of a regular site.

## Controls

| Key | Action |
|---|---|
| ← → | walk |
| Space | jump (press again in the air for a double jump) |
| ↓ | drop through a platform · stomp while in the air · enter a pipe |
| P / Esc | pause |

On touch devices, on-screen buttons appear during the game.

## Run locally

No build step, no dependencies: plain HTML, CSS and JavaScript.

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Structure

```
index.html          home: 5 stages (start, about, process, work, contact)
work/*.html         case studies (each one a level) and the archive
css/estilo.css      site styles, floors, pipes, cards
js/mundo.js         reads the DOM and builds the level (platforms, stages, holes, pipes)
js/jogo.js          input, physics, camera, enemies, HUD, page-to-page pipes
js/efeitos.js       springs that make blocks react to the character's weight
js/sprites.js       the character and enemies as pixel maps
assets/             covers, case images and videos, logos, icons
ferramentas/        Python scripts that draw the pixel art covers, logos and icons (not needed to deploy)
```

Mark up content with `data-plat` (platform), `data-fase` (stage), `data-pouso` (landing spot),
`data-moedas` / `data-skill` (collectibles), `data-bugs` (enemies) and `a[data-cano]` (pipe to another page).
A detailed write-up of the mechanics (in Portuguese) is in [ANALISE.md](ANALISE.md).

## Credits

Concept inspired by the platformer portfolio at [pvwebprojects.com/pedro](https://www.pvwebprojects.com/pedro/).
All code, pixel art and content here are original.
