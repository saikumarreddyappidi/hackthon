import React, { useCallback, useEffect, useState } from 'react';
import API from '../api';
import { useAuth } from '../AuthContext';

export default function Chatbot() {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const response = await API.get(`/chatbot/${user.id}`);
      setSuggestions(response.data.suggested_questions || []);
      if (response.data.answer) {
        setAnswer(response.data.answer);
      }
    } catch (error) {
      setAnswer('Unable to load AI chatbot suggestions right now.');
    }
  }, [user]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const askQuestion = async (questionText) => {
    if (!user || !questionText?.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const response = await API.get(`/chatbot/${user.id}`, {
        params: { question: questionText.trim() }
      });
      setAnswer(response.data.answer || 'No answer generated.');
      setSuggestions(response.data.suggested_questions || suggestions);
    } catch (error) {
      setAnswer('I could not answer that right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    askQuestion(question);
  };

  return (
    <div>
      <div className="page-header">
        <h1>💬 AI Chatbot</h1>
        <p>Ask study questions or click suggested questions to get instant answers</p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Ask Your Question</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Question</label>
              <textarea
                className="form-control"
                rows={4}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Example: How can I improve my Maths readiness score quickly?"
                style={{ resize: 'vertical' }}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading || !question.trim()}>
              {loading ? 'Thinking...' : 'Ask AI'}
            </button>
          </form>

          <hr className="divider" />

          <div className="card-title">Answer</div>
          <div style={{
            minHeight: 120,
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}>
            {answer || 'Ask a question or click one from the suggestions to see the AI answer here.'}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Suggested Questions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {suggestions.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                No suggestions available yet.
              </div>
            )}
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.4 }}
                onClick={() => {
                  setQuestion(item);
                  askQuestion(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
