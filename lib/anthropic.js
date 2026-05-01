// ==========================================================
// Anthropic Claude API client
// Used for study guide generation and chat-based follow-up Q&A.
// ==========================================================

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6'; // daily driver, $3/$15 per M tokens, handles PDFs/images natively

function buildAuthHeaders(apiKey) {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
}

// Build a Claude messages array from study materials
function buildStudyMaterialsMessage(materials) {
  const content = [];

  if (materials.textContent) {
    content.push({
      type: 'text',
      text: 'STUDY MATERIAL (pasted text):\n\n' + materials.textContent.slice(0, 50000),
    });
  }

  if (materials.images && materials.images.length > 0) {
    for (const img of materials.images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType || 'image/jpeg',
          data: img.data,
        },
      });
    }
  }

  if (materials.pdfs && materials.pdfs.length > 0) {
    for (const pdf of materials.pdfs) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdf.data,
        },
      });
    }
  }

  if (content.length === 0) {
    content.push({ type: 'text', text: 'No materials provided.' });
  }

  return content;
}

// Generate a structured study guide from materials
async function generateStudyGuideClaude(apiKey, materials, options = {}) {
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const subject = options.subjectName ? ` for ${options.subjectName}` : '';
  const titleHint = options.title ? ` titled "${options.title}"` : '';

  const systemPrompt = `You are a friendly, expert tutor helping a student build a study guide${subject}${titleHint}.

Read all the provided materials carefully. Then produce a structured JSON object with these fields:

{
  "title": "concise, descriptive title for this study guide",
  "summary": "2-3 sentence overview of what this material covers",
  "key_concepts": ["array of 5-12 key terms or concepts students must know"],
  "content_md": "the full study guide as markdown — use ## headings, bullet points, bold for emphasis. Make it thorough, well-organized, easy to skim. Include definitions, examples, key relationships, formulas/dates. Do NOT wrap in code fences.",
  "flashcards": [
    {"q": "question or term", "a": "answer or definition"}
    // ...8-15 flashcards covering the most important things to memorize
  ],
  "practice_questions": [
    {"q": "practice question", "a": "answer with brief explanation", "type": "short_answer" | "multiple_choice" | "essay"}
    // ...4-8 practice questions of varying difficulty
  ]
}

Guidelines:
- Be accurate. Don't invent information not present in the material.
- If material is sparse, say so in the summary and produce a smaller guide rather than padding.
- Use plain language a student can actually learn from.
- Bold key terms in content_md.
- For practice_questions, mix levels: some recall, some application.

Respond with ONLY the JSON object. No markdown code fences, no commentary before or after.`;

  const messageContent = buildStudyMaterialsMessage(materials);

  const body = {
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: messageContent }],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Claude API error (${res.status})`;
    try {
      const errJson = JSON.parse(text);
      if (errJson.error && errJson.error.message) errMsg += ': ' + errJson.error.message;
    } catch {
      errMsg += ': ' + text.slice(0, 200);
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  // Claude responses come as content blocks; we want the first text block
  const text = (data.content || []).find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Empty response from Claude');

  let parsed;
  try {
    // Strip any code fences just in case the model added them
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error('Could not parse Claude study guide response: ' + err.message);
  }

  return {
    title: String(parsed.title || options.title || 'Study Guide').slice(0, 250),
    summary: parsed.summary ? String(parsed.summary).slice(0, 1000) : null,
    key_concepts: Array.isArray(parsed.key_concepts)
      ? parsed.key_concepts.slice(0, 20).map(s => String(s).slice(0, 200)) : [],
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

// Chat with Claude about an existing study guide
// Sends: the guide context + full conversation history + new user message
async function chatStudyGuideClaude(apiKey, guide, history, userMessage) {
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const systemPrompt = `You are a patient, encouraging tutor helping a student understand the material in a study guide titled "${guide.title}".

The study guide covers:
${guide.content_md ? guide.content_md.slice(0, 8000) : '(no content yet)'}

Key concepts: ${(Array.isArray(guide.key_concepts) ? guide.key_concepts : []).join(', ')}

Answer the student's questions about this material clearly and accurately. If they ask about something not in the material, say so honestly and offer your best general explanation. Keep responses focused and direct. Use markdown formatting (**bold**, lists, etc.) when helpful.`;

  const messages = [];
  for (const msg of history.slice(-20)) { // last 20 turns
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    });
  }
  messages.push({ role: 'user', content: userMessage });

  const body = {
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Claude API error (${res.status})`;
    try {
      const errJson = JSON.parse(text);
      if (errJson.error?.message) errMsg += ': ' + errJson.error.message;
    } catch { errMsg += ': ' + text.slice(0, 200); }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const reply = (data.content || []).find(b => b.type === 'text')?.text;
  if (!reply) throw new Error('Empty response from Claude');
  return reply.trim();
}

async function testClaudeKey(apiKey) {
  if (!apiKey) throw new Error('No API key provided');
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Invalid Claude key (${res.status})`;
    try {
      const j = JSON.parse(text);
      if (j.error?.message) msg = j.error.message;
    } catch {}
    throw new Error(msg);
  }
  return true;
}

module.exports = { generateStudyGuideClaude, chatStudyGuideClaude, testClaudeKey };
