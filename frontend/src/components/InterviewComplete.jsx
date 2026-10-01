import {
  CheckCircle,
  Clock,
  Mail,
  ShieldCheck,
} from "lucide-react";

function InterviewComplete({ candidate, onReturn }) {
  return (
    <section className="complete-section">
      <div className="glass-panel complete-card">
        <div className="complete-icon">
          <CheckCircle size={34} />
        </div>

        <h1>Interview Submitted Successfully!</h1>

        <p>
          Thank you{" "}
          <strong>{candidate.name || "Candidate"}</strong>.
          Your interview responses have been securely submitted
          to the HR system.
        </p>

        <div className="completion-grid">
          <div className="completion-item">
            <CheckCircle size={19} />

            <div>
              <span>Status</span>
              <strong>Submitted</strong>
            </div>
          </div>

          <div className="completion-item">
            <ShieldCheck size={19} />

            <div>
              <span>Evaluation</span>
              <strong>HR Review Only</strong>
            </div>
          </div>

          <div className="completion-item">
            <Clock size={19} />

            <div>
              <span>Next Step</span>
              <strong>HR Review</strong>
            </div>
          </div>
        </div>

        <div className="next-step-box">
          <div className="next-step-title">
            <Mail size={17} />
            What happens next?
          </div>

          <p>
            Your interview transcript and AI-generated evaluation
            have been submitted to the HR team. The HR team will
            review the interview and contact you regarding the next
            stage of the recruitment process.
          </p>
        </div>

        <button
          className="primary-button centered-button"
          onClick={onReturn}
        >
          Return to Home Portal
        </button>
      </div>
    </section>
  );
}

export default InterviewComplete;