// scoring.js — pure test-scoring logic, used by qbank.js when a student
// submits an attempt. Pulled out into its own module so it can be
// unit-tested (see test/scoring.test.js) in isolation from the DB-backed
// question-bank router.
function computeScore(answers, questions) {
    let correct = 0, wrong = 0, skipped = 0;
    for (const q of questions) {
        const given = answers[q.id];
        if (!given) skipped++;
        else if (given === q.correct_answer) correct++;
        else wrong++;
    }
    return { correct, wrong, skipped, total: questions.length, score: correct };
}

module.exports = { computeScore };
