// Site settings. Everything here is public, so never put secrets in this file.
export const config = {
  // OAuth client ID from Google Cloud Console (see README). While this is
  // left as the placeholder, the sign-in page shows a dev-mode start button.
  googleClientId: "mrvgeometry.github.io/math-arcade/",

  // SHA-256 hashes (hex) of teacher email addresses, lowercased. Generate one with:
  //   printf '%s' 'you@school.org' | shasum -a 256
  // Only these accounts see the Teacher button and page. While the list is
  // empty, nobody does (except in dev mode on your own computer).
  teacherEmailHashes: [
    "18cd069b6ebfd96693036f6505dd22ee16c2644e5a2895c7a90b6302ed93b33c",
    "98cef49f543e82d216e3f38d4855d3152743750ae80e1d1609fb2e22ff3ee7b7",
    "b09fe8aa546c2dd3f8b03f6d8a3be016732051a24d0908d48519207ccad1804e",
  ],

  // Chance (0 to 1) that the computer plays its best move. Otherwise it
  // picks a random open square.
  aiOptimalMoveChance: 0.1,
};
