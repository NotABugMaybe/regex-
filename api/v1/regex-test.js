import { json, method, requireApiKey, parsePattern, readBody } from '../../lib/api-utils.js';
export default function handler(req, res) {
  if (!method(req, res, 'POST') || !requireApiKey(req, res)) return;
  try {
    const { pattern, flags = 'g', text = '' } = readBody(req);
    if (typeof text !== 'string' || text.length > 100000) return json(res, 400, { error: 'invalid_text', message: 'Text must be a string up to 100,000 characters.' });
    const regex = parsePattern(pattern, flags);
    const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))].slice(0, 1000).map(m => ({ match: m[0], index: m.index, groups: m.groups || null }));
    return json(res, 200, { success: true, data: { count: matches.length, matches } });
  } catch (error) { return json(res, 400, { error: 'invalid_regex', message: error.message }); }
}
