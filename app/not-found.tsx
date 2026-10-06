import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="app notFoundPage">
      <div className="notFoundCard">
        <div className="identityMark"><span>R</span><b>RANG</b><small>1.0</small></div>
        <p className="eyebrow">NO SUCH PLACE</p>
        <h1>YOU TOOK A WRONG TURN.</h1>
        <p>The road ends here. There are still five worlds waiting for you.</p>
        <Link className="primaryButton" href="/">BACK TO RANG →</Link>
      </div>
    </main>
  );
}
