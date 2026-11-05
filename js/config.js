// Site settings. Everything here is public, so never put secrets in this file.
export const config = {
  // From Firebase console > Project settings > Your apps. This block is
  // meant to be public: the Firestore rules (firestore.rules) are what
  // protect the data.
  firebase: {
    apiKey: "AIzaSyAzjQWzU-ef4IZYhb7nUjTqI1mM_ILQ4ck",
    appId: "1:1008549945030:web:cfa595394d4922752c01c7",
    authDomain: "math-arcade-mrv.firebaseapp.com",
    messagingSenderId: "1008549945030",
    projectId: "math-arcade-mrv",
    storageBucket: "math-arcade-mrv.firebasestorage.app",
  },

  // The User UID of the teacher account, from Firebase console >
  // Authentication > Users. It must match the UID in firestore.rules.
  // A UID is an ID, not a password, so it's safe to publish.
  teacherUid: "c7XsczYvZOghPpQEfeyblMnro2T2",

  // Shows a "Play as guest" button on the sign-in page. Guests can play
  // every game, but nothing they do is saved. Set to false to require a
  // username and PIN.
  allowGuests: true,

  // Chance (0 to 1) that the computer plays its best move. Otherwise it
  // picks a random open square.
  aiOptimalMoveChance: 0.1,
};
