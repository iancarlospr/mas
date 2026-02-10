export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-8 shadow-lg">
        {children}
      </div>
    </div>
  );
}
