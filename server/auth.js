const crypto = require("crypto");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyLogin({ username, password, env }) {
  const expectedUsername = String(env.ADMIN_USER || "").trim();
  const expectedPassword = String(env.ADMIN_PASS || "");

  if (!expectedUsername || !expectedPassword) return false;

  return (
    safeEqual(String(username || "").trim(), expectedUsername) &&
    safeEqual(String(password || ""), expectedPassword)
  );
}

module.exports = { verifyLogin };
