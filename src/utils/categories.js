import { Colors } from './theme';

// `id` is also sent to the native alarm screen as `icon` (see AlarmActivity.ICONS)
export const CATEGORIES = [
  { id: 'general', label: 'General', emoji: '🔔', color: Colors.seafoamDeep },
  { id: 'medicine', label: 'Medicine', emoji: '💊', color: Colors.coralDeep },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', color: Colors.petalDeep },
  { id: 'bills', label: 'Bills', emoji: '💳', color: Colors.jasmineDark },
  { id: 'health', label: 'Health', emoji: '💧', color: '#4FA3C7' },
  { id: 'work', label: 'Work', emoji: '💼', color: Colors.deep },
  { id: 'call', label: 'Call', emoji: '📞', color: '#5B8DEF' },
  { id: 'home', label: 'Home', emoji: '🏠', color: '#C08A5B' },
];

export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
}
