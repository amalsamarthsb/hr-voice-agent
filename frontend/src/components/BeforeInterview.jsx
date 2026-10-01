import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mic,
  ShieldCheck,
} from "lucide-react";


export default function BeforeInterview({
  job,
  resume,
  questions,
  onStart,
  onBack,
  loading,
}) {
  return (
    <div className="before-interview-page">

      <div className="before-interview-card">

        <div className="before-header">

          <div className="before-icon">
            <Mic size={28} />
          </div>

          <h1>
            Your AI Interview is Ready
          </h1>

          <p>
            Please review the information
            below before starting.
          </p>

        </div>


        <div className="interview-summary">

          <div className="summary-item">

            <span>
              Position
            </span>

            <strong>
              {job?.title ||
                job?.job_title ||
                "Selected Position"}
            </strong>

          </div>


          <div className="summary-item">

            <span>
              Resume
            </span>

            <strong>
              {resume?.filename ||
                resume?.file_name ||
                "Selected Resume"}
            </strong>

          </div>


          <div className="summary-item">

            <span>
              Questions
            </span>

            <strong>
              {questions?.length || 0}
            </strong>

          </div>

        </div>


        <div className="instructions">

          <h2>
            Before you begin
          </h2>

          <div className="instruction-item">

            <CheckCircle2 size={19} />

            <span>
              Make sure your microphone
              is working.
            </span>

          </div>

          <div className="instruction-item">

            <CheckCircle2 size={19} />

            <span>
              Sit somewhere quiet where
              you can speak clearly.
            </span>

          </div>

          <div className="instruction-item">

            <CheckCircle2 size={19} />

            <span>
              Answer each question naturally
              and clearly.
            </span>

          </div>

          <div className="instruction-item">

            <CheckCircle2 size={19} />

            <span>
              The interview will record
              your responses for HR review.
            </span>

          </div>

        </div>


        <div className="privacy-notice">

          <ShieldCheck size={20} />

          <div>

            <strong>
              Privacy & Review
            </strong>

            <p>
              Your interview responses are
              processed for the recruitment
              process. AI evaluation results
              are internal HR information and
              are not shown to candidates.
            </p>

          </div>

        </div>


        <div className="before-actions">

          <button
            type="button"
            className="back-button"
            onClick={onBack}
            disabled={loading}
          >
            <ArrowLeft size={18} />
            Back
          </button>


          <button
            type="button"
            className="start-button"
            onClick={onStart}
            disabled={
              loading ||
              !questions ||
              questions.length === 0
            }
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                Preparing...
              </>
            ) : (
              <>
                <Mic size={18} />
                Begin Voice Interview
              </>
            )}
          </button>

        </div>

      </div>

    </div>
  );
}