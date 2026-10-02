export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export const AUTH_EXPIRED_EVENT = "auth:expired";

export function getErrorMessage(value, fallback = "Request failed", depth = 0) {
  if (typeof value === "string" && value.trim()) {
    const jsonStart = value.indexOf("{");
    if (jsonStart !== -1 && depth < 4) {
      try {
        const parsed = JSON.parse(value.slice(jsonStart));
        const code = parsed?.error?.code;
        if (code === "credit_balance_exhausted") {
          return "The OpenAI API account has no credits remaining. Add credits at https://platform.openai.com/settings/organization/billing/ and retry the interview.";
        }

        const parsedMessage = getErrorMessage(parsed, "", depth + 1);
        if (parsedMessage) {
          return parsedMessage;
        }
      } catch {
        return value;
      }
    }

    return value;
  }

  if (value instanceof Error && value.message) {
    return getErrorMessage(value.message, fallback, depth + 1);
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => getErrorMessage(item, "", depth + 1))
      .filter(Boolean);
    if (messages.length) {
      return messages.join("; ");
    }
  }

  if (value && typeof value === "object" && depth < 4) {
    for (const key of ["message", "detail", "error", "msg"]) {
      const message = getErrorMessage(value[key], "", depth + 1);
      if (message) {
        return message;
      }
    }

    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}


export async function api(endpoint, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  if (!response.ok) {
    if (response.status === 401 && token && endpoint !== "/auth/login") {
      logout();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    let message = "Request failed";

    try {
      const data = await response.json();
      message = getErrorMessage(data?.detail, message);
    } catch {
      // Keep default error message.
    }

    if (response.status === 401 && token && endpoint !== "/auth/login") {
      message = "Your session has expired. Please sign in again.";
    }

    throw new Error(message);
  }

  return response.json();
}


export async function login(email, password) {
  const data = await api("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  localStorage.setItem(
    "access_token",
    data.access_token
  );

  return data;
}


export async function register(email, password) {
  return api("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
}


export async function getCurrentUser() {
  return api("/auth/me");
}


export async function uploadResume(file) {
  const formData = new FormData();

  formData.append("file", file);

  return api("/candidate/resume", {
    method: "POST",
    body: formData,
  });
}


export async function createInterview(jobId, resumeId) {
  return api("/interviews/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id: jobId,
      resume_id: resumeId,
    }),
  });
}


export async function submitAnswer(
  interviewId,
  questionId,
  transcript
) {
  return api("/interviews/answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      interview_id: interviewId,
      question_id: questionId,
      transcript,
    }),
  });
}


export async function completeInterview(interviewId) {
  return api(
    `/interviews/${interviewId}/complete`,
    {
      method: "POST",
    }
  );
}


export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}