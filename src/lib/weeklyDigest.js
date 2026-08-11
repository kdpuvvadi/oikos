import { OIKOS_LOGO_DATA_URI } from './emailLogo.js';
import { normalizeDigestLogoMode } from './digestLogoMode.js';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isoDateUTC(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Previous completed Mon–Sun week in UTC. */
export function previousWeekRange(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = today.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(today.getUTCDate() - daysSinceMonday);

  const weekStart = new Date(thisMonday);
  weekStart.setUTCDate(thisMonday.getUTCDate() - 7);
  const weekEndExclusive = new Date(thisMonday);

  return {
    fromIso: isoDateUTC(weekStart),
    toExclusiveIso: isoDateUTC(weekEndExclusive),
    toInclusiveIso: isoDateUTC(new Date(weekEndExclusive.getTime() - 24 * 60 * 60 * 1000))
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInr(amount) {
  const n = Number(amount);
  const num = Number.isFinite(n) ? n : 0;
  const negative = num < 0;
  const fixed = Math.abs(num).toFixed(2);
  const parts = fixed.split('.');
  let intPart = parts[0];

  // Indian grouping (last 3, then pairs of 2) without zero-width regex replaces.
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const restDigits = intPart.slice(0, -3);
    let rest = '';
    for (let i = 0; i < restDigits.length; i += 1) {
      const fromEnd = restDigits.length - i;
      if (i > 0 && fromEnd % 2 === 0) rest += ',';
      rest += restDigits.charAt(i);
    }
    intPart = `${rest},${last3}`;
  }

  return `${negative ? '-₹' : '₹'}${intPart}.${parts[1]}`;
}

function displayName(user) {
  const first = String(user?.firstName || '').trim();
  const last = String(user?.lastName || '').trim();
  const name = [first, last].filter(Boolean).join(' ');
  return name || String(user?.name || '').trim() || 'there';
}

function summarizeTransactions(transactions) {
  let total = 0;
  const byCategory = {};

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    total += amount;
    const categoryName = String(tx.expand?.category?.name || 'Uncategorized').trim() || 'Uncategorized';
    byCategory[categoryName] = (byCategory[categoryName] || 0) + amount;
  }

  const categoryRows = Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return { total, count: transactions.length, categoryRows };
}

function logoHeaderHtml(appUrl = '', logoMode = 'embed') {
  const mode = normalizeDigestLogoMode(logoMode);
  const base = String(appUrl || '').replace(/\/$/, '');
  const linkedSrc = base ? `${base}/img/apple-touch-icon.png` : '';
  const logoSrc = mode === 'link' && linkedSrc ? linkedSrc : OIKOS_LOGO_DATA_URI;

  if (mode === 'link' && linkedSrc) {
    return `<div style="margin:0 0 20px;">
  <a href="${escapeHtml(base)}" style="text-decoration:none;">
    <img src="${escapeHtml(logoSrc)}" width="48" height="48" alt="Oikos" style="display:block;border:0;border-radius:10px;outline:none;">
  </a>
  <p style="margin:10px 0 0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#0f766e;">Oikos</p>
</div>`;
  }

  return `<div style="margin:0 0 20px;">
  <img src="${logoSrc}" width="48" height="48" alt="Oikos" style="display:block;border:0;border-radius:10px;outline:none;">
  <p style="margin:10px 0 0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#0f766e;">Oikos</p>
</div>`;
}

export function buildWeeklyDigestEmailHtml(user, range, summary, appUrl = '', logoMode = 'embed') {
  const greeting = escapeHtml(displayName(user));
  const rows = summary.categoryRows.map((row) => (
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e8e8e8;">${escapeHtml(row.name)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e8e8e8;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatInr(row.amount))}</td>
    </tr>`
  )).join('');

  const base = String(appUrl || '').replace(/\/$/, '');
  const dashboardLink = base
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(base)}/dashboard" style="color:#0f766e;font-weight:600;">Open dashboard</a></p>`
    : '';
  const prefsLink = base
    ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Manage this email in <a href="${escapeHtml(base)}/me" style="color:#6b7280;">Me → Weekly digest</a>.</p>`
    : '<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Turn this off anytime from Me → Weekly digest in Oikos.</p>';

  return `
<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:8px;">
  ${logoHeaderHtml(base, logoMode)}
  <p>Hi ${greeting},</p>
  <p>Here is your Oikos spending summary for <strong>${escapeHtml(range.fromIso)}</strong> to <strong>${escapeHtml(range.toInclusiveIso)}</strong>.</p>
  <div style="margin:20px 0;padding:16px 18px;background:#f0fdfa;border-radius:12px;">
    <p style="margin:0;font-size:13px;color:#0f766e;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Total spent</p>
    <p style="margin:4px 0 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(formatInr(summary.total))}</p>
    <p style="margin:6px 0 0;font-size:13px;color:#4b5563;">${summary.count} expense${summary.count === 1 ? '' : 's'}</p>
  </div>
  ${summary.categoryRows.length
    ? `<p style="margin:0 0 8px;font-weight:600;">By category</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`
    : '<p style="margin:0;color:#6b7280;font-size:14px;">No expenses recorded for this week.</p>'}
  ${dashboardLink}
  ${prefsLink}
</div>`.trim();
}

export function buildWeeklyDigestPreview({
  user,
  transactions = [],
  appUrl = typeof window !== 'undefined' ? window.location.origin : '',
  logoMode = 'embed'
}) {
  const range = previousWeekRange();
  const summary = summarizeTransactions(transactions);
  const mode = normalizeDigestLogoMode(logoMode);
  return {
    userId: user?.id || '',
    email: String(user?.email || '').trim(),
    name: displayName(user),
    optedOut: user?.weeklyDigest === false,
    verified: user?.verified === true,
    logoMode: mode,
    range,
    summary,
    empty: transactions.length === 0,
    subject: `Your weekly Oikos summary · ${formatInr(summary.total)}`,
    html: buildWeeklyDigestEmailHtml(user, range, summary, appUrl, mode)
  };
}
