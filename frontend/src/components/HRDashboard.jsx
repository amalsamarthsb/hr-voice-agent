import { useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

import { api } from "../services/api";

export default function HRDashboard({ onLogout }) {
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [refreshingJobs, setRefreshingJobs] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [jobError, setJobError] = useState("");
  const [jobSuccess, setJobSuccess] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const loadInterviews = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setRefreshing(true);
      setError("");

      const data = await api("/hr/interviews");

      setInterviews(data);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadJobs = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setJobsLoading(true);
      }
      setRefreshingJobs(true);
      setJobError("");

      const data = await api("/hr/jobs");
      setJobs(data);
    } catch (loadError) {
      console.error(loadError);
      setJobError(loadError.message);
    } finally {
      setJobsLoading(false);
      setRefreshingJobs(false);
    }
  };

  const createJob = async (event) => {
    event.preventDefault();
    setJobError("");
    setJobSuccess("");

    try {
      setSavingJob(true);
      const createdJob = await api("/hr/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: jobTitle,
          description: jobDescription,
        }),
      });

      setJobs((previous) => [createdJob, ...previous]);
      setJobTitle("");
      setJobDescription("");
      setJobSuccess("Position published and available in the candidate portal.");
    } catch (createError) {
      console.error(createError);
      setJobError(createError.message);
    } finally {
      setSavingJob(false);
    }
  };

  const openInterview = async (interviewId) => {
    try {
      setDetailsLoading(true);
      setError("");

      const data = await api(
        `/hr/interviews/${interviewId}`
      );

      setSelectedInterview(data);
      setEmailError("");
      setEmailSuccess("");
      setEmailSubject(`Interview outcome: ${data.job_title}`);
      setEmailBody(
        data.evaluation
          ? `Hello,\n\nThank you for taking the time to interview for ${data.job_title}. Following our AI interview evaluation, your outcome is: ${data.evaluation.passed ? "PASSED" : "FAILED"}.\n\nThank you,\nThe HR Team`
          : ""
      );
    } catch (detailsError) {
      console.error(detailsError);
      setError(detailsError.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const evaluateInterview = async () => {
    if (!selectedInterview) {
      return;
    }

    try {
      setEvaluating(true);
      setError("");

      await api(
        `/hr/interviews/${selectedInterview.interview_id}/evaluate`,
        {
          method: "POST",
        }
      );

      const updated = await api(
        `/hr/interviews/${selectedInterview.interview_id}`
      );

      setSelectedInterview(updated);
      setEmailSubject(`Interview outcome: ${updated.job_title}`);
      setEmailBody(
        `Hello,\n\nThank you for taking the time to interview for ${updated.job_title}. Following our AI interview evaluation, your outcome is: ${updated.evaluation.passed ? "PASSED" : "FAILED"}.\n\nThank you,\nThe HR Team`
      );

      await loadInterviews(true);
    } catch (evaluationError) {
      console.error(evaluationError);
      setError(evaluationError.message);
    } finally {
      setEvaluating(false);
    }
  };

  const sendOutcomeEmail = async (event) => {
    event.preventDefault();
    if (!selectedInterview?.evaluation) {
      return;
    }

    try {
      setSendingEmail(true);
      setEmailError("");
      setEmailSuccess("");
      const result = await api(
        `/hr/interviews/${selectedInterview.interview_id}/email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject: emailSubject,
            body: emailBody,
          }),
        }
      );
      setEmailSuccess(`Email sent to ${result.recipient}.`);
    } catch (sendError) {
      console.error(sendError);
      setEmailError(sendError.message);
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    loadInterviews();
    loadJobs();
  }, []);

  const completedCount = interviews.filter(
    (item) => item.status === "completed"
  ).length;

  const evaluatedCount = interviews.filter(
    (item) => item.overall_score !== null
  ).length;

  const pendingCount = completedCount - evaluatedCount;

  return (
    <div className="hr-dashboard">
      <header className="hr-header">
        <div className="hr-brand">
          <div className="hr-brand-icon">
            <ShieldCheck size={22} />
          </div>

          <div>
            <h1>HR Interview Dashboard</h1>
            <span>AI Interview Management</span>
          </div>
        </div>

        <div className="hr-header-actions">
          <button
            type="button"
            className={`icon-button ${refreshing ? "is-refreshing" : ""}`}
            onClick={() => loadInterviews(true)}
            title="Refresh"
            aria-label="Refresh interviews"
            disabled={refreshing}
          >
            <RefreshCw size={19} />
          </button>

          <button
            type="button"
            className="logout-button"
            onClick={onLogout}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      <main className="hr-content">
        <section className="hr-stat-grid">
          <div className="hr-stat-card">
            <div className="stat-icon">
              <FileText size={21} />
            </div>

            <div>
              <span>Total Interviews</span>
              <strong>{interviews.length}</strong>
            </div>
          </div>

          <div className="hr-stat-card">
            <div className="stat-icon">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <span>Completed</span>
              <strong>{completedCount}</strong>
            </div>
          </div>

          <div className="hr-stat-card">
            <div className="stat-icon">
              <Clock size={21} />
            </div>

            <div>
              <span>Pending Evaluation</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>

          <div className="hr-stat-card">
            <div className="stat-icon">
              <BarChart3 size={21} />
            </div>

            <div>
              <span>Evaluated</span>
              <strong>{evaluatedCount}</strong>
            </div>
          </div>
        </section>

        <section className="hr-jobs-management">
          <div className="hr-jobs-heading">
            <div>
              <span className="detail-label">Recruitment</span>
              <h2>Open positions</h2>
              <p>Create job descriptions for candidates to select.</p>
            </div>

            <button
              type="button"
              className={`refresh-button ${refreshingJobs ? "is-refreshing" : ""}`}
              onClick={() => loadJobs(true)}
              title="Refresh positions"
              aria-label="Refresh positions"
              disabled={refreshingJobs}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {jobError && (
            <div className="job-form-message error" role="alert">
              {jobError}
            </div>
          )}

          {jobSuccess && (
            <div className="job-form-message success" role="status">
              <CheckCircle2 size={17} />
              {jobSuccess}
            </div>
          )}

          <div className="hr-jobs-grid">
            <form className="job-create-form" onSubmit={createJob}>
              <label htmlFor="job-title">Position title</label>
              <input
                id="job-title"
                name="title"
                value={jobTitle}
                onChange={(event) => {
                  setJobTitle(event.target.value);
                  setJobSuccess("");
                }}
                placeholder="e.g. Senior Product Designer"
                maxLength={255}
                required
              />

              <label htmlFor="job-description">Job description</label>
              <textarea
                id="job-description"
                name="description"
                value={jobDescription}
                onChange={(event) => {
                  setJobDescription(event.target.value);
                  setJobSuccess("");
                }}
                placeholder="Describe responsibilities, required skills, and experience."
                rows={5}
                required
              />

              <button
                type="submit"
                className="publish-job-button"
                disabled={savingJob || !jobTitle.trim() || !jobDescription.trim()}
              >
                {savingJob ? (
                  <>
                    <Loader2 size={17} className="spin" />
                    Publishing position...
                  </>
                ) : (
                  <>
                    <Plus size={17} />
                    Publish position
                  </>
                )}
              </button>
            </form>

            <div className="published-jobs">
              <h3>Published positions <span>{jobs.length}</span></h3>
              {jobsLoading ? (
                <div className="loading-state jobs-loading">
                  <Loader2 size={23} className="spin" />
                  Loading positions...
                </div>
              ) : jobs.length === 0 ? (
                <div className="jobs-empty">
                  <Briefcase size={25} />
                  <p>No positions published yet.</p>
                  <span>New openings will appear here and in the candidate portal.</span>
                </div>
              ) : (
                <div className="published-job-list">
                  {jobs.map((job) => (
                    <article
                      className="published-job-card"
                      key={job.id}
                    >
                      <div className="published-job-title">
                        <Briefcase size={16} />
                        <strong>{job.title}</strong>
                      </div>
                      <p>{job.description}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="hr-error">
            {error}
          </div>
        )}

        <section className="hr-workspace">
          <div className="interview-list-panel">
            <div className="panel-heading">
              <div>
                <h2>Candidate Interviews</h2>
                <p>
                  Review completed AI interviews
                </p>
              </div>

              <button
                type="button"
                className={`refresh-button ${refreshing ? "is-refreshing" : ""}`}
                onClick={() => loadInterviews(true)}
                aria-label="Refresh interviews"
                disabled={refreshing}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {loading ? (
              <div className="loading-state">
                <Loader2
                  size={28}
                  className="spin"
                />
                <span>Loading interviews...</span>
              </div>
            ) : interviews.length === 0 ? (
              <div className="empty-state">
                <FileText size={36} />
                <h3>No interviews yet</h3>
                <p>
                  Candidate interviews will appear here.
                </p>
              </div>
            ) : (
              <div className="interview-list">
                {interviews.map((interview) => (
                  <button
                    type="button"
                    key={interview.interview_id}
                    className={`interview-row ${
                      selectedInterview?.interview_id ===
                      interview.interview_id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      openInterview(
                        interview.interview_id
                      )
                    }
                  >
                    <div className="candidate-avatar">
                      <User size={18} />
                    </div>

                    <div className="candidate-info">
                      <strong>
                        {interview.candidate_email}
                      </strong>

                      <span>
                        {interview.job_title}
                      </span>
                    </div>

                    <div className="interview-status">
                      {interview.status ===
                      "completed" ? (
                        <span className="status-completed">
                          Completed
                        </span>
                      ) : (
                        <span className="status-other">
                          {interview.status}
                        </span>
                      )}

                      {interview.overall_score !==
                        null && (
                        <strong>
                          {Math.round(
                            interview.overall_score
                          )}
                          /100
                        </strong>
                      )}
                      {typeof interview.passed === "boolean" && (
                        <span
                          className={`outcome-badge ${
                            interview.passed ? "passed" : "failed"
                          }`}
                        >
                          {interview.passed ? "Passed" : "Failed"}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="interview-detail-panel">
            {!selectedInterview ? (
              <div className="detail-empty">
                <FileText size={46} />

                <h2>Select an interview</h2>

                <p>
                  Choose a candidate from the list to
                  review their interview.
                </p>
              </div>
            ) : detailsLoading ? (
              <div className="loading-state">
                <Loader2
                  size={28}
                  className="spin"
                />
                <span>
                  Loading interview details...
                </span>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div>
                    <span className="detail-label">
                      Candidate
                    </span>

                    <h2>
                      {
                        selectedInterview.candidate_email
                      }
                    </h2>

                    <p>
                      {selectedInterview.job_title}
                    </p>
                  </div>

                  {selectedInterview.status ===
                    "completed" && (
                    <span className="completed-badge">
                      <CheckCircle2 size={15} />
                      Completed
                    </span>
                  )}
                </div>

                <div className="answers-section">
                  <div className="section-title">
                    <h3>Interview Responses</h3>

                    <span>
                      {
                        selectedInterview.questions
                          .length
                      }{" "}
                      Questions
                    </span>
                  </div>

                  <div className="answer-list">
                    {selectedInterview.questions.map(
                      (item) => (
                        <div
                          className="answer-card"
                          key={item.question_id}
                        >
                          <div className="question-number">
                            Q{item.order_index}
                          </div>

                          <div className="answer-content">
                            <h4>
                              {item.question}
                            </h4>

                            <div className="candidate-answer">
                              <span>
                                Candidate Response
                              </span>

                              <p>
                                {item.answer ||
                                  "No answer recorded."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="evaluation-section">
                  <div className="section-title">
                    <div>
                      <h3>AI Evaluation</h3>

                      <span>
                        Internal HR information
                      </span>
                    </div>
                  </div>

                  {!selectedInterview.evaluation ? (
                    <div className="evaluation-pending">
                      <Clock size={28} />

                      <div>
                        <strong>
                          Evaluation pending
                        </strong>

                        <p>
                          Run the AI evaluation after
                          reviewing the candidate's
                          responses.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="evaluate-button"
                        onClick={evaluateInterview}
                        disabled={
                          evaluating ||
                          selectedInterview.status !==
                            "completed"
                        }
                      >
                        {evaluating ? (
                          <>
                            <Loader2
                              size={18}
                              className="spin"
                            />
                            Evaluating...
                          </>
                        ) : (
                          <>
                            <BarChart3 size={18} />
                            Run AI Evaluation
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="evaluation-result">
                      <div className="score-card">
                        <span>Overall Score</span>

                        <strong>
                          {Math.round(
                            selectedInterview
                              .evaluation
                              .overall_score
                          )}
                          <small>/100</small>
                        </strong>
                      </div>

                      <div className="result-status">
                        {selectedInterview.evaluation
                          .passed ? (
                          <>
                            <CheckCircle2 size={22} />
                            <div>
                              <strong>
                                Passed
                              </strong>
                              <span>
                                AI evaluation outcome
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <XCircle size={22} />
                            <div>
                              <strong>
                                Failed
                              </strong>
                              <span>
                                AI evaluation outcome
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="feedback-card">
                        <span>
                          AI Evaluation Summary
                        </span>

                        <p>
                          {
                            selectedInterview
                              .evaluation.feedback
                          }
                        </p>
                      </div>

                      <form
                        className="candidate-email-form"
                        onSubmit={sendOutcomeEmail}
                      >
                        <div className="email-form-heading">
                          <div>
                            <h4>Email candidate</h4>
                            <p>
                              Preset outcome email. Edit it before sending to{" "}
                              {selectedInterview.candidate_email}.
                            </p>
                          </div>
                          <Mail size={19} />
                        </div>

                        <label htmlFor="candidate-email-subject">
                          Subject
                        </label>
                        <input
                          id="candidate-email-subject"
                          value={emailSubject}
                          onChange={(event) => {
                            setEmailSubject(event.target.value);
                            setEmailSuccess("");
                            setEmailError("");
                          }}
                          maxLength={255}
                          required
                        />

                        <label htmlFor="candidate-email-body">
                          Message
                        </label>
                        <textarea
                          id="candidate-email-body"
                          value={emailBody}
                          onChange={(event) => {
                            setEmailBody(event.target.value);
                            setEmailSuccess("");
                            setEmailError("");
                          }}
                          rows={7}
                          maxLength={10000}
                          required
                        />

                        {emailError && (
                          <div className="job-form-message error" role="alert">
                            {emailError}
                          </div>
                        )}
                        {emailSuccess && (
                          <div className="job-form-message success" role="status">
                            <CheckCircle2 size={17} />
                            {emailSuccess}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="evaluate-button"
                          disabled={
                            sendingEmail ||
                            !emailSubject.trim() ||
                            !emailBody.trim()
                          }
                        >
                          {sendingEmail ? (
                            <>
                              <Loader2 size={18} className="spin" />
                              Sending email...
                            </>
                          ) : (
                            <>
                              <Mail size={18} />
                              Send outcome email
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}