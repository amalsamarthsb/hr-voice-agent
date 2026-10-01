import { useEffect, useState } from "react";

import Login from "./components/Login";
import Register from "./components/Register";
import CandidateDashboard from "./components/CandidateDashboard";
import BeforeInterview from "./components/BeforeInterview";
import VoiceInterview from "./components/VoiceInterview";
import HRDashboard from "./components/HRDashboard";

import {
  api,
  AUTH_EXPIRED_EVENT,
} from "./services/api";

function normalizeInterviewQuestions(questions) {
  return questions.map((question) => {
    const text = question.text || question.question;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("The interview returned an invalid question.");
    }

    return {
      ...question,
      text,
    };
  });
}


function App() {

  const [user, setUser] =
    useState(null);

  const [page, setPage] =
    useState("login");


  const [selectedJob, setSelectedJob] =
    useState(null);

  const [selectedResume, setSelectedResume] =
    useState(null);


  const [interviewId, setInterviewId] =
    useState(null);

  const [questions, setQuestions] =
    useState([]);


  const [loadingInterview, setLoadingInterview] =
    useState(false);

  const [error, setError] =
    useState("");


  /*
   * Restore the session when
   * the page is refreshed.
   */
  useEffect(() => {

    const token =
      localStorage.getItem(
        "access_token"
      );

    const savedUser =
      localStorage.getItem(
        "user"
      );


    if (!token || !savedUser) {
      return;
    }


    try {

      const parsedUser =
        JSON.parse(savedUser);

      setUser(parsedUser);


      if (parsedUser.role === "hr") {
        setPage("hr");
      } else {
        setPage("candidate");
      }

    } catch {

      localStorage.removeItem(
        "user"
      );

      localStorage.removeItem(
        "access_token"
      );

    }

  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setSelectedJob(null);
      setSelectedResume(null);
      setInterviewId(null);
      setQuestions([]);
      setLoadingInterview(false);
      setError("Your session has expired. Please sign in again.");
      setPage("login");
    };

    window.addEventListener(
      AUTH_EXPIRED_EVENT,
      handleExpiredSession
    );

    return () => {
      window.removeEventListener(
        AUTH_EXPIRED_EVENT,
        handleExpiredSession
      );
    };
  }, []);


  /*
   * Login callback.
   */
  const handleLogin = (
    loggedInUser
  ) => {

    setUser(loggedInUser);

    setError("");


    localStorage.setItem(
      "user",
      JSON.stringify(
        loggedInUser
      )
    );


    if (
      loggedInUser.role === "hr"
    ) {

      setPage("hr");

    } else {

      setPage("candidate");

    }

  };


  /*
   * Registration completed.
   */
  const handleRegister = () => {

    setPage("login");

    setError("");

  };


  /*
   * Logout.
   */
  const handleLogout = () => {

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "user"
    );


    setUser(null);

    setSelectedJob(null);

    setSelectedResume(null);

    setInterviewId(null);

    setQuestions([]);

    setPage("login");

  };


  /*
   * Create interview.
   */
  const startInterview = async (
    job,
    resume
  ) => {

    setError("");

    setLoadingInterview(true);


    try {

      /*
       * Create interview.
       */
      const interview =
        await api(
          "/interviews/",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              job_id: job.id,
              resume_id: resume.id,
            }),
          }
        );


      /*
       * Generate questions.
       */
      const questionResponse =
        await api(
          `/interviews/${interview.id}/questions`
        );
      const generatedQuestions =
        normalizeInterviewQuestions(questionResponse);


      setSelectedJob(job);

      setSelectedResume(resume);

      setInterviewId(
        interview.id
      );

      setQuestions(
        generatedQuestions
      );


      setPage(
        "before-interview"
      );

    } catch (err) {

      console.error(err);

      setError(
        err.message ||
          "Unable to create the interview."
      );

    } finally {

      setLoadingInterview(false);

    }

  };

  const resumePreparedInterview = async (interview, job, resume) => {
    setError("");
    setLoadingInterview(true);

    try {
      const questionResponse = await api(
        `/interviews/${interview.id}/questions`
      );
      const generatedQuestions =
        normalizeInterviewQuestions(questionResponse);

      if (!generatedQuestions.length) {
        throw new Error(
          "This interview has no prepared questions. Please start a new interview."
        );
      }

      setSelectedJob(job);
      setSelectedResume(resume);
      setInterviewId(interview.id);
      setQuestions(generatedQuestions);
      setPage("before-interview");
    } catch (resumeError) {
      console.error(resumeError);
      setError(
        resumeError.message ||
          "Unable to reopen the prepared interview."
      );
    } finally {
      setLoadingInterview(false);
    }
  };


  /*
   * Move from the preparation
   * screen to voice interview.
   */
  const beginVoiceInterview = () => {

    if (
      !interviewId ||
      questions.length === 0
    ) {

      setError(
        "Interview information is missing."
      );

      return;
    }


    setError("");

    setPage(
      "voice-interview"
    );

  };


  /*
   * Interview finished.
   *
   * Candidate outcomes are loaded through the candidate-safe
   * interview list; scores and evaluation feedback stay HR-only.
   */
  const finishInterview = () => {

    setPage(
      "candidate"
    );

    setSelectedJob(null);

    setSelectedResume(null);

    setInterviewId(null);

    setQuestions([]);

  };


  /*
   * LOGIN
   */
  if (
    page === "login" &&
    !user
  ) {

    return (
      <Login
        onLogin={handleLogin}
        notice={error}
        onRegister={() =>
          setPage("register")
        }
      />
    );

  }


  /*
   * REGISTER
   */
  if (
    page === "register" &&
    !user
  ) {

    return (
      <Register
        onRegister={
          handleRegister
        }
        onLogin={() =>
          setPage("login")
        }
      />
    );

  }


  /*
   * HR DASHBOARD
   */
  if (
    user?.role === "hr"
  ) {

    return (
      <HRDashboard
        onLogout={
          handleLogout
        }
      />
    );

  }


  /*
   * BEFORE INTERVIEW
   */
  if (
    page === "before-interview"
  ) {

    return (
      <BeforeInterview
        job={selectedJob}
        resume={selectedResume}
        questions={questions}
        onStart={
          beginVoiceInterview
        }
        onBack={() =>
          setPage("candidate")
        }
        loading={
          loadingInterview
        }
      />
    );

  }


  /*
   * VOICE INTERVIEW
   */
  if (
    page === "voice-interview"
  ) {

    return (
      <VoiceInterview
        interviewId={
          interviewId
        }
        questions={
          questions
        }
        onFinish={
          finishInterview
        }
      />
    );

  }


  /*
   * CANDIDATE DASHBOARD
   */
  return (
    <CandidateDashboard
      user={user}
      onLogout={
        handleLogout
      }
      onStartInterview={
        startInterview
      }
      onResumeInterview={resumePreparedInterview}
      loadingInterview={
        loadingInterview
      }
      error={error}
    />
  );

}


export default App;