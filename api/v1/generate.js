import { json, method, requireApiKey, generateWithGemini, readBody } from '../../lib/api-utils.js';
export default async function handler(req, res) {
  if (!method(req, res, 'POST') || !requireApiKey(req, res)) return;
  try { return json(res, 200, { success: true, data: await generateWithGemini(readBody(req).description) }); }
  catch (error) { return json(res, error.status || 502, { error: error.code || 'generation_failed', message: error.message }); }
}
