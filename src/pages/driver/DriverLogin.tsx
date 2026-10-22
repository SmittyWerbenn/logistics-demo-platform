import { driverPath } from "../../utils/urls";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, type Location } from "react-router-dom";
import logoIcon from "../../assets/icon-mark.png";
import { useAuth } from "../../store/AuthContext";
import { PasswordInput } from "../../components/PasswordInput";
import { ContactAdminButton } from "../../components/ContactAdminButton";

const MAX_WRONG_PASSWORD = 3;

export default function DriverLogin() {
  const { login, logout, isAuthenticated, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingRoleCheck, setAwaitingRoleCheck] = useState(false);
  // Consecutive "wrong password" failures for the email being tried. Only a
  // hint - nothing is locked. Resets on success, on a different email, or
  // when the page is reloaded.
  const [failedCount, setFailedCount] = useState(0);
  const [failedEmail, setFailedEmail] = useState("");
  const [failedCode, setFailedCode] = useState("");
  // Not offered for accounts this portal is not meant for (see backend login).
  const wrongPasswordWarning =
    failedCount >= MAX_WRONG_PASSWORD && failedEmail === email.trim().toLowerCase() && failedCode === "BAD_CREDENTIALS_DRIVER";

  // Unknown email: there is no account to reset, so no "Lupa Password?".
  const emailNotRegistered = error === "Email tidak terdaftar.";

  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? driverPath("/");

  // login() resolves before the AuthContext's profile state has actually
  // flushed, so the role isn't readable synchronously after awaiting it -
  // react to the profile update instead, once it lands.
  useEffect(() => {
    if (!awaitingRoleCheck || !profile) return;
    setAwaitingRoleCheck(false);
    if (profile.role === "Driver") {
      navigate(from, { replace: true });
    } else {
      logout();
      setError("Akun ini bukan akun Driver. Gunakan Portal Admin untuk login.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, awaitingRoleCheck]);

  // Already signed in as a driver and landed back on /driver/login - go
  // straight to the dashboard instead of showing the form again.
  if (isAuthenticated && profile?.role === "Driver" && !awaitingRoleCheck) {
    return <Navigate to={driverPath("/")} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      if (result.code?.startsWith("BAD_CREDENTIALS")) {
        const key = email.trim().toLowerCase();
        setFailedCount((n) => (failedEmail === key ? n + 1 : 1));
        setFailedEmail(key);
        setFailedCode(result.code);
      }
      return;
    }
    setFailedCount(0);
    setAwaitingRoleCheck(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <img src={logoIcon} alt="GMS Logistics" className="h-14 w-14 object-contain" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Portal Driver</h1>
          <p className="mt-1 text-sm text-slate-500">GMS Logistics</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Email</span>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-3 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="nama@gms-logistics.id"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Password</span>
            <PasswordInput
              value={password}
              onChange={setPassword}
              className="w-full rounded-lg border border-slate-300 py-3 pl-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {/* Lupa Password: the WhatsApp number depends on the role behind the typed
              email (GMS-Admin -> Superadmin, everyone else -> Admin). */}
          {!emailNotRegistered && (
          <div className="-mt-1 text-right">
            <ContactAdminButton
              variant="link"
              label="Lupa Password?"
              confirmFirst
              email={email}
              message={(info) =>
                `Halo ${info.target === "superadmin" ? "Superadmin" : "Admin"} GMS, saya driver dan lupa password akun ${email.trim()}. Mohon bantuannya.`
              }
            />
          </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          {wrongPasswordWarning && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Anda sudah {failedCount} kali salah memasukkan password. Jika lupa password atau akun bermasalah,
              silakan hubungi admin.
            </div>
          )}
          {wrongPasswordWarning && (
            <ContactAdminButton
              email={email}
              message={() => `Halo Admin GMS, saya driver dan tidak bisa login (password salah berulang kali) dengan email ${email}. Mohon bantuannya.`}
            />
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}
