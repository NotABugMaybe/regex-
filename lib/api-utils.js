import { createHash, timingSafeEqual } from 'node:crypto';
export function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res.status(status).json(body);
}

export function method(req, res, expected) {
  res.setHeader('Allow', `${expected}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', `${expected}, OPTIONS`);
  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
  if (req.method !== expected) {
    json(res, 405, { error: 'method_not_allowed', message: `Use ${expected}.` });
    return false;
  }
  return true;
}


const publicRequests = new Map();
export function publicGenerationAllowed(req, res) {
  const now = Date.now();
  const ip = String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const current = publicRequests.get(ip);
  if (current && current.until > now && current.count >= 12) {
    res.setHeader('Retry-After', String(Math.ceil((current.until - now) / 1000)));
    json(res, 429, { error: 'rate_limited', message: 'Too many generation requests. Please wait a minute and try again.' });
    return false;
  }
  if (!current || current.until <= now) publicRequests.set(ip, { count: 1, until: now + 60_000 });
  else current.count++;
  if (publicRequests.size > 1000) {
    for (const [key, value] of publicRequests) if (value.until <= now) publicRequests.delete(key);
    if (publicRequests.size > 1000) publicRequests.delete(publicRequests.keys().next().value);
  }
  return true;
}

export function requireApiKey(req, res) {
  const configured = process.env.APP_API_KEY;
  if (!configured) {
    json(res, 503, { error: 'service_not_configured', message: 'APP_API_KEY is not configured.' });
    return false;
  }
  const provided = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!provided || provided.length !== configured.length || !apiKeyMatches(provided, configured)) {
    json(res, 401, { error: 'unauthorized', message: 'Provide a valid Bearer API key.' });
    return false;
  }
  return true;
}

function apiKeyMatches(a, b) {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

export function parsePattern(pattern, flags = '') {
  if (typeof pattern !== 'string' || pattern.length > 500) throw new Error('Pattern must be a string of 500 characters or fewer.');
  if (typeof flags !== 'string' || !/^(?!.*(.).*\1)[dgimsuvy]*$/.test(flags) || (flags.includes('u') && flags.includes('v'))) {
    throw new Error('Use valid JavaScript regex flags (d, g, i, m, s, u, v, y).');
  }
  return new RegExp(pattern, flags);
}

export async function generateWithGemini(description) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('Set GEMINI_API_KEY in your deployment environment.'), { status: 503, code: 'ai_not_configured' });
  if (typeof description !== 'string' || !description.trim() || description.length > 1000) {
    throw Object.assign(new Error('Describe the text you want to match (1–1000 characters).'), { status: 400, code: 'invalid_description' });
  }
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Create JavaScript regular expressions. Return only a JSON object with keys pattern, flags, explanation, examples. pattern is the regex source without slashes; flags is a valid JavaScript flags string; explanation is one concise sentence; examples is an array of 2 matching strings. Never wrap output in markdown.' }] },
      contents: [{ parts: [{ text: description.trim() }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    })
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'Gemini request failed.'), { status: response.status === 429 ? 429 : 502, code: 'ai_provider_error' });
  let result;
  try { result = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || ''); }
  catch { throw Object.assign(new Error('Gemini returned an unreadable pattern. Try a more specific description.'), { status: 502, code: 'invalid_ai_response' }); }
  try { parsePattern(result.pattern, result.flags || 'g'); }
  catch { throw Object.assign(new Error('Gemini returned an invalid JavaScript regex. Try again.'), { status: 502, code: 'invalid_ai_response' }); }
  return { pattern: result.pattern, flags: result.flags || 'g', explanation: String(result.explanation || ''), examples: Array.isArray(result.examples) ? result.examples.slice(0, 5) : [] };
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}
