import React, { useEffect, useState, useCallback } from 'react';

/**
 * Feature 4 – Share & Challenge
 * This component auto-renders when the URL contains ?challenge=BASE64
 * It overlays the quiz, lets the challenger complete it, and shows a comparison.
 */

function ChallengeQuiz({ quizData, creatorScore, creatorTotal, creatorName, onClose }) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState({});
  const [done, setDone] = useState(false);
  const [revLink, setRevLink] = useState('');
  const [copyDone, setCopyDone] = useState(false);

  const q = quizData[qIdx];
  const answered = selected[qIdx] !== undefined;

  const handleSelect = (opt) => {
    if (answered) return;
    const next = { ...selected, [qIdx]: opt };
    setSelected(next);
    if (qIdx === quizData.length - 1) setDone(true);
  };

  const myScore = Object.entries(selected).filter(([i, a]) => quizData[+i]?.correct === a).length;

  const generateReverseLink = useCallback(() => {
    try {
      const encoded = btoa(JSON.stringify({ quizData, creatorScore: myScore, creatorTotal: quizData.length, creatorName: 'Challenger' }));
      const base = window.location.origin + window.location.pathname;
      setRevLink(`${base}?challenge=${encoded}`);
    } catch {
      setRevLink(window.location.href);
    }
  }, [quizData, myScore]);

  useEffect(() => { if (done) generateReverseLink(); }, [done, generateReverseLink]);

  const copyLink = () => {
    navigator.clipboard.writeText(revLink).then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 2000); });
  };

  const optBg = (opt) => {
    if (!answered) return '#fff';
    if (opt === q.correct) return '#d1fae5';
    if (opt === selected[qIdx]) return '#fee2e2';
    return '#fff';
  };
  const optBorder = (opt) => {
    if (!answered) return '#d1fae5';
    if (opt === q.correct) return '#059669';
    if (opt === selected[qIdx]) return '#ef4444';
    return '#d1fae5';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, overflowY: 'auto', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28, maxWidth: 560, width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: '#064e3b', fontWeight: 800, fontSize: 20 }}>🤝 Challenge Quiz</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          {creatorName || 'A friend'} scored <strong>{creatorScore}/{creatorTotal}</strong> — can you beat them?
        </p>

        {!done ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>Question {qIdx + 1} of {quizData.length}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(qIdx / quizData.length) * 100}%`, background: '#059669' }} />
              </div>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#064e3b', marginBottom: 16, lineHeight: 1.5 }}>{q.question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {Object.entries(q.options).map(([opt, text]) => (
                <button key={opt} onClick={() => handleSelect(opt)} style={{
                  textAlign: 'left', padding: '12px 16px', borderRadius: 10,
                  border: `2px solid ${optBorder(opt)}`, background: optBg(opt),
                  fontWeight: 500, fontSize: 14, fontFamily: 'inherit', cursor: answered ? 'default' : 'pointer', color: '#064e3b'
                }}>
                  <strong>{opt}.</strong> {text}
                </button>
              ))}
            </div>
            {answered && q.explanation && (
              <div className="alert alert-success" style={{ marginBottom: 12 }}>
                <span>💡</span><span><strong>Explanation:</strong> {q.explanation}</span>
              </div>
            )}
            {answered && qIdx < quizData.length - 1 && (
              <button className="btn btn-primary" onClick={() => setQIdx(qIdx + 1)}>Next →</button>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{myScore > creatorScore ? '🏆' : myScore === creatorScore ? '🤝' : '😅'}</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#064e3b' }}>
              You scored {myScore}/{quizData.length} vs {creatorName || 'them'}'s {creatorScore}/{creatorTotal}
            </h3>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {myScore > creatorScore ? 'You win! 🎉' : myScore === creatorScore ? 'It\'s a tie!' : 'Better luck next time!'}
            </p>
            {revLink && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontWeight: 600, color: '#064e3b', marginBottom: 8 }}>Challenge them back:</p>
                <div style={{ background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 14px', fontSize: 12, wordBreak: 'break-all', color: '#064e3b', marginBottom: 10 }}>{revLink}</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={copyLink}>{copyDone ? '✅ Copied!' : '📋 Copy Link'}</button>
                  <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(`I challenged you back on SmartStudy! ${revLink}`)}`} target="_blank" rel="noopener noreferrer">📲 WhatsApp</a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChallengeChecker() {
  const [challengeData, setChallengeData] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('challenge');
    if (!encoded) return;
    try {
      const decoded = JSON.parse(atob(encoded));
      if (decoded?.quizData?.length) {
        setChallengeData(decoded);
        setVisible(true);
      }
    } catch (e) {
      console.warn('Invalid challenge param', e);
    }
  }, []);

  if (!visible || !challengeData) return null;

  return (
    <ChallengeQuiz
      quizData={challengeData.quizData}
      creatorScore={challengeData.creatorScore}
      creatorTotal={challengeData.creatorTotal}
      creatorName={challengeData.creatorName}
      onClose={() => setVisible(false)}
    />
  );
}
