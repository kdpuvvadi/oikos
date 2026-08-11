/// <reference path="../pb_data/types/types.d.ts" />

// Delivers every PocketBase-generated email (verification, OTP, reset, digests, etc.)
// through ZeptoMail's HTTPS API. Do not call e.next() when Zepto is configured,
// because that would continue to PocketBase's SMTP mailer.
//
// data:image/...;base64,... URLs in HTML are rewritten to cid: inline images so
// clients that strip data URIs (and firewalls that block remote images) still show logos.
onMailerSend((e) => {
  const apiKey = $os.getenv("ZEPTO_MAIL_API_KEY");
  const fromAddress = $os.getenv("ZEPTO_MAIL_FROM_ADDRESS");
  const fromName = $os.getenv("ZEPTO_MAIL_FROM_NAME") || "Oikos";

  // Retain PocketBase's configured mailer for local/non-Zepto deployments.
  if (!apiKey || !fromAddress) return e.next();

  const to = [];
  const recipients = (e.message && e.message.to) || [];
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    if (!recipient || !recipient.address) continue;
    const entry = {
      email_address: {
        address: recipient.address,
      },
    };
    if (recipient.name) {
      entry.email_address.name = recipient.name;
    }
    to.push(entry);
  }

  if (!to.length) {
    throw new Error("ZeptoMail: no recipients on message.");
  }

  function rewriteDataUriImages(html) {
    const inlineImages = [];
    let out = "";
    let remaining = String(html || "");
    let matchIndex = 0;
    const marker = "src=\"";
    const dataPrefix = "data:image/";

    while (remaining.length) {
      const srcPos = remaining.indexOf(marker);
      if (srcPos < 0) {
        out += remaining;
        break;
      }
      out += remaining.substring(0, srcPos + marker.length);
      remaining = remaining.substring(srcPos + marker.length);

      if (remaining.indexOf(dataPrefix) !== 0) {
        continue;
      }

      const endQuote = remaining.indexOf("\"");
      if (endQuote < 0) {
        out += remaining;
        remaining = "";
        break;
      }

      const dataUri = remaining.substring(0, endQuote);
      remaining = remaining.substring(endQuote);

      const commaPos = dataUri.indexOf(";base64,");
      if (commaPos < 0) {
        out += dataUri;
        continue;
      }

      const mimeType = dataUri.substring(5, commaPos); // after "data:"
      const b64 = dataUri.substring(commaPos + 8).replace(/\s+/g, "");
      if (!mimeType || !b64) {
        out += dataUri;
        continue;
      }

      const cid = "oikos-inline-" + matchIndex;
      matchIndex += 1;
      inlineImages.push({
        content: b64,
        mime_type: mimeType,
        cid: cid,
      });
      out += "cid:" + cid;
    }

    return { html: out, inlineImages: inlineImages };
  }

  const rewritten = rewriteDataUriImages(e.message.html || e.message.text || "<p></p>");
  const payload = {
    from: {
      address: fromAddress,
      name: fromName,
    },
    to: to,
    subject: e.message.subject || "Oikos",
    htmlbody: rewritten.html,
  };
  if (rewritten.inlineImages.length) {
    payload.inline_images = rewritten.inlineImages;
  }

  const response = $http.send({
    url: "https://api.zeptomail.in/v1.1/email",
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": "Zoho-enczapikey " + apiKey,
    },
    body: JSON.stringify(payload),
    timeout: 30,
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const bodyText = response.body ? String(response.body) : "";
    throw new Error(
      "ZeptoMail rejected email with status "
      + response.statusCode
      + (bodyText ? (": " + bodyText) : "")
    );
  }
});
