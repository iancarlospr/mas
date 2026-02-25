/**
 * GhostScan OS — Auth Layout
 * ═══════════════════════════════
 *
 * WHAT: Layout wrapper for auth pages (login, register, verify).
 * WHY:  AuthForm renders its own full-screen dark CRT background.
 *       Verify page also handles its own layout. This layout is now a
 *       transparent pass-through (Plan Section 15).
 * HOW:  No wrapper styling — children control their own presentation.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
