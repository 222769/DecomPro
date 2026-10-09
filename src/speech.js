export function availableVoices() {
  return (window.speechSynthesis?.getVoices?.() || []).slice().sort((a,b) => {
    const rank = v => /^en[-_]GB$/i.test(v.lang) ? 0 : /^en/i.test(v.lang) ? 1 : 2;
    return rank(a)-rank(b) || a.name.localeCompare(b.name);
  });
}
export function utteranceFor(text, settings) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = availableVoices();
  const voice = voices.find(v => v.voiceURI === settings.voiceURI) || voices.find(v => /^en[-_]GB$/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-GB';
  utterance.rate = settings.speechRate;
  utterance.volume = settings.speechVolume;
  return utterance;
}
