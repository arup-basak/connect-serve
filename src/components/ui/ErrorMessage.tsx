interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <div className="bg-red-500/[0.07] border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-2.5">
      {message}
    </div>
  );
}
