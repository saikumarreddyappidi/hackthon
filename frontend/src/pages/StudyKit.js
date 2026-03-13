import React, { useState, useRef, useCallback } from 'react';
import { callClaude, LS_QUIZ_RESULTS } from '../config';

// ── helpers ────────────────────────────────────────────────
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function extractPdfText(file) {
  return new Promise((resolve, reject) => {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (!pdfjsLib) return reject(new Error('PDF.js not loaded'));
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((s) => s.str).join(' ') + '\n';
        }
        resolve(text.slice(0, 8000));
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

async function fetchYouTubeTranscript(videoId) {
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
    `https://youtubetranscript.com/?server_vid=${videoId}`
  )}`;
  const resp = await fetch(url);
  const data = await resp.json();
  const html = data.contents || '';
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.slice(0, 8000);
}

const STUDY_KIT_SYSTEM = `You are an expert AI study assistant. Analyze the learning content and return ONLY a valid JSON object. No markdown, no code blocks, no extra text.

{
  "notes": {
    "topic": "string",
    "key_concepts": ["string"],
    "definitions": [{ "term": "string", "definition": "string" }],
    "summary": "3-5 sentences",
    "bullet_points": ["string"]
  },
  "flashcards": [
    { "id": 1, "question": "string", "answer": "string", "topic": "string", "difficulty": "easy|medium|hard" }
  ],
  "quiz": [
    {
      "id": 1,
      "question": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      "correct": "A|B|C|D",
      "explanation": "string",
      "topic": "string"
    }
  ]
}

Rules:
- Generate exactly 8 flashcards
- Generate exactly 8 quiz questions
- Extract 5-10 key concepts
- Include all definitions found
- Return ONLY the JSON object`;

function extractJsonText(raw) {
  if (!raw) return '';
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) return fencedMatch[1].trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return (jsonMatch ? jsonMatch[0] : raw).trim();
}

function parseStudyKitPayload(raw) {
  const parsed = JSON.parse(extractJsonText(raw));
  if (!parsed?.notes || !Array.isArray(parsed?.flashcards) || !Array.isArray(parsed?.quiz)) {
    throw new Error('AI returned incomplete study kit data. Please try again.');
  }
  return parsed;
}

// ── sub-components ──────────────────────────────────────────

function NotesTab({ notes }) {
  if (!notes) return null;
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', marginBottom: 16 }}>{notes.topic}</h2>
      {notes.key_concepts?.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="card-title">Key Concepts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {notes.key_concepts.map((c, i) => (
              <span key={i} className="badge badge-success" style={{ fontSize: 13, padding: '5px 12px' }}>{c}</span>
            ))}
          </div>
        </div>
      )}
      {notes.definitions?.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="card-title">Definitions</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
            <thead>
              <tr style={{ background: '#d1fae5' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#064e3b', borderRadius: '8px 0 0 8px' }}>Term</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#064e3b', borderRadius: '0 8px 8px 0' }}>Definition</th>
              </tr>
            </thead>
            <tbody>
              {notes.definitions.map((d, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#f0fdf4' : '#fff' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#059669', borderBottom: '1px solid #d1fae5' }}>{d.term}</td>
                  <td style={{ padding: '8px 12px', color: '#374151', borderBottom: '1px solid #d1fae5' }}>{d.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {notes.summary && (
        <blockquote style={{
          background: '#d1fae5', borderLeft: '4px solid #059669',
          padding: '14px 18px', borderRadius: '0 10px 10px 0',
          fontSize: 14, lineHeight: 1.7, color: '#064e3b', marginBottom: 18
        }}>
          {notes.summary}
        </blockquote>
      )}
      {notes.bullet_points?.length > 0 && (
        <div>
          <div className="card-title">Key Points</div>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.bullet_points.map((bp, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#374151' }}>
                <span style={{ color: '#059669', fontWeight: 700, marginTop: 1 }}>•</span>
                {bp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FlashcardsTab({ flashcards }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!flashcards?.length) return null;
  const card = flashcards[idx];
  const diffColor = { easy: '#059669', medium: '#f59e0b', hard: '#ef4444' };
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 12, color: 'var(--text-muted)', fontSize: 14 }}>
        Card {idx + 1} of {flashcards.length}
      </div>
      <div
        onClick={() => setFlipped(!flipped)}
        style={{
          cursor: 'pointer', minHeight: 200, border: '2px solid #6ee7b7',
          borderRadius: 16, padding: '32px 24px', textAlign: 'center',
          background: flipped ? '#d1fae5' : '#fff', transition: 'background 0.3s',
          position: 'relative', userSelect: 'none'
        }}
      >
        {!flipped ? (
          <div>
            <div className="badge badge-success" style={{
              background: diffColor[card.difficulty] + '22',
              color: diffColor[card.difficulty], marginBottom: 14
            }}>
              {card.difficulty}
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#064e3b', lineHeight: 1.5 }}>{card.question}</p>
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>Click to reveal answer</p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 16, color: '#064e3b', lineHeight: 1.7 }}>{card.answer}</p>
            <span className="badge badge-success" style={{ marginTop: 14 }}>{card.topic}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
        <button
          className="btn btn-secondary"
          disabled={idx === 0}
          onClick={() => { setIdx(idx - 1); setFlipped(false); }}
        >← Previous</button>
        <button
          className="btn btn-primary"
          disabled={idx === flashcards.length - 1}
          onClick={() => { setIdx(idx + 1); setFlipped(false); }}
        >Next →</button>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ['#059669','#34d399','#6ee7b7','#fbbf24','#f87171','#818cf8'];
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {Array.from({ length: 60 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: Math.random() * 100 + '%',
          top: -20,
          width: 10 + Math.random() * 8,
          height: 10 + Math.random() * 8,
          background: colors[Math.floor(Math.random() * colors.length)],
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * 2}s linear forwards`,
          opacity: 0.9,
        }} />
      ))}
    </div>
  );
}

