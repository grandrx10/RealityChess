export default function HomePage() {
  return (
    <main className="shell">
      <h1 className="title">Cross Reality Chess</h1>
      <p className="subtitle">Bughouse across a chess board and a xiangqi board.</p>
      <div className="row">
        <a className="btn" href="/local">
          Hot seat
        </a>
        <a className="btn" href="/lobby">
          Lobby
        </a>
      </div>
    </main>
  );
}
