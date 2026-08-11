/// <reference path="../pb_data/types/types.d.ts" />

/**
 * Weekly expense digests for verified users (approved or admin) who have not opted out.
 * Default: Mondays at 08:00 UTC for the previous Mon–Sun (UTC). Digests are on by default.
 * Override with WEEKLY_DIGEST_CRON (5-field cron expression).
 *
 * Empty weeks are still emailed (zero-spend summary). Admin manual sends use oikos_digest_jobs.
 *
 * IMPORTANT: PocketBase JSVM runs each handler in an isolated context — helpers declared
 * outside the cron callback are NOT visible inside it (ReferenceError). Keep all logic nested.
 */

const cronExpr = String($os.getenv("WEEKLY_DIGEST_CRON") || "0 8 * * 1").trim() || "0 8 * * 1";

cronAdd("oikos-weekly-digest", cronExpr, () => {
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function isoDateUTC(date) {
    return date.getUTCFullYear() + "-" + pad2(date.getUTCMonth() + 1) + "-" + pad2(date.getUTCDate());
  }

  function pbDayStart(isoDate) {
    return String(isoDate).slice(0, 10) + " 00:00:00.000Z";
  }

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
    const n = Number(amount);
    const num = isFinite(n) ? n : 0;
    const negative = num < 0;
    const abs = negative ? -num : num;
    const fixed = abs.toFixed(2);
    const parts = fixed.split(".");
    let intPart = parts[0];

    // Indian grouping without zero-width /g replace (Goja can double-insert commas).
    if (intPart.length > 3) {
      const last3 = intPart.substring(intPart.length - 3);
      const restDigits = intPart.substring(0, intPart.length - 3);
      let rest = "";
      for (let i = 0; i < restDigits.length; i++) {
        const fromEnd = restDigits.length - i;
        if (i > 0 && fromEnd % 2 === 0) rest += ",";
        rest += restDigits.charAt(i);
      }
      intPart = rest + "," + last3;
    }

    return (negative ? "-₹" : "₹") + intPart + "." + parts[1];
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function errorMessage(error) {
    if (!error) return "Unknown error";
    if (error.message) return String(error.message);
    return String(error);
  }

  function fieldString(record, key) {
    try {
      if (record && typeof record.getString === "function") {
        return String(record.getString(key) || "");
      }
    } catch (error) {
      // fall through
    }
    try {
      return String((record && record.get(key)) || "");
    } catch (error) {
      return "";
    }
  }

  function fieldBool(record, key) {
    try {
      if (record && typeof record.getBool === "function") {
        return record.getBool(key) === true;
      }
    } catch (error) {
      // fall through
    }
    try {
      return (record && record.get(key)) === true;
    } catch (error) {
      return false;
    }
  }

  function recordEmail(user) {
    try {
      if (user && typeof user.email === "function") {
        return String(user.email() || "").trim();
      }
    } catch (error) {
      // fall through
    }
    return fieldString(user, "email").trim();
  }

  function displayName(user) {
    const first = fieldString(user, "firstName").trim();
    const last = fieldString(user, "lastName").trim();
    const name = [first, last].filter(Boolean).join(" ");
    if (name) return name;
    const fallback = fieldString(user, "name").trim();
    return fallback || "there";
  }

  function appPublicUrl() {
    try {
      const settings = $app.settings();
      return String($os.getenv("APP_PUBLIC_URL") || (settings && settings.meta && settings.meta.appURL) || "").replace(/\/$/, "");
    } catch (error) {
      return String($os.getenv("APP_PUBLIC_URL") || "").replace(/\/$/, "");
    }
  }

  function logoHeaderHtml(appUrl) {
    const base = String(appUrl || "").replace(/\/$/, "");
    if (base) {
      const logoSrc = escapeHtml(base + "/img/apple-touch-icon.png");
      const homeHref = escapeHtml(base);
      return (
        '<div style="margin:0 0 20px;">'
        + '<a href="' + homeHref + '" style="text-decoration:none;">'
        + '<img src="' + logoSrc + '" width="48" height="48" alt="Oikos" '
        + 'style="display:block;border:0;border-radius:10px;outline:none;">'
        + "</a>"
        + '<p style="margin:10px 0 0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#0f766e;">Oikos</p>'
        + "</div>"
      );
    }
    return (
      '<div style="margin:0 0 20px;">'
      + '<p style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#0f766e;">Oikos</p>'
      + "</div>"
    );
  }

  function categoryNameForTx(tx, categoryCache) {
    const categoryId = fieldString(tx, "category").trim();
    if (!categoryId) return "Uncategorized";
    if (categoryCache[categoryId]) return categoryCache[categoryId];

    try {
      const expanded = typeof tx.expandedOne === "function" ? tx.expandedOne("category") : null;
      if (expanded) {
        const name = fieldString(expanded, "name").trim() || "Uncategorized";
        categoryCache[categoryId] = name;
        return name;
      }
    } catch (error) {
      // look up below
    }

    try {
      const category = $app.findRecordById("oikos_categories", categoryId);
      const name = fieldString(category, "name").trim() || "Uncategorized";
      categoryCache[categoryId] = name;
      return name;
    } catch (error) {
      categoryCache[categoryId] = "Uncategorized";
      return "Uncategorized";
    }
  }

  function loadUserTransactions(userId, fromIso, toExclusiveIso) {
    const from = pbDayStart(fromIso);
    const to = pbDayStart(toExclusiveIso);
    const safeUserId = String(userId || "").replace(/"/g, "");
    const filter = 'user = "' + safeUserId + '" && date >= "' + from + '" && date < "' + to + '"';
    const batchSize = 200;
    let offset = 0;
    const all = [];

    for (;;) {
      const batch = $app.findRecordsByFilter(
        "oikos_transactions",
        filter,
        "-date",
        batchSize,
        offset
      );
      if (!batch || !batch.length) break;
      for (let i = 0; i < batch.length; i++) all.push(batch[i]);
      if (batch.length < batchSize) break;
      offset += batch.length;
    }

    return all;
  }

  function summarize(transactions) {
    let total = 0;
    const byCategory = {};
    const categoryCache = {};

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const amount = Number(tx.get("amount")) || 0;
      total += amount;
      const categoryName = categoryNameForTx(tx, categoryCache);
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
      logoHeaderHtml(appUrl),
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

  function sendDigest(user, range, summary) {
    const email = recordEmail(user);
    if (!email) {
      throw new Error("User email is unavailable.");
    }

    const settings = $app.settings();
    const fromAddress = $os.getenv("ZEPTO_MAIL_FROM_ADDRESS")
      || (settings && settings.meta && settings.meta.senderAddress)
      || "";
    const fromName = $os.getenv("ZEPTO_MAIL_FROM_NAME")
      || (settings && settings.meta && settings.meta.senderName)
      || "Oikos";

    if (!fromAddress) {
      throw new Error(
        "No sender address configured. Set ZEPTO_MAIL_FROM_ADDRESS (and ZEPTO_MAIL_API_KEY) or PocketBase mail sender settings."
      );
    }

    const name = displayName(user);
    const message = new MailerMessage({
      from: { address: fromAddress, name: fromName },
      to: name
        ? [{ address: email, name: name }]
        : [{ address: email }],
      subject: "Your weekly Oikos summary · " + formatInr(summary.total),
      html: buildEmailHtml(user, range, summary, appPublicUrl()),
    });

    try {
      $app.newMailClient().send(message);
    } catch (error) {
      const detail = errorMessage(error);
      $app.logger().error("weekly digest mailer failed", "error", detail);
      throw new Error("Email delivery failed: " + detail);
    }
  }

  function runWeeklyDigests() {
    const range = previousWeekRange(new Date());
    const batchSize = 100;
    let offset = 0;
    let sent = 0;
    let sentEmpty = 0;
    let failed = 0;
    let eligible = 0;

    $app.logger().info(
      "weekly digests started",
      "from", range.fromIso,
      "to", range.toInclusiveIso
    );

    for (;;) {
      const users = $app.findRecordsByFilter(
        "users",
        'verified = true && weeklyDigestOptOut != true && (approved = true || kind = "admin")',
        "-created",
        batchSize,
        offset
      );
      if (!users || !users.length) break;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        eligible += 1;
        try {
          const transactions = loadUserTransactions(user.id, range.fromIso, range.toExclusiveIso);
          sendDigest(user, range, summarize(transactions));
          sent += 1;
          if (!transactions.length) sentEmpty += 1;
        } catch (error) {
          failed += 1;
          $app.logger().error("weekly digest failed", "user", user.id, "error", errorMessage(error));
        }
      }

      if (users.length < batchSize) break;
      offset += users.length;
    }

    $app.logger().info(
      "weekly digests complete",
      "from", range.fromIso,
      "to", range.toInclusiveIso,
      "eligible", eligible,
      "sent", sent,
      "sentEmpty", sentEmpty,
      "failed", failed
    );
  }

  try {
    runWeeklyDigests();
  } catch (error) {
    $app.logger().error("weekly digest cron failed", "error", errorMessage(error));
  }
});
