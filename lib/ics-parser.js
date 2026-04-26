// Minimal ICS (iCalendar) parser
// Handles VEVENT blocks, line continuations (RFC 5545 folding), escaped chars,
// DTSTART/DTEND with TZID or UTC, all-day events, SUMMARY, DESCRIPTION, UID.

function unfold(raw) {
  // ICS lines that start with a space or tab are continuations of the previous line
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function unescape(str) {
  if (!str) return '';
  return str
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseDate(value, params) {
  // VALUE=DATE means all-day (YYYYMMDD)
  // Otherwise it's a datetime YYYYMMDDTHHMMSS, possibly with Z suffix for UTC
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { date: `${y}-${m}-${d}`, time: null, allDay: true };
  }
  // Datetime: 20251015T140000 or 20251015T140000Z
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/);
  if (match) {
    const [, y, mo, d, h, mi, s, z] = match;
    if (z === 'Z') {
      // UTC — convert to local date/time
      const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
      return {
        date: dt.toISOString().slice(0, 10),
        time: dt.toTimeString().slice(0, 8),
        allDay: false,
        utc: dt.toISOString()
      };
    }
    return {
      date: `${y}-${mo}-${d}`,
      time: `${h}:${mi}:${s}`,
      allDay: false
    };
  }
  return null;
}

function parseICS(text) {
  const events = [];
  const unfolded = unfold(text);
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = { params: {} };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.uid) events.push(current);
      inEvent = false;
      current = null;
      continue;
    }
    if (!inEvent || !current) continue;

    // Property:value, or PROPERTY;PARAM=X;PARAM=Y:value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const head = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    const headParts = head.split(';');
    const propName = headParts[0].toUpperCase();
    const params = {};
    for (let i = 1; i < headParts.length; i++) {
      const [pk, pv] = headParts[i].split('=');
      if (pk && pv) params[pk.toUpperCase()] = pv;
    }

    switch (propName) {
      case 'UID':
        current.uid = value.trim();
        break;
      case 'SUMMARY':
        current.summary = unescape(value);
        break;
      case 'DESCRIPTION':
        current.description = unescape(value);
        break;
      case 'LOCATION':
        current.location = unescape(value);
        break;
      case 'CATEGORIES':
        current.categories = unescape(value);
        break;
      case 'DTSTART': {
        const parsed = parseDate(value, params);
        if (parsed) current.start = parsed;
        break;
      }
      case 'DTEND': {
        const parsed = parseDate(value, params);
        if (parsed) current.end = parsed;
        break;
      }
      case 'STATUS':
        current.status = value.trim();
        break;
      case 'URL':
        current.url = value.trim();
        break;
    }
  }

  return events;
}

module.exports = { parseICS };
