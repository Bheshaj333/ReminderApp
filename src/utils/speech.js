import * as Speech from 'expo-speech';

export const RATE_OPTIONS = [
  { label: 'Slow', value: 0.75 },
  { label: 'Normal', value: 0.95 },
  { label: 'Fast', value: 1.2 },
];

export const PITCH_OPTIONS = [
  { label: 'Deep', value: 0.8 },
  { label: 'Natural', value: 1.0 },
  { label: 'Bright', value: 1.2 },
];

/**
 * Speak `text` the same way the native alarm will (same engine, voice, rate, pitch, prefix).
 * Used for previews in the app.
 */
export function speak(text, settings = {}, { onDone, onStart } = {}) {
  Speech.stop();
  const spoken = settings.announcePrefix ? `Reminder. ${text}` : text;
  Speech.speak(spoken, {
    voice: settings.voiceId || undefined,
    rate: settings.rate ?? 0.95,
    pitch: settings.pitch ?? 1.0,
    onStart,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export function stopSpeech() {
  Speech.stop();
}

const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
  kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', ur: 'Urdu', es: 'Spanish', fr: 'French', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', cmn: 'Chinese',
  ar: 'Arabic', nl: 'Dutch', tr: 'Turkish', id: 'Indonesian', th: 'Thai', vi: 'Vietnamese', pl: 'Polish',
  sv: 'Swedish', uk: 'Ukrainian', el: 'Greek', he: 'Hebrew', ne: 'Nepali', si: 'Sinhala',
};
const REGION_NAMES = {
  US: 'US', GB: 'UK', IN: 'India', AU: 'Australia', CA: 'Canada', NG: 'Nigeria', IE: 'Ireland', ZA: 'South Africa',
  ES: 'Spain', MX: 'Mexico', FR: 'France', DE: 'Germany', BR: 'Brazil', PT: 'Portugal',
};

function languageName(tag = '') {
  const [lang, region] = tag.replace('_', '-').split('-');
  const name = LANGUAGE_NAMES[lang?.toLowerCase()] || lang || 'Other';
  const reg = region && (REGION_NAMES[region.toUpperCase()] || region.toUpperCase());
  return reg ? `${name} (${reg})` : name;
}

/** Installed TTS voices grouped by language, with friendly labels. */
export async function getVoiceGroups() {
  let voices = [];
  try {
    voices = await Speech.getAvailableVoicesAsync();
  } catch (e) {
    return [];
  }
  const groups = {};
  for (const v of voices) {
    const lang = (v.language || '').replace('_', '-');
    if (!lang) continue;
    // Android "-language" entries are generic aliases of the default voice
    if (/-language$/.test(v.identifier)) continue;
    (groups[lang] = groups[lang] || []).push(v);
  }
  return Object.entries(groups)
    .map(([lang, list]) => ({
      lang,
      label: languageName(lang),
      voices: list
        .sort((a, b) => a.identifier.localeCompare(b.identifier))
        .map((v, i) => ({
          id: v.identifier,
          label: `Voice ${String.fromCharCode(65 + (i % 26))}`,
          online: /network/i.test(v.identifier),
          enhanced: v.quality === 'Enhanced',
        })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
