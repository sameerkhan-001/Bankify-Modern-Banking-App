import Icon from './Icon.jsx';

/** Pure CSS/SVG hero art (no images): tilted bank card + shield. */
export function CardArt() {
  return (
    <div className="card-art" aria-hidden="true">
      <div className="card-art-glow" />
      <div className="card-art-card">
        <div className="card-art-chip" />
        <div className="card-art-lines">
          <span /> <span /> <span />
        </div>
        <div className="card-art-bank">
          <Icon name="bank" size={22} />
        </div>
      </div>
      <div className="card-art-shield">
        <Icon name="shieldCheck" size={44} strokeWidth={1.6} />
      </div>
      <span className="orb orb-1" />
      <span className="orb orb-2" />
      <span className="orb orb-3" />
    </div>
  );
}

export function BankArt() {
  return (
    <div className="bank-art" aria-hidden="true">
      <div className="bank-art-glow" />
      <div className="bank-art-tile">
        <Icon name="bank" size={64} strokeWidth={1.4} />
      </div>
      <span className="orb orb-1" />
      <span className="orb orb-2" />
    </div>
  );
}
