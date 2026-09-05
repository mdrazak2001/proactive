# Proactive — Midnight Moonshot Build Brief

## Purpose of this document

This is the source of truth for the 24-hour hackathon build. It is written so a coding agent can implement the project without reopening product-scope debates. Preserve the product statement and the scope cuts unless a blocker makes a change necessary.

## Locked product statement

**Proactive helps product teams turn one verbal meeting commitment into an agreed, ready-to-review next step before everyone leaves the room.**

### What this means

Proactive is a meeting-to-action dispatch agent. A transcript is input, not the product. The valuable moment is that a vague spoken commitment becomes a specific proposal, the people present can correct or approve it, and a connected work app starts the first reversible piece of work while everyone can see the result.

### First user and first scenario

Start with **small product teams in product/design review meetings**. They already move work between meeting calls, Notion, GitHub, Figma, Linear, Slack, and email.

The demo scenario is deliberately narrower:

> “Mohammed, document the mobile computer-use research today.”

Proactive proposes one work item, lets the room edit, redirect, approve, or skip it, then dispatches it through one demo connector. For the first working integration, use one controlled test destination only, such as a GitHub issue in a test repository or a Notion page in a test workspace. Do not claim that every destination is implemented.

## Product thesis and differentiation

Existing meeting tools already summarize calls, generate action items, draft emails, and integrate with work tools. Do not claim that Proactive is the first tool to turn transcripts into tasks.

The defensible thesis is:

> Meeting notes preserve what happened. Proactive resolves the one commitment that must leave the meeting as work already in motion.

Existing note-taker behaviour is usually capture, recap, then downstream review. Proactive adds a shared, real-time execution contract:

1. Detect a single explicit commitment.
2. Turn it into a concrete proposed action with a destination.
3. Let a human approve, edit, redirect, or skip it before dispatch.
4. Show a live, shared audit trail until the result is ready to review.

The agent never sends or publishes anything without approval. “Ready to review” is the success state for the hackathon. Do not implement automatic email sending, calendar invites to real people, or any irreversible production change.

## Device thesis

Proactive is **device-agnostic for capture and phone-first for control**, not “mobile transcription software.”

- Laptop: primary capture/execution surface for Zoom, Google Meet, Teams, pasted transcript text, or uploaded audio.
- Phone: lightweight control surface for approval, redirecting, and receiving status; later it can capture in-person/hybrid meetings.
- Both surfaces: the same responsive web app, connected to the same live room.

For the hackathon build a responsive web app / PWA. Do not build native Android or iOS apps. It must open by URL on an iPhone, Android phone, and laptop without an app-store install.

The phone view proves that control remains with the human. The laptop view proves that the agent is actually doing work. The SpacetimeDB module proves that both surfaces share live state.

## Hackathon constraints — non-negotiable

This is the Midnight Moonshot builder handbook context.

- 24-hour, in-person hackathon in Bengaluru, September 5–6, 2026.
- Track: **Agents**. The selected prompt is “Agents work for one person at a time.”
- SpacetimeDB must be at the core. The real-time logic must live in a module deployed to Maincloud. This is the highest-weighted criterion.
- Use fresh code only. Create the repo during the hackathon window; do not use proprietary or employer code.
- The build must open and work on a phone and from a live URL.
- Judges test two tabs: act in one and see the other update without a refresh. They also inspect tables, reducers, and subscriptions in the module.
- The core task must work end-to-end for a first-time user in under three minutes.
- Submission qualification includes a public demo video under three minutes, a public post linking every build, an explicit one-liner, email communications, password-free entry within 30 seconds, and onboarding.
- Market readiness is 30 points: positioning, a credible first-500-user channel, and traction. Get real people into the room after launch.

Important schedule from the handbook:

- 14:00–15:00: deploy the module and create the skeleton.
- 15:00–19:00: make the two-client live core loop work.
- 19:00–21:00: make a stranger able to enter and understand it.
- 21:30: launch post and live product.
- 21:30–00:00: get approximately 25 people to try it and observe friction.
- 08:30: code freeze.

## Demo scope — lock this

### Build

