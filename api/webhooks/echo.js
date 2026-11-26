import { json, method } from '../../lib/api-utils.js';
export default function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const event = req.body && typeof req.body === 'object' ? req.body : {};
  return json(res, 202, { received: true, event, receivedAt: new Date().toISOString() });
}
