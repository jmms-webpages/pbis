export default function Loading({ label = 'Loading' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-plum-200 border-t-plum-600" />
        <p className="font-body text-sm text-plum-700">{label}…</p>
      </div>
    </div>
  );
}
