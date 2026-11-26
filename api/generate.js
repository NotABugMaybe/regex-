import { json, method, generateWithGemini, publicGenerationAllowed } from '../lib/api-utils.js';
export default async function handler(req, res) {
  if (!method(req, res, 'POST') || !publicGenerationAllowed(req, res)) return;
  try {
    const result = await generateWithGemini(req.body?.description);
    return json(res, 200, { success: true, data: result });
  } catch (error) {
    return json(res, error.status || 502, { error: error.code || 'generation_failed', message: error.message });
  }
}
