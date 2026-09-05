// Replace these files in public/demo/voice/ if you want different takes.
// Keep the filenames. Any browser-playable WAV works.

export const preparedSpeakers = [
  {
    id: 'kit',
    name: 'Kit',
    role: 'Incident commander',
    voice: 'British Masculine',
  },
  {
    id: 'cliff',
    name: 'Cliff',
    role: 'Checkout',
    voice: 'American Masculine',
  },
  {
    id: 'sienna',
    name: 'Sienna',
    role: 'Payments',
    voice: 'American Feminine',
  },
] as const;

export const preparedClips = [
  {
    sequence: 1,
    speakerId: 'kit',
    speaker: 'Kit · Incident commander',
    text: 'Checkout failures jumped two minutes after R42. applyCoupon is throwing TypeErrors. Is it us, or is Stripe degrading?',
    relevant: true,
    scene: 'evidence-wake',
    src: '/demo/voice/01-kit.wav',
  },
  {
    sequence: 2,
    speakerId: 'cliff',
    speaker: 'Cliff · Checkout',
    text: 'R42 went out at 14:14. The TypeError is in applyCoupon. We shipped it without a retry guard.',
    relevant: false,
    scene: 'evidence-wake',
    src: '/demo/voice/02-cliff.wav',
  },
  {
    sequence: 3,
    speakerId: 'sienna',
    speaker: 'Sienna · Payments',
    text: 'Stripe p95 is 342 milliseconds, same as yesterday. I would rule Stripe out.',
    relevant: false,
    scene: 'evidence-wake',
    src: '/demo/voice/03-sienna.wav',
  },
  {
    sequence: 4,
    speakerId: 'kit',
    speaker: 'Kit · Incident commander',
    text: 'Then the release caused it. Patch the missing retry guard, run the focused tests, and prepare a draft PR.',
    relevant: false,
    scene: 'code-patch',
    src: '/demo/voice/04-kit.wav',
  },
  {
    sequence: 5,
    speakerId: 'cliff',
    speaker: 'Cliff · Checkout',
    text: 'Retry is patched. Three tests passed. Draft PR is ready.',
    relevant: false,
    scene: 'code-patch',
    src: '/demo/voice/05-cliff.wav',
  },
  {
    sequence: 6,
    speakerId: 'kit',
    speaker: 'Kit · Incident commander',
    text: 'Email HR and Legal the rollout status, attach the approved policy, and flag that training is only 82 percent complete.',
    relevant: false,
    scene: 'mail-dispatch',
    src: '/demo/voice/06-kit.wav',
  },
  {
    sequence: 7,
    speakerId: 'sienna',
    speaker: 'Sienna · Payments',
    text: 'Sent. One more: check whether Acme was promised SSO or SCIM by October, and draft the correction.',
    relevant: false,
    scene: 'promise-check',
    src: '/demo/voice/07-sienna.wav',
  },
] as const;

export type PreparedClip = (typeof preparedClips)[number];
export type PreparedSpeakerId = (typeof preparedSpeakers)[number]['id'];

export function prefixForPlayback(text: string, progress: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const count = Math.min(
    words.length,
    Math.max(1, Math.ceil(Math.min(1, Math.max(0, progress)) * words.length)),
  );
  return words.slice(0, count).join(' ');
}

export function rmsFromAnalyser(analyser: AnalyserNode): number {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = ((samples[index] ?? 128) - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / samples.length);
}

function waitForEnded(element: HTMLAudioElement, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(`Could not play ${element.currentSrc || 'the prepared clip'}.`));
    };
    const onAbort = () => {
      cleanup();
      element.pause();
      resolve();
    };
    const cleanup = () => {
      element.removeEventListener('ended', finish);
      element.removeEventListener('error', fail);
      signal.removeEventListener('abort', onAbort);
    };
    element.addEventListener('ended', finish, { once: true });
    element.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class PreparedClipPlayer {
  private element: HTMLAudioElement | undefined;
  private context: AudioContext | undefined;
  private analyser: AnalyserNode | undefined;
  private source: MediaElementAudioSourceNode | undefined;
  private stopped = false;

  getAnalyser(): AnalyserNode | undefined {
    return this.analyser;
  }

  getElement(): HTMLAudioElement | undefined {
    return this.element;
  }

  private attachGraph(element: HTMLAudioElement): void {
    if (this.source) return;
    const context = new AudioContext({ latencyHint: 'interactive' });
    const source = context.createMediaElementSource(element);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    analyser.connect(context.destination);
    this.context = context;
    this.source = source;
    this.analyser = analyser;
    void context.resume();
  }

  /**
   * Starts clip 1 in the same turn as the click. Do not await anything else
   * before calling this, or the browser will block playback.
   */
  begin(src: string, signal: AbortSignal): Promise<void> {
    if (this.stopped) return Promise.resolve();
    const element = new Audio(src);
    element.preload = 'auto';
    element.controls = false;
    element.muted = false;
    element.defaultMuted = false;
    element.volume = 1;
    element.playbackRate = 1;
    element.crossOrigin = 'anonymous';
    element.setAttribute('playsinline', 'true');
    this.element = element;
    this.attachGraph(element);
    const started = element.play();
    return started.then(() => waitForEnded(element, signal));
  }

  async play(src: string, signal: AbortSignal): Promise<void> {
    if (this.stopped || signal.aborted) return;
    const element = this.element ?? new Audio();
    this.element = element;
    element.muted = false;
    element.volume = 1;
    if (!this.source) this.attachGraph(element);
    element.src = src;
    await this.context?.resume();
    await element.play();
    await waitForEnded(element, signal);
  }

  stop(): void {
    this.stopped = true;
    const element = this.element;
    this.element = undefined;
    this.analyser = undefined;
    this.source = undefined;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') void context.close();
  }
}
