export default function HomePage() {
  return (
    <main className="shell">
      <h1 className="title">Cross Reality Chess</h1>
      <p className="subtitle">
        Bughouse played across two boards at once — standard chess and xiangqi.
        Whatever you capture lands in your partner&apos;s hand on the other
        board, and it keeps the moves it was born with.
      </p>

      <div className="card">
        <h2 className="panel__title">Play now</h2>
        <p>
          <a href="/local">Hot seat</a> — all four seats on one screen, no
          account and no network. Good for learning the variant.
        </p>
        <p>
          <a href="/lobby">Lobby</a> — open a table online and play 2v2 or 1v1
          against other people. Needs Firebase configured.
        </p>
      </div>

      <div className="card">
        <h2 className="panel__title">The rules, briefly</h2>
        <ul>
          <li>
            Teams are <strong>Xiangqi Red + Chess Black</strong> and{" "}
            <strong>Xiangqi Black + Chess White</strong>.
          </li>
          <li>
            In <strong>2v2</strong> the two boards run independently. In{" "}
            <strong>1v1</strong> one player holds both seats of a team and play
            follows a strict cycle: White, Black, Red, Black.
          </li>
          <li>
            A captured piece goes to your partner and keeps its native movement.
            A cannon dropped on the chess board still needs a screen to capture.
          </li>
          <li>
            The chess board has a <strong>river</strong> down the middle.
            Elephants and advisors cannot cross it; soldiers gain sideways
            movement once past it.
          </li>
          <li>
            Drops onto the <strong>xiangqi</strong> board must land on your own
            side of the river. Drops onto the <strong>chess</strong> board can
            go anywhere.
          </li>
          <li>The first checkmate on either board ends the whole match.</li>
        </ul>
      </div>
    </main>
  );
}
