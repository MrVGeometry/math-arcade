// Site settings. Everything here is public, so never put secrets in this file.
export const config = {
  // OAuth client ID from Google Cloud Console (see README). While this is
  // left as the placeholder, the sign-in page shows a dev-mode start button.
  googleClientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",

  // SHA-256 hashes (hex) of teacher email addresses, lowercased. Generate one with:
  //   printf '%s' 'you@school.org' | shasum -a 256
  // Only these accounts see the Teacher button and page. While the list is
  // empty, nobody does (except in dev mode on your own computer).
  teacherEmailHashes: [`nicholasvosburgh@misdmail.net`,`deusmortisii@gmail.com`,`nicholas.vosburgh@gmail.com`]

  // Chance (0 to 1) that the computer plays its best move. Otherwise it
  // picks a random open square.
  aiOptimalMoveChance: 0.1,
};
