// Gemini AI helper — transforms raw ICS calendar events into clean task objects.
// Uses the Gemini 2.5 Flash model (free tier) via Google AI Studio API.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TASK_TYPES = ['assignment', 'homework', 'reading', 'essay', 'exam', 'quiz', 'project', 'lab', 'study', 'other'];

/**
 * Transform a batch of raw calendar events into structured task data.
 * @param {string} apiKey - The user's Gemini API key
 * @param {Array} events - Raw ICS events with {summary, description, start, location, etc.}
 * @param {Array} subjects - User's existing subjects [{id, name}, ...] for matching
 * @returns {Array} Array of task objects {title, type, subject_id, priority, description, due_date, due_time}
 */
async function transformEvents(apiKey, events, subjects) {
  if (!apiKey) throw new Error('Gemini API key not configured');
  if (events.length === 0) return [];

  const subjectList = subjects.map(s => `  - ${s.name} (id: ${s.id})`).join('\n') || '  (none — task should have null subject_id)';

  // Build a compact event list for the model
  const eventList = events.map((e, i) => {
    const lines = [];
    lines.push(`${i + 1}. SUMMARY: ${e.summary || '(no title)'}`);
    if (e.description) lines.push(`   DESCRIPTION: ${truncate(e.description, 400)}`);
    if (e.location) lines.push(`   LOCATION: ${e.location}`);
    if (e.categories) lines.push(`   CATEGORIES: ${e.categories}`);
    if (e.start) {
      lines.push(`   DATE: ${e.start.date}${e.start.time ? ' ' + e.start.time : ' (all day)'}`);
    }
    return lines.join('\n');
  }).join('\n\n');

  const prompt = `You are an assistant that converts raw school calendar events into clean, structured student tasks.

For each event below, output ONE task object with these fields:
- title: A clean, concise task title (e.g. "Read Ch 4-5", "Algebra Quiz", "Essay due") — strip class prefixes like "ENG10:" since that goes in subject_id instead
- type: One of: ${TASK_TYPES.join(', ')}
  - "homework"/"reading" for daily reading or HW assignments
  - "essay" for papers/writing assignments
  - "exam"/"quiz" for tests
  - "project"/"lab" if labeled as such
  - "study" for review or study sessions
  - "assignment" as a general fallback
- subject_id: integer ID from the user's classes below, or null if no match
  - Match by class name being mentioned (e.g. "ENG10" matches "English 10", "Math" matches "Algebra II")
  - Use null if you can't confidently match
- priority: "low", "medium", or "high"
  - "high" for exams, tests, papers, projects with deadlines, anything called "due" or "test" or "final"
  - "medium" for typical homework
  - "low" for optional readings, study suggestions
- description: Any helpful context from the original (page numbers, requirements). Keep brief or null
- due_date: YYYY-MM-DD (use the event's date)
- due_time: HH:MM:SS or null if all-day
- skip: true ONLY if this looks like a class meeting/recurring schedule item, NOT an assignment (e.g. "English Class", "Period 4", "Lunch") — set skip:true and we'll ignore it

USER'S CLASSES:
${subjectList}

EVENTS TO TRANSFORM:
${eventList}

Respond with ONLY a JSON array of objects, one per event in the same order. No markdown, no commentary, no code fences. Begin with [ and end with ].`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    }
  };

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Gemini API error (${res.status})`;
    try {
      const errJson = JSON.parse(text);
      if (errJson.error && errJson.error.message) errMsg += ': ' + errJson.error.message;
    } catch {
      errMsg += ': ' + text.slice(0, 200);
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  let parsed;
  try {
    // Strip any accidental markdown code fences
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error('Could not parse Gemini response as JSON: ' + err.message);
  }

  if (!Array.isArray(parsed)) throw new Error('Gemini returned non-array response');

  // Validate and clean each task
  const tasks = parsed
    .filter(t => t && !t.skip)
    .map(t => ({
      title: String(t.title || '').slice(0, 250) || 'Untitled task',
      type: TASK_TYPES.includes(t.type) ? t.type : 'assignment',
      subject_id: t.subject_id ? parseInt(t.subject_id) : null,
      priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
      description: t.description ? String(t.description).slice(0, 1000) : null,
      due_date: t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
      due_time: t.due_time && /^\d{2}:\d{2}/.test(t.due_time) ? t.due_time.slice(0, 8) : null,
    }));

  return tasks;
}

/**
 * Test that an API key works by making a tiny request.
 */
async function testApiKey(apiKey) {
  if (!apiKey) throw new Error('No API key provided');
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 10 }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Invalid API key (status ${res.status})`;
    try {
      const j = JSON.parse(text);
      if (j.error?.message) msg = j.error.message;
    } catch {}
    throw new Error(msg);
  }
  return true;
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

module.exports = { transformEvents, testApiKey };
