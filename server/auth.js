function verifyLogin({ username, password, env }) {
  const okUser =
    String(username || "").trim() === String(env.ADMIN_USER || "").trim();

  const okPass =
    String(password || "").trim() === String(env.ADMIN_PASS || "").trim();

  return okUser && okPass;
}

module.exports = { verifyLogin };
