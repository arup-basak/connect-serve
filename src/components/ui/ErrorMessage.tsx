interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">
      {message}
    </div>
  );
}
