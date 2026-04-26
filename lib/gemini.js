// Gemini AI helper — transforms ICS calendar events into structured data.
// Used by /api/import/feeds/:id/sync.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TASK_TYPES = ['assignment', 'homework', 'reading', 'essay', 'exam', 'quiz', 'project', 'lab', 'study', 'other'];

const PALETTE = [
  '#d4a857', '#e08667', '#b8c9e0', '#8fb67c', '#c9a3d4',
  '#f0c274', '#7ab0c4', '#d68aa3', '#a8b87c', '#9cabbf',
];

/**
 * Extract unique subjects from a CLASSES calendar feed.
 * The feed is a recurring schedule of class meetings, e.g.
 *   "ENG10 - Mr. Smith - Room 204" repeating MTWRF
 * We dedupe by class name and return one subject per real class.
 *
 * @returns Array of {name, teacher, room, color}
 */
async function extractSubjects(apiKey, events) {
  if (!apiKey) throw new Error('Gemini API key not configured');
  if (events.length === 0) return [];

  // Take a representative sample — too many events overflow context
  // We dedupe by SUMMARY first to save tokens.
  const seen = new Map();
  for (const e of events) {
    const key = (e.summary || '').trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, e);
    }
  }
  const sample = Array.from(seen.values()).slice(0, 60);

  const eventList = sample.map((e, i) => {
    const lines = [`${i + 1}. SUMMARY: ${e.summary || '(no title)'}`];
    if (e.description) lines.push(`   DESC: ${truncate(e.description, 200)}`);
    if (e.location) lines.push(`   LOCATION: ${e.location}`);
    return lines.join('\n');
  }).join('\n\n');

  const prompt = `You are processing a student's class-schedule calendar feed. Each event represents a recurring class meeting.

Extract the unique CLASSES (not individual meetings). One class per real subject — if a class meets 5x/week, that's still ONE class.

For each class, output:
- name: A clean, human-friendly class name. Strip course codes if a friendly name is also present. Examples:
  - "ENG10 - Mr. Smith" → "English 10"
  - "ALG2-H Block A" → "Algebra II Honors"
  - "AP US History" → "AP US History"
  - "Period 4 Math" → "Math (Period 4)"
- teacher: Just the teacher's name if present (e.g. "Mr. Smith"), else null
- room: Room number/name if present (e.g. "204", "Lab B"), else null

Skip events that aren't classes: lunch, advisory, free period, study hall, assembly, chapel, breaks, holidays.

CALENDAR EVENTS:
${eventList}

Respond with ONLY a JSON array of class objects. No markdown, no commentary, no code fences. Begin with [ end with ].`;

  const result = await callGemini(apiKey, prompt);
  if (!Array.isArray(result)) throw new Error('Gemini returned non-array for class extraction');

  return result
    .filter(c => c && c.name)
    .map((c, i) => ({
      name: String(c.name).slice(0, 100),
      teacher: c.teacher ? String(c.teacher).slice(0, 100) : null,
      room: c.room ? String(c.room).slice(0, 50) : null,
      color: PALETTE[i % PALETTE.length],
    }));
}

/**
 * Transform raw assignment events into clean tasks, using the user's known
 * subjects to match each assignment to a class.
 */
async function transformAssignments(apiKey, events, subjects) {
  if (!apiKey) throw new Error('Gemini API key not configured');
  if (events.length === 0) return [];

  const subjectList = subjects.length > 0
    ? subjects.map(s => `  - ${s.name} (id: ${s.id})${s.teacher ? ` — taught by ${s.teacher}` : ''}`).join('\n')
    : '  (none — set subject_id to null)';

  const eventList = events.map((e, i) => {
    const lines = [`${i + 1}. SUMMARY: ${e.summary || '(no title)'}`];
    if (e.description) lines.push(`   DESCRIPTION: ${truncate(e.description, 400)}`);
    if (e.location) lines.push(`   LOCATION: ${e.location}`);
    if (e.categories) lines.push(`   CATEGORIES: ${e.categories}`);
    if (e.start) {
      lines.push(`   DATE: ${e.start.date}${e.start.time ? ' ' + e.start.time : ' (all day)'}`);
    }
    return lines.join('\n');
  }).join('\n\n');

  const prompt = `You are processing a student's ASSIGNMENT calendar feed and converting each event into a structured task.

CRITICAL: Class meetings are NOT assignments. If an event looks like a recurring class period (e.g. "English 10 Class", "Period 4", "Math Block A"), set skip:true.

For each event, output ONE object with these fields:
- title: A clean, concise task title. Strip class prefixes like "ENG10:" since that goes in subject_id. E.g. "Read Ch 4-5", "Polynomial Quiz", "Essay #2 — Final Draft"
- type: One of: ${TASK_TYPES.join(', ')}
  - "exam"/"quiz" for tests, midterms, finals, quizzes — IMPORTANT: detect these aggressively
  - "essay" for papers, reports, writing assignments
  - "project"/"lab" if labeled as such
  - "homework"/"reading" for daily HW or assigned readings
  - "study" for review or study sessions
  - "assignment" as a general fallback
- subject_id: integer ID from the user's classes below, or null if no confident match
  - Match by name, course code, or teacher (e.g. "ENG10:" matches "English 10", "Mr. Smith's class" matches by teacher)
  - Use null if you genuinely can't tell
- priority: "low" / "medium" / "high"
  - "high" for ALL exams/quizzes/tests/finals/midterms, papers/essays, projects with deadlines
  - "medium" for typical homework
  - "low" for optional readings, study suggestions, FYI items
- description: Brief context from the original (page numbers, requirements). Null if redundant with title.
- due_date: YYYY-MM-DD (use the event's date)
- due_time: HH:MM:SS or null if all-day
- skip: true ONLY if this is NOT an assignment (class meeting, lunch, schedule item)

USER'S CLASSES:
${subjectList}

EVENTS:
${eventList}

Respond with ONLY a JSON array, one object per event in the same order. No markdown, no commentary, no code fences. Begin with [ end with ].`;

  const result = await callGemini(apiKey, prompt);
  if (!Array.isArray(result)) throw new Error('Gemini returned non-array for assignments');

  return result
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
}

/**
 * Common Gemini call wrapper, returns parsed JSON.
 */
async function callGemini(apiKey, prompt) {
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

  try {
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    throw new Error('Could not parse Gemini response as JSON: ' + err.message);
  }
}

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

module.exports = { extractSubjects, transformAssignments, testApiKey };
