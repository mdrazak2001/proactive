import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { reducers, tables } from './module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import LiveMeetingStage from './features/war-room/LiveMeetingStage';
import { PreparedClipPlayer, preparedClips, prefixForPlayback } from './features/war-room/preparedVoice';
import './App.css';

const ROOM_ID = 'checkout-r42';

function compareBigInt(a: bigint, b: bigint) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function ProactiveMark() {
  return (
    <div className="brand-mark" aria-label="Proactive">
      <span className="brand-mark__signal"><i /><i /><i /></span>
      <span>PROACTIVE</span>
    </div>
  );
}

function JoinScreen({ connected, onJoin }: {
  connected: boolean;
  onJoin: (name: string, role: string) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Incident commander');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() && connected) onJoin(name.trim(), role);
  };

  return (
    <main className="join-shell">
      <div className="join-shell__topline">
        <ProactiveMark />
        <span className={`connection-pill ${connected ? 'is-live' : ''}`}>
          <span /> {connected ? 'Realtime ready' : 'Connecting'}
        </span>
      </div>
      <section className="join-card">
        <div className="join-card__eyebrow">LIVE INCIDENT ROOM · SEV-1</div>
        <h1>Join the checkout<br />investigation.</h1>
        <p>One shared incident bridge. What the room says out loud opens the actions every responder can see.</p>
        <form onSubmit={submit}>
          <label>
            Display name
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              autoComplete="nickname"
              autoFocus
              placeholder="Your name"
            />
          </label>
          <fieldset>
            <legend>Your role</legend>
            {['Incident commander', 'Responder', 'Observer'].map(option => (
              <button
                type="button"
                key={option}
                aria-pressed={role === option}
                className={role === option ? 'role-option is-selected' : 'role-option'}
                onClick={() => setRole(option)}
              >
                <span>{option}</span>
                <i>{role === option ? 'Selected' : 'Join as'}</i>
              </button>
            ))}
          </fieldset>
          <button className="primary-button" disabled={!connected || !name.trim()} type="submit">
            Enter war room <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
      <p className="join-shell__footnote">Google sign-in · No production credentials · Every action is visible</p>
    </main>
  );
}

