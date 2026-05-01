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

/**
 * Generate a study guide from uploaded materials.
 * @param {string} apiKey
 * @param {Object} materials - { textContent, images: [base64], pdfData: base64 }
 * @param {Object} options - { title, subjectName }
 */
async function generateStudyGuide(apiKey, materials, options = {}) {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const parts = [];

  // System-style prompt
  const subject = options.subjectName ? ` for ${options.subjectName}` : '';
  const titleHint = options.title ? ` titled "${options.title}"` : '';
  parts.push({
    text: `You are a friendly, expert tutor helping a student build a study guide${subject}${titleHint}.

Read all the provided materials carefully. Then produce a structured JSON object with these fields:

{
  "title": "concise, descriptive title for this study guide",
  "summary": "2-3 sentence overview of what this material covers",
  "key_concepts": ["array of 5-12 key terms or concepts students must know"],
  "content_md": "the full study guide as markdown — use ## headings, bullet points, bold for emphasis. This is the heart of the study guide; make it thorough, well-organized, easy to skim, and useful for studying. Include definitions, examples, key relationships, and any formulas/dates/etc. Do NOT include code fences around the content; just write the markdown body.",
  "flashcards": [
    {"q": "question or term", "a": "answer or definition"},
    ... 8-15 flashcards covering the most important things to memorize
  ],
  "practice_questions": [
    {"q": "practice question", "a": "answer with brief explanation", "type": "short_answer" | "multiple_choice" | "essay"},
    ... 4-8 practice questions of varying difficulty
  ]
}

Guidelines:
- Be accurate. Don't invent information not present in the material.
- If material is sparse, say so in the summary and produce a smaller guide rather than padding with fluff.
- Use plain language a student can actually learn from.
- Bold key terms in the content_md.
- For practice_questions, mix levels: some recall, some application.

Respond with ONLY the JSON object. No markdown code fences, no commentary.`
  });

  // Add the user's materials
  if (materials.textContent) {
    parts.push({ text: '\n\nUSER PROVIDED TEXT:\n' + materials.textContent.slice(0, 30000) });
  }

  if (materials.images && materials.images.length > 0) {
    for (const img of materials.images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.data, // base64 string (no data URL prefix)
        }
      });
    }
  }

  if (materials.pdfs && materials.pdfs.length > 0) {
    for (const pdf of materials.pdfs) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdf.data,
        }
      });
    }
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
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
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error('Could not parse study guide response: ' + err.message);
  }

  // Validate + sanitize
  return {
    title: String(parsed.title || options.title || 'Study Guide').slice(0, 250),
    summary: parsed.summary ? String(parsed.summary).slice(0, 1000) : null,
    key_concepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts.slice(0, 20).map(s => String(s).slice(0, 200)) : [],
    content_md: parsed.content_md ? String(parsed.content_md).slice(0, 30000) : '',
    flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards.slice(0, 30).map(c => ({
      q: String(c.q || '').slice(0, 500),
      a: String(c.a || '').slice(0, 1000),
    })) : [],
    practice_questions: Array.isArray(parsed.practice_questions) ? parsed.practice_questions.slice(0, 20).map(q => ({
      q: String(q.q || '').slice(0, 500),
      a: String(q.a || '').slice(0, 1500),
      type: ['short_answer', 'multiple_choice', 'essay'].includes(q.type) ? q.type : 'short_answer',
    })) : [],
  };
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

// Chat with Gemini about an existing study guide
async function chatStudyGuide(apiKey, guide, history, userMessage) {
  if (!apiKey) throw new Error('Gemini API key not configured');

  const systemContext = `You are a patient, encouraging tutor helping a student understand the material in a study guide titled "${guide.title}".

The study guide covers:
${guide.content_md ? String(guide.content_md).slice(0, 8000) : '(no content yet)'}

Key concepts: ${(Array.isArray(guide.key_concepts) ? guide.key_concepts : []).join(', ')}

Answer questions about this material clearly and accurately. If asked about something not in the material, say so honestly and offer your best explanation. Use markdown formatting when helpful.`;

  // Gemini's chat format — alternate user/model turns
  const contents = [
    { role: 'user', parts: [{ text: systemContext }] },
    { role: 'model', parts: [{ text: 'Got it — ready to help with questions about this guide.' }] },
  ];
  for (const msg of history.slice(-20)) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Gemini error (${res.status})`;
    try {
      const j = JSON.parse(text);
      if (j.error?.message) msg = j.error.message;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Empty response from Gemini');
  return reply.trim();
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

module.exports = { extractSubjects, transformAssignments, generateStudyGuide, chatStudyGuide, testApiKey };
