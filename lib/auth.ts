export function isAdminUser(userId?: string | null): boolean {
    return userId === "user_2uVd56CasqiekMDl4WFFHTZEYFR";
  }
  
  export function isAdminUsername(username?: string | null): boolean {
    return username === "randomplayables";
  }
  
  // Double check both ID and username for maximum security
  export function isAdmin(userId?: string | null, username?: string | null): boolean {
    return isAdminUser(userId) && isAdminUsername(username);
  }