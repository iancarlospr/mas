/**
 * Marketing Layout — Pass-through.
 * Marketing content is now in desktop icon windows.
 * NavBar and Footer replaced by MenuBar and Taskbar in DesktopShell.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
