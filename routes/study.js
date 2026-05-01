const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth-middleware');
const { generateStudyGuide, chatStudyGuide } = require('../lib/gemini');
const { generateStudyGuideClaude, chatStudyGuideClaude } = require('../lib/anthropic');
const { limiters } = require('../lib/rate-limit');

const router = express.Router();
router.use(requireAuth);

async function getUserAIKeys(userId) {
  const r = await pool.query(
    'SELECT gemini_api_key, anthropic_api_key, preferred_ai FROM user_settings WHERE user_id = $1',
    [userId]
  );
  return {
    gemini: r.rows[0]?.gemini_api_key || null,
    claude: r.rows[0]?.anthropic_api_key || null,
    preferred: r.rows[0]?.preferred_ai || 'gemini',
  };
}

// GET /api/study/guides
router.get('/guides', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT g.id, g.title, g.subject_id, g.source_summary, g.created_at,
             s.name AS subject_name, s.color AS subject_color
      FROM study_guides g
      LEFT JOIN subjects s ON s.id = g.subject_id
      WHERE g.user_id = $1
      ORDER BY g.created_at DESC
    `, [req.userId]);
    res.json({ guides: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/study/guides/:id — full guide content + chat history
router.get('/guides/:id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT g.*, s.name AS subject_name, s.color AS subject_color
      FROM study_guides g
      LEFT JOIN subjects s ON s.id = g.subject_id
      WHERE g.id = $1 AND g.user_id = $2
    `, [req.params.id, req.userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const chatR = await pool.query(`
      SELECT id, role, content, created_at
      FROM study_chat_messages
      WHERE guide_id = $1 AND user_id = $2
      ORDER BY created_at ASC
    `, [req.params.id, req.userId]);
    res.json({ guide: r.rows[0], chat: chatR.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/study/guides/:id
router.delete('/guides/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM study_guides WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/study/generate
router.post('/generate', limiters.aiGenerate, async (req, res) => {
  const { title, subject_id, textContent, images, pdfs, ai_provider } = req.body || {};
  if (!textContent && (!images || images.length === 0) && (!pdfs || pdfs.length === 0)) {
    return res.status(400).json({ error: 'Provide some material — text, images, or PDF' });
  }

  const keys = await getUserAIKeys(req.userId);
  const provider = ai_provider || keys.preferred || 'gemini';

  let apiKey, generatorFn;
  if (provider === 'claude') {
    apiKey = keys.claude;
    if (!apiKey) return res.status(400).json({ error: 'Connect a Claude API key in Settings first.' });
    generatorFn = generateStudyGuideClaude;
  } else {
    apiKey = keys.gemini;
    if (!apiKey) return res.status(400).json({ error: 'Connect a Gemini API key in Settings or Import first.' });
    generatorFn = generateStudyGuide;
  }

  let subjectName = null;
  if (subject_id) {
    const sR = await pool.query('SELECT name FROM subjects WHERE id = $1 AND user_id = $2', [subject_id, req.userId]);
    if (sR.rows.length > 0) subjectName = sR.rows[0].name;
  }

  try {
    const result = await generatorFn(apiKey, {
      textContent, images: images || [], pdfs: pdfs || [],
    }, { title, subjectName });

    const srcParts = [];
    if (textContent) srcParts.push('Pasted text');
    if (images && images.length > 0) srcParts.push(`${images.length} image${images.length === 1 ? '' : 's'}`);
    if (pdfs && pdfs.length > 0) srcParts.push(`${pdfs.length} PDF${pdfs.length === 1 ? '' : 's'}`);
    const sourceSummary = `From ${srcParts.join(' + ')} (via ${provider === 'claude' ? 'Claude' : 'Gemini'})`;

    const ins = await pool.query(`
      INSERT INTO study_guides (user_id, subject_id, title, source_summary, content_md, flashcards, practice_questions, key_concepts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [
      req.userId, subject_id || null, result.title, sourceSummary,
      result.content_md,
      JSON.stringify(result.flashcards),
      JSON.stringify(result.practice_questions),
      JSON.stringify(result.key_concepts),
    ]);
    res.json({ guide: ins.rows[0] });
  } catch (err) {
    console.error('Study generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/study/guides/:id/chat
router.post('/guides/:id/chat', limiters.aiChat, async (req, res) => {
  const { message, ai_provider } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message required' });
  }
  const trimmed = message.trim().slice(0, 4000);

  const gR = await pool.query(
    'SELECT * FROM study_guides WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (gR.rows.length === 0) return res.status(404).json({ error: 'Guide not found' });
  const guide = gR.rows[0];

  const histR = await pool.query(
    'SELECT role, content FROM study_chat_messages WHERE guide_id = $1 AND user_id = $2 ORDER BY created_at ASC',
    [req.params.id, req.userId]
  );

  const keys = await getUserAIKeys(req.userId);
  const provider = ai_provider || keys.preferred || 'gemini';
  let apiKey, chatFn;
  if (provider === 'claude') {
    apiKey = keys.claude;
    if (!apiKey) return res.status(400).json({ error: 'Connect a Claude API key first.' });
    chatFn = chatStudyGuideClaude;
  } else {
    apiKey = keys.gemini;
    if (!apiKey) return res.status(400).json({ error: 'Connect a Gemini API key first.' });
    chatFn = chatStudyGuide;
  }

  try {
    await pool.query(
      'INSERT INTO study_chat_messages (user_id, guide_id, role, content) VALUES ($1, $2, $3, $4)',
      [req.userId, req.params.id, 'user', trimmed]
    );
    const reply = await chatFn(apiKey, guide, histR.rows, trimmed);
    const insR = await pool.query(
      'INSERT INTO study_chat_messages (user_id, guide_id, role, content) VALUES ($1, $2, $3, $4) RETURNING id, content, created_at',
      [req.userId, req.params.id, 'assistant', reply]
    );
    res.json({ reply, message_id: insR.rows[0].id });
  } catch (err) {
    console.error('Study chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/study/guides/:id/chat — clear chat history
router.delete('/guides/:id/chat', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM study_chat_messages WHERE guide_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
