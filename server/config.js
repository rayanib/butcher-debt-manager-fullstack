function getSessionSecret(env = process.env) {
  const configuredSecret = String(env.SESSION_SECRET || "").trim();
  const isProduction = env.NODE_ENV === "production";

  if (configuredSecret) return configuredSecret;

  if (isProduction) {
    throw new Error("SESSION_SECRET is required in production.");
  }

  return "development-only-secret";
}

module.exports = { getSessionSecret };
