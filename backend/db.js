// db.js — Connectomic Medical Academy
// Anatomy / Physiology / Biochemistry / Neuroscience, each split into two
// tracks: 1. MBBS Level  2. Reference (reference book material, PPTs, videos).
// Test engine (question bank -> generated tests -> attempts), mirroring
// CTK Ignition's Bridge Course engine, scoped to this app's section/chapter
// hierarchy instead of course/subject — see qbank.js.
//
// Users are identified by a synthetic id, NOT email -- registration allows
// either email or phone (at least one required, not both), so email can't
// be the primary key. OTP goes to whichever contact channel exists: phone
// (SMS) if provided, otherwise email.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
        ? { rejectUnauthorized: false }
        : false
});

// ---------------------------------------------------------------------------
// SCHEMA
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// MIGRATION — this project's `users` table went through breaking schema
// changes (email-as-primary-key -> synthetic `id`, to support phone-or-
// email registration instead of requiring both). CREATE TABLE IF NOT
// EXISTS is a no-op against a database that already has an OLDER-shaped
// `users` table, which would otherwise fail confusingly the moment
// anything queries the new `id` column. Detect that case and rebuild the
// affected tables cleanly. Safe for pre-launch/dev data: curriculum data
// (sections/books/chapters) is unaffected and reseeds automatically; any
// accounts, notes, materials, or lectures created under the old schema
// will need to be re-added, since their primary/foreign keys fundamentally
// changed shape (TEXT email -> INTEGER id) and can't be mechanically
// translated without knowing exactly which prior schema version created them.
async function migrateLegacySchema() {
    const { rows: [{ exists: usersTableExists }] } = await pool.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') AS exists
    `);
    if (!usersTableExists) return; // fresh install -- nothing to migrate

    const { rows: idColumn } = await pool.query(`
        SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'
    `);
    if (idColumn.length) return; // already on the current schema

    console.log(
        '⚠️  Detected an older database schema (users table has no id column).\n' +
        '    This project moved from email-keyed accounts to a synthetic id\n' +
        '    (to support phone-or-email registration), which changes primary/\n' +
        '    foreign keys throughout. Rebuilding the auth + content tables so\n' +
        '    the current schema can be created cleanly -- curriculum data\n' +
        '    (sections/books/chapters) will be reseeded automatically; any\n' +
        '    accounts, notes, materials, or lectures from the old schema will\n' +
        '    need to be re-added.'
    );
    await pool.query(`
        DROP TABLE IF EXISTS chapter_notes CASCADE;
        DROP TABLE IF EXISTS materials CASCADE;
        DROP TABLE IF EXISTS lectures CASCADE;
        DROP TABLE IF EXISTS students CASCADE;
        DROP TABLE IF EXISTS faculty CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
    `);
}

// MIGRATION — same problem as above, for the test-engine tables. If a
// table with one of these names already exists (e.g. left over from an
// unrelated local project, or an older/incompatible schema someone
// pointed this app's DATABASE_URL at) but is missing a column this
// schema requires, CREATE TABLE IF NOT EXISTS silently no-ops against it
// and every query against that column fails confusingly at runtime
// instead of at startup. Detect that per table and rebuild just that
// table. Only ever called against a dedicated Medical Academy database,
// never one shared with another live app -- do not run this against a
// database that might hold another project's real data.
async function migrateTestEngineSchema() {
    const requiredColumn = {
        question_bank: 'status',
        generated_tests: 'test_type',
        generated_test_questions: 'position',
        test_attempts: 'correct_count',
        mistakes: 'difficulty',
    };
    for (const [table, column] of Object.entries(requiredColumn)) {
        const { rows: [{ exists: tableExists }] } = await pool.query(
            `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`, [table]
        );
        if (!tableExists) continue;
        const { rows: colRows } = await pool.query(
            `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, column]
        );
        if (colRows.length) continue; // already the current shape

        console.log(
            `⚠️  Found an existing "${table}" table that doesn't match this app's schema ` +
            `(missing column "${column}"). This usually means DATABASE_URL points at a ` +
            `database that already has a table by this name from something else. ` +
            `Rebuilding "${table}" -- if you meant to keep whatever was in it, stop now ` +
            `and point DATABASE_URL at a dedicated database for Medical Academy instead.`
        );
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }
}

