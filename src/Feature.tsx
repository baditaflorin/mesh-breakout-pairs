import { useEffect, useMemo, useState } from "react";
import {
  MeshNameInput,
  createClockSync,
  useExpiringClaim,
  useNamedPeer,
  useRoster,
  useSharedTimer,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";
import { usePairing } from "../../mesh-common/src/multiplayer/usePairing";

const DEFAULT_DURATION_MS = 5 * 60_000;
const FACILITATOR_TTL_MS = 90_000;

type Props = { room: YRoom | null; roomId?: string; config: MeshConfig };

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function peerLabel(peerId: string, nameOf: (peerId: string) => string | undefined): string {
  return nameOf(peerId) || `Guest ${peerId.slice(0, 5)}`;
}

export function Feature({ room, roomId = "default", config }: Props) {
  const namedPeer = useNamedPeer(config, room);
  const roster = useRoster(room);
  const clock = useMemo(() => createClockSync(room?.provider ?? null), [room?.provider]);
  const [durationMs, setDurationMs] = useState(DEFAULT_DURATION_MS);
  const facilitator = useExpiringClaim(room, "mesh-breakout-pairs:facilitator", FACILITATOR_TTL_MS);
  const timer = useSharedTimer(room, "mesh-breakout-pairs:timer", { durationMs, clock });
  const pairing = usePairing(room, clock, { roundMs: durationMs });

  useEffect(() => () => clock.destroy(), [clock]);

  const isFacilitator = facilitator.isMine;
  const active = timer.state === "running";
  const canStart = Boolean(room && isFacilitator && roster.present.length >= 2);
  const names = (ids: [string] | [string, string]) =>
    ids.map((id) => peerLabel(id, namedPeer.nameOf));

  const start = () => {
    if (!canStart) return;
    timer.start(durationMs);
  };

  const rotate = () => {
    if (!isFacilitator || !room) return;
    pairing.shuffle();
    timer.start(durationMs);
  };

  return (
    <main className="breakout-page">
      <section className="breakout-hero" aria-labelledby="breakout-title">
        <p className="eyebrow">Mesh Breakout Pairs</p>
        <h1 id="breakout-title">Good conversations, on rotation.</h1>
        <p>
          A lightweight facilitator console for pairing a room into two-person conversations. No
          meeting account, central host, or breakout-room server.
        </p>
        <span className={`presence ${room ? "is-live" : ""}`}>
          <span aria-hidden="true" />{" "}
          {room ? `${Math.max(1, roster.present.length)} people in this room` : "Joining room…"}
        </span>
      </section>

      <section className="breakout-grid" aria-label="Breakout controls and pairings">
        <article className="card facilitator-card">
          <p className="eyebrow">Facilitator desk</p>
          <h2>
            {isFacilitator
              ? "You’re guiding this round"
              : facilitator.claimedBy
                ? "Facilitator is active"
                : "Claim the desk"}
          </h2>
          <p className="muted">
            The desk claim expires after 90 seconds of inactivity, so another participant can keep
            the room moving if needed.
          </p>
          {!isFacilitator && (
            <button
              type="button"
              onClick={facilitator.claim}
              disabled={!room || !facilitator.isFree}
            >
              {facilitator.claimedBy ? "Desk already claimed" : "Run this breakout"}
            </button>
          )}
          {isFacilitator && (
            <div className="desk-controls">
              <label>
                Conversation length
                <select
                  value={durationMs}
                  onChange={(event) => setDurationMs(Number(event.target.value))}
                  disabled={active}
                >
                  <option value={3 * 60_000}>3 minutes</option>
                  <option value={5 * 60_000}>5 minutes</option>
                  <option value={8 * 60_000}>8 minutes</option>
                  <option value={10 * 60_000}>10 minutes</option>
                </select>
              </label>
              <div className="control-row">
                {active ? (
                  <button className="primary" type="button" onClick={rotate}>
                    Rotate pairs now
                  </button>
                ) : (
                  <button className="primary" type="button" onClick={start} disabled={!canStart}>
                    Start breakouts
                  </button>
                )}
                {timer.state === "running" && (
                  <button type="button" onClick={timer.pause}>
                    Pause
                  </button>
                )}
                {timer.state === "paused" && (
                  <button type="button" onClick={timer.resume}>
                    Resume
                  </button>
                )}
                {timer.state !== "idle" && (
                  <button className="quiet" type="button" onClick={timer.reset}>
                    End
                  </button>
                )}
              </div>
            </div>
          )}
        </article>

        <article className="card timer-card" aria-live="polite">
          <p className="eyebrow">This round</p>
          <p className="timer-state">
            {timer.state === "running" ? "Talk" : timer.state === "paused" ? "Paused" : "Ready"}
          </p>
          <output aria-label="Time remaining">
            {formatDuration(timer.remainingMs ?? durationMs)}
          </output>
          <p className="muted">
            {timer.state === "finished"
              ? "Time to rotate."
              : active
                ? "The shared clock keeps everyone aligned."
                : "A facilitator starts the shared round clock."}
          </p>
        </article>
      </section>

      <section className="card pairs-card" aria-labelledby="pairs-title">
        <div className="pairs-heading">
          <div>
            <p className="eyebrow">Round {Math.max(1, pairing.round + 1)}</p>
            <h2 id="pairs-title">Your conversation map</h2>
          </div>
          {pairing.myPartnerId && (
            <span className="partner-pill">
              Meet {peerLabel(pairing.myPartnerId, namedPeer.nameOf)}
            </span>
          )}
        </div>
        {pairing.pairings.length === 0 ? (
          <p className="empty">Invite at least one other person to create pairs.</p>
        ) : (
          <ol className="pair-list">
            {pairing.pairings.map((pair, index) => (
              <li
                className={pair.includes(room?.peerId ?? "") ? "is-mine" : ""}
                key={pair.join("-")}
              >
                <span>#{index + 1}</span>
                <strong>{names(pair).join(pair.length === 2 ? "  +  " : " · ")}</strong>
                <small>
                  {pair.length === 2 ? "Find each other" : "Triad host / floating guest"}
                </small>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="identity-row card">
        <div>
          <p className="eyebrow">Your card</p>
          <h2>{namedPeer.myName || "Add your name"}</h2>
        </div>
        <MeshNameInput
          value={namedPeer.name}
          onChange={namedPeer.setName}
          ariaLabel="Your display name"
          placeholder="How should your partner call you?"
          maxLength={32}
        />
      </section>
      <p className="security-note">
        Pairings are deterministic from the shared roster and fair room randomness. The desk is a
        coordination tool, not an access-control boundary.
      </p>
    </main>
  );
}
