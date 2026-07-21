/// <reference path="../pb_data/types/types.d.ts" />

// Delivers every PocketBase-generated email (verification, OTP, reset, etc.)
// through ZeptoMail's HTTPS API. Do not call e.next(), because that would
// continue to PocketBase's SMTP mailer.
onMailerSend((e) => {
  const apiKey = $os.getenv("ZEPTO_MAIL_API_KEY");
  const fromAddress = $os.getenv("ZEPTO_MAIL_FROM_ADDRESS");
  const fromName = $os.getenv("ZEPTO_MAIL_FROM_NAME") || "Oikos";

  // Retain PocketBase's configured mailer for local/non-Zepto deployments.
  if (!apiKey || !fromAddress) return e.next();

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
      to: e.message.to.map((recipient) => ({
        email_address: {
          address: recipient.address,
          ...(recipient.name ? { name: recipient.name } : {}),
        },
      })),
      subject: e.message.subject,
      htmlbody: e.message.html || e.message.text || "<p></p>",
    }),
    timeout: 30,
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error("ZeptoMail rejected email with status " + response.statusCode + ": " + response.body);
  }
});
