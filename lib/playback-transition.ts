type QueueTrack = { id: string; audio?: string };

// The caller passes only tracks the listener owns. Do not impose a separate
// end-of-book boundary: a bundle continues from chapter 13 into its bonuses.
export function nextPlaybackTrack<T extends QueueTrack>(queue: readonly T[], currentId: string, autoContinue = true): T | null {
  if (!autoContinue) return null;
  const index = queue.findIndex(track => track.id === currentId);
  return index < 0 ? null : queue.slice(index + 1).find(track => track.audio) || null;
}

type AudioSource = {
  dataset: { trackId?: string };
  src: string;
  getAttribute(name: string): string | null;
};
// One native source owner prevents React from assigning src again after a
// synchronous queue/ended play(), which can abort playback on mobile browsers.
export function setPlaybackSource(audio: AudioSource, trackId: string, source: string) {
  audio.dataset.trackId = trackId;
  if (audio.getAttribute('src') !== source) audio.src = source;
}

export function ignorePlaybackPause(audio: { paused: boolean; ended: boolean }, switching: boolean) {
  // A queued pause from a previous source must not stop the new audio. Natural
  // completion is handled by ended, without a false paused state in between.
  return switching || !audio.paused || audio.ended;
}
