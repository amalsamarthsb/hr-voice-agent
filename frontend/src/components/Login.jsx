import { useState } from "react";
import { Loader2 } from "lucide-react";
import { login } from "../services/api";

export default function Login({
  onLogin,
  onRegister,
  notice = "",
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      /*
       * Step 1:
       * Send email/password to FastAPI.
       */
      await login(email, password);

      /*
       * Step 2:
       * Get the logged-in user's information.
       */
      const response = await fetch(
        "http://127.0.0.1:8000/auth/me",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(
              "access_token"
            )}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to retrieve user information."
        );
      }

      const user = await response.json();

      /*
       * Step 3:
       * Give the user information back to App.jsx.
       */
      onLogin(user);
    } catch (err) {
      setError(
        err.message ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-header">
          <h1>AI Interview Agent</h1>

          <p>
            Sign in to continue
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <div className="form-group">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          {notice && !error && (
            <div className="auth-error" role="status">
              {notice}
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={17} className="spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>

        </form>

        <div className="auth-footer">
          <span>
            Don't have an account?
          </span>

          <button
            type="button"
            onClick={onRegister}
            className="auth-link"
          >
            Create account
          </button>
        </div>

      </div>
    </div>
  );
}