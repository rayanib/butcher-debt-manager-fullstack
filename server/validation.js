class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function getRequiredText(value, label, { max = 120 } = {}) {
  const text = String(value || "").trim();
  if (!text) throw new ValidationError(`${label} is required.`);
  if (text.length > max) throw new ValidationError(`${label} is too long.`);
  return text;
}

function getOptionalText(value, { max = 300 } = {}) {
  const text = String(value || "").trim();
  if (text.length > max) throw new ValidationError("Text is too long.");
  return text;
}

function getPositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new ValidationError(`${label} must be greater than 0.`);
  }
  return number;
}

function getNonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ValidationError(`${label} cannot be negative.`);
  }
  return number;
}

function getPositiveInteger(value, label = "ID") {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new ValidationError(`${label} must be a positive integer.`);
  }
  return number;
}

module.exports = {
  ValidationError,
  getRequiredText,
  getOptionalText,
  getPositiveNumber,
  getNonNegativeNumber,
  getPositiveInteger
};
