// ============================================================
// SmartStudy Global Config
// ============================================================
// API key lives in the backend — no longer needed in the browser
const BACKEND_URL =
  process.env.REACT_APP_API_URL || (
    window.location.hostname === 'saikumarreddyappidi.github.io'
      ? 'https://smartstudy-api-saikumarreddyappidi.onrender.com'
      : 'http://localhost:8000'
  );

// localStorage keys
export const LS_QUIZ_RESULTS       = "smartstudy_quiz_results";
export const LS_STUDY_PLAN         = "smartstudy_study_plan";
export const LS_POMODORO_SESSIONS  = "smartstudy_pomodoro_sessions";
export const LS_CHALLENGE_DATA     = "smartstudy_challenge_data";

// Helper – call the backend AI proxy. JSON mode is used for structured outputs.
export async function callClaude(systemPrompt, userMessage, maxTokens = 2000, options = {}) {
  const resp = await fetch(`${BACKEND_URL}/claude`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: systemPrompt,
      message: userMessage,
      max_tokens: maxTokens,
      response_format: options.responseFormat,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.text;
}
