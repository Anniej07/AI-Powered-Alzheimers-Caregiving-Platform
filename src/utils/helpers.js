import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
};

export const formatTime = (date) => date ? format(new Date(date), 'h:mm a') : '—';
export const formatDateTime = (date) => date ? format(new Date(date), 'MMM d, yyyy h:mm a') : '—';
export const timeAgo = (date) => date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : '—';

export const getInitials = (name = '') =>
  name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

export const severityColor = (s) => ({
  critical: 'danger', high: 'danger', medium: 'warn', low: 'info'
}[s] || 'neutral');

export const sentimentColor = (s) => ({
  positive: 'success', negative: 'danger', neutral: 'neutral'
}[s] || 'neutral');

export const emotionIcon = (e) => ({
  happy: '😊', sad: '😢', angry: '😠', fearful: '😨',
  disgusted: '🤢', surprised: '😲', neutral: '😐',
  anxious: '😰', confused: '😕', stressed: '😤', calm: '😌',
}[e] || '😐');

export const roleLabel = (r) => ({ patient: 'Patient', caregiver: 'Caregiver', doctor: 'Doctor' }[r] || r);

export const getAdherenceColor = (rate) => {
  if (rate === null || rate === undefined) return 'var(--ink-muted)';
  if (rate >= 80) return 'var(--success)';
  if (rate >= 60) return 'var(--warn)';
  return 'var(--danger)';
};
