/// <reference path="../pb_data/types/types.d.ts" />

/**
 * Weekly expense digests for verified users (approved or admin) who have not opted out.
 * Default: Mondays at 08:00 UTC for the previous Mon–Sun (UTC). Digests are on by default.
 * Override with WEEKLY_DIGEST_CRON (5-field cron expression).
 *
 * Admin routes (auth users collection, kind=admin):
 *   GET  /api/oikos/weekly-digest/{userId}  — preview HTML + summary
 *   POST /api/oikos/weekly-digest/{userId}  — send email ({ force?: bool })
 */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isoDateUTC(date) {
  return date.getUTCFullYear() + "-" + pad2(date.getUTCMonth() + 1) + "-" + pad2(date.getUTCDate());
}

function pbDayStart(isoDate) {
  return String(isoDate).slice(0, 10) + " 00:00:00.000Z";
}

/** Previous completed Mon–Sun week in UTC, relative to `now`. */
function previousWeekRange(now) {
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
    toInclusiveIso: isoDateUTC(new Date(weekEndExclusive.getTime() - 24 * 60 * 60 * 1000)),
  };
}

function formatInr(amount) {
  const n = Number(amount) || 0;
  try {
    return "₹" + n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return "₹" + n.toFixed(2);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayName(user) {
  const first = String(user.getString("firstName") || "").trim();
  const last = String(user.getString("lastName") || "").trim();
  const name = [first, last].filter(Boolean).join(" ");
  if (name) return name;
  const fallback = String(user.getString("name") || "").trim();
  return fallback || "there";
}

function appPublicUrl() {
  const settings = $app.settings();
  return String($os.getenv("APP_PUBLIC_URL") || settings.meta.appURL || "").replace(/\/$/, "");
}

function loadUserTransactions(userId, fromIso, toExclusiveIso) {
  const from = pbDayStart(fromIso);
  const to = pbDayStart(toExclusiveIso);
  const batchSize = 200;
  let offset = 0;
  const all = [];

  for (;;) {
    const batch = $app.findRecordsByFilter(
      "oikos_transactions",
      "user = {:userId} && date >= {:from} && date < {:to}",
      "-date",
      batchSize,
      offset,
      { userId: userId, from: from, to: to }
    );
    if (!batch || !batch.length) break;
    all.push(...batch);
    if (batch.length < batchSize) break;
    offset += batch.length;
  }

  if (all.length) {
    try {
      $app.expandRecords(all, ["category"]);
    } catch (error) {
      // Category names are optional in the email body.
    }
  }

  return all;
}

function summarize(transactions) {
  let total = 0;
  const byCategory = {};

  for (const tx of transactions) {
    const amount = Number(tx.get("amount")) || 0;
    total += amount;
    const expanded = tx.expandedOne("category");
    const categoryName = expanded
      ? String(expanded.getString("name") || "Uncategorized")
      : "Uncategorized";
    byCategory[categoryName] = (byCategory[categoryName] || 0) + amount;
  }

  const categoryRows = Object.keys(byCategory)
    .map((name) => ({ name: name, amount: byCategory[name] }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return { total: total, count: transactions.length, categoryRows: categoryRows };
}

function buildEmailHtml(user, range, summary, appUrl) {
  const greeting = escapeHtml(displayName(user));
  const rows = summary.categoryRows.map((row) => (
    "<tr>"
    + '<td style="padding:8px 0;border-bottom:1px solid #e8e8e8;">' + escapeHtml(row.name) + "</td>"
    + '<td style="padding:8px 0;border-bottom:1px solid #e8e8e8;text-align:right;font-variant-numeric:tabular-nums;">'
    + escapeHtml(formatInr(row.amount))
    + "</td>"
    + "</tr>"
  )).join("");

  const dashboardLink = appUrl
    ? '<p style="margin:24px 0 0;"><a href="' + escapeHtml(appUrl) + '/dashboard" style="color:#0f766e;font-weight:600;">Open dashboard</a></p>'
    : "";

  const prefsLink = appUrl
    ? '<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Manage this email in <a href="' + escapeHtml(appUrl) + '/me" style="color:#6b7280;">Me → Weekly digest</a>.</p>'
    : '<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Turn this off anytime from Me → Weekly digest in Oikos.</p>';

  return [
    '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:8px;">',
    "<p>Hi " + greeting + ",</p>",
    "<p>Here is your Oikos spending summary for <strong>"
      + escapeHtml(range.fromIso)
      + "</strong> to <strong>"
      + escapeHtml(range.toInclusiveIso)
      + "</strong>.</p>",
    '<div style="margin:20px 0;padding:16px 18px;background:#f0fdfa;border-radius:12px;">',
    '<p style="margin:0;font-size:13px;color:#0f766e;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Total spent</p>',
    '<p style="margin:4px 0 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;">'
      + escapeHtml(formatInr(summary.total))
      + "</p>",
    '<p style="margin:6px 0 0;font-size:13px;color:#4b5563;">'
      + escapeHtml(String(summary.count))
      + (summary.count === 1 ? " expense" : " expenses")
      + "</p>",
    "</div>",
    summary.categoryRows.length
      ? '<p style="margin:0 0 8px;font-weight:600;">By category</p>'
        + '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
        + rows
        + "</table>"
      : '<p style="margin:0;color:#6b7280;font-size:14px;">No expenses recorded for this week.</p>',
    dashboardLink,
    prefsLink,
    "</div>",
  ].join("");
}

function buildDigestPayload(user, range) {
  const transactions = loadUserTransactions(user.id, range.fromIso, range.toExclusiveIso);
  const summary = summarize(transactions);
  const appUrl = appPublicUrl();
  return {
    userId: user.id,
    email: String(user.email() || "").trim(),
    name: displayName(user),
    optedOut: user.getBool("weeklyDigestOptOut") === true,
    verified: user.getBool("verified") === true,
    range: range,
    summary: summary,
    empty: transactions.length === 0,
    subject: "Your weekly Oikos summary · " + formatInr(summary.total),
    html: buildEmailHtml(user, range, summary, appUrl),
  };
}

function sendDigestMessage(user, payload) {
  const email = payload.email;
  if (!email) {
    throw new BadRequestError("User email is unavailable.");
  }

  const settings = $app.settings();
  const fromAddress = settings.meta.senderAddress || $os.getenv("ZEPTO_MAIL_FROM_ADDRESS") || "";
  const fromName = settings.meta.senderName || $os.getenv("ZEPTO_MAIL_FROM_NAME") || "Oikos";

  if (!fromAddress) {
    throw new BadRequestError("No sender address configured for weekly digests.");
  }

  const message = new MailerMessage({
    from: { address: fromAddress, name: fromName },
    to: [{ address: email, name: payload.name }],
    subject: payload.subject,
    html: payload.html,
  });

  $app.newMailClient().send(message);
}

function sendDigest(user, range, summary) {
  const payload = {
    email: String(user.email() || "").trim(),
    name: displayName(user),
    subject: "Your weekly Oikos summary · " + formatInr(summary.total),
    html: buildEmailHtml(user, range, summary, appPublicUrl()),
  };
  sendDigestMessage(user, payload);
}

function requireAppAdmin(e) {
  const auth = e.auth;
  if (!auth || String(auth.getString("kind") || "") !== "admin") {
    throw new ForbiddenError("Admin access required.");
  }
  return auth;
}

function loadTargetUser(userId) {
  const id = String(userId || "").trim();
  if (!id) throw new BadRequestError("User id is required.");
  try {
    return $app.findRecordById("users", id);
  } catch (error) {
    throw new NotFoundError("User not found.");
  }
}

function runWeeklyDigests() {
  const range = previousWeekRange(new Date());
  const batchSize = 100;
  let offset = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (;;) {
    const users = $app.findRecordsByFilter(
      "users",
      'verified = true && weeklyDigestOptOut = false && (approved = true || kind = "admin")',
      "-created",
      batchSize,
      offset
    );
    if (!users || !users.length) break;

    for (const user of users) {
      try {
        const transactions = loadUserTransactions(user.id, range.fromIso, range.toExclusiveIso);
        if (!transactions.length) {
          skipped += 1;
          continue;
        }
        sendDigest(user, range, summarize(transactions));
        sent += 1;
      } catch (error) {
        failed += 1;
        const message = error && error.message ? error.message : String(error);
        $app.logger().error("weekly digest failed", "user", user.id, "error", message);
      }
    }

    if (users.length < batchSize) break;
    offset += users.length;
  }

  $app.logger().info(
    "weekly digests complete",
    "from", range.fromIso,
    "to", range.toInclusiveIso,
    "sent", sent,
    "skippedEmpty", skipped,
    "failed", failed
  );
}

const cronExpr = String($os.getenv("WEEKLY_DIGEST_CRON") || "0 8 * * 1").trim() || "0 8 * * 1";
cronAdd("oikos-weekly-digest", cronExpr, () => {
  runWeeklyDigests();
});

routerAdd(
  "GET",
  "/api/oikos/weekly-digest/{userId}",
  (e) => {
    requireAppAdmin(e);
    const user = loadTargetUser(e.request.pathValue("userId"));
    const payload = buildDigestPayload(user, previousWeekRange(new Date()));
    return e.json(200, payload);
  },
  $apis.requireAuth("users")
);

routerAdd(
  "POST",
  "/api/oikos/weekly-digest/{userId}",
  (e) => {
    requireAppAdmin(e);
    const user = loadTargetUser(e.request.pathValue("userId"));
    const body = e.requestInfo().body || {};
    const force = body.force === true || body.force === "true" || body.force === 1;
    const payload = buildDigestPayload(user, previousWeekRange(new Date()));

    if (!payload.verified && !force) {
      throw new BadRequestError("User email is not verified. Pass force=true to send anyway.");
    }
    if (payload.optedOut && !force) {
      throw new BadRequestError("User opted out of weekly digests. Pass force=true to send anyway.");
    }
    if (payload.empty && !force) {
      throw new BadRequestError("No expenses in the digest week. Pass force=true to send anyway.");
    }

    sendDigestMessage(user, payload);
    return e.json(200, {
      ok: true,
      message: "Weekly digest emailed to " + payload.email + ".",
      email: payload.email,
      range: payload.range,
      summary: payload.summary,
      forced: force,
    });
  },
  $apis.requireAuth("users")
);