1. A named room opened from a shareable URL.
2. Two connected web clients: desktop/execution view and mobile/control view.
3. A prepared transcript that arrives as live chunks.
4. One candidate commitment detected from that transcript.
5. Proposal controls: **Approve**, **Edit**, **Redirect**, **Skip**.
6. Shared status transitions: `Detected` → `Proposed` → `Edited or redirected` → `Approved` → `Dispatching` → `Ready to review`.
7. One real or transparently labelled demo connector to a controlled test destination.
8. Result URL or result card visible on both connected clients.

### Do not build

- Native Android or iOS apps.
- Always-on phone listening.
- Production Zoom/Meet/Teams bots.
- Full speech-to-text infrastructure before the core loop works.
- More than one real work-app integration.
- Authentication, billing, settings, workspace administration, or complex permissions.
- Automatic sending, publishing, scheduling, or destructive actions.
- A generic dashboard, a giant task list, or a full meeting archive.

### Transcript implementation order

Start with deterministic demo transcript playback. It must look live, but it does not need real microphone input.

After the full shared loop works, optionally add a simple pasted-transcript field. Add real microphone/STT only if there is surplus time. The hackathon does not reward audio infrastructure over a working live loop.

## Core UX

### The experience in one sentence

While a team is still in the meeting, Proactive condenses one spoken promise into a large, shared action card, lets a human correct it, and visibly prepares the first work artifact.

### Desktop / laptop view

This is the meeting and execution surface.

- Header: room name, participants/presence, “Live” connection indicator.
- Left/upper area: calm transcript stream. It is secondary visual context, not the primary focal point.
- Center: one large action card. This should dominate the screen.
- Card content: the quote/source line, interpreted action, owner, chosen destination, and current status.
- Right/lower activity rail: time-stamped events such as “Devon redirected destination to Notion”, “Mohammed approved”, “Agent created draft”.
- Final result: a prominent “Ready to review” state and safe link to the controlled test artifact.

### Phone view

This is the human control surface.

- Header: `Proactive is listening` or `Meeting in progress`.
- Background: a compact transcript with the relevant spoken line highlighted.
- Foreground: a bottom-sheet-like commitment card that says `I heard a next step`.
- Buttons: `Approve`, `Edit`, `Redirect`, `Skip`. Each must have a clear active/disabled state.
- After approval: the same card becomes a compact status timeline and result link.

### Signature interaction

The transcript line that contains the commitment visually condenses into the action card. This is the visual proof of the product’s purpose: conversation becomes work.

### Design direction

Use a calm operational look, closer to a meeting margin or a live handoff than a generic SaaS dashboard.

- One focal card, not a grid of cards.
- Dense but quiet transcript context, high-contrast proposal and result.
- Dark ink / graphite surfaces, warm off-white text, a single green or electric-lime accent for the live/approved state, muted amber for “needs review.”
- Use colour for status, not decoration.
- Prioritize mobile legibility and 44px minimum touch targets.

## SpacetimeDB architecture

Use the current React + TypeScript SpacetimeDB quickstart as the starting point. Keep the Maincloud module genuinely responsible for the shared state, not as a token database.

### Tables

- `rooms`: room id, title, created time, state.
- `participants`: room id, identity, display name, device role, presence.
- `transcript_chunks`: room id, sequence, speaker, text, timestamp, highlighted flag.
- `action_proposals`: room id, source chunk id, action text, owner, destination, status, version.
- `proposal_edits`: proposal id, editor, prior value, new value, timestamp.
- `approvals`: proposal id, participant id, decision, timestamp.
- `execution_runs`: proposal id, connector type, status, result URL, error text, timestamp.
- `activity_events`: room id, event type, actor, body, timestamp.

### Reducers

- `create_room`
- `join_room`
- `append_transcript_chunk`
- `create_action_proposal`
- `edit_action_proposal`
- `redirect_action_proposal`
- `approve_action_proposal`
- `skip_action_proposal`
- `start_execution`
- `update_execution_status`

Every user-visible state change must flow through reducers. Both clients subscribe to the room-scoped tables and update immediately when reducers write new rows.

### Client behaviour