function App() {
  const { isActive: connected } = useSpacetimeDB();
  const [joined, setJoined] = useState(() => sessionStorage.getItem('proactive_joined') === 'true');
  const [displayName, setDisplayName] = useState(() => sessionStorage.getItem('proactive_name') ?? '');
  const [role, setRole] = useState(() => sessionStorage.getItem('proactive_role') ?? 'Incident commander');
  const [playing, setPlaying] = useState(false);
  const [activeSequence, setActiveSequence] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [rooms] = useTable(tables.incidentRoom);
  const [participants] = useTable(tables.participant);
  const [segments] = useTable(tables.transcriptSegment);
  const [transcriptRuns] = useTable(tables.transcriptRun);
  const [requests] = useTable(tables.investigationRequest);

  const createDemoRoom = useReducer(reducers.createDemoRoom);
  const joinRoom = useReducer(reducers.joinRoom);
  const acquireTranscriptRun = useReducer(reducers.acquireTranscriptRun);
  const releaseTranscriptRun = useReducer(reducers.releaseTranscriptRun);
  const publishTranscriptResult = useReducer(reducers.publishTranscriptResult);
  const finalizeTranscriptSegment = useReducer(reducers.finalizeTranscriptSegment);
  const discardTranscriptInterim = useReducer(reducers.discardTranscriptInterim);
  const proposeInvestigation = useReducer(reducers.proposeInvestigation);
  const resetDemo = useReducer(reducers.resetDemo);

  const roomRequested = useRef(false);
  const participantJoinRequested = useRef(false);
  const playbackGenerationRef = useRef(0);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const audioPlayerRef = useRef<PreparedClipPlayer | null>(null);
  const room = rooms.find(item => item.roomId === ROOM_ID);
  const activeTranscriptRun = transcriptRuns.find(item => item.roomId === ROOM_ID);
  const roomParticipants = participants.filter(item => item.roomId === ROOM_ID && item.online);
  const roomSegments = useMemo(
    () => segments.filter(item => item.roomId === ROOM_ID).sort((a, b) => a.sequence - b.sequence),
    [segments]
  );
  const roomRequests = useMemo(
    () => requests.filter(item => item.roomId === ROOM_ID).sort((a, b) => compareBigInt(a.id, b.id)),
    [requests]
  );
  const request = roomRequests.length > 0 ? roomRequests[roomRequests.length - 1] : undefined;

  useEffect(() => {
    if (!connected || room || roomRequested.current) return;
    roomRequested.current = true;
    Promise.resolve(createDemoRoom({ roomId: ROOM_ID, title: 'Checkout degradation after R42' }))
      .catch(reason => setError(String(reason)));
  }, [connected, createDemoRoom, room]);

  useEffect(() => {
    if (!connected) {
      participantJoinRequested.current = false;
      return;
    }
    if (!joined || !room || participantJoinRequested.current) return;
    participantJoinRequested.current = true;
    Promise.resolve(joinRoom({ roomId: ROOM_ID, displayName, role }))
      .catch(reason => {
        participantJoinRequested.current = false;
        setError(String(reason));
      });
  }, [connected, displayName, joinRoom, joined, role, room]);

  useEffect(() => () => {
    playbackGenerationRef.current += 1;
    playbackAbortRef.current?.abort();
    playbackAbortRef.current = null;
    const player = audioPlayerRef.current;
    audioPlayerRef.current = null;
    if (player) void player.stop();
  }, []);

  const handleJoin = async (name: string, selectedRole: string) => {
    setDisplayName(name);
    setRole(selectedRole);
    sessionStorage.setItem('proactive_joined', 'true');
    sessionStorage.setItem('proactive_name', name);
    sessionStorage.setItem('proactive_role', selectedRole);
    setJoined(true);
    participantJoinRequested.current = true;
    try {
      await joinRoom({ roomId: ROOM_ID, displayName: name, role: selectedRole });
    } catch (reason) {
      participantJoinRequested.current = false;
      setError(String(reason));
    }
  };

  /** The stage reads speaker amplitude from the clip that is actually playing. */
  const getAnalyser = useCallback(() => audioPlayerRef.current?.getAnalyser(), []);

  const playIncident = async () => {
    if (playing || roomSegments.length || request || activeTranscriptRun) return;
    const playbackGeneration = playbackGenerationRef.current + 1;
    playbackGenerationRef.current = playbackGeneration;
    const runId = crypto.randomUUID();
    const abortController = new AbortController();
    const audioPlayer = new PreparedClipPlayer();
    playbackAbortRef.current = abortController;
    audioPlayerRef.current = audioPlayer;
    let currentSequence: number | null = null;
    let runLeaseAcquired = false;
    setPlaying(true);
    setError('');
    try {
      // Start Kit's first clip in this click turn, before any network wait.
      let pendingPlayback = audioPlayer.begin(preparedClips[0].src, abortController.signal);
      await acquireTranscriptRun({ roomId: ROOM_ID, runId });
      runLeaseAcquired = true;

      for (const [index, clip] of preparedClips.entries()) {
        if (playbackGenerationRef.current !== playbackGeneration) return;
        if (abortController.signal.aborted) return;
        currentSequence = clip.sequence;
        setActiveSequence(clip.sequence);
        const publishInterim = async (text: string) => {
          await publishTranscriptResult({
            roomId: ROOM_ID,
            sequence: clip.sequence,
            speaker: clip.speaker,
            text,
            relevant: clip.relevant,
            isFinal: false,
          });
        };
        await publishInterim(prefixForPlayback(clip.text, 0.08));
        const element = audioPlayer.getElement();
        const progressTimer = window.setInterval(() => {
          if (!element?.duration) return;
          void publishInterim(prefixForPlayback(clip.text, element.currentTime / element.duration));
        }, 90);
        await pendingPlayback;
        window.clearInterval(progressTimer);
        if (playbackGenerationRef.current !== playbackGeneration) return;
        await publishTranscriptResult({
          roomId: ROOM_ID,
          sequence: clip.sequence,
          speaker: clip.speaker,
          text: clip.text,
          relevant: clip.relevant,
          isFinal: true,
        });
        await finalizeTranscriptSegment({ roomId: ROOM_ID, sequence: clip.sequence });
        currentSequence = null;
        setActiveSequence(null);
        const next = preparedClips[index + 1];
        pendingPlayback = next
          ? audioPlayer.play(next.src, abortController.signal)
          : Promise.resolve();
      }

      if (playbackGenerationRef.current !== playbackGeneration) return;
      await proposeInvestigation({
        roomId: ROOM_ID,
        sourceSegmentId: 0n,
        prompt: 'Did R42 cause the checkout TypeErrors, or is Stripe degrading?',
        targetService: 'checkout-api',
        windowMinutes: 15,
        constraints: 'No writes · No shell · No production changes',
      });
    } catch (reason) {
      const cancelledByCaller = abortController.signal.aborted;
      if (!cancelledByCaller) abortController.abort();
      if (currentSequence !== null) {
        try {
          await discardTranscriptInterim({ roomId: ROOM_ID, sequence: currentSequence });
        } catch {
          // Keep the original transport error; reset remains available if the
          // client disconnected before cleanup could reach SpacetimeDB.
        }
      }
      if (!cancelledByCaller) setError(String(reason));
    } finally {
      if (runLeaseAcquired) {
        try {
          await releaseTranscriptRun({ roomId: ROOM_ID, runId });
        } catch (reason) {
          if (!abortController.signal.aborted) setError(current => current || String(reason));
        }
      }
      await audioPlayer.stop();
      if (playbackAbortRef.current === abortController) playbackAbortRef.current = null;
      if (audioPlayerRef.current === audioPlayer) audioPlayerRef.current = null;
      if (playbackGenerationRef.current === playbackGeneration) {
        setActiveSequence(null);
        setPlaying(false);
      }
    }
  };

  const handleReset = async () => {
    setError('');
    try {
      playbackAbortRef.current?.abort();
      playbackAbortRef.current = null;
      const player = audioPlayerRef.current;
      audioPlayerRef.current = null;
      if (player) player.stop();
      playbackGenerationRef.current += 1;
      setActiveSequence(null);
      setPlaying(false);
      if (role !== 'Incident commander') {
        await joinRoom({ roomId: ROOM_ID, displayName, role: 'Incident commander' });
        setRole('Incident commander');
        sessionStorage.setItem('proactive_role', 'Incident commander');
      }
      await resetDemo({ roomId: ROOM_ID });
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (!joined) return <JoinScreen connected={connected && Boolean(room)} onJoin={handleJoin} />;

  return (
    <div className="app-shell">
      <header className="war-header">
        <div className="war-header__inner">
          <ProactiveMark />
          <div className="incident-identity">
            <strong>{room?.title ?? 'Opening incident room…'}</strong>
            <span>INC-2048 · SEV-1</span>
          </div>
          <div className="war-header__state">
            <span>{roomParticipants.length} connected</span>
            <span className={connected ? 'is-live' : ''}>{connected ? 'Live' : 'Reconnecting'}</span>
            {(playing || roomSegments.length > 0 || Boolean(activeTranscriptRun)) && (
              <button type="button" onClick={() => void handleReset()}>
                Reset transcript
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="stage-page">
        <LiveMeetingStage
          segments={roomSegments}
          activeSequence={activeSequence}
          playing={playing}
          connected={connected}
          started={playing || roomSegments.length > 0 || Boolean(activeTranscriptRun)}
          busy={playing}
          getAnalyser={getAnalyser}
          onStart={() => void playIncident()}
        />
      </div>

      {error && <div className="error-toast" role="alert"><strong>Couldn’t complete that action</strong><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    </div>
  );
}

export default App;
