import { json, method, requireApiKey, generateWithGemini, readBody } from '../../lib/api-utils.js';
export default async function handler(req, res) {
  if (!method(req, res, 'POST') || !requireApiKey(req, res)) return;
  try {
    const body = readBody(req);
    let target = null;
    if (body.webhookUrl) {
      try { target = new URL(body.webhookUrl); } catch { return json(res, 400, { error: 'invalid_webhook_url', message: 'webhookUrl must be a valid HTTPS URL.' }); }
      const hostname = target.hostname.toLowerCase();
      if (target.protocol !== 'https:' || target.username || target.password || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1' || hostname === '127.0.0.1' || hostname.startsWith('127.')) return json(res, 400, { error: 'invalid_webhook_url', message: 'webhookUrl must be a public HTTPS URL without credentials.' });
    }
    const data = await generateWithGemini(body.description);
    const event = { id: crypto.randomUUID(), type: 'regex.generated', createdAt: new Date().toISOString(), data };
    if (body.webhookUrl) {
      const delivery = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Regex-Studio-Event': event.type }, body: JSON.stringify(event), signal: AbortSignal.timeout(5000) }).then(r => ({ delivered: r.ok, status: r.status })).catch(() => ({ delivered: false, status: null }));
      return json(res, 200, { success: true, data, webhook: delivery });
    }
    return json(res, 200, { success: true, data, webhook: { delivered: false, reason: 'No webhookUrl supplied.' } });
  } catch (error) { return json(res, error.status || 502, { error: error.code || 'generation_failed', message: error.message }); }
}
