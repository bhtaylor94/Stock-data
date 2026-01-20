import type { AlertEvent, AlertsConfig } from './alertsStore';

export async function sendWebhookIfConfigured(cfg: AlertsConfig, ev: AlertEvent): Promise<void> {
  const url = String(cfg?.webhookUrl || '').trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: ev }),
    });
  } catch {
    // best-effort; never throw
  }
}
