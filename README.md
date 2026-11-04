# Math Arcade

A retro arcade site where students answer math questions to make moves in games.

| Game | Math | Question file |
| --- | --- | --- |
| Tic-Tac-Toe | A 1-step equation before every X | `questions.json` |
| Deus Draconis | A 2-step equation every 30 seconds | `questions-two-step.json` |
| Astro Stomp | A 1-step equation to refill oxygen, and one at each rocket | `questions.json` |
| Spireclash | None: a 3D build-and-duel game against an AI rival (in `spireclash/`) | None |

It's fully static (HTML, CSS and JavaScript with no build step), so it can run on GitHub
Pages, Netlify or any static host.

## Run it locally

Pages load `questions.json` with `fetch`, so open them through a local server, not by
double-clicking the file:

```sh
cd math-arcade
python3 -m http.server 8080
```

Then open http://localhost:8080. Until a Google client ID is set, the sign-in page shows
a **Press start** button (dev mode) so you can try everything.

## Set up Google sign-in

1. Go to [Google Cloud Console](https://console.cloud.google.com/), create a project.
2. **APIs & Services > OAuth consent screen**: set it up (External, or Internal if your
   school uses Google Workspace and only school accounts should get in). Only the basic
   `openid`/`email`/`profile` scopes are used.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID**, type
   **Web application**. Under **Authorized JavaScript origins** add
   `http://localhost` and `http://localhost:8080`, plus your live URL (e.g.
   `https://yourname.github.io`). No redirect URI is needed.
4. Paste the client ID into `googleClientId` in `js/config.js`.

School Workspace accounts: your Google admin may have to allow the app before students
can sign in.

## Make yourself the teacher

Hash your email (lowercase) and put the result in `teacherEmailHashes` in
`js/config.js`:

```sh
printf '%s' 'you@school.org' | shasum -a 256
```

A hash is used so your email doesn't appear in the public source. Only accounts on
this list see the Teacher button and page. While the list is empty, nobody does.

Before a Google client ID is set, the sign-in page runs in dev mode with a plain start
button. That button gives teacher access only when the site is running on your own
computer (`localhost` or an opened file), so you can try the teacher tools while setting
up. On the live site, dev mode signs everyone in as a student.

## Change the questions

1. Sign in, press **Teacher**, and pick the question set (one per game).
2. Edit, delete, add, or generate equations (1-step or 2-step to match the set).
   Each set's draft autosaves separately in that browser.
3. Press **Export**, replace the matching file in this folder with the download
   (`questions.json` or `questions-two-step.json`), and push.

You can also edit the files by hand. Each entry is `{ "prompt": ..., "answer": ... }`.

## Privacy

- Google's sign-in token is read in the browser only to check whether the person is a
  teacher, then discarded. Nothing is sent to any server of ours (there isn't one).
- The only thing kept is a `{ "teacher": true/false }` flag in `sessionStorage`,
  which disappears when the tab closes. Sound on/off and the teacher draft live in
  `localStorage`.
- Google itself still knows that the account signed in to this site.

The sign-in gate and teacher check run in the browser, so a tech-savvy student could get
around them. That's acceptable here: the questions are public anyway, and changing them
for everyone requires pushing to the repo.

## Tuning

`aiOptimalMoveChance` in `js/config.js` sets how often the tic-tac-toe CPU plays its
best move (default `0.1`, so 1 move in 10). The rest of the time it picks a random
open square.

## Deus Draconis

A JavaScript remake of the Scratch game
[Deus Draconis](https://scratch.mit.edu/projects/1261173284). The monster spawn
schedule, flight paths, slime, fire ammo (3 shots, one back every 2s), +5 per
monster, 3 lives and the 90-second round all follow the original. The pixel art and
sound effects are new, and there's no background music.

Math: every 30 seconds of round time the game pauses for a 2-step equation. Any
answer gives a 2.5-second shield (the dragon blinks inside a blue box). A correct
answer also gives +10 points and refills fire. Losing a life restarts the round
clock, so the questions come at 30s and 60s of each life. Tune `shieldSeconds`,
`bonusPoints` and `questionEvery` at the top of `js/draconis/game.js`.

## Astro Stomp

A three-stage platformer: Mars, then Venus, then Saturn. Arrow keys or A/D move,
space (or up/W) jumps, and down (or S) in the air smashes straight down. Only a smash
kills an alien; landing on one normally just bounces you off. On touch screens,
on-screen buttons appear after the first tap.

- **Mars:** stalker, horned brute (takes 2 smashes) and the hovering brain, which
  drifts at helmet height so you can jump over it and smash it.
- **Venus** (lava pits): ravager (winds up, then charges), blade alien and the bug,
  which dives on you from above, then lies stunned on the ground for about 3 seconds.
  While stunned it's harmless and any landing on it kills it.
- **Saturn:** all six.

Math: getting hit or falling costs one of 3 oxygen hearts. At zero, a 1-step equation
pops up: right refills oxygen on the spot, wrong restarts the planet. Reaching the
rocket asks one more: right gives +500, and you launch either way.

Stages are described in tile columns in `js/astro/levels.js` (floor ranges, blocks,
platforms, enemies, rocket), so they're easy to rearrange. The low-gravity jump
peaks at about 5 tiles up and carries about 9 tiles across. Tune `playerGravity`,
`jumpSpeed`, `maxFallSpeed` and `smashSpeed` at the top of `js/astro/player.js`. The art in `img/astro/` was cut from the supplied sprite
sheets.

## Adding a game

Create a page that includes the same session guard script and top bar, call
`initPage()` from `js/ui.js`, then `await loadQuestions(file)` once and
`await askQuestion({ source: file })` whenever a move needs an answer (it resolves
`true` or `false`). Add a card for it in `arcade.html`, and add the file to
`questionSets` in `js/teacher.js` so teachers can edit it.
