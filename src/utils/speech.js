import * as Speech from 'expo-speech';

export function speak(text, voiceStyle = 'default') {
    Speech.stop();

    const options = {
        language: 'en-US',
        pitch: voiceStyle === 'firm' ? 0.8 : voiceStyle === 'gentle' ? 1.2 : 1.0,
        rate: voiceStyle === 'firm' ? 0.9 : voiceStyle === 'gentle' ? 0.85 : 0.9,
    };

    Speech.speak(text, options);
}

export function stopSpeech() {
    Speech.stop();
}