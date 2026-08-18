import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { IconClock, IconQuiz } from '../components/Icons.jsx';

export default function TakeTest() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const startedAt = useRef(Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    api(`/api/tests/${testId}/questions`).then(data => {
      setTest(data.test);
      setQuestions(data.questions);
      setSecondsLeft((data.test.time_limit_min || 30) * 60);
      setLoading(false);
    }).catch(err => {
      showToast(err.message, 'error');
      navigate('/tests');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) { handleSubmit(); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  function selectAnswer(qId, option) {
    setAnswers(a => ({ ...a, [qId]: option }));
  }

  async function handleSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const timeTakenSec = Math.round((Date.now() - startedAt.current) / 1000);
    try {
      const result = await api(`/api/tests/${testId}/submit`, { method: 'POST', body: JSON.stringify({ answers, timeTakenSec }) });
      navigate(`/tests/attempts/${result.attemptId}`, { replace: true });
    } catch (err) {
      showToast(err.message, 'error');
      submittedRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!questions.length) return <div className="page"><p className="helper-text">This test has no questions.</p></div>;

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;
  const mins = Math.floor((secondsLeft || 0) / 60);
  const secs = (secondsLeft || 0) % 60;

  return (
    <div className="page">
      <div className="flex-between">
        <h2 className="icon-row"><IconQuiz />{test.title}</h2>
        <span className={`chip ${secondsLeft < 60 ? 'chip-reference' : 'chip-mbbs'}`}>
          <IconClock /> {mins}:{secs < 10 ? '0' : ''}{secs}
        </span>
      </div>

      <p className="helper-text">Question {current + 1} of {questions.length} · {answeredCount} answered · {q.chapter_name}</p>

      <div className="card">
        <p style={{ fontSize: '1.05rem', fontWeight: 600 }}>{q.question_text}</p>
        <div className="mt-1">
          {['A', 'B', 'C', 'D'].map(opt => (
            <div
              key={opt}
              className="chapter-row"
              style={{ borderRadius: 10, border: '1px solid var(--border)', marginBottom: '0.5rem', background: answers[q.id] === opt ? 'var(--accent-soft)' : 'transparent' }}
              onClick={() => selectAnswer(q.id, opt)}
            >
              <span><strong>{opt}.</strong> {q[`option_${opt.toLowerCase()}`]}</span>
              {answers[q.id] === opt && <span className="chip chip-mbbs">Selected</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-between mt-1">
        <button className="btn btn-outline" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>Previous</button>
        <div className="grid-7">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              className={`btn btn-sm ${i === current ? 'btn-primary' : answers[qq.id] ? 'btn-secondary' : 'btn-outline'}`}
              onClick={() => setCurrent(i)}
            >{i + 1}</button>
          ))}
        </div>
        {current < questions.length - 1
          ? <button className="btn btn-outline" onClick={() => setCurrent(c => c + 1)}>Next</button>
          : <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>{submitting ? 'Submitting…' : 'Submit test'}</button>}
      </div>
    </div>
  );
}
