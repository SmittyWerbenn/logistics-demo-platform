import { adminPath, driverPath } from "../utils/urls";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
    </div>
  );
}

/** Driver accounts don't use /admin at all anymore - they have their own
 * portal at /driver. Every admin guard below checks this first and bounces
 * a Driver there instead of rendering any admin page. */
function driverRedirect(profile: { role: string } | null): ReactNode | null {
  if (profile?.role === "Driver") return <Navigate to={driverPath("/")} replace />;
  return null;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;

  return <>{children}</>;
}

/** For general admin-edit routes (Buat Pengiriman, Pengaturan, Manajemen
 * Armada/Kota) - only Superadmin and Admin qualify. Driver and Viewer are
 * both bounced to the Dashboard rather than seeing a page they can't act on. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;
  if (profile?.role !== "Superadmin" && profile?.role !== "Admin") {
    return <Navigate to={adminPath("/")} replace />;
  }

  return <>{children}</>;
}

/** For pages a Mitra account must not open (Master Armada): everyone else who is logged in qualifies;
 * a Mitra is bounced to the Dashboard. The API refuses the same data to Mitra as well. */
export function RequireNotMitra({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;
  if (profile?.role === "Mitra") return <Navigate to={adminPath("/")} replace />;

  return <>{children}</>;
}

/** For Buat Pengiriman specifically - Superadmin, Admin and Client
 * qualify (a Client creates shipments tagged to its own Nomor
 * Pelanggan). Driver and Viewer are both bounced to the Dashboard. */
export function RequireShipmentCreator({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;
  if (profile?.role !== "Superadmin" && profile?.role !== "Admin" && profile?.role !== "Client") {
    return <Navigate to={adminPath("/")} replace />;
  }

  return <>{children}</>;
}

/** For Update Tracking specifically - Superadmin and Admin qualify. Driver
 * now uses the driver portal's own status-update flow instead of this
 * shared admin page, and Viewer is bounced to the Dashboard. */
export function RequireTrackingUpdater({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;
  if (profile?.role === "Viewer") {
    return <Navigate to={adminPath("/")} replace />;
  }

  return <>{children}</>;
}

/** For the driver portal (/driver/*) - a fully separate app from /admin, so
 * this redirects to /driver/login (never /admin/login), and only a Driver
 * account may pass; any other role gets bounced back to /driver/login too,
 * since there's no "driver home" for them to land on. */
export function RequireDriver({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated || profile?.role !== "Driver") {
    return <Navigate to={driverPath("/login")} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

/** For routes only Superadmin may open - Admin and Viewer are both bounced
 * to the Dashboard. Currently unused (Manajemen User now also admits
 * Admin, see RequireAdmin), kept for a future Superadmin-only page. */
export function RequireSuperadmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;
  if (profile?.role !== "Superadmin") {
    return <Navigate to={adminPath("/")} replace />;
  }

  return <>{children}</>;
}

/** Rate Publish view access: Superadmin, Admin (GMS-Admin), Viewer, dan Client (Admin Client).
 * Semua role ini dapat melihat Rate Publish, namun hanya Superadmin + Admin yang dapat mengubah
 * (ditentukan di komponen halaman dan enforced di backend API).
 *
 * Pola pengecekan mengikuti RequireShipmentCreator agar konsisten. */
export function RequireRatePublish({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;
  if (
    profile?.role !== "Superadmin" &&
    profile?.role !== "Admin" &&
    profile?.role !== "Viewer" &&
    profile?.role !== "Client"
  ) {
    return <Navigate to={adminPath("/")} replace />;
  }

  return <>{children}</>;
}

/** Master Layanan view access: Superadmin, Admin (GMS-Admin), Viewer, dan Client (Admin Client) -
 * sama seperti Rate Publish. Hanya Superadmin + Admin yang boleh menambah/mengubah/menonaktifkan
 * (tombol dan kolom Aksi disembunyikan di halaman, dan ditegakkan ulang di backend API lewat
 * permission `settings.manage`). */
export function RequireLayananView({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to={adminPath("/login")} replace state={{ from: location }} />;
  }
  const redirect = driverRedirect(profile);
  if (redirect) return redirect;
  if (
    profile?.role !== "Superadmin" &&
    profile?.role !== "Admin" &&
    profile?.role !== "Viewer" &&
    profile?.role !== "Client"
  ) {
    return <Navigate to={adminPath("/")} replace />;
  }

  return <>{children}</>;
}