async function initSchema() {
    await migrateLegacySchema();
    await migrateTestEngineSchema();

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id                  SERIAL PRIMARY KEY,
            email               TEXT UNIQUE,
            phone               TEXT UNIQUE,
            password_hash       TEXT NOT NULL,
            role                TEXT NOT NULL DEFAULT 'student', -- student | faculty | admin
            name                TEXT NOT NULL,
            is_verified         BOOLEAN DEFAULT FALSE,
            approval_status     TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected')), -- faculty need admin approval; students/admin are auto-approved
            onboarding_done     BOOLEAN DEFAULT FALSE,
            otp_code_hash       TEXT,
            otp_purpose         TEXT,   -- 'verify' | 'reset'
            otp_channel         TEXT,   -- 'sms' | 'email' -- which one the current OTP was sent to
            otp_expires_at      TIMESTAMPTZ,
            otp_attempts        INTEGER DEFAULT 0,
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT users_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
        );

        CREATE TABLE IF NOT EXISTS students (
            user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            name                TEXT NOT NULL,
            phase               TEXT,   -- '1st MBBS' | '2nd MBBS' | 'Final MBBS Part 1' | 'Final MBBS Part 2'
            state               TEXT,
            daily_study_hours   NUMERIC,
            created_at          TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS faculty (
            user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            name                TEXT NOT NULL,
            specialization      TEXT,
            created_at          TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sections (
            id          SERIAL PRIMARY KEY,
            name        TEXT UNIQUE NOT NULL,
            position    INTEGER NOT NULL DEFAULT 0,
            created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS books (
            id            SERIAL PRIMARY KEY,
            section_id    INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
            type          TEXT NOT NULL CHECK (type IN ('mbbs','reference')),
            title         TEXT NOT NULL,
            description   TEXT,
            position      INTEGER NOT NULL DEFAULT 0,
            created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS chapters (
            id            SERIAL PRIMARY KEY,
            section_id    INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
            name          TEXT NOT NULL,
            position      INTEGER NOT NULL DEFAULT 0,
            created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(section_id, name)
        );

        CREATE TABLE IF NOT EXISTS chapter_notes (
            id              SERIAL PRIMARY KEY,
            chapter_id      INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
            book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            title           TEXT NOT NULL,
            html_content    TEXT NOT NULL,
            position        INTEGER NOT NULL DEFAULT 0,
            created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS materials (
            id              SERIAL PRIMARY KEY,
            book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            chapter_id      INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
            title           TEXT NOT NULL,
            material_type   TEXT NOT NULL DEFAULT 'link' CHECK (material_type IN ('link','ppt','book')),
            external_url    TEXT NOT NULL,
            description     TEXT,
            uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS lectures (
            id              SERIAL PRIMARY KEY,
            book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            chapter_id      INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
            title           TEXT NOT NULL,
            url             TEXT NOT NULL,
            uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );

        -- ===================================================================
        -- TEST ENGINE — question bank -> generated tests -> attempts.
        -- Mirrors the CTK Ignition Bridge Course engine's shape, scoped to
        -- this app's section/chapter hierarchy instead of course/subject.
        -- ===================================================================
        CREATE TABLE IF NOT EXISTS question_bank (
            id              SERIAL PRIMARY KEY,
            section_id      INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
            chapter_id      INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
            question_text   TEXT NOT NULL,
            option_a        TEXT NOT NULL,
            option_b        TEXT NOT NULL,
            option_c        TEXT NOT NULL,
            option_d        TEXT NOT NULL,
            correct_answer  TEXT NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
            explanation     TEXT,
            difficulty      TEXT NOT NULL DEFAULT 'Moderate' CHECK (difficulty IN ('Easy','Moderate','Difficult')),
            status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
            submitted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
            approved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
            approved_at     TIMESTAMPTZ,
            rejection_note  TEXT,
            usage_count     INTEGER DEFAULT 0,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS generated_tests (
            id              SERIAL PRIMARY KEY,
            test_type       TEXT NOT NULL CHECK (test_type IN ('chapter','subject','grand','custom')),
            title           TEXT NOT NULL,
            section_id      INTEGER REFERENCES sections(id) ON DELETE CASCADE,   -- NULL for grand (all subjects)
            chapter_id      INTEGER REFERENCES chapters(id) ON DELETE CASCADE,   -- set for chapter tests only
            question_count  INTEGER NOT NULL DEFAULT 20,
            time_limit_min  INTEGER NOT NULL DEFAULT 30,
            created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,     -- set for faculty-built grand tests
            status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS generated_test_questions (
            id              SERIAL PRIMARY KEY,
            test_id         INTEGER NOT NULL REFERENCES generated_tests(id) ON DELETE CASCADE,
            question_id     INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
            position        INTEGER NOT NULL DEFAULT 0,
            UNIQUE (test_id, question_id)
        );

        CREATE TABLE IF NOT EXISTS test_attempts (
            id              SERIAL PRIMARY KEY,
            test_id         INTEGER NOT NULL REFERENCES generated_tests(id) ON DELETE CASCADE,
            student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            answers         JSONB NOT NULL DEFAULT '{}',
            score           INTEGER NOT NULL DEFAULT 0,
            total           INTEGER NOT NULL DEFAULT 0,
            correct_count   INTEGER NOT NULL DEFAULT 0,
            wrong_count     INTEGER NOT NULL DEFAULT 0,
            skipped_count   INTEGER NOT NULL DEFAULT 0,
            time_taken_sec  INTEGER,
            submitted_at    TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (test_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS mistakes (
            id              SERIAL PRIMARY KEY,
            student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            test_id         INTEGER REFERENCES generated_tests(id) ON DELETE CASCADE,
            question_id     INTEGER REFERENCES question_bank(id) ON DELETE CASCADE,
            section_id      INTEGER REFERENCES sections(id) ON DELETE SET NULL,
            chapter_id      INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
            difficulty      TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );

        -- Student blog -- open topic, admin can moderate/remove any post.
        CREATE TABLE IF NOT EXISTS blog_posts (
            id              SERIAL PRIMARY KEY,
            author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title           TEXT NOT NULL,
            content         TEXT NOT NULL,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await migrateContentSchema();
    await seedSections();
    await seedAdmin();
    await seedQuestionBank();
    console.log('✅  Connectomic Medical Academy schema ready');
}

// Additive, non-destructive migration for existing installs: new columns
// on tables that already exist from before this change, plus relaxing the
// old one-book-per-type-per-section constraint now that faculty can create
// their own books. Safe to run every startup -- every statement is
// idempotent (IF NOT EXISTS / IF EXISTS) and none of them drop data.
async function migrateContentSchema() {
    await pool.query(`
        ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS topic TEXT;
        ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS estimated_time_sec INTEGER DEFAULT 60;

        ALTER TABLE materials ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'link' CHECK (source_type IN ('link','file'));
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS storage_key TEXT;
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

        ALTER TABLE lectures ADD COLUMN IF NOT EXISTS storage_key TEXT;
        ALTER TABLE lectures ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

        ALTER TABLE books ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE books DROP CONSTRAINT IF EXISTS books_section_id_type_key;

        ALTER TABLE sections ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE chapters ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

        ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
        -- Existing faculty accounts predate the approval gate -- grandfather
        -- them in as approved rather than silently locking out everyone who
        -- already registered before this feature existed.
    `);
}

// ---------------------------------------------------------------------------
// SEED DATA — idempotent, safe to re-run every startup
// ---------------------------------------------------------------------------
const SECTION_CHAPTERS = {
    'Anatomy': ['Upper Limb', 'Lower Limb', 'Thorax', 'Abdomen', 'Head & Neck', 'Neuroanatomy'],
    'Physiology': ['General Physiology', 'Nerve-Muscle Physiology', 'Blood', 'Cardiovascular System', 'Respiratory System', 'Renal Physiology'],
    'Biochemistry': ['Biomolecules', 'Enzymes', 'Carbohydrate Metabolism', 'Lipid Metabolism', 'Molecular Biology', 'Vitamins & Minerals'],
    'Neuroscience': ['Neuroanatomy Basics', 'Neurophysiology', 'Neurotransmitters & Synaptic Signalling', 'Sensory Systems', 'Motor Systems', 'Higher Cognitive Functions']
};

async function seedSections() {
    const sectionNames = Object.keys(SECTION_CHAPTERS);
    for (let i = 0; i < sectionNames.length; i++) {
        const name = sectionNames[i];
        const { rows: [section] } = await pool.query(
            `INSERT INTO sections (name, position) VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET position = EXCLUDED.position
             RETURNING id`,
            [name, i]
        );
        const sectionId = section.id;

        // Seed the two starter books only if this section has none of that
        // type yet -- check-then-insert instead of ON CONFLICT, since the
        // UNIQUE(section_id, type) constraint was intentionally relaxed so
        // faculty can add more books of either type. This also means a
        // restart won't clobber a title/description a faculty member has
        // since edited on the seeded books.
        for (const [type, title, desc, position] of [
            ['mbbs', 'MBBS Level', `Core chapter-wise ${name} teaching content for MBBS curriculum.`, 0],
            ['reference', 'Reference & Resources', `Reference book material, PPTs and videos for ${name}.`, 1]
        ]) {
            const { rows: [existing] } = await pool.query(
                `SELECT id FROM books WHERE section_id=$1 AND type=$2 LIMIT 1`, [sectionId, type]
            );
            if (!existing) {
                await pool.query(
                    `INSERT INTO books (section_id, type, title, description, position) VALUES ($1,$2,$3,$4,$5)`,
                    [sectionId, type, title, desc, position]
                );
            }
        }

        const chapters = SECTION_CHAPTERS[name];
        for (let c = 0; c < chapters.length; c++) {
            await pool.query(
                `INSERT INTO chapters (section_id, name, position) VALUES ($1, $2, $3)
                 ON CONFLICT (section_id, name) DO UPDATE SET position = EXCLUDED.position`,
                [sectionId, chapters[c], c]
            );
        }
    }
    console.log('✅  Sections, books & chapters up to date (Anatomy / Physiology / Biochemistry / Neuroscience)');
}

async function seedAdmin() {
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@connectomicmedical.local';
    const plainPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';
    const { rows: [existing] } = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing) return;
    const hash = await bcrypt.hash(plainPassword, 10);
    await pool.query(
        `INSERT INTO users (email, password_hash, role, name, is_verified, onboarding_done)
         VALUES ($1, $2, 'admin', 'Academy Admin', TRUE, TRUE)`,
        [email, hash]
    );
    console.log(`✅  Seeded default admin login -> ${email} / ${plainPassword}  (change this password immediately)`);
}

// Real MBBS-level sample MCQs, one chapter per section, so the test engine
// (chapter/subject/grand tests) has something to generate from immediately
// without a faculty/admin having to author questions first. Idempotent —
// only inserts if that chapter has no questions yet, safe to re-run.
const SAMPLE_QUESTIONS = {
    'Anatomy::Upper Limb': [
        { q: 'Which nerve is most commonly injured in a mid-shaft humeral fracture?', a: 'Radial nerve', b: 'Median nerve', c: 'Ulnar nerve', d: 'Axillary nerve', correct: 'A', diff: 'Moderate', exp: 'The radial nerve runs in the spiral (radial) groove directly against the mid-shaft of the humerus, making it vulnerable there.' },
        { q: 'The "anatomical snuffbox" is bounded medially by the tendon of which muscle?', a: 'Extensor pollicis brevis', b: 'Extensor pollicis longus', c: 'Abductor pollicis longus', d: 'Flexor pollicis longus', correct: 'B', diff: 'Difficult', exp: 'EPL forms the medial (ulnar) border; APL and EPB form the lateral (radial) border.' },
        { q: 'Winging of the scapula is a classic sign of injury to which nerve?', a: 'Long thoracic nerve', b: 'Thoracodorsal nerve', c: 'Dorsal scapular nerve', d: 'Suprascapular nerve', correct: 'A', diff: 'Easy', exp: 'The long thoracic nerve supplies serratus anterior, which holds the scapula against the thoracic wall.' },
        { q: 'Which muscle initiates the first 15° of shoulder abduction?', a: 'Deltoid', b: 'Supraspinatus', c: 'Infraspinatus', d: 'Teres minor', correct: 'B', diff: 'Moderate', exp: 'Supraspinatus initiates abduction before deltoid takes over for the remaining range.' },
        { q: 'The cubital fossa is bounded laterally by which muscle?', a: 'Pronator teres', b: 'Brachioradialis', c: 'Biceps brachii', d: 'Brachialis', correct: 'B', diff: 'Moderate', exp: 'Brachioradialis forms the lateral border; pronator teres forms the medial border.' },
    ],
    'Physiology::Cardiovascular System': [
        { q: 'The dicrotic notch on the aortic pressure curve corresponds to which event?', a: 'Mitral valve closure', b: 'Aortic valve closure', c: 'Tricuspid valve opening', d: 'Isovolumetric contraction', correct: 'B', diff: 'Moderate', exp: 'The brief backflow of blood against the closing aortic valve produces the dicrotic notch.' },
        { q: 'Which phase of the cardiac action potential corresponds to the plateau seen in ventricular myocytes?', a: 'Phase 0', b: 'Phase 1', c: 'Phase 2', d: 'Phase 4', correct: 'C', diff: 'Moderate', exp: 'Phase 2 (plateau) is maintained by balanced Ca2+ influx and K+ efflux.' },
        { q: 'Cardiac output is the product of heart rate and which other variable?', a: 'Stroke volume', b: 'Ejection fraction', c: 'End-diastolic volume', d: 'Total peripheral resistance', correct: 'A', diff: 'Easy', exp: 'CO = HR × SV.' },
        { q: 'Which reflex is primarily responsible for the rapid, beat-to-beat regulation of blood pressure?', a: 'Renin-angiotensin system', b: 'Baroreceptor reflex', c: 'Chemoreceptor reflex', d: 'Bainbridge reflex', correct: 'B', diff: 'Easy', exp: 'The baroreceptor reflex acts within seconds via the carotid sinus and aortic arch stretch receptors.' },
        { q: 'The Frank-Starling law relates stroke volume to which variable?', a: 'Afterload', b: 'Heart rate', c: 'End-diastolic volume (preload)', d: 'Contractility', correct: 'C', diff: 'Moderate', exp: 'Greater venous return stretches myocardial fibres, increasing stroke volume up to a physiological limit.' },
    ],
    'Biochemistry::Enzymes': [
        { q: 'A competitive inhibitor typically affects which kinetic parameter?', a: 'Increases Vmax, Km unchanged', b: 'Increases apparent Km, Vmax unchanged', c: 'Decreases Vmax, Km unchanged', d: 'Decreases both Vmax and Km', correct: 'B', diff: 'Moderate', exp: 'Competitive inhibitors raise the apparent Km because more substrate is needed to outcompete the inhibitor; Vmax is unaffected given enough substrate.' },
        { q: 'Which cofactor is required by pyruvate dehydrogenase complex but NOT by lactate dehydrogenase?', a: 'NAD+', b: 'Thiamine pyrophosphate', c: 'FAD', d: 'Both B and C', correct: 'D', diff: 'Difficult', exp: 'PDH complex uses TPP, FAD, NAD+, CoA and lipoic acid; LDH only uses NAD+/NADH.' },
        { q: 'Allosteric enzymes typically show which type of substrate saturation curve?', a: 'Hyperbolic', b: 'Sigmoidal', c: 'Linear', d: 'Exponential decay', correct: 'B', diff: 'Easy', exp: 'Cooperative binding at multiple subunits produces the characteristic sigmoidal curve.' },
        { q: 'Which enzyme class catalyzes the transfer of a phosphate group from ATP to a substrate?', a: 'Hydrolase', b: 'Isomerase', c: 'Kinase (transferase)', d: 'Ligase', correct: 'C', diff: 'Easy', exp: 'Kinases are a subclass of transferases that transfer phosphate groups, typically from ATP.' },
        { q: 'Zymogens are inactive enzyme precursors typically activated by which mechanism?', a: 'Allosteric binding of an activator', b: 'Proteolytic cleavage', c: 'Phosphorylation only', d: 'Dimerization', correct: 'B', diff: 'Moderate', exp: 'Zymogens like trypsinogen and pepsinogen require irreversible proteolytic cleavage to expose the active site.' },
    ],
    'Neuroscience::Neurophysiology': [
        { q: 'The resting membrane potential of a typical neuron is closest to which value?', a: '-90 mV', b: '-70 mV', c: '-40 mV', d: '0 mV', correct: 'B', diff: 'Easy', exp: 'Around -70 mV, set mainly by the K+ equilibrium potential and the Na+/K+-ATPase.' },
        { q: 'Saltatory conduction in myelinated axons occurs by depolarization jumping between which structures?', a: 'Synaptic boutons', b: 'Nodes of Ranvier', c: 'Dendritic spines', d: 'Schwann cell bodies', correct: 'B', diff: 'Easy', exp: 'Voltage-gated Na+ channels cluster at the nodes of Ranvier, allowing the action potential to jump node-to-node.' },
        { q: 'Which neurotransmitter is primarily inhibitory in the adult mammalian CNS?', a: 'Glutamate', b: 'Acetylcholine', c: 'GABA', d: 'Dopamine', correct: 'C', diff: 'Easy', exp: 'GABA acting on GABA-A/GABA-B receptors is the principal inhibitory neurotransmitter in the adult CNS.' },
        { q: 'The absolute refractory period of a neuron is due primarily to what state of voltage-gated Na+ channels?', a: 'Fully closed (resting)', b: 'Open (activated)', c: 'Inactivated', d: 'Not yet synthesized', correct: 'C', diff: 'Moderate', exp: 'Inactivated Na+ channels cannot reopen until the membrane repolarizes, making a second action potential impossible during this period.' },
        { q: 'Long-term potentiation (LTP) at the hippocampal CA1 synapse critically depends on which receptor?', a: 'AMPA receptor alone', b: 'NMDA receptor', c: 'GABA-A receptor', d: 'Nicotinic ACh receptor', correct: 'B', diff: 'Difficult', exp: 'NMDA receptors act as coincidence detectors (requiring both depolarization and glutamate binding) to trigger the Ca2+ influx that induces LTP.' },
    ],
};

async function seedQuestionBank() {
    let inserted = 0;
    for (const key of Object.keys(SAMPLE_QUESTIONS)) {
        const [sectionName, chapterName] = key.split('::');
        const { rows: [chapter] } = await pool.query(
            `SELECT c.id AS chapter_id, c.section_id FROM chapters c
             JOIN sections s ON s.id = c.section_id
             WHERE s.name = $1 AND c.name = $2`,
            [sectionName, chapterName]
        );
        if (!chapter) continue;
        const { rows: [{ count }] } = await pool.query(
            `SELECT COUNT(*) FROM question_bank WHERE chapter_id = $1`, [chapter.chapter_id]
        );
        if (parseInt(count, 10) > 0) continue; // already seeded (or faculty/admin already added real ones)

        for (const item of SAMPLE_QUESTIONS[key]) {
            await pool.query(
                `INSERT INTO question_bank
                 (section_id, chapter_id, question_text, option_a, option_b, option_c, option_d,
                  correct_answer, explanation, difficulty, status, approved_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'approved',NOW())`,
                [chapter.section_id, chapter.chapter_id, item.q, item.a, item.b, item.c, item.d,
                 item.correct, item.exp, item.diff]
            );
            inserted++;
        }
    }
    if (inserted > 0) console.log(`✅  Seeded ${inserted} sample question-bank MCQs (one chapter per subject) for test-generation testing`);
}

module.exports = { pool, initSchema, SECTION_CHAPTERS, seedQuestionBank };