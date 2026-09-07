/// <reference path="../pb_data/types/types.d.ts" />

/**
 * Any user who signs in with OAuth (Google, etc.), or already has a linked
 * OAuth provider, is approved. Email/password-only signups stay pending.
 *
 * Keep this as the only top-level hook in this file so Goja registers it.
 */
onRecordAuthRequest((e) => {
  try {
    const rec = e.record;
    if (rec) {
      const kind = String(rec.get("kind") || "").trim();
      const alreadyApproved = rec.get("approved") === true;
      if (kind !== "admin" && !alreadyApproved) {
        let viaOAuth = String(e.authMethod || "") === "oauth2";
        if (!viaOAuth) {
          try {
            const links = $app.findAllExternalAuthsByRecord(rec);
            viaOAuth = !!(links && links.length);
          } catch (error) {
            viaOAuth = false;
          }
        }
        if (!viaOAuth) {
          try {
            const id = String(rec.id || rec.get("id") || "");
            if (id) {
              const rows = $app.findRecordsByFilter("_externalAuths", 'recordRef = "' + id + '"', "", 1, 0);
              viaOAuth = !!(rows && rows.length);
            }
          } catch (error) {
            // keep viaOAuth
          }
        }
        if (viaOAuth) {
          rec.set("approved", true);
          if (!kind) rec.set("kind", "user");
          const app = e.app || $app;
          try {
            app.save(rec);
          } catch (error) {
            try {
              app.saveNoValidate(rec);
            } catch (error2) {
              // request still continues; record may stay pending
            }
          }
        }
      }
    }
  } catch (error) {
    // never block authentication
  }

  e.next();
}, "users");
