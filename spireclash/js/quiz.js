/**
 * Math questions between Spireclash rounds. This is a module (the rest of the
 * game is plain scripts), so it hands game.js a single G.askRoundQuestions().
 */
import { askQuestion, loadQuestions } from '../../js/questions.js';

const source = '../questions.json';
// A round fought for less than this many seconds needs 1 right answer.
// Anything longer needs 2.
const quickRound = 30;

const ready = loadQuestions(source);
// Handled when a round ends. This only stops an early unhandled rejection.
ready.catch(() => {});

// Resolves once the player has answered enough questions right for a round
// that was fought for `seconds`. If the questions can't load, the duel
// carries on rather than getting stuck.
window.G.askRoundQuestions = async function (seconds) {
  try {
    await ready;
  } catch (error) {
    return;
  }
  const needed = seconds < quickRound ? 1 : 2;
  for (let i = 1; i <= needed; i += 1) {
    const label = needed === 1 ? 'Round over! Solve it to carry on' : `Question ${i} of ${needed}`;
    // One at a time: each must be right before the next appears.
    await askQuestion({ label, source });
  }
};
