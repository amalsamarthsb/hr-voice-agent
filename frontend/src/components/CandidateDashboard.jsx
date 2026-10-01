import { useEffect, useState } from "react";
import {
  FileText,
  LogOut,
  Play,
  Upload,
  Briefcase,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  api,
  uploadResume,
} from "../services/api";


export default function CandidateDashboard({
  user,
  onLogout,
  onStartInterview,
  onResumeInterview,
  loadingInterview,
  error,
}) {
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [preparedInterviews, setPreparedInterviews] = useState([]);
  const [completedInterviews, setCompletedInterviews] = useState([]);

  const [selectedJob, setSelectedJob] =
    useState(null);

  const [selectedResume, setSelectedResume] =
    useState(null);

  const [loadingJobs, setLoadingJobs] =
    useState(true);

  const [loadingResumes, setLoadingResumes] =
    useState(true);

  const [loadingInterviews, setLoadingInterviews] =
    useState(true);

  const [refreshingInterviews, setRefreshingInterviews] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [refreshingJobs, setRefreshingJobs] =
    useState(false);

  const [uploadSuccess, setUploadSuccess] =
    useState(false);

  const [localError, setLocalError] =
    useState("");


  /*
   * Load available jobs.
   */
  const loadJobs = async (isRefresh = false) => {
    try {
      setLoadingJobs(true);
      setRefreshingJobs(isRefresh);

      const data = await api("/jobs");

      setJobs(data);
    } catch (err) {
      console.error(err);

      setLocalError(
        err.message ||
          "Unable to load available jobs."
      );
    } finally {
      setLoadingJobs(false);
      setRefreshingJobs(false);
    }
  };


  /*
   * Load resumes belonging to candidate.
   */
  const loadResumes = async () => {
    try {
      setLoadingResumes(true);

      const data = await api(
        "/candidate/resumes"
      );

      setResumes(data);
    } catch (err) {
      console.error(err);

      setLocalError(
        err.message ||
          "Unable to load resumes."
      );
    } finally {
      setLoadingResumes(false);
    }
  };

  const loadPreparedInterviews = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoadingInterviews(true);
      } else {
        setRefreshingInterviews(true);
      }
      const data = await api("/interviews/my");
      setCompletedInterviews(
        data.filter((interview) => interview.status === "completed")
      );
      const seenSelections = new Set();
      setPreparedInterviews(
        data.filter((interview) => {
          if (interview.status !== "ready") {
            return false;
          }

          const selection = `${interview.job_id}:${interview.resume_id}`;
          if (seenSelections.has(selection)) {
            return false;
          }

          seenSelections.add(selection);
          return true;
        })
      );
    } catch (err) {
      console.error(err);
      setLocalError(
        err.message ||
          "Unable to load prepared interviews."
      );
    } finally {
      setLoadingInterviews(false);
      setRefreshingInterviews(false);
    }
  };


  useEffect(() => {
    loadJobs();
    loadResumes();
    loadPreparedInterviews();
  }, []);

  useEffect(() => {
    const refreshVisibleInterviews = () => {
      if (document.visibilityState === "visible") {
        loadPreparedInterviews(true);
      }
    };
    const interval = window.setInterval(refreshVisibleInterviews, 30000);
    document.addEventListener("visibilitychange", refreshVisibleInterviews);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        refreshVisibleInterviews
      );
    };
  }, []);


  /*
   * Upload a resume.
   */
  const handleResumeUpload = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setUploading(true);
      setLocalError("");
      setUploadSuccess(false);

      const uploadedResume =
        await uploadResume(file);

      setResumes((previous) => [
        uploadedResume,
        ...previous,
      ]);

      setSelectedResume(
        uploadedResume
      );
      setUploadSuccess(true);

    } catch (err) {
      console.error(err);

      setLocalError(
        err.message ||
          "Resume upload failed."
      );
    } finally {
      setUploading(false);

      event.target.value = "";
    }
  };


  /*
   * Start interview.
   */
  const handleStart = () => {
    if (!selectedJob) {
      setLocalError(
        "Please select a job first."
      );
      return;
    }

    if (!selectedResume) {
      setLocalError(
        "Please upload or select a resume first."
      );
      return;
    }

    setLocalError("");

    onStartInterview(
      selectedJob,
      selectedResume
    );
  };


  const combinedError =
    error || localError;


  return (
    <div className="candidate-dashboard">

      <header className="candidate-header">

        <div>
          <h1>
            AI Interview Agent
          </h1>

          <p>
            Candidate Portal
          </p>
        </div>

        <div className="candidate-header-right">

          <span>
            {user?.email}
          </span>

          <button
            type="button"
            onClick={onLogout}
            className="logout-button"
          >
            <LogOut size={18} />
            Logout
          </button>

        </div>

      </header>


      <main className="candidate-content">

        <section className="welcome-section">
          <h2>
            Welcome to your interview
          </h2>

          <p>
            Select a position, upload your
            resume, and begin your AI-powered
            interview.
          </p>
        </section>


        {combinedError && (
          <div className="candidate-error">
            <AlertCircle size={18} />
            {combinedError}
          </div>
        )}


        <div className="candidate-grid">

          {/* JOBS */}

          <section className="candidate-card">

            <div className="card-heading">

              <div className="card-icon">
                <Briefcase size={20} />
              </div>

              <div>
                <h3>
                  Available Positions
                </h3>

                <p>
                  Choose the position you
                  want to interview for.
                </p>
              </div>

              <button
                type="button"
                className={`refresh-button ${refreshingJobs ? "is-refreshing" : ""}`}
                onClick={() => loadJobs(true)}
                disabled={refreshingJobs}
                aria-label="Refresh available positions"
                title="Refresh positions"
              >
                <RefreshCw size={16} />
              </button>
            </div>


            {loadingJobs ? (
              <div className="loading-state">
                <Loader2
                  size={24}
                  className="spin"
                />
                Loading positions...
              </div>
            ) : jobs.length === 0 ? (
              <div className="empty-state">
                <Briefcase size={32} />
                <p>
                  No positions available.
                </p>
              </div>
            ) : (
              <div className="job-list">

                {jobs.map((job) => (
                  <button
                    type="button"
                    key={job.id}
                    className={`job-card ${
                      selectedJob?.id === job.id
                        ? "selected"
                        : ""
                    }`}
                    aria-pressed={selectedJob?.id === job.id}
                    onClick={() =>
                      setSelectedJob(job)
                    }
                  >

                    <div>
                      <strong>
                        {job.title ||
                          job.job_title}
                      </strong>

                      {job.description && (
                        <p>
                          {job.description}
                        </p>
                      )}
                    </div>

                  </button>
                ))}

              </div>
            )}

          </section>


          {/* RESUME */}

          <section className="candidate-card">

            <div className="card-heading">

              <div className="card-icon">
                <FileText size={20} />
              </div>

              <div>
                <h3>
                  Your Resume
                </h3>

                <p>
                  Select an existing resume
                  or upload a new one.
                </p>
              </div>

            </div>


            <label className={`upload-box ${uploading ? "uploading" : ""} ${uploadSuccess ? "upload-success" : ""}`}>

              {uploading ? (
                <Loader2 size={28} className="spin" />
              ) : uploadSuccess ? (
                <CheckCircle2 size={28} />
              ) : (
                <Upload size={28} />
              )}

              <strong>
                {uploading
                  ? "Uploading..."
                  : uploadSuccess
                    ? "Resume uploaded"
                    : "Upload Resume"}
              </strong>

              <span>
                PDF or supported document
              </span>

              <input
                type="file"
                accept=".pdf,.docx"
                onChange={
                  handleResumeUpload
                }
                disabled={uploading}
                hidden
              />

            </label>


            {loadingResumes ? (
              <div className="loading-state">
                <Loader2
                  size={22}
                  className="spin"
                />
                Loading resumes...
              </div>
            ) : resumes.length === 0 ? (
              <div className="empty-state">
                <FileText size={28} />
                <p>
                  No resumes uploaded yet.
                </p>
              </div>
            ) : (
              <div className="resume-list">

                {resumes.map((resume) => (
                  <button
                    type="button"
                    key={resume.id}
                    className={`resume-item ${
                      selectedResume?.id ===
                      resume.id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedResume(
                        resume
                      )
                    }
                  >
                    <FileText size={18} />

                    <span>
                      {resume.filename ||
                        resume.file_name ||
                        "Resume"}
                    </span>
                  </button>
                ))}

              </div>
            )}

          </section>

        </div>

        {!loadingInterviews && preparedInterviews.length > 0 && (
          <section className="prepared-interviews">
            <div className="prepared-interviews-heading">
              <div>
                <span>Ready when you are</span>
                <h3>Prepared interviews</h3>
              </div>
              <span className="prepared-count">
                {preparedInterviews.length} ready
              </span>
            </div>

            <div className="prepared-interview-list">
              {preparedInterviews.map((interview) => {
                const job = jobs.find(
                  (item) => item.id === interview.job_id
                );
                const resume = resumes.find(
                  (item) => item.id === interview.resume_id
                );

                if (!job || !resume) {
                  return null;
                }

                return (
                  <article
                    className="prepared-interview-card"
                    key={interview.id}
                  >
                    <div>
                      <strong>{job.title}</strong>
                      <span>{resume.filename}</span>
                    </div>
                    <button
                      type="button"
                      className="prepared-interview-button"
                      onClick={() =>
                        onResumeInterview(interview, job, resume)
                      }
                      disabled={loadingInterview}
                    >
                      Continue preparation
                      <ArrowRight size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!loadingInterviews && completedInterviews.length > 0 && (
          <section className="candidate-results">
            <div className="prepared-interviews-heading">
              <div>
                <span>Your interview history</span>
                <h3>Interview results</h3>
              </div>
              <span className="prepared-count">
                {completedInterviews.length} completed
              </span>
              <button
                type="button"
                className={`refresh-button ${refreshingInterviews ? "is-refreshing" : ""}`}
                onClick={() => loadPreparedInterviews(true)}
                disabled={refreshingInterviews}
                aria-label="Refresh interview results"
                title="Refresh interview results"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="candidate-result-list">
              {completedInterviews.map((interview) => {
                const job = jobs.find(
                  (item) => item.id === interview.job_id
                );
                const hasOutcome = typeof interview.passed === "boolean";

                return (
                  <article className="candidate-result-card" key={interview.id}>
                    <div>
                      <strong>{job?.title || "Interview"}</strong>
                      <span>
                        {hasOutcome
                          ? "AI interview outcome"
                          : "Your interview is awaiting evaluation"}
                      </span>
                    </div>
                    {hasOutcome ? (
                      <span
                        className={`candidate-outcome ${
                          interview.passed ? "passed" : "failed"
                        }`}
                      >
                        {interview.passed ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <XCircle size={17} />
                        )}
                        {interview.passed ? "Passed" : "Failed"}
                      </span>
                    ) : (
                      <span className="candidate-outcome pending">
                        <Clock size={17} />
                        Evaluation pending
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}


        {/* START INTERVIEW */}

        <section className="start-interview-section">

          <div>
            <h3>
              Ready to begin?
            </h3>

            <p>
              {selectedJob
                ? `Position: ${
                    selectedJob.title ||
                    selectedJob.job_title
                  }`
                : "Select a position first."}
            </p>

            <p>
              {selectedResume
                ? `Resume: ${
                    selectedResume.filename ||
                    selectedResume.file_name ||
                    "Selected"
                  }`
                : "Select a resume first."}
            </p>
          </div>


          <button
            type="button"
            className="start-interview-button"
            onClick={handleStart}
            disabled={
              loadingInterview ||
              !selectedJob ||
              !selectedResume
            }
          >
            {loadingInterview ? (
              <>
                <Loader2
                  size={19}
                  className="spin"
                />
                Preparing Interview...
              </>
            ) : (
              <>
                <Play size={19} />
                Start Interview
              </>
            )}
          </button>

        </section>

      </main>

    </div>
  );
}