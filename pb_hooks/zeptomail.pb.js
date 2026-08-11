/// <reference path="../pb_data/types/types.d.ts" />

// Delivers every PocketBase-generated email (verification, OTP, reset, digests, etc.)
// through ZeptoMail's HTTPS API. Do not call e.next() when Zepto is configured,
// because that would continue to PocketBase's SMTP mailer.
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

  const response = $http.send({
    url: "https://api.zeptomail.in/v1.1/email",
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": "Zoho-enczapikey " + apiKey,
    },
    body: JSON.stringify({
      from: {
        address: fromAddress,
        name: fromName,
      },
      to: to,
      subject: e.message.subject || "Oikos",
      htmlbody: e.message.html || e.message.text || "<p></p>",
    }),
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
