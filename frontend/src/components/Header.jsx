import { Headphones, ShieldCheck } from "lucide-react";

function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-icon">
          <Headphones size={21} />
        </div>

        <div>
          <div className="brand-title">
            TalentAI Agent
            <span className="candidate-badge">Candidate Room</span>
          </div>

          <div className="brand-subtitle">
            AI-Powered Autonomous Talent Evaluation
          </div>
        </div>
      </div>

      <div className="security-badge">
        <ShieldCheck size={15} />
        <span>Encrypted Session</span>
      </div>
    </header>
  );
}

export default Header;