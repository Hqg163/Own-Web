function parseSiteOwnerUserId(value = process.env.SITE_OWNER_USER_ID) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function adminEmailValues(value) {
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return value;
  return String(value ?? '').split(',');
}

function normalizedAdminEmails(value = process.env.ADMIN_EMAILS) {
  return new Set(adminEmailValues(value)
    .map((email) => String(email ?? '').trim().toLowerCase())
    .filter(Boolean));
}

function resolveIdentityConfig(options = {}) {
  const { ownerId = parseSiteOwnerUserId(), adminEmails = normalizedAdminEmails() } = options || {};
  return {
    ownerId: parseSiteOwnerUserId(ownerId),
    adminEmails: normalizedAdminEmails(adminEmails),
  };
}

function isSiteOwner(user, ownerId = parseSiteOwnerUserId()) {
  const userId = Number(user?.id);
  const configuredOwnerId = parseSiteOwnerUserId(ownerId);
  return Boolean(Number.isSafeInteger(userId) && userId > 0 && configuredOwnerId && userId === configuredOwnerId);
}

function isAdmin(user, adminEmails = normalizedAdminEmails()) {
  const emails = normalizedAdminEmails(adminEmails);
  return Boolean(user && emails.has(String(user.email || '').trim().toLowerCase()));
}

function capabilitiesForUser(user, options = {}) {
  const { ownerId, adminEmails } = resolveIdentityConfig(options);
  return {
    isSiteOwner: isSiteOwner(user, ownerId),
    isAdmin: isAdmin(user, adminEmails),
  };
}

module.exports = {
  parseSiteOwnerUserId,
  normalizedAdminEmails,
  resolveIdentityConfig,
  isSiteOwner,
  isAdmin,
  capabilitiesForUser,
};
