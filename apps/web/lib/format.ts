export function timeAgo(dateString: string): string {
  const delta = Date.now() - new Date(dateString).getTime();
  const seconds = Math.max(1, Math.floor(delta / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

