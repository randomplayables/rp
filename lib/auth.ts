export function isAdminUser(userId?: string | null): boolean {
  // Read the admin user ID from environment variables for security
  const adminId = process.env.ADMIN_USER_ID;

  // Check if the adminId is configured and if the provided userId matches
  return !!adminId && userId === adminId;
}

export function isAdminUsername(username?: string | null): boolean {
  return username === "randomplayables";
}

// Double check both ID and username for maximum security
export function isAdmin(userId?: string | null, username?: string | null): boolean {
  return isAdminUser(userId) && isAdminUsername(username);
}