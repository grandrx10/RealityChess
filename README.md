# Cross Reality Chess

Bughouse played across two boards at once — standard chess on one, xiangqi on
the other. Whatever you capture lands in your partner's hand on the *other*
board, and it keeps the moves it was born with. A cannon captured on the
xiangqi board can be dropped onto the chess board, where it still slides like a
rook and still needs a screen to capture.

## Rules

**Teams.** Xiangqi Red + Chess Black, against Xiangqi Black + Chess White.
Captures feed your partner, so they arrive on the opposite board.

**Turn order.**

- **2v2** — the two boards run independently and simultaneously, like real
  bughouse. Four players, one seat each.
- **1v1** — one player holds both seats of their team, and play follows a
  strict cycle: Chess White, Chess Black, Xiangqi Red, Xiangqi Black.

**The river.** The chess board has one too, down the middle between ranks 4
and 5. It matters only to pieces whose own rules mention it.

**Xiangqi pieces dropped on the chess board**

| Piece | Behaviour on 8×8 |
| --- | --- |
| Chariot | Rook |
| Horse | Knight. House rule: no hobbling leg, so it is a chess knight |
| Cannon | Rook slide; captures only over exactly one screen |
| Elephant | Two points diagonally, blocked by the eye, may not cross the river |
| Advisor | One point diagonally, no palace, may not cross the river |
| Soldier | Forward one; gains sideways movement past the river |

An elephant or advisor is confined to whichever bank it stands on. Since chess
drops are unrestricted, one dropped past the river becomes a permanent raider
in enemy territory rather than being frozen.

**Chess pieces dropped on the xiangqi board** ignore the river and the palace
entirely. A pawn moves and captures as a chess pawn and promotes on rank 10.

**Horses and knights are the same piece.** Standard xiangqi blocks a horse when
the orthogonal square it steps through is occupied; this variant drops that, so
the two are interchangeable wherever they end up.

**Drop placement.** Onto the xiangqi board, you must drop on your own side of
the river. Onto the chess board, anywhere empty. A pawn may not be dropped on
its promotion rank, where it could never move again.

**Endings.** The first checkmate on either board ends the whole match for that
team. Xiangqi keeps its own rule that a stalemated player *loses*, so the two
boards genuinely disagree about what a stalemate means.

## Layout

```
src/rules/        Pure, dependency-free rules engine. No network, no framework.
  types.ts          Core types
  geometry.ts       Board shapes, seats, teams, river and palace tests
  movement.ts       Move generation for all 13 piece types, on either board
  setup.ts          Starting positions
  match.ts          Legality, drops, turn order, endings, applyMove
  rules.test.ts     Unit tests plus perft baselines
src/components/   Board and piece rendering (SVG)
  pieceArt.tsx      GENERATED -- run `npm run art`, never edit by hand
assets/           Licensed source artwork (see ATTRIBUTION.md)
scripts/          The art generator
public/pieces/    GENERATED xiangqi tiles
src/lib/          Firebase client/admin wiring and the match document shape
src/app/          Next.js App Router: home, hot seat, lobby, match, API routes
```

The engine is deliberately transport-agnostic: the server imports it to
validate authoritatively, and the client imports the *same* module to highlight
legal moves. Swapping Firestore for something else touches nothing in
`src/rules`.

## Running it

```bash
npm install
npm run dev
```

`/local` is a hot-seat board that plays the full variant with no backend at
all. Good for learning the rules and for checking that a change to the engine
feels right.

The board carries no labels: a small token beside each side lights up when it
is that side's turn, and whatever a player is holding sits next to it. The only
other controls are the notation toggle (images or 漢字), the mode switch and
new match.

`npm run art` regenerates the piece artwork from `assets/` into
`src/components/pieceArt.tsx` and `public/pieces/`. You only need it if you
change the source art. See ATTRIBUTION.md -- both sets are CC BY-SA 3.0 and
that licence follows the artwork if you publish this.

Pieces are drawn from two sets, and which set a piece came from is the signal
that matters: a piece **on a disc** follows the xiangqi rulebook, wherever it
has been dropped. So a cannon sitting on the chess board still looks like a
xiangqi cannon, and still needs a screen to capture.

`npm test` runs the suite. The chess perft counts (20 / 400 / 8902) are the
published ones, so a regression in that engine fails loudly. The xiangqi counts
(46 / 2096) are variant baselines rather than published values, because the
house rule on horses changes them from the standard 44 / 1920.

## Firebase setup

The online lobby needs a Firebase project.

1. Create a project, then enable **Firestore** and **Anonymous** authentication.
2. Copy `.env.local.example` to `.env.local` and fill it in. The service
   account JSON comes from *Project settings → Service accounts → Generate key*
   and can be pasted as raw JSON or base64.
3. Deploy the rules and the index:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

   The lobby query filters on `status` and orders by `createdAt`, which needs
   the composite index in `firestore.indexes.json`.

### How the backend works

Vercel functions are stateless, so no game state lives in them. Instead:

- **Clients read Firestore directly.** The lobby list and the board both come
  from `onSnapshot` subscriptions, which is what makes them live.
- **Clients never write game documents.** `firestore.rules` denies all client
  writes. Every mutation goes through an API route that verifies the caller's
  ID token, re-runs the rules engine, and commits inside a transaction. That
  transaction is what keeps 2v2's two simultaneous boards from interleaving
  into a corrupt state.

## Deploying to Vercel

Push the repo and import it. Add the same environment variables from
`.env.local` to the Vercel project — `FIREBASE_SERVICE_ACCOUNT` as a secret.
Nothing else needs configuring; the API routes run as Node serverless
functions.

## Known gaps

- **No clocks.** Bughouse lives on time pressure, and 2v2 especially wants
  them. They need a server-authoritative timestamp per seat.
- **Perpetual check and chase** are not implemented. Xiangqi forbids them and
  penalises the offender; right now threefold repetition is scored as a draw on
  both boards instead.
- **Mate is called immediately.** In real bughouse a mated player can be saved
  by a piece arriving from their partner a moment later. Here the match ends
  the instant a player on the clock has no legal move.
- Latency is roughly 200–300ms per move through Firestore. Fine for 1v1's
  strict cycle; if simultaneous 2v2 feels sluggish, the engine is already
  isolated enough to move behind a WebSocket server without touching the rules.
