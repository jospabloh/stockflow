// A business's admin is stored as built-in role 'owner' (2026-09-24).
// Built-in 'admin' is reserved for the platform owner and the service role,
// because every RLS rule's user_condition:{role:"admin"} branch is not scoped
// to a business. Legacy business admins still stored as 'admin' keep working.
export function isBusinessAdmin(user) {
  return user?.role === "admin" || user?.role === "owner";
}

// The app's own role vocabulary ('admin' | 'almacenista') — what permission
// profiles (role_key) and the permission registry are keyed on.
export function appRole(role) {
  return role === "owner" ? "admin" : role;
}
