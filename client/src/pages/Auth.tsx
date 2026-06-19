import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import jaiHero from "@assets/ChatGPT_Image_Mar_7,_2026,_09_01_46_PM_1772935512407.png";

type AuthView = "login" | "register" | "forgot" | "reset" | "resetSent";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, config: any) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const setUserId = useStore((s) => s.setUserId);
  const setAuthStatus = useStore((s) => s.setAuthStatus);

  const [view, setView] = useState<AuthView>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (token) {
      setResetToken(token);
      setView("reset");
      return;
    }
    if (params.get("view") === "register") {
      setView("register");
    }
  }, []);

  useEffect(() => {
    api.getConfig().then((cfg) => {
      if (cfg.googleClientId) setGoogleClientId(cfg.googleClientId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!googleClientId || view !== "login") return;

    const loadGIS = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: googleBtnRef.current.offsetWidth || 320,
          shape: "rectangular",
          text: "signin_with",
        });
      }
    };

    if (window.google) {
      loadGIS();
    } else {
      const script = document.getElementById("gis-script");
      if (!script) {
        const s = document.createElement("script");
        s.id = "gis-script";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        s.onload = loadGIS;
        document.head.appendChild(s);
      } else {
        script.addEventListener("load", loadGIS);
      }
    }
  }, [googleClientId, view]);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setError("");
    setLoading(true);
    try {
      const user = await api.authGoogle(response.credential);
      setUserId(user.id);
      setAuthStatus("authenticated");
      if (user.isOnboarded) {
        setLocation("/home", { replace: true });
      } else {
        setLocation("/", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const user = await api.authLogin({ email, password });
      setUserId(user.id);
      setAuthStatus("authenticated");
      if (user.isOnboarded) {
        setLocation("/home", { replace: true });
      } else {
        setLocation("/", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email || !password) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const user = await api.authRegister({ name: name.trim(), email, password });
      setUserId(user.id);
      setAuthStatus("authenticated");
      setLocation("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.authForgotPassword(email);
      if (result.devResetUrl) setDevResetUrl(result.devResetUrl);
      setView("resetSent");
    } catch (err: any) {
      setError(err.message || "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.authResetPassword(resetToken, password);
      setSuccessMsg("Password updated. You can now sign in.");
      setView("login");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const switchView = (v: AuthView) => {
    setError("");
    setSuccessMsg("");
    setView(v);
  };

  const inputClass =
    "w-full h-12 px-4 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all";

  const btnClass =
    "w-full h-12 rounded-full text-base font-bold text-stone-900 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-b from-stone-100 via-stone-50 to-stone-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <img
            src={jaiHero}
            alt="JAI"
            data-testid="img-auth-hero"
            className="w-20 h-20 object-cover object-top rounded-2xl mb-4 shadow-md"
          />
          <h1 className="text-2xl font-bold text-stone-900">Mustard Seed</h1>
          <p className="text-sm text-stone-500 mt-1">Your accountability partner, JAI</p>
        </div>

        <AnimatePresence mode="wait">
          {view === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-1">Sign in</h2>
                <p className="text-sm text-stone-500 mb-5">Welcome back. Let's keep growing.</p>

                {successMsg && (
                  <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
                    {successMsg}
                  </div>
                )}

                {googleClientId && (
                  <>
                    <div ref={googleBtnRef} className="w-full mb-4" data-testid="btn-google-signin" />
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-stone-200" />
                      <span className="text-xs text-stone-400">or</span>
                      <div className="flex-1 h-px bg-stone-200" />
                    </div>
                  </>
                )}

                <form onSubmit={handleLogin} className="space-y-3">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    autoComplete="email"
                    data-testid="input-login-email"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="current-password"
                    data-testid="input-login-password"
                  />

                  {error && (
                    <p className="text-sm text-red-500 px-1" data-testid="text-auth-error">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="btn-login-submit"
                    className={btnClass}
                    style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)" }}
                  >
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </form>

                <button
                  onClick={() => switchView("forgot")}
                  className="w-full mt-3 text-sm text-stone-500 hover:text-stone-700 transition-colors"
                  data-testid="btn-forgot-password"
                >
                  Forgot password?
                </button>
              </div>

              <p className="text-center mt-5 text-sm text-stone-500">
                New here?{" "}
                <button
                  onClick={() => switchView("register")}
                  className="font-semibold text-amber-600 hover:text-amber-700"
                  data-testid="btn-switch-to-register"
                >
                  Create an account
                </button>
              </p>
            </motion.div>
          )}

          {view === "register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-1">Create account</h2>
                <p className="text-sm text-stone-500 mb-5">Plant your seed. Start growing.</p>

                {googleClientId && (
                  <>
                    <div ref={googleBtnRef} className="w-full mb-4" data-testid="btn-google-register" />
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-stone-200" />
                      <span className="text-xs text-stone-400">or</span>
                      <div className="flex-1 h-px bg-stone-200" />
                    </div>
                  </>
                )}

                <form onSubmit={handleRegister} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    autoComplete="name"
                    data-testid="input-register-name"
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    autoComplete="email"
                    data-testid="input-register-email"
                  />
                  <input
                    type="password"
                    placeholder="Password (min. 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    data-testid="input-register-password"
                  />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    data-testid="input-register-confirm"
                  />

                  {error && (
                    <p className="text-sm text-red-500 px-1" data-testid="text-auth-error">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="btn-register-submit"
                    className={btnClass}
                    style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)" }}
                  >
                    {loading ? "Creating account…" : "Create account"}
                  </button>
                </form>
              </div>

              <p className="text-center mt-5 text-sm text-stone-500">
                Already have an account?{" "}
                <button
                  onClick={() => switchView("login")}
                  className="font-semibold text-amber-600 hover:text-amber-700"
                  data-testid="btn-switch-to-login"
                >
                  Sign in
                </button>
              </p>
            </motion.div>
          )}

          {view === "forgot" && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-1">Reset password</h2>
                <p className="text-sm text-stone-500 mb-5">
                  Enter your email and we'll send you a reset link.
                </p>

                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    autoComplete="email"
                    data-testid="input-forgot-email"
                  />

                  {error && (
                    <p className="text-sm text-red-500 px-1">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="btn-forgot-submit"
                    className={btnClass}
                    style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)" }}
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </form>

                <button
                  onClick={() => switchView("login")}
                  className="w-full mt-3 text-sm text-stone-500 hover:text-stone-700"
                  data-testid="btn-back-to-login"
                >
                  ← Back to sign in
                </button>
              </div>
            </motion.div>
          )}

          {view === "resetSent" && (
            <motion.div
              key="resetSent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 text-center">
                <div className="text-4xl mb-3">📬</div>
                <h2 className="text-xl font-bold text-stone-900 mb-2">Check your inbox</h2>
                <p className="text-sm text-stone-500 mb-4">
                  If an account exists for <strong>{email}</strong>, a reset link has been sent.
                </p>
                {devResetUrl && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                    <p className="text-xs font-bold text-amber-700 mb-1">DEV MODE — Reset Link:</p>
                    <a
                      href={devResetUrl}
                      className="text-xs text-amber-600 break-all underline"
                      data-testid="link-dev-reset"
                    >
                      {devResetUrl}
                    </a>
                  </div>
                )}
                <button
                  onClick={() => switchView("login")}
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                  data-testid="btn-back-to-login-from-sent"
                >
                  Back to sign in
                </button>
              </div>
            </motion.div>
          )}

          {view === "reset" && (
            <motion.div
              key="reset"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-1">New password</h2>
                <p className="text-sm text-stone-500 mb-5">Choose a strong password for your account.</p>

                <form onSubmit={handleResetPassword} className="space-y-3">
                  <input
                    type="password"
                    placeholder="New password (min. 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    data-testid="input-reset-password"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    data-testid="input-reset-confirm"
                  />

                  {error && (
                    <p className="text-sm text-red-500 px-1">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="btn-reset-submit"
                    className={btnClass}
                    style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)" }}
                  >
                    {loading ? "Saving…" : "Save new password"}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
