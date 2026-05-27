const { Resend } = require('resend');
const { kv } = require('@vercel/kv');

const FROM = 'Dubai Meridian Forum <info@dubaimeridian.com>';
const REPLY_TO = 'info@dubaimeridian.com';
const KV_KEY = 'dmf:registration_counter';

const EMAIL_TEMPLATE = `Dear {{name}},

Welcome to the Dubai Meridian Forum. Your registration is confirmed — you are Delegate {{registration_number}} of a limited cohort competing this August in Dubai.

DMF 2026 is a four-day international competitive forum bringing together students and emerging professionals across four disciplines — Law, Finance, Engineering, and Management. Delegates compete across track-specific challenges and a final interdisciplinary contest, with a prize package of approximately $35,000 in project funding, fifty internship placements, ten B2B sponsorship opportunities, and access to a curated network of industry leaders, judges, and investors.

The event:
August 2–5, 2026
Mövenpick Jumeirah Beach Hotel, Dubai

In the coming weeks, you'll be among the first to hear about confirmed speakers, partner organizations, judges, the interdisciplinary challenge, track selection, expanded rewards, and pricing for the pass tiers. Announcements roll out to registered delegates ahead of any public release.

For any questions, reply directly to this email.

Welcome aboard.

Warmly,

Parth Menon
Chief Operating Officer
Dubai Meridian Forum 2026

dubaimeridian.com
instagram.com/dubaimeridian
linkedin.com/company/dubaimeridian`;

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function titleCaseFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const sanitizedName = escapeHtml(name.trim());
  const firstName = titleCaseFirst(sanitizedName.split(/\s+/)[0]);

  let registration_number;
  try {
    const counter = await kv.incr(KV_KEY);
    registration_number = `DMF-2026-${counter.toString().padStart(3, '0')}`;
  } catch (kvErr) {
    console.error('KV INCR failed:', kvErr);
    registration_number = `DMF-2026-T${String(Date.now()).slice(-4)}`;
  }

  const emailBody = EMAIL_TEMPLATE
    .replace('{{name}}', firstName)
    .replace('{{registration_number}}', registration_number);

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: email.trim(),
      subject: `You're registered — Dubai Meridian Forum 2026 · Delegate ${registration_number}`,
      text: emailBody,
      replyTo: REPLY_TO,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return res.status(500).json({ error: 'Failed to send confirmation' });
    }

    return res.status(200).json({ success: true, registration_number });
  } catch (err) {
    console.error('Send exception:', err.message);
    return res.status(500).json({ error: 'Failed to send confirmation' });
  }
};
