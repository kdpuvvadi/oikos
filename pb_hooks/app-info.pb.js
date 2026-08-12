/// <reference path="../pb_data/types/types.d.ts" />

/**
 * Public build metadata (no auth).
 * GET /api/app-info → { version, branch, pocketbase }
 *
 * version: APP_VERSION env, else pb_public/manifest.json
 * branch: APP_BUILD_BRANCH env (defaults to "unknown")
 * pocketbase: pocketbase --version
 */
routerAdd("GET", "/api/app-info", (e) => {
  function readTextFile(path) {
    try {
      const raw = $os.readFile(path);
      if (typeof raw === "string") return raw;
      if (typeof toString === "function") return toString(raw);
    } catch (error) {
      // try next
    }
    return "";
  }

  function readVersion() {
    const fromEnv = String($os.getenv("APP_VERSION") || "").trim();
    if (fromEnv) return fromEnv;

    const candidates = [
      "pb_public/manifest.json",
      "/usr/src/app/pb_public/manifest.json",
      "package.json",
      "/usr/src/app/package.json",
    ];
    for (let i = 0; i < candidates.length; i++) {
      try {
        const text = readTextFile(candidates[i]);
        if (!text) continue;
        const data = JSON.parse(text);
        const version = String((data && data.version) || "").trim();
        if (version) return version;
      } catch (error) {
        // try next
      }
    }
    return "";
  }

  function readPocketBaseVersion() {
    const binaries = [
      "/usr/src/app/pocketbase",
      "pocketbase",
      "./pocketbase",
    ];
    for (let i = 0; i < binaries.length; i++) {
      try {
        const output = toString($os.cmd(binaries[i], "--version").output());
        const match = String(output || "").match(/(\d+\.\d+\.\d+(?:-[^\s]+)?)/);
        if (match && match[1]) return match[1];
        const trimmed = String(output || "").trim();
        if (trimmed) return trimmed;
      } catch (error) {
        // try next binary
      }
    }
    return "";
  }

  const version = readVersion();
  const branch = String($os.getenv("APP_BUILD_BRANCH") || "").trim() || "unknown";
  const pocketbase = readPocketBaseVersion();

  return e.json(200, {
    version: version,
    branch: branch,
    pocketbase: pocketbase,
  });
});
