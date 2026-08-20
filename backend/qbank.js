// qbank.js — Test Engine for Connectomic Medical Academy
// Mirrors CTK Ignition's Bridge Course engine (question bank -> generated
// tests -> attempts -> mistakes/progress), scoped to this app's existing
// Section -> Chapter hierarchy instead of Course -> Subject.
//
// Three test types:
//   chapter  — practice test drawn from one chapter's approved questions
//   subject  — practice test drawn from every chapter in one section
//   grand    — faculty-curated test spanning any chapters, built as a
//              draft in the Lecturer Hub and published for students
//
// Chapter/subject tests are generated fresh each time a student starts
// one (repeatable practice). Grand tests are attempted once per student,
// like CTK's Grand Test.

const { Router } = require('express');

function init({ pool, authenticate, requireRole }) {
    const router = Router();

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    async function buildTest({ testType, title, sectionId, chapterId, questionCount, timeLimitMin, createdBy, status }) {
        const conditions = [`status = 'approved'`];
        const params = [];
        if (chapterId) { params.push(chapterId); conditions.push(`chapter_id = $${params.length}`); }
        else if (sectionId) { params.push(sectionId); conditions.push(`section_id = $${params.length}`); }
        const { rows: pool_ } = await pool.query(
            `SELECT id FROM question_bank WHERE ${conditions.join(' AND ')}`, params
        );
        if (pool_.length === 0) return { error: 'No approved questions are available yet for this selection.' };

        const picked = shuffle(pool_).slice(0, questionCount || pool_.length);
        const { rows: [test] } = await pool.query(
            `INSERT INTO generated_tests (test_type, title, section_id, chapter_id, question_count, time_limit_min, created_by, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [testType, title, sectionId || null, chapterId || null, picked.length, timeLimitMin || 30, createdBy || null, status || 'published']
        );
        for (let i = 0; i < picked.length; i++) {
            await pool.query(
                `INSERT INTO generated_test_questions (test_id, question_id, position) VALUES ($1,$2,$3)`,
                [test.id, picked[i].id, i]
            );
        }
        return { test };
    }

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

    // ============================================================
    // QUESTION BANK — faculty/admin CRUD + approval workflow
    // ============================================================

    // Resolves a chapter by name (case-insensitive). Bulk imports from
    // faculty key questions by chapterName rather than numeric IDs, since
    // that's what they actually know off the top of their head.
    async function findChapterByName(chapterName) {
        if (!chapterName) return null;
        const { rows: [chapter] } = await pool.query(
            `SELECT id, section_id FROM chapters WHERE LOWER(name) = LOWER($1) LIMIT 1`, [chapterName.trim()]
        );
        return chapter || null;
    }

    router.post('/api/qbank/questions', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        const { sectionId, chapterId, questionText, optionA, optionB, optionC, optionD, correctAnswer, explanation, difficulty, topic, estimatedTime } = req.body;
        if (!sectionId || !chapterId || !questionText?.trim() || !optionA?.trim() || !optionB?.trim() || !optionC?.trim() || !optionD?.trim() || !correctAnswer)
            return res.status(400).json({ error: 'Section, chapter, question text, all four options and the correct answer are required.' });
        if (!['A', 'B', 'C', 'D'].includes(correctAnswer))
            return res.status(400).json({ error: 'correctAnswer must be A, B, C, or D.' });

        const isAdmin = req.user.role === 'admin';
        try {
            const { rows: [q] } = await pool.query(
                `INSERT INTO question_bank
                 (section_id, chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer,
                  explanation, difficulty, topic, estimated_time_sec, status, submitted_by, approved_by, approved_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
                [sectionId, chapterId, questionText.trim(), optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim(),
                 correctAnswer, explanation || null, difficulty || 'Moderate', topic || null, estimatedTime || 60,
                 isAdmin ? 'approved' : 'pending', req.user.id, isAdmin ? req.user.id : null, isAdmin ? new Date() : null]
            );
            res.status(201).json({ success: true, question: q });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while saving the question.' }); }
    });

    // Bulk JSON import. Admin-authored/imported questions go live
    // immediately; faculty bulk imports queue for approval. Each item is
    // keyed by chapterName (e.g. "Laws of Motion") -- sectionId/chapterId
    // are still accepted directly for backward compatibility (the admin
    // panel's dropdown-based import uses those).
    router.post('/api/qbank/questions/bulk', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        const { questions, sectionId: defaultSectionId, chapterId: defaultChapterId } = req.body;
        if (!Array.isArray(questions) || questions.length === 0)
            return res.status(400).json({ error: 'questions array required.' });

        const isAdmin = req.user.role === 'admin';
        const inserted = [], errors = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            try {
                let sectionId = q.sectionId || defaultSectionId;
                let chapterId = q.chapterId || defaultChapterId;
                if (q.chapterName) {
                    const chapter = await findChapterByName(q.chapterName);
                    if (!chapter) throw new Error(`No chapter named "${q.chapterName}" was found.`);
                    chapterId = chapter.id; sectionId = chapter.section_id;
                }
                if (!sectionId || !chapterId) throw new Error('chapterName (or sectionId/chapterId) is required.');
                if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer)
                    throw new Error('questionText, optionA-D and correctAnswer are all required.');
                if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) throw new Error('correctAnswer must be A, B, C, or D.');

                const { rows: [row] } = await pool.query(
                    `INSERT INTO question_bank
                     (section_id, chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer,
                      explanation, difficulty, topic, estimated_time_sec, status, submitted_by, approved_by, approved_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
                    [sectionId, chapterId, q.questionText, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer,
                     q.explanation || null, q.difficulty || 'Moderate', q.topic || null, q.estimatedTime || 60,
                     isAdmin ? 'approved' : 'pending', req.user.id, isAdmin ? req.user.id : null, isAdmin ? new Date() : null]
                );
                inserted.push(row.id);
            } catch (err) { errors.push({ index: i, error: err.message }); }
        }
        res.json({ success: true, inserted: inserted.length, errors });
    });

    router.get('/api/qbank/questions', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        const { sectionId, chapterId, difficulty, status, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const conditions = [], params = [];
        if (sectionId) { params.push(sectionId); conditions.push(`q.section_id = $${params.length}`); }
        if (chapterId) { params.push(chapterId); conditions.push(`q.chapter_id = $${params.length}`); }
        if (difficulty) { params.push(difficulty); conditions.push(`q.difficulty = $${params.length}`); }
        if (status) { params.push(status); conditions.push(`q.status = $${params.length}`); }
        if (req.user.role === 'faculty') {
            params.push(req.user.id);
            conditions.push(`(q.status = 'approved' OR q.submitted_by = $${params.length})`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        try {
            const { rows } = await pool.query(
                `SELECT q.*, s.name AS section_name, c.name AS chapter_name
                 FROM question_bank q JOIN sections s ON s.id = q.section_id JOIN chapters c ON c.id = q.chapter_id
                 ${where} ORDER BY q.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, parseInt(limit, 10), offset]
            );
            const { rows: [cnt] } = await pool.query(
                `SELECT COUNT(*) AS total FROM question_bank q ${where}`, params
            );
            res.json({ questions: rows, total: parseInt(cnt.total, 10), page: parseInt(page, 10), limit: parseInt(limit, 10) });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing questions.' }); }
    });

    router.put('/api/qbank/questions/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        const { rows: [q] } = await pool.query(`SELECT * FROM question_bank WHERE id=$1`, [req.params.id]);
        if (!q) return res.status(404).json({ error: 'Question not found.' });
        const isAdmin = req.user.role === 'admin';
        if (!isAdmin) {
            if (q.submitted_by !== req.user.id) return res.status(403).json({ error: 'You can only edit your own questions.' });
            if (q.status === 'approved') return res.status(400).json({ error: 'Approved questions cannot be edited by faculty.' });
        }
        const { sectionId, chapterId, questionText, optionA, optionB, optionC, optionD, correctAnswer, explanation, difficulty } = req.body;
        if (correctAnswer && !['A', 'B', 'C', 'D'].includes(correctAnswer))
            return res.status(400).json({ error: 'correctAnswer must be A, B, C, or D.' });
        try {
            await pool.query(
                `UPDATE question_bank SET section_id=$1, chapter_id=$2, question_text=$3, option_a=$4, option_b=$5,
                 option_c=$6, option_d=$7, correct_answer=$8, explanation=$9, difficulty=$10, status=$11, approved_by=$12, approved_at=$13
                 WHERE id=$14`,
                [sectionId || q.section_id, chapterId || q.chapter_id, questionText || q.question_text,
                 optionA || q.option_a, optionB || q.option_b, optionC || q.option_c, optionD || q.option_d,
                 correctAnswer || q.correct_answer, explanation !== undefined ? explanation : q.explanation,
                 difficulty || q.difficulty, isAdmin ? 'approved' : 'pending',
                 isAdmin ? req.user.id : q.approved_by, isAdmin ? new Date() : q.approved_at, req.params.id]
            );
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while updating the question.' }); }
    });

    router.delete('/api/qbank/questions/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        try {
            const { rows: [q] } = await pool.query(`SELECT * FROM question_bank WHERE id=$1`, [req.params.id]);
            if (!q) return res.status(404).json({ error: 'Question not found.' });
            const isAdmin = req.user.role === 'admin';
            if (q.status === 'approved' && !isAdmin) return res.status(403).json({ error: 'Only an admin can delete an approved question.' });
            if (q.submitted_by !== req.user.id && !isAdmin) return res.status(403).json({ error: 'You can only delete your own questions.' });
            await pool.query(`DELETE FROM question_bank WHERE id=$1`, [req.params.id]);
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the question.' }); }
    });

    router.get('/api/qbank/pending', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT q.*, s.name AS section_name, c.name AS chapter_name, u.name AS submitted_by_name
                 FROM question_bank q
                 JOIN sections s ON s.id = q.section_id JOIN chapters c ON c.id = q.chapter_id
                 LEFT JOIN users u ON u.id = q.submitted_by
                 WHERE q.status='pending' ORDER BY q.created_at ASC`
            );
            res.json(rows);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing pending questions.' }); }
    });

    router.post('/api/qbank/approve-batch', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        const { questionIds, action, rejectionNote } = req.body;
        if (!Array.isArray(questionIds) || !questionIds.length || !['approve', 'reject'].includes(action))
            return res.status(400).json({ error: 'questionIds array and action are required.' });
        try {
            await pool.query(
                `UPDATE question_bank SET status=$1, approved_by=$2, approved_at=NOW(), rejection_note=$3 WHERE id = ANY($4::int[])`,
                [action === 'approve' ? 'approved' : 'rejected', req.user.id, rejectionNote || null, questionIds]
            );
            res.json({ success: true, updated: questionIds.length });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while updating questions.' }); }
    });

    router.get('/api/qbank/stats', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
        try {
            const { rows: [counts] } = await pool.query(`
                SELECT COUNT(*) FILTER (WHERE status='approved') AS approved,
                       COUNT(*) FILTER (WHERE status='pending') AS pending,
                       COUNT(*) FILTER (WHERE status='rejected') AS rejected,
                       COUNT(*) AS total FROM question_bank`);
            const { rows: bySection } = await pool.query(`
                SELECT s.name AS section_name, COUNT(*) AS count
                FROM question_bank q JOIN sections s ON s.id = q.section_id
                WHERE q.status='approved' GROUP BY s.name ORDER BY s.name`);
            res.json({ counts, bySection });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading stats.' }); }
    });

    // ============================================================
    // STUDENT — practice tests (chapter / subject), generated on demand
    // ============================================================

    router.post('/api/tests/chapter', authenticate, requireRole('student'), async (req, res) => {
        const { chapterId, questionCount } = req.body;
        if (!chapterId) return res.status(400).json({ error: 'chapterId is required.' });
        try {
            const { rows: [chapter] } = await pool.query(`SELECT id, name, section_id FROM chapters WHERE id=$1`, [chapterId]);
            if (!chapter) return res.status(404).json({ error: 'Chapter not found.' });
            const { test, error } = await buildTest({
                testType: 'chapter', title: `${chapter.name} — Chapter Test`,
                sectionId: chapter.section_id, chapterId, questionCount: Math.min(questionCount || 15, 50), timeLimitMin: 20
            });
            if (error) return res.status(400).json({ error });
            res.json({ success: true, test });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while generating the test.' }); }
    });

    router.post('/api/tests/subject', authenticate, requireRole('student'), async (req, res) => {
        const { sectionId, questionCount } = req.body;
        if (!sectionId) return res.status(400).json({ error: 'sectionId is required.' });
        try {
            const { rows: [section] } = await pool.query(`SELECT id, name FROM sections WHERE id=$1`, [sectionId]);
            if (!section) return res.status(404).json({ error: 'Section not found.' });
            const { test, error } = await buildTest({
                testType: 'subject', title: `${section.name} — Subject Test`,
                sectionId, questionCount: Math.min(questionCount || 30, 100), timeLimitMin: 45
            });
            if (error) return res.status(400).json({ error });
            res.json({ success: true, test });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while generating the test.' }); }
    });

    // Grand Tests are faculty-published; students can only fetch the most
    // recently published one and attempt it once.
    router.get('/api/tests/grand', authenticate, requireRole('student'), async (req, res) => {
        try {
            const { rows: [gt] } = await pool.query(
                `SELECT id, title, time_limit_min, question_count, created_at
                 FROM generated_tests WHERE test_type='grand' AND status='published' ORDER BY created_at DESC LIMIT 1`
            );
            if (!gt) return res.json({ test: null, available: false });
            const { rows: [attempt] } = await pool.query(
                `SELECT id, score, total, submitted_at FROM test_attempts WHERE test_id=$1 AND student_id=$2`,
                [gt.id, req.user.id]
            );
            res.json({ test: gt, available: true, alreadyAttempted: !!attempt, attempt: attempt || null });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading the grand test.' }); }
    });

    router.get('/api/tests/history', authenticate, requireRole('student'), async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT ta.id, ta.score, ta.total, ta.correct_count, ta.wrong_count, ta.skipped_count, ta.submitted_at,
                        gt.title, gt.test_type, gt.id AS test_id
                 FROM test_attempts ta JOIN generated_tests gt ON gt.id = ta.test_id
                 WHERE ta.student_id=$1 ORDER BY ta.submitted_at DESC LIMIT 50`,
                [req.user.id]
            );
            res.json(rows);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading test history.' }); }
    });

    router.get('/api/tests/:id/questions', authenticate, requireRole('student'), async (req, res) => {
        const testId = parseInt(req.params.id, 10);
        try {
            const { rows: [gt] } = await pool.query(
                `SELECT id, title, test_type, time_limit_min FROM generated_tests WHERE id=$1`, [testId]
            );
            if (!gt) return res.status(404).json({ error: 'Test not found.' });
            const { rows: [existing] } = await pool.query(
                `SELECT id FROM test_attempts WHERE test_id=$1 AND student_id=$2`, [testId, req.user.id]
            );
            if (existing) return res.status(400).json({ error: 'You have already attempted this test.', attemptId: existing.id });

            const { rows: questions } = await pool.query(
                `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.difficulty,
                        c.name AS chapter_name
                 FROM generated_test_questions gtq
                 JOIN question_bank q ON q.id = gtq.question_id
                 JOIN chapters c ON c.id = q.chapter_id
                 WHERE gtq.test_id=$1 ORDER BY gtq.position`,
                [testId]
            );
            res.json({ test: gt, questions });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading the test.' }); }
    });

    router.post('/api/tests/:id/submit', authenticate, requireRole('student'), async (req, res) => {
        const testId = parseInt(req.params.id, 10);
        const { answers, timeTakenSec } = req.body;
        try {
            const { rows: [existing] } = await pool.query(
                `SELECT id FROM test_attempts WHERE test_id=$1 AND student_id=$2`, [testId, req.user.id]
            );
            if (existing) return res.status(400).json({ error: 'Already submitted.' });

            const { rows: questions } = await pool.query(
                `SELECT q.id, q.correct_answer, q.section_id, q.chapter_id, q.difficulty
                 FROM generated_test_questions gtq JOIN question_bank q ON q.id = gtq.question_id
                 WHERE gtq.test_id=$1`, [testId]
            );
            if (!questions.length) return res.status(404).json({ error: 'Test not found.' });

            const { correct, wrong, skipped, total, score } = computeScore(answers || {}, questions);
            const { rows: [attempt] } = await pool.query(
                `INSERT INTO test_attempts (test_id, student_id, answers, score, total, correct_count, wrong_count, skipped_count, time_taken_sec)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, submitted_at`,
                [testId, req.user.id, JSON.stringify(answers || {}), score, total, correct, wrong, skipped, timeTakenSec || null]
            );

            for (const q of questions) {
                const given = (answers || {})[q.id];
                if (given && given !== q.correct_answer) {
                    await pool.query(
                        `INSERT INTO mistakes (student_id, test_id, question_id, section_id, chapter_id, difficulty)
                         VALUES ($1,$2,$3,$4,$5,$6)`,
                        [req.user.id, testId, q.id, q.section_id, q.chapter_id, q.difficulty]
                    );
                }
            }
            await pool.query(`UPDATE question_bank SET usage_count = usage_count + 1 WHERE id = ANY($1::int[])`, [questions.map(q => q.id)]);

            res.json({
                success: true, attemptId: attempt.id, score, total,
                percentage: total ? Math.round((score / total) * 1000) / 10 : 0,
                correct, wrong, skipped, submittedAt: attempt.submitted_at
            });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while submitting the test.' }); }
    });

    router.get('/api/tests/attempts/:attemptId/review', authenticate, requireRole('student'), async (req, res) => {
        try {
            const { rows: [attempt] } = await pool.query(
                `SELECT ta.*, gt.title, gt.test_type FROM test_attempts ta JOIN generated_tests gt ON gt.id = ta.test_id
                 WHERE ta.id=$1 AND ta.student_id=$2`, [req.params.attemptId, req.user.id]
            );
            if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
            const { rows: questions } = await pool.query(
                `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
                        q.correct_answer, q.explanation, c.name AS chapter_name
                 FROM generated_test_questions gtq JOIN question_bank q ON q.id = gtq.question_id
                 JOIN chapters c ON c.id = q.chapter_id
                 WHERE gtq.test_id=$1 ORDER BY gtq.position`, [attempt.test_id]
            );
            res.json({ attempt, questions });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading the review.' }); }
    });

    router.get('/api/progress/analytics', authenticate, requireRole('student'), async (req, res) => {
        try {
            const { rows: [overall] } = await pool.query(
                `SELECT COUNT(*) AS tests_taken,
                        AVG(score::float / NULLIF(total,0)) * 100 AS avg_pct,
                        MAX(score::float / NULLIF(total,0)) * 100 AS best_pct
                 FROM test_attempts WHERE student_id=$1`, [req.user.id]
            );
            const { rows: weakChapters } = await pool.query(
                `SELECT c.name AS chapter_name, s.name AS section_name, COUNT(*) AS mistake_count
                 FROM mistakes m JOIN chapters c ON c.id = m.chapter_id JOIN sections s ON s.id = m.section_id
                 WHERE m.student_id=$1 GROUP BY c.name, s.name ORDER BY mistake_count DESC LIMIT 10`, [req.user.id]
            );
            const { rows: recentScores } = await pool.query(
                `SELECT gt.title, gt.test_type, ta.score, ta.total,
                        ROUND((ta.score::numeric / NULLIF(ta.total,0)) * 100, 1) AS pct, ta.submitted_at
                 FROM test_attempts ta JOIN generated_tests gt ON gt.id = ta.test_id
                 WHERE ta.student_id=$1 ORDER BY ta.submitted_at DESC LIMIT 20`, [req.user.id]
            );
            const { rows: bySection } = await pool.query(
                `SELECT s.name AS section_name,
                        ROUND((AVG(ta.score::numeric / NULLIF(ta.total,0)) * 100)::numeric, 1) AS avg_pct,
                        COUNT(*) AS tests_taken
                 FROM test_attempts ta JOIN generated_tests gt ON gt.id = ta.test_id
                 LEFT JOIN sections s ON s.id = gt.section_id
                 WHERE ta.student_id=$1 AND s.id IS NOT NULL GROUP BY s.name ORDER BY s.name`, [req.user.id]
            );
            res.json({ overall, weakChapters, recentScores, bySection });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading progress.' }); }
    });

    // ============================================================
    // FACULTY — Grand Test builder (draft -> add/remove questions -> publish)
    // ============================================================

    router.get('/api/faculty/tests', authenticate, requireRole('faculty'), async (req, res) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, title, question_count, time_limit_min, status, created_at
                 FROM generated_tests WHERE test_type='grand' AND created_by=$1 ORDER BY created_at DESC`,
                [req.user.id]
            );
            res.json(rows);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing your tests.' }); }
    });

    router.post('/api/faculty/tests', authenticate, requireRole('faculty'), async (req, res) => {
        const { title, timeLimitMin } = req.body;
        if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
        try {
            const { rows: [test] } = await pool.query(
                `INSERT INTO generated_tests (test_type, title, question_count, time_limit_min, created_by, status)
                 VALUES ('grand',$1,0,$2,$3,'draft') RETURNING *`,
                [title.trim(), timeLimitMin || 60, req.user.id]
            );
            res.status(201).json({ success: true, test });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while creating the test.' }); }
    });

    router.get('/api/faculty/tests/:id/questions', authenticate, requireRole('faculty'), async (req, res) => {
        try {
            const { rows: [test] } = await pool.query(
                `SELECT * FROM generated_tests WHERE id=$1 AND created_by=$2`, [req.params.id, req.user.id]
            );
            if (!test) return res.status(404).json({ error: 'Test not found.' });
            const { rows: included } = await pool.query(
                `SELECT q.*, s.name AS section_name, c.name AS chapter_name
                 FROM generated_test_questions gtq JOIN question_bank q ON q.id = gtq.question_id
                 JOIN sections s ON s.id = q.section_id JOIN chapters c ON c.id = q.chapter_id
                 WHERE gtq.test_id=$1 ORDER BY gtq.position`, [req.params.id]
            );
            const { rows: available } = await pool.query(
                `SELECT q.id, q.question_text, s.name AS section_name, c.name AS chapter_name, q.difficulty
                 FROM question_bank q JOIN sections s ON s.id = q.section_id JOIN chapters c ON c.id = q.chapter_id
                 WHERE q.status='approved' AND q.id NOT IN (
                     SELECT question_id FROM generated_test_questions WHERE test_id=$1
                 ) ORDER BY s.name, c.name, q.created_at DESC LIMIT 200`, [req.params.id]
            );
            res.json({ test, included, available });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading the test.' }); }
    });

    router.post('/api/faculty/tests/:id/questions', authenticate, requireRole('faculty'), async (req, res) => {
        const { questionId } = req.body;
        if (!questionId) return res.status(400).json({ error: 'questionId is required.' });
        try {
            const { rows: [test] } = await pool.query(
                `SELECT * FROM generated_tests WHERE id=$1 AND created_by=$2 AND status='draft'`, [req.params.id, req.user.id]
            );
            if (!test) return res.status(404).json({ error: 'Draft test not found.' });
            const { rows: [maxPos] } = await pool.query(
                `SELECT COALESCE(MAX(position), -1) AS max_pos FROM generated_test_questions WHERE test_id=$1`, [req.params.id]
            );
            await pool.query(
                `INSERT INTO generated_test_questions (test_id, question_id, position) VALUES ($1,$2,$3)
                 ON CONFLICT (test_id, question_id) DO NOTHING`,
                [req.params.id, questionId, parseInt(maxPos.max_pos, 10) + 1]
            );
            await pool.query(
                `UPDATE generated_tests SET question_count = (SELECT COUNT(*) FROM generated_test_questions WHERE test_id=$1) WHERE id=$1`,
                [req.params.id]
            );
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while adding the question.' }); }
    });

    router.delete('/api/faculty/tests/:id/questions/:questionId', authenticate, requireRole('faculty'), async (req, res) => {
        try {
            const { rows: [test] } = await pool.query(
                `SELECT * FROM generated_tests WHERE id=$1 AND created_by=$2 AND status='draft'`, [req.params.id, req.user.id]
            );
            if (!test) return res.status(404).json({ error: 'Draft test not found.' });
            await pool.query(`DELETE FROM generated_test_questions WHERE test_id=$1 AND question_id=$2`, [req.params.id, req.params.questionId]);
            await pool.query(
                `UPDATE generated_tests SET question_count = (SELECT COUNT(*) FROM generated_test_questions WHERE test_id=$1) WHERE id=$1`,
                [req.params.id]
            );
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while removing the question.' }); }
    });

    // Add a whole chapter's worth of questions at once. If questionCount is
    // given, that many are picked at random from the chapter's approved
    // bank; if omitted, every approved question in the chapter is added.
    // Lets faculty build a grand test by chapter selection instead of
    // hand-picking every individual question.
    router.post('/api/faculty/tests/:id/chapters', authenticate, requireRole('faculty'), async (req, res) => {
        const { chapterId, questionCount } = req.body;
        if (!chapterId) return res.status(400).json({ error: 'chapterId is required.' });
        try {
            const { rows: [test] } = await pool.query(
                `SELECT * FROM generated_tests WHERE id=$1 AND created_by=$2 AND status='draft'`, [req.params.id, req.user.id]
            );
            if (!test) return res.status(404).json({ error: 'Draft test not found.' });

            const { rows: candidates } = await pool.query(
                `SELECT q.id FROM question_bank q
                 WHERE q.chapter_id=$1 AND q.status='approved'
                 AND q.id NOT IN (SELECT question_id FROM generated_test_questions WHERE test_id=$2)`,
                [chapterId, req.params.id]
            );
            if (!candidates.length) return res.status(400).json({ error: 'No unused approved questions are available in that chapter.' });

            const picked = questionCount ? shuffle(candidates).slice(0, questionCount) : candidates;
            const { rows: [maxPos] } = await pool.query(
                `SELECT COALESCE(MAX(position), -1) AS max_pos FROM generated_test_questions WHERE test_id=$1`, [req.params.id]
            );
            let pos = parseInt(maxPos.max_pos, 10) + 1;
            for (const c of picked) {
                await pool.query(
                    `INSERT INTO generated_test_questions (test_id, question_id, position) VALUES ($1,$2,$3) ON CONFLICT (test_id, question_id) DO NOTHING`,
                    [req.params.id, c.id, pos++]
                );
            }
            await pool.query(
                `UPDATE generated_tests SET question_count = (SELECT COUNT(*) FROM generated_test_questions WHERE test_id=$1) WHERE id=$1`,
                [req.params.id]
            );
            res.json({ success: true, added: picked.length });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while adding the chapter.' }); }
    });

    router.post('/api/faculty/tests/:id/publish', authenticate, requireRole('faculty'), async (req, res) => {
        try {
            const { rows: [test] } = await pool.query(
                `SELECT * FROM generated_tests WHERE id=$1 AND created_by=$2 AND status='draft'`, [req.params.id, req.user.id]
            );
            if (!test) return res.status(404).json({ error: 'Draft test not found.' });
            if (test.question_count < 1) return res.status(400).json({ error: 'Add at least one question before publishing.' });
            await pool.query(`UPDATE generated_tests SET status='published' WHERE id=$1`, [req.params.id]);
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while publishing the test.' }); }
    });

    router.delete('/api/faculty/tests/:id', authenticate, requireRole('faculty'), async (req, res) => {
        try {
            await pool.query(`DELETE FROM generated_tests WHERE id=$1 AND created_by=$2 AND status='draft'`, [req.params.id, req.user.id]);
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the test.' }); }
    });

    return router;
}

module.exports = { init };