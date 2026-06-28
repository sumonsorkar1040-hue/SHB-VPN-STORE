/**
 * ══════════════════════════════════════════════════════════
 *  Cloudflare Worker — Telegram Login Hash Verifier
 *  Elite VPN Store
 * ══════════════════════════════════════════════════════════
 *
 *  Deploy ধাপ:
 *  1. dash.cloudflare.com → Workers & Pages → Create Worker
 *  2. এই কোড paste করো → Save and Deploy
 *  3. Settings → Variables → Add variable:
 *       Name : BOT_TOKEN
 *       Value: 8843007866:AAGIEL4WrqNgcITL7u2ualw1f0uorr7eIo4
 *       (Encrypt: YES চেক করো)
 *  4. Worker URL কপি করো → index.html এ WORKER_URL বসাও
 * ══════════════════════════════════════════════════════════
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/verify') {
      try {
        const data = await request.json();
        const { hash, ...userData } = data;

        if (!hash || !userData.id || !userData.auth_date) {
          return Response.json({ ok: false, error: 'Missing required fields' }, { headers: corsHeaders });
        }

        // auth_date 1 দিনের বেশি পুরনো হলে reject
        const authDate = parseInt(userData.auth_date);
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > 86400) {
          return Response.json({ ok: false, error: 'Auth data expired' }, { headers: corsHeaders });
        }

        // data-check-string তৈরি: sorted key=value, \n দিয়ে join
        const checkString = Object.keys(userData)
          .filter(k => userData[k] !== undefined && userData[k] !== null && userData[k] !== '')
          .sort()
          .map(k => `${k}=${userData[k]}`)
          .join('\n');

        // BOT_TOKEN env variable থেকে নাও
        // BOT_TOKEN set করো Cloudflare Worker → Settings → Variables
        // Value: 8843007866:AAGIEL4WrqNgcITL7u2ualw1f0uorr7eIo4
        const botToken = env.BOT_TOKEN;
        if (!botToken) {
          return Response.json({ ok: false, error: 'BOT_TOKEN not configured in Worker env' }, { headers: corsHeaders });
        }

        // HMAC-SHA256: key=SHA256(BOT_TOKEN), message=checkString
        const encoder = new TextEncoder();
        const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));
        const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(checkString));
        const computedHash = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (computedHash !== hash) {
          return Response.json({ ok: false, error: 'Invalid hash' }, { headers: corsHeaders });
        }

        // ✅ Verified
        return Response.json({
          ok: true,
          user: {
            id: String(userData.id),
            name: userData.first_name + (userData.last_name ? ' ' + userData.last_name : ''),
            username: userData.username || null,
            photo: userData.photo_url || null,
          }
        }, { headers: corsHeaders });

      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500, headers: corsHeaders });
      }
    }

    return new Response('Elite VPN — Telegram Verifier ✅', { headers: corsHeaders });
  }
};
