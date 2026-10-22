import { driverPath } from "../../utils/urls";
import { ROLE_BAR_CLASS } from "../../utils/roleTheme";
import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import logoIcon from "../../assets/icon-mark.png";
import { useAuth } from "../../store/AuthContext";
import { HeaderClock } from "../HeaderClock";
import { LogoutConfirm } from "../LogoutConfirm";

/** Layout for the driver portal (/driver/*) - deliberately separate from
 * both the public site header and AdminLayout's sidebar. Mobile-first (a
 * driver in the field is the primary user), but widens up on tablet/desktop
 * instead of staying pinned to a phone-width column. */
export function DriverLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  function handleLogout() {
    setLogoutOpen(false);
    logout();
    navigate(driverPath("/login"), { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className={`no-print sticky top-0 z-20 border-b border-t-4 border-slate-200 ${ROLE_BAR_CLASS.Driver} bg-white px-4`}>
        <div className={`mx-auto flex h-14 items-center justify-between ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
          <div className="flex min-w-0 items-center gap-2">
            <img src={logoIcon} alt="GMS Logistics" className="h-7 w-7 shrink-0 object-contain" />
            <span className="truncate text-sm font-semibold text-slate-900">GMS Logistics</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <HeaderClock />
            {profile && <span className="hidden text-sm text-slate-500 sm:block">{profile.nama}</span>}
            <button
              onClick={() => setLogoutOpen(true)}
              title="Logout"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 sm:px-3 sm:text-sm"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <LogoutConfirm
        open={logoutOpen}
        nama={profile?.nama}
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />
      <main className={`mx-auto px-4 py-4 sm:px-6 ${wide ? "max-w-4xl" : "max-w-2xl"}`}>{children}</main>
    </div>
  );
}