- Use the generated TypeScript bindings plus SpacetimeDB React hooks.
- Subscribe only to the current room’s data.
- Use reducers for all mutations; do not maintain a separate fake WebSocket state layer.
- Keep connection, loading, and reconnect states visible but quiet.
- Demonstrate two tabs with different responsive layouts against the same room id.

### Connector boundary

Model dispatch as an adapter behind `start_execution`.

- First write an `execution_runs` row with `dispatching` status.
- Invoke the one selected controlled connector.
- Write status updates and the result URL back to SpacetimeDB.
- Use a test repository/workspace and never place access tokens in client code or the public repository.
- If a real connector cannot be made safe and reliable in time, label the fallback `Demo connector` clearly. Do not fake a production integration.

## Acceptance tests

The build is ready for launch only when all of these pass:

1. A first-time user can open a URL, enter a display name, and join the demo room in under 30 seconds.
2. Two browsers connected to one room see each incoming transcript chunk without refresh.
3. A prepared commitment creates the same proposal on both clients.
4. A phone user edits, redirects, approves, or skips a proposal; the desktop client reflects that change in under one second.
5. Approval starts a visible execution run.
6. The final safe result is visible on phone and desktop.
7. A user can explain the product in one sentence after using it.
8. The module is deployed to Maincloud and the public URL works on an iPhone/Android-sized viewport.

## Demo script — 90 seconds

1. Open the desktop room and phone room from the same link.
2. Say: “This is Proactive. It turns a meeting commitment into an approved next step while the context is still alive.”
3. Start the prepared transcript. Let 2–3 neutral lines stream in.
4. Stream the commitment: “Mohammed, document the mobile computer-use research today.”
5. Show the proposal appear live on both screens.
6. On the phone, redirect or edit one detail. For example, change the destination to the one demo connector.
7. Approve it on the phone.
8. On desktop, show `Dispatching` progress and the shared activity trail.
9. Show `Ready to review` and the created draft/test artifact on both screens.
10. Close with: “The transcript is the sensor. The product is the shared, human-approved dispatch.”

## Judge and investor questions

### Why not just use an existing note taker?

Existing tools are strong at recording, summarising, extracting action items, and integrating with systems. Proactive targets the last moment of ambiguity: agreeing on exactly one action and visibly moving it into motion while everyone who made the decision can still correct it.

### Why a phone?

The phone is optional capture and primary control. Laptop capture handles normal video calls. Phone control keeps approval and redirection in the human’s hand, works for in-person/hybrid meetings later, and gives the team an independent surface that can watch the desktop execution.

### Why real-time shared state?

Meeting context expires quickly. The people who can clarify a vague commitment are in the room now. The shared action state gives them a chance to correct the agent before work begins.

### Why start with product/design teams?

They have frequent review meetings and a visible, multi-tool handoff problem. The first connector is intentionally narrow; the dispatch model can later support more work systems.

## User testing and traction plan

Get 10–25 hackathon attendees to use the demo room. Ask only behavioural questions:

1. “When did a meeting follow-up last slip?”
2. “What did you do after the meeting?”
3. “Where did the commitment end up?”
4. “What was frustrating about the current workaround?”

Do not ask “Would you use this?” Record quotes, task completion, and confusion points. Use the best real quote in the demo/pitch only with permission.

First-500-users plan: post short build clips and a launch demo in product-builder, design-builder, and hackathon communities; offer a shareable meeting room, not a waitlist-only landing page. The immediate hackathon goal is live evidence, not scale.

## Sources and links

