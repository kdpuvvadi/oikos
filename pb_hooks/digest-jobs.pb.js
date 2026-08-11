/// <reference path="../pb_data/types/types.d.ts" />

/**
 * Admin manual weekly-digest send via oikos_digest_jobs collection create.
 * All logic is inlined inside the handler — Goja does not reliably see
 * sibling function declarations from record hooks in this PocketBase build.
 */
onRecordCreateRequest((e) => {
  const auth = e.auth;
  let kind = "";
  try {
    if (auth) {
      if (typeof auth.getString === "function") {
        kind = String(auth.getString("kind") || "").trim();
      } else {
        kind = String(auth.get("kind") || "").trim();
      }
    }
  } catch (error) {
    kind = "";
  }

  if (kind !== "admin" && auth && auth.id) {
    try {
      const fresh = $app.findRecordById("users", auth.id);
      if (typeof fresh.getString === "function") {
        kind = String(fresh.getString("kind") || "").trim();
      } else {
        kind = String(fresh.get("kind") || "").trim();
      }
    } catch (error) {
      // keep kind
    }
  }

  if (kind !== "admin") {
    throw new ForbiddenError("Admin access required.");
  }

  const userId = String(e.record.get("targetUser") || "").trim();
  const subject = String(e.record.get("subject") || "").trim();
  const html = String(e.record.get("html") || "").trim();
  if (!userId || !subject || !html) {
    throw new BadRequestError("targetUser, subject, and html are required.");
  }

  let user;
  try {
    user = $app.findRecordById("users", userId);
  } catch (error) {
    throw new NotFoundError("User not found.");
  }

  let email = "";
  try {
    if (typeof user.email === "function") {
      email = String(user.email() || "").trim();
    }
  } catch (error) {
    email = "";
  }
  if (!email) {
    try {
      email = String(user.getString("email") || user.get("email") || "").trim();
    } catch (error) {
      email = "";
    }
  }
  if (!email) {
    throw new BadRequestError("User email is unavailable.");
  }

  let firstName = "";
  let lastName = "";
  let nameField = "";
  try {
    firstName = String(user.getString("firstName") || user.get("firstName") || "").trim();
    lastName = String(user.getString("lastName") || user.get("lastName") || "").trim();
    nameField = String(user.getString("name") || user.get("name") || "").trim();
  } catch (error) {
    // ignore
  }
  const display = [firstName, lastName].filter(Boolean).join(" ") || nameField || "there";

  const settings = $app.settings();
  const fromAddress = $os.getenv("ZEPTO_MAIL_FROM_ADDRESS")
    || (settings && settings.meta && settings.meta.senderAddress)
    || "";
  const fromName = $os.getenv("ZEPTO_MAIL_FROM_NAME")
    || (settings && settings.meta && settings.meta.senderName)
    || "Oikos";

  if (!fromAddress) {
    throw new BadRequestError(
      "No sender address configured. Set ZEPTO_MAIL_FROM_ADDRESS (and ZEPTO_MAIL_API_KEY) or PocketBase mail sender settings."
    );
  }

  const to = display && display !== "there"
    ? [{ address: email, name: display }]
    : [{ address: email }];

  const message = new MailerMessage({
    from: { address: fromAddress, name: fromName },
    to: to,
    subject: subject,
    html: html,
  });

  try {
    $app.newMailClient().send(message);
  } catch (error) {
    const detail = error && error.message ? String(error.message) : String(error);
    $app.logger().error("digest job mailer failed", "error", detail);
    throw new BadRequestError("Email delivery failed: " + detail);
  }

  e.record.set("status", "sent");
  e.record.set("error", "");
  e.next();
}, "oikos_digest_jobs");