function QuizTab({ quiz, topic, onSave }) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState({});
  const [done, setDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  if (!quiz?.length) return null;
  const q = quiz[qIdx];
  const answered = selected[qIdx] !== undefined;
  const correctCount = Object.entries(selected).filter(([i, ans]) => quiz[+i]?.correct === ans).length;
  const accuracy = Math.round((correctCount / quiz.length) * 100);

  const handleSelect = (opt) => {
    if (answered) return;
    const next = { ...selected, [qIdx]: opt };
    setSelected(next);
    if (qIdx === quiz.length - 1) {
      const results = quiz.map((qu, i) => ({
        question: qu.question, selected: next[i], correct: qu.correct,
        isCorrect: next[i] === qu.correct
      }));
      const entry = {
        topic: topic || 'Study Kit', score: Object.values(next).filter((a, i) => quiz[i]?.correct === a).length,
        total: quiz.length,
        accuracy: Math.round((Object.values(next).filter((a, i) => quiz[i]?.correct === a).length / quiz.length) * 100),
        timestamp: new Date().toISOString(), questionResults: results
      };
      const existing = JSON.parse(localStorage.getItem(LS_QUIZ_RESULTS) || '[]');
      localStorage.setItem(LS_QUIZ_RESULTS, JSON.stringify([...existing, entry]));
      if (onSave) onSave(entry);
      setDone(true);
      if (entry.accuracy >= 70) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 4000); }
    }
  };

  const handleShare = () => setShareModal(true);

  const shareUrl = (() => {
    try {
      const encoded = btoa(JSON.stringify({ quizData: quiz, creatorScore: correctCount, creatorTotal: quiz.length }));
      const base = window.location.origin + window.location.pathname;
      return `${base}?challenge=${encoded}`;
    } catch {
      return window.location.href;
    }
  })();

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 2000); });
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        {showConfetti && <Confetti />}
        <div style={{ fontSize: 64 }}>{accuracy >= 70 ? '🎉' : '📖'}</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#064e3b', marginTop: 12 }}>
          You scored {correctCount}/{quiz.length} ({accuracy}%)
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
          {accuracy >= 70 ? 'Great job! Keep it up 🚀' : "Keep studying — you'll get there! 💪"}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => { setSelected({}); setQIdx(0); setDone(false); }}>
            🔄 Retry Quiz
          </button>
          <button className="btn btn-secondary" onClick={handleShare}>Share Quiz 🔗</button>
        </div>

        {shareModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div className="card" style={{ maxWidth: 480, width: '90%', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: '#064e3b', fontWeight: 800 }}>🤝 Challenge a Friend</h3>
                <button onClick={() => setShareModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
              </div>
              <p style={{ color: '#374151', marginBottom: 12, fontWeight: 600 }}>
                I scored {correctCount}/{quiz.length} — can you beat me?
              </p>
              <div style={{
                background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 8,
                padding: '10px 14px', fontSize: 12, wordBreak: 'break-all',
                color: '#064e3b', marginBottom: 12
              }}>{shareUrl}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={copyLink} style={{ flex: 1 }}>
                  {copyDone ? '✅ Copied!' : '📋 Copy Link'}
                </button>
                <a
                  className="btn btn-secondary"
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                  href={`https://wa.me/?text=${encodeURIComponent(`I scored ${correctCount}/${quiz.length} on SmartStudy! Can you beat me? ${shareUrl}`)}`}
                  target="_blank" rel="noopener noreferrer"
                >
                  📲 WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          <span>Question {qIdx + 1} of {quiz.length}</span>
          <span>{Math.round(((qIdx) / quiz.length) * 100)}% complete</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((qIdx) / quiz.length) * 100}%`, background: '#059669' }} />
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: '#064e3b', marginBottom: 20, lineHeight: 1.5 }}>{q.question}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {Object.entries(q.options).map(([opt, text]) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            style={{
              textAlign: 'left', padding: '12px 16px', borderRadius: 10, cursor: answered ? 'default' : 'pointer',
              border: `2px solid ${optBorder(opt)}`, background: optBg(opt),
              fontWeight: 500, fontSize: 14, fontFamily: 'inherit', transition: 'all 0.2s',
              color: '#064e3b',
            }}
          >
            <strong>{opt}.</strong> {text}
          </button>
        ))}
      </div>
      {answered && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <span>💡</span>
          <span><strong>Explanation:</strong> {q.explanation}</span>
        </div>
      )}
      {answered && qIdx < quiz.length - 1 && (
        <button className="btn btn-primary" onClick={() => { setQIdx(qIdx + 1); }}>
          Next Question →
        </button>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function StudyKit() {
  const [inputTab, setInputTab] = useState('text');
  const [pdfFile, setPdfFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kitData, setKitData] = useState(null);
  const [outputTab, setOutputTab] = useState('notes');
  const [lastTopic, setLastTopic] = useState('');
  const fileRef = useRef();

  const generate = useCallback(async () => {
    setError('');
    setLoading(true);
    setKitData(null);
    try {
      let text = '';
      if (inputTab === 'pdf') {
        if (!pdfFile) throw new Error('Please select a PDF file');
        text = await extractPdfText(pdfFile);
      } else if (inputTab === 'text') {
        if (!pasteText.trim()) throw new Error('Please paste some text');
        text = pasteText.trim();
      } else {
        if (!ytUrl.trim()) throw new Error('Please enter a YouTube URL');
        const vid = extractYouTubeId(ytUrl.trim());
        if (!vid) throw new Error('Could not extract video ID from URL');
        text = await fetchYouTubeTranscript(vid);
        if (!text || text.length < 50) throw new Error('Could not fetch transcript. Try a different video.');
      }
      const raw = await callClaude(
        STUDY_KIT_SYSTEM,
        `Generate study materials from this content: ${text}`,
        2000,
        { responseFormat: 'json' }
      );
      let parsed;
      try {
        parsed = parseStudyKitPayload(raw);
      } catch {
        throw new Error('AI returned invalid JSON. Please try again.');
      }
      setKitData(parsed);
      setLastTopic(parsed.notes?.topic || 'Study Kit');
      setOutputTab('notes');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [inputTab, pdfFile, pasteText, ytUrl]);

  const inputTabs = [
    { key: 'text', label: '📝 Paste Text' },
    { key: 'pdf', label: '📄 Upload PDF' },
    { key: 'youtube', label: '🎥 YouTube Link' },
  ];
  const outputTabs = [
    { key: 'notes', label: '📝 Notes' },
    { key: 'flashcards', label: '🃏 Flashcards' },
    { key: 'quiz', label: '❓ Quiz' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>📚 Study Kit Generator</h1>
        <p>Upload a PDF, paste text, or paste a YouTube link — get Notes, Flashcards & a Quiz instantly.</p>
      </div>

      {/* Input card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #d1fae5' }}>
          {inputTabs.map(t => (
            <button key={t.key} onClick={() => setInputTab(t.key)} style={{
              padding: '10px 20px', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              border: 'none', background: 'none',
              borderBottom: inputTab === t.key ? '2px solid #059669' : '2px solid transparent',
              color: inputTab === t.key ? '#059669' : '#6b7280', marginBottom: -2, transition: 'all 0.15s'
            }}>{t.label}</button>
          ))}
        </div>

        {inputTab === 'text' && (
          <textarea
            className="form-control"
            rows={8}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="Paste your study notes, textbook excerpt, article, lecture notes here..."
          />
        )}
        {inputTab === 'pdf' && (
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed #6ee7b7', borderRadius: 12, padding: '40px 20px',
              textAlign: 'center', cursor: 'pointer', background: '#f0fdf4'
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => setPdfFile(e.target.files[0])} />
            {pdfFile
              ? <p style={{ color: '#059669', fontWeight: 700 }}>📄 {pdfFile.name}</p>
              : <p style={{ color: '#9ca3af' }}>Click to upload PDF (PDF.js powered)</p>}
          </div>
        )}
        {inputTab === 'youtube' && (
          <input
            className="form-control"
            value={ytUrl}
            onChange={e => setYtUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        )}

        {error && <div className="alert alert-danger" style={{ marginTop: 14 }}>⚠️ {error}</div>}

        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}
          disabled={loading}
          onClick={generate}
        >
          {loading
            ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Generating...</>
            : 'Generate Study Kit ✨'}
        </button>
      </div>

      {/* Output */}
      {kitData && (
        <div className="card">
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #d1fae5' }}>
            {outputTabs.map(t => (
              <button key={t.key} onClick={() => setOutputTab(t.key)} style={{
                padding: '10px 20px', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                border: 'none', background: 'none',
                borderBottom: outputTab === t.key ? '2px solid #059669' : '2px solid transparent',
                color: outputTab === t.key ? '#059669' : '#6b7280', marginBottom: -2, transition: 'all 0.15s'
              }}>{t.label}</button>
            ))}
          </div>
          {outputTab === 'notes' && <NotesTab notes={kitData.notes} />}
          {outputTab === 'flashcards' && <FlashcardsTab flashcards={kitData.flashcards} />}
          {outputTab === 'quiz' && <QuizTab quiz={kitData.quiz} topic={lastTopic} />}
        </div>
      )}
    </div>
  );
}