- Hackathon handbook: https://worldtour.spacetimedb.com/handbook
- Hackathon rules: https://worldtour.spacetimedb.com/handbook#7
- Hackathon evaluation: https://worldtour.spacetimedb.com/handbook#8
- Hackathon build timeline: https://worldtour.spacetimedb.com/handbook#5
- Hackathon tracks: https://worldtour.spacetimedb.com/handbook#6
- Problem-hunting deck: https://docs.google.com/presentation/d/1coKxQT5QekIEfHkez3_Q2clTEcp7OON1jhSR4LBqXy0/edit
- SpacetimeDB React quickstart: https://spacetimedb.com/docs/quickstarts/react/
- SpacetimeDB TypeScript SDK / React bindings: https://spacetimedb.com/docs/clients/typescript/
- SpacetimeDB reducers: https://spacetimedb.com/docs/functions/reducers/
- SpacetimeDB subscriptions: https://spacetimedb.com/docs/clients/subscriptions/
- SpacetimeDB Maincloud deployment: https://spacetimedb.com/docs/how-to/deploy/maincloud/
- Otter action-item behaviour: https://help.otter.ai/hc/en-us/articles/5093228433687-Conversation-Page-Overview
- Otter voice actions: https://help.otter.ai/hc/en-us/articles/30910450353431-Otter-AI-Chat-voice-commands-and-actions
- Otter Jira connector: https://help.otter.ai/hc/en-us/articles/40485786582551-Connect-Jira-to-Otter-ai
- Zoom device mix: https://www.zoom.com/en/resources/video-audio-quality-report/

## Paste-ready build prompt for an implementation agent

```text
You are building Proactive for the Midnight Moonshot hackathon. Read this entire brief and treat it as the product specification.

Product statement: “Proactive helps product teams turn one verbal meeting commitment into an agreed, ready-to-review next step before everyone leaves the room.”

Build a mobile-first responsive React + TypeScript web application backed by a real SpacetimeDB TypeScript module deployed to Maincloud. SpacetimeDB must own the real-time shared room state. Use generated bindings, subscriptions, and reducers for all mutations. Do not use a separate mock WebSocket layer.

The product has two surfaces against the same room URL:
1. Desktop meeting/execution view: incoming live transcript, dominant action proposal, activity timeline, visible execution status, safe result link.
2. Mobile control view: compact transcript context and a large commitment card with Approve, Edit, Redirect, Skip. Approval must visibly control the desktop execution state in real time.

The transcript is a sensor, not the core product. Start with deterministic prepared transcript playback. Do not spend time building microphone transcription, native mobile apps, meeting bots, auth, settings, or multiple integrations.

Build the full loop:
room join → transcript chunks stream into both clients → one commitment creates a proposal → user edits/redirects/approves/skips from phone → both clients update without refresh → visible dispatch run → ready-to-review result.

Use a controlled test connector only. Never send an email, publish content, create appointments, or mutate production data. If a safe real connector cannot be completed, label the fallback “Demo connector” plainly; do not imply it is a production integration.

Required SpacetimeDB tables: rooms, participants, transcript_chunks, action_proposals, proposal_edits, approvals, execution_runs, activity_events.
Required reducers: create_room, join_room, append_transcript_chunk, create_action_proposal, edit_action_proposal, redirect_action_proposal, approve_action_proposal, skip_action_proposal, start_execution, update_execution_status.

Design: calm, high-craft operational UI. Do not make a generic dashboard or card grid. Use one dominant commitment card. Transcript is quiet context. The commitment line should visually condense into the action card. Mobile controls need generous touch targets. Use status color sparingly.

Acceptance criteria:
- A first-time user enters with a name in under 30 seconds.
- Two browser clients in the same room update in under one second without refresh.
- Phone approve/edit/redirect/skip changes desktop state live.
- Approval starts a visible execution run and both clients see the final safe result.
- The app works on phone-sized viewports and a public URL.
- The Maincloud module and its reducers/subscriptions are clearly used by the product.

Implementation order:
1. Bootstrap from the SpacetimeDB React/TypeScript quickstart and deploy a bare module to Maincloud immediately.
2. Create rooms, participants, subscriptions, and a two-tab live “hello” state.
3. Implement transcript playback and streamed shared chunks.
4. Implement proposal lifecycle reducers and the phone control card.
5. Implement desktop execution timeline and activity events.
6. Add one safe controlled connector or a clearly labelled demo connector.
7. Polish responsive views, loading/error states, onboarding, and a seeded demo room.
8. Test with two devices/tabs and record a 90-second demo.

Before making broad changes, inspect the existing repository and preserve its conventions. Keep code clear, typed, and small. Report blockers early, especially Maincloud access, module deployment, connector credentials, or any need for an external permission.
```
