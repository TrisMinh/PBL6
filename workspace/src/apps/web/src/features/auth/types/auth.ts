export type UserRole = "customer" | "admin";

export interface MockSession {
  userId: string;
  role: UserRole;
  expiresAt: string;
  token?: string;
}
