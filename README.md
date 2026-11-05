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

Then open http://localhost:8080 and sign in with a student login or the teacher
account. Scores from local testing are saved to the real database, so test with a
spare student login.

## Student and teacher logins (Firebase)

Logins and results live in the Firebase project `math-arcade-mrv` (free Spark plan).
Its config is in `js/config.js`. That block is public by design: `firestore.rules`
is what protects the data.

- **Students** sign in with a username and 4-digit PIN that you create on the
  Teacher page. Behind the scenes the username becomes
  `username@students.example.com` and the password is `pin-` plus the PIN, because
  Firebase only does email + password logins.
- **The teacher** types their email and password into the same box. An `@` in the
  username box tells the site it's the teacher.

- **Guests** press **Play as guest** and skip logging in. They can play every
  game, but nothing is saved and they don't appear on the dashboard. Turn this off
  with `allowGuests: false` in `js/config.js`.

### One-time setup

1. Firebase console > **Authentication > Sign-in method**: turn on
   **Email/Password** (leave the email link option off).
2. **Authentication > Users > Add user**: your email and a strong password.
   Copy the **User UID** from the list.
3. Paste that UID into `teacherUid` in `js/config.js`, and in place of
   `PASTE_TEACHER_UID_HERE` in `firestore.rules`.
4. **Firestore Database > Rules**: paste the whole of `firestore.rules`, then
   **Publish**. Do this again whenever the rules file changes.
5. **Authentication > Settings > Authorized domains**: add your live domain (e.g.
   `yourname.github.io`). `localhost` is there already.

### Making student logins

Teacher page > **Create student logins**. Pick a letter, a starting number and how
many. Usernames are an adjective starting with that letter, an animal, and a number
counting up from the start, e.g. L and 30 give `luckyotter30`, `loyalpanda31`. Word
lists are in `js/words.js`.

The class results table shows every login with its PIN. **Download logins** saves a
CSV and **Print login cards** prints cut-out cards, for the class picked in the
filter. Keep your own list matching usernames to real names: Firebase never sees
student names.

A forgotten PIN can be looked up in the results table. To remove a student, delete
them in **Authentication > Users** and their record under `students` in
**Firestore Database**.

### What gets saved

For each student, under `students/{uid}`:

- `attempts`: one entry per question answered (game, question, correct answer,
  what they typed, right or wrong, time).
- `summary/all`: running totals for the dashboard (right and wrong per game and
  per question, best scores, tic-tac-toe wins/draws/losses, last played).

The dashboard reads the student list and summaries (one read per student), so it
stays well inside the free daily quota. A student's recent answers are read only
when you click their name. The teacher's own play is never saved.

## Change the questions

1. Sign in, press **Teacher**, and pick the question set (one per game).
2. Edit, delete, add, or generate equations (1-step or 2-step to match the set).
   Each set's draft autosaves separately in that browser.
3. Press **Export**, replace the matching file in this folder with the download
   (`questions.json` or `questions-two-step.json`), and push.

You can also edit the files by hand. Each entry is `{ "prompt": ..., "answer": ... }`.

## Privacy

- Students sign in with a made-up username and PIN. No names, emails or other
  personal details are stored. Only you know who each username belongs to.
- Answers and scores are stored in Firebase (Google) under that username. Only the
  teacher account can read them. Students can add their own results but can't read
  or change anyone else's.
- The sign-in lasts until the tab closes, so the next student on a shared computer
  starts signed out. Sound on/off and the teacher's question draft live in
  `localStorage`.

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
`true` or `false`). Answers are saved for the dashboard automatically. When a game
ends, call `recordGameEnd({ score })` from `js/firebase.js` (add `result: "wins"`
or `"losses"` if it has one). Add a card for it in `arcade.html`, and add the file to
`questionSets` in `js/teacher.js` so teachers can edit it.
