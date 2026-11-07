import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import {
  Layers3,
  ArrowRight,
  ShieldCheck,
  Check,
  Boxes,
  Store,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TextField, ErrorState } from "./Common";
import { authApi } from "../../api/auth";
import { errorMessage, fetcher } from "../../api/workspace";
import { useAppDispatch } from "../../hooks/redux";
import { setCredentials } from "../../store/slices/authSlice";
import type { Readiness } from "../../types/workspace";
type Mode = "login" | "register" | "forgot" | "reset" | "verify";
export default function AuthScreen({ mode = "login" }: { mode?: Mode }) {
  const navigate = useNavigate(),
    dispatch = useAppDispatch(),
    { mutate } = useSWRConfig(),
    [params] = useSearchParams();
  const [form, setForm] = useState({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    }),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState("");
  const { data: readiness } = useSWR<Readiness>("/health", fetcher);
  const title = {
    login: "Welcome back.",
    register: "Make room for better listings.",
    forgot: "Let’s get you back in.",
    reset: "A fresh start, securely.",
    verify: "Verify your email.",
  }[mode];
  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      if (mode === "login" || mode === "register") {
        const response =
          mode === "login"
            ? await authApi.login({
                email: form.email,
                password: form.password,
              })
            : await authApi.register(form);
        dispatch(setCredentials({ user: response.data.user }));
        await mutate(
          "/auth/profile",
          { user: response.data.user },
          { revalidate: false },
        );
        navigate("/dashboard", { replace: true });
      } else {
        const response =
          mode === "forgot"
            ? await authApi.forgotPassword({ email: form.email })
            : mode === "reset"
              ? await authApi.resetPassword({
                  token: params.get("token") || "",
                  password: form.password,
                })
              : await authApi.verifyEmail({ token: params.get("token") || "" });
        setNotice(response.message);
      }
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          <span>
            listing<span className="brand-light">studio</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="auth-story-content">
          <span className="auth-kicker">
            <i />
            THE CONNECTED SELLER WORKSPACE
          </span>
          <h1>
            One catalog.{" "}
            <br />
            Every account.{" "}
            <br />
            <em>Less chaos.</em>
          </h1>
          <p>
            A thoughtful home for your products, seller accounts, and bulk
            listings. Built to keep the details together.
          </p>
          <div className="auth-workflow">
            <div>
              <span>
                <Boxes size={19} />
              </span>
              <strong>Organize</strong>
              <small>Your global SKUs</small>
            </div>
            <ArrowRight size={17} />
            <div>
              <span>
                <Store size={19} />
              </span>
              <strong>Connect</strong>
              <small>Every seller account</small>
            </div>
            <ArrowRight size={17} />
            <div>
              <span>
                <FileSpreadsheet size={19} />
              </span>
              <strong>Export</strong>
              <small>Account-ready files</small>
            </div>
          </div>
          <div className="auth-trust">
            <ShieldCheck size={18} />
            <span>Your catalog stays yours. Secure by design.</span>
          </div>
        </div>
        <footer>
          MADE FOR YOUR NEXT CHAPTER <span>01 — THE WORKSPACE</span>
        </footer>
      </section>
      <section className="auth-form-side">
        <div className="auth-topline">
          <span>
            {mode === "register"
              ? "Already have a workspace?"
              : "New to Listing Studio?"}
          </span>
          <Link to={mode === "register" ? "/login" : "/register"}>
            {mode === "register" ? "Sign in" : "Create an account"}
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="auth-form-wrap">
          <p className="eyebrow">
            {mode === "register"
              ? "YOUR WORKSPACE STARTS HERE"
              : "YOUR CATALOG IS WAITING"}
          </p>
          <h2>{title}</h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to pick up where you left off."
              : mode === "register"
                ? "A few details, and you’re ready to get organized."
                : mode === "forgot"
                  ? "Enter your email to request a secure password reset."
                  : mode === "verify"
                    ? "Confirm your email address using the verification link."
                    : "Choose a strong password for your account."}
          </p>
          {readiness && !readiness.authConfigured && (
            <Alert className="mb-6">
              <ShieldCheck />
              <AlertTitle>Workspace configuration pending</AlertTitle>
              <AlertDescription>
                Secure JWT secrets must be configured before sign-in and
                registration are available. No demo login is used.
              </AlertDescription>
            </Alert>
          )}
          {notice ? (
            <Alert>
              <Check />
              <AlertTitle>Request completed</AlertTitle>
              <AlertDescription>
                {notice}
                <Link to="/login" className="text-primary underline">
                  Return to sign in
                </Link>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={submit}>
              <FieldGroup className="gap-5">
                {mode === "register" && (
                  <div className="form-columns">
                    <TextField
                      id="first-name"
                      label="First name"
                      value={form.firstName}
                      onChange={(v) => field("firstName", v)}
                      autoComplete="given-name"
                      required
                    />
                    <TextField
                      id="last-name"
                      label="Last name"
                      value={form.lastName}
                      onChange={(v) => field("lastName", v)}
                      autoComplete="family-name"
                      required
                    />
                  </div>
                )}
                {mode !== "reset" && mode !== "verify" && (
                  <TextField
                    id="auth-email"
                    label="Email address"
                    value={form.email}
                    type="email"
                    onChange={(v) => field("email", v)}
                    autoComplete="email"
                    placeholder="you@yourbusiness.com"
                    required
                  />
                )}
                {mode !== "forgot" && mode !== "verify" && (
                  <TextField
                    id="auth-password"
                    label={mode === "reset" ? "New password" : "Password"}
                    type="password"
                    value={form.password}
                    onChange={(v) => field("password", v)}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    description={
                      mode === "register"
                        ? "At least 8 characters."
                        : mode === "reset"
                          ? "Use at least 8 characters, with uppercase, lowercase, a number, and a special character."
                          : undefined
                    }
                  />
                )}
                {mode === "login" && (
                  <div className="flex justify-end">
                    <Link
                      className="text-sm text-primary hover:underline"
                      to="/forgot-password"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                )}
                {failure && <ErrorState message={failure} />}
                <Button size="lg" disabled={busy} className="w-full">
                  {busy
                    ? "One moment…"
                    : mode === "register"
                      ? "Create your workspace"
                      : mode === "forgot"
                        ? "Send reset link"
                        : mode === "reset"
                          ? "Update password"
                          : mode === "verify"
                            ? "Verify email address"
                            : "Sign in to your workspace"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </FieldGroup>
            </form>
          )}
          <p className="auth-security-note">
            <ShieldCheck size={14} />
            Email and password. No marketplace credentials required.
          </p>
        </div>
        <footer className="auth-form-footer">
          A quieter way to manage a growing catalog.
        </footer>
      </section>
    </main>
  );
}
