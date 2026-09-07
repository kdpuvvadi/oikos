/// <reference path="../pb_data/types/types.d.ts" />

/**
 * Google (and other OAuth) users skip admin approval. Email/password signups
 * still create as unapproved via the collection create rule.
 *
 * Helpers stay inside each handler — Goja does not reliably see sibling
 * function declarations from record hooks in this PocketBase build.
 */
onRecordCreateRequest((e) => {
  let isOAuth = false;
  try {
    if (typeof e.requestInfo === "function") {
      const info = e.requestInfo();
      isOAuth = String((info && (info.context || info.Context)) || "").toLowerCase() === "oauth2";
    }
  } catch (error) {
    isOAuth = false;
  }
  if (!isOAuth) {
    try {
      if (typeof $apis !== "undefined" && typeof $apis.requestInfo === "function") {
        const info = $apis.requestInfo(e);
        isOAuth = String((info && (info.context || info.Context)) || "").toLowerCase() === "oauth2";
      }
    } catch (error) {
      // keep isOAuth
    }
  }

  if (isOAuth && e.record) {
    try {
      e.record.set("kind", "user");
      e.record.set("approved", true);
      e.record.set("emailVisibility", true);
    } catch (error) {
      // create still proceeds
    }
  }

  e.next();
}, "users");

onRecordAuthWithOAuth2Request((e) => {
  function readValue(obj, keys) {
    if (!obj) return "";
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        let value = obj[key];
        if (typeof value === "function") value = value.call(obj);
        value = String(value == null ? "" : value).trim();
        if (value && value !== "undefined" && value !== "[object Object]") return value;
      } catch (error) {
        // try next key
      }
    }
    return "";
  }

  function namesFromOAuth(oauthUser) {
    const raw = (oauthUser && (oauthUser.rawUser || oauthUser.RawUser)) || {};
    let firstName = readValue(raw, ["given_name", "givenName", "first_name", "firstName"]);
    let lastName = readValue(raw, ["family_name", "familyName", "last_name", "lastName"]);
    const fullName = readValue(oauthUser, ["name", "Name"]);
    if (!firstName && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      firstName = parts[0] || "";
      lastName = lastName || parts.slice(1).join(" ");
    }
    const name = [firstName, lastName].filter(Boolean).join(" ") || fullName;
    return { firstName: firstName, lastName: lastName, name: name };
  }

  const profile = namesFromOAuth(e.oauth2User);

  if (e.isNewRecord) {
    if (!e.createData) e.createData = {};
    e.createData.kind = "user";
    e.createData.emailVisibility = true;
    if (profile.firstName && !e.createData.firstName) e.createData.firstName = profile.firstName;
    if (profile.lastName && !e.createData.lastName) e.createData.lastName = profile.lastName;
    if (profile.name && !e.createData.name) e.createData.name = profile.name;
  }

  if (e.record) {
    try {
      if (String(e.record.get("kind") || "").trim() !== "admin") {
        e.record.set("approved", true);
      }
    } catch (error) {
      // login still proceeds
    }
  }

  e.next();

  if (!e.record) return;

  const app = e.app || $app;
  let changed = false;

  try {
    const kind = String(e.record.get("kind") || "").trim();
    if (kind !== "admin" && e.record.get("approved") !== true) {
      e.record.set("approved", true);
      changed = true;
    }
  } catch (error) {
    // keep going for names
  }

  try {
    let first = String(e.record.get("firstName") || "").trim();
    let last = String(e.record.get("lastName") || "").trim();
    const currentName = String(e.record.get("name") || "").trim();
    if (!first && profile.firstName) {
      e.record.set("firstName", profile.firstName);
      first = profile.firstName;
      changed = true;
    }
    if (!last && profile.lastName) {
      e.record.set("lastName", profile.lastName);
      last = profile.lastName;
      changed = true;
    }
    const nextName = [first, last].filter(Boolean).join(" ") || profile.name;
    if (nextName && nextName !== currentName) {
      e.record.set("name", nextName);
      changed = true;
    }
  } catch (error) {
    // Auth still succeeds.
  }

  if (!changed) return;
  try {
    app.save(e.record);
  } catch (error) {
    try {
      app.saveNoValidate(e.record);
    } catch (error2) {
      // Auth still succeeds; oauth-approve hook can still mark approved.
    }
  }
}, "users");
