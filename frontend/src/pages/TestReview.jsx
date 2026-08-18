import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { IconQuiz } from '../components/Icons.jsx';

export default function TestReview() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/tests/attempts/${attemptId}/review`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!data) return <div className="page"><p className="helper-text">Attempt not found.</p></div>;

  const { attempt, questions } = data;
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 1000) / 10 : 0;

  return (
    <div className="page">
      <h2 className="icon-row"><IconQuiz />{attempt.title}</h2>

      <div className="grid-3">
        <div className="card" style={{ textAlign: 'center' }}><h3>{attempt.score}/{attempt.total}</h3><p className="helper-text">Score ({pct}%)</p></div>
        <div className="card" style={{ textAlign: 'center' }}><h3>{attempt.correct_count} / {attempt.wrong_count} / {attempt.skipped_count}</h3><p className="helper-text">Correct / Wrong / Skipped</p></div>
        <div className="card" style={{ textAlign: 'center' }}><h3>{attempt.time_taken_sec ? Math.round(attempt.time_taken_sec / 60) : '—'} min</h3><p className="helper-text">Time taken</p></div>
      </div>

      <div className="card mt-1">
        <h3>Review</h3>
        {questions.map((q, i) => {
          const given = attempt.answers?.[q.id];
          const isCorrect = given === q.correct_answer;
          return (
            <div key={q.id} className="mt-1" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <p style={{ fontWeight: 600 }}>{i + 1}. {q.question_text} <span className="helper-text">({q.chapter_name})</span></p>
              <div className="grid-2">
                {['A', 'B', 'C', 'D'].map(opt => {
                  let style = {};
                  if (opt === q.correct_answer) style = { color: 'var(--accent-deep)', fontWeight: 700 };
                  else if (opt === given && !isCorrect) style = { color: '#A33F3F', textDecoration: 'line-through' };
                  return <span key={opt} style={style}>{opt}. {q[`option_${opt.toLowerCase()}`]}</span>;
                })}
              </div>
              <p className="helper-text mt-1">
                {given ? (isCorrect ? '✓ You answered correctly.' : `✗ You answered ${given}. Correct answer: ${q.correct_answer}.`) : `Skipped. Correct answer: ${q.correct_answer}.`}
              </p>
              {q.explanation && <p className="helper-text"><em>{q.explanation}</em></p>}
            </div>
          );
        })}
      </div>

      <Link className="btn btn-outline mt-1" to="/tests">Back to Test Centre</Link>
    </div>
  );
}
