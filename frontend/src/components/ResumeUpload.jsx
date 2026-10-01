import { useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  CloudUpload,
  FileText,
  Lock,
} from "lucide-react";

function ResumeUpload({
  candidate,
  updateCandidate,
  resume,
  onResumeUploaded,
  onContinue,
}) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file) => {
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PDF or DOC/DOCX resume.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Resume must be smaller than 10MB.");
      return;
    }

    onResumeUploaded(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];

    handleFile(file);
  };

  const handleContinue = () => {
    if (!candidate.name.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!candidate.email.trim()) {
      alert("Please enter your email.");
      return;
    }

    if (!resume) {
      alert("Please upload your resume first.");
      return;
    }

    onContinue();
  };

  return (
    <section className="setup-section">
      <div className="page-heading">
        <span className="step-pill">Step 1 of 3</span>

        <h1>Welcome! Let's get you set up.</h1>

        <p>
          Verify your candidate information and upload your resume so the AI
          HR Agent can personalize your interview.
        </p>
      </div>

      <div className="glass-panel setup-card">
        <div className="candidate-grid">
          <div className="field">
            <label>Full Name</label>

            <input
              type="text"
              value={candidate.name}
              placeholder="Enter your full name"
              onChange={(event) =>
                updateCandidate({
                  name: event.target.value,
                })
              }
            />
          </div>

          <div className="field">
            <label>Email Address</label>

            <input
              type="email"
              value={candidate.email}
              placeholder="Enter your email"
              onChange={(event) =>
                updateCandidate({
                  email: event.target.value,
                })
              }
            />
          </div>

          <div className="field full-width">
            <label>Target Position</label>

            <div className="locked-input">
              <input
                type="text"
                value={candidate.jobTitle}
                readOnly
              />

              <Lock size={15} />
            </div>
          </div>
        </div>

        <div className="upload-section">
          <label>Resume / CV</label>

          <div
            className={`dropzone ${dragging ? "dragging" : ""} ${
              resume ? "uploaded" : ""
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              hidden
              onChange={(event) =>
                handleFile(event.target.files?.[0])
              }
            />

            {resume ? (
              <>
                <div className="upload-icon success">
                  <CheckCircle size={28} />
                </div>

                <div>
                  <strong>{resume.name}</strong>

                  <p>Resume uploaded successfully</p>
                </div>
              </>
            ) : (
              <>
                <div className="upload-icon">
                  <CloudUpload size={28} />
                </div>

                <div>
                  <strong>Click to upload or drag & drop</strong>

                  <p>PDF, DOC or DOCX • Maximum 10MB</p>
                </div>
              </>
            )}
          </div>
        </div>

        {resume && (
          <div className="resume-preview">
            <div className="resume-preview-header">
              <div>
                <CheckCircle size={16} />
                Resume Ready
              </div>

              <span>{resume.name}</span>
            </div>

            <div className="resume-preview-content">
              <FileText size={22} />

              <div>
                <strong>AI Resume Analysis</strong>

                <p>
                  Your resume will be analyzed against the selected job
                  description before the interview begins.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card-actions">
          <button
            className="primary-button"
            onClick={handleContinue}
          >
            Proceed to System Calibration
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default ResumeUpload;