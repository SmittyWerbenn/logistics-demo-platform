import { useEffect } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RequireAdmin, RequireAuth, RequireNotMitra, RequireDriver, RequireShipmentCreator, RequireSuperadmin, RequireTrackingUpdater, RequireRatePublish, RequireLayananView } from "./components/RequireAuth";
import { AuditLogProvider } from "./store/AuditLogContext";
import { AuthProvider } from "./store/AuthContext";
import { ClientLogoProvider } from "./store/ClientLogoContext";
import { FeedbackProvider } from "./store/FeedbackContext";
import { FleetProvider } from "./store/FleetContext";
import { HelpContactProvider } from "./store/HelpContactContext";
import { LanguageProvider } from "./store/LanguageContext";
import { LocationProvider } from "./store/LocationContext";
import { LayananProvider } from "./store/LayananContext";
import { MitraProvider } from "./store/MitraContext";
import { NotificationProvider } from "./store/NotificationContext";
import { SettingsProvider } from "./store/SettingsContext";
import { ShipmentProvider } from "./store/ShipmentContext";
import { UserManagementProvider } from "./store/UserManagementContext";

import AccountSettings from "./pages/admin/AccountSettings";
import AuditLogPage from "./pages/admin/AuditLogPage";
import ClientCompanyProfile from "./pages/admin/ClientCompanyProfile";
import RecycleBin from "./pages/admin/RecycleBin";
import { ToastProvider } from "./components/Toast";
import CreateShipment from "./pages/admin/CreateShipment";
import CustomerList from "./pages/admin/CustomerList";
import Dashboard from "./pages/admin/Dashboard";
import EmailPreview from "./pages/admin/EmailPreview";
import FeedbackAdmin from "./pages/admin/FeedbackAdmin";
import FleetList from "./pages/admin/FleetList";
import LayananList from "./pages/admin/LayananList";
import LocationList from "./pages/admin/LocationList";
import Login from "./pages/admin/Login";
import MitraList from "./pages/admin/MitraList";
import NotificationCenter from "./pages/admin/NotificationCenter";
import SettingsPage from "./pages/admin/SettingsPage";
import RatePublish from "./pages/admin/RatePublish";
import ShipmentDetail from "./pages/admin/ShipmentDetail";
import ShipmentList from "./pages/admin/ShipmentList";
import ShipmentTracking from "./pages/admin/ShipmentTracking";
import TruckHistory from "./pages/admin/TruckHistory";
import UpdateTracking from "./pages/admin/UpdateTracking";
import DriverUserManagement from "./pages/admin/DriverUserManagement";
import RecoveryRequests from "./pages/admin/RecoveryRequests";
import UserManagement from "./pages/admin/UserManagement";
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverLogin from "./pages/driver/DriverLogin";
import DriverShipmentDetail from "./pages/driver/DriverShipmentDetail";
import DriverShipmentHistory from "./pages/driver/DriverShipmentHistory";
import CekOngkir from "./pages/public/CekOngkir";
import Home from "./pages/public/Home";
import TrackingResult from "./pages/public/TrackingResult";
import TrackingSearch from "./pages/public/TrackingSearch";
import { ADMIN_BASE_URL, DRIVER_BASE_URL, adminPath, detectPortal, driverPath } from "./utils/urls";

/**
 * On the PUBLIC domain, the /admin and /driver portals must not be reachable
 * under gms-logistics.id - bounce any such path to the correct subdomain,
 * stripping the portal prefix (they now live at the subdomain root).
 * Cross-origin, so use a full navigation.
 */
function HostGuard() {
  const location = useLocation();
  useEffect(() => {
    if (detectPortal() !== "public") return;
    const path = location.pathname;
    if (path.startsWith("/admin")) {
      const rest = path.slice("/admin".length) || "/";
      window.location.replace(ADMIN_BASE_URL + rest + location.search + location.hash);
    } else if (path.startsWith("/driver")) {
      const rest = path.slice("/driver".length) || "/";
      window.location.replace(DRIVER_BASE_URL + rest + location.search + location.hash);
    }
  }, [location]);
  return null;
}

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <HelpContactProvider>
        <AuthProvider>
          <ClientLogoProvider>
            <AuditLogProvider>
              <NotificationProvider>
                <FeedbackProvider>
                  <FleetProvider>
                    <LocationProvider>
                      <MitraProvider>
                        <LayananProvider>
                          <UserManagementProvider>
                            <SettingsProvider>
                              <ShipmentProvider>
                                <ToastProvider>{children}</ToastProvider>
                              </ShipmentProvider>
                            </SettingsProvider>
                          </UserManagementProvider>
                        </LayananProvider>
                      </MitraProvider>
                    </LocationProvider>
                  </FleetProvider>
                </FeedbackProvider>
              </NotificationProvider>
            </AuditLogProvider>
          </ClientLogoProvider>
        </AuthProvider>
      </HelpContactProvider>
    </LanguageProvider>
  );
}

export default function App() {
  const portal = detectPortal();
  const isAdmin = portal === "admin";
  const isDriver = portal === "driver";

  return (
    <AppProviders>
      {/* Static demo can be hosted under a GitHub Pages project subpath
          (/<repo>/); Vite exposes that base path as BASE_URL. */}
      <Router basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}>
        <HostGuard />
        <Routes>
          {/* Customer / public site - only on the public domain and localhost */}
          {!isAdmin && !isDriver && (
            <>
              <Route path="/" element={<Home />} />
              <Route path="/tentang" element={<Navigate to="/" state={{ scrollTo: "tentang" }} replace />} />
              <Route path="/kontak" element={<Navigate to="/" state={{ scrollTo: "kontak" }} replace />} />
              <Route path="/cek-ongkir" element={<CekOngkir />} />
              <Route path="/tracking" element={<TrackingSearch />} />
              <Route path="/tracking/:awb" element={<TrackingResult />} />
            </>
          )}

          {/* Driver portal - fully separate from /admin, own login/layout */}
          {!isAdmin && (
            <>
              <Route path={driverPath("/login")} element={<DriverLogin />} />
              <Route path={driverPath("/")} element={<RequireDriver><DriverDashboard /></RequireDriver>} />
              <Route path={driverPath("/riwayat")} element={<RequireDriver><DriverShipmentHistory /></RequireDriver>} />
              <Route path={driverPath("/shipments/:awb")} element={<RequireDriver><DriverShipmentDetail /></RequireDriver>} />
            </>
          )}

          {/* Admin / internal */}
          {!isDriver && (
            <>
              <Route path={adminPath("/login")} element={<Login />} />
              <Route path={adminPath("/")} element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path={adminPath("/pengiriman")} element={<RequireAuth><ShipmentList /></RequireAuth>} />
              <Route path={adminPath("/pengiriman/baru")} element={<RequireShipmentCreator><CreateShipment /></RequireShipmentCreator>} />
              <Route path={adminPath("/resi/:awb")} element={<RequireAuth><ShipmentDetail /></RequireAuth>} />
              <Route path={adminPath("/tracking/:awb")} element={<RequireAuth><ShipmentTracking /></RequireAuth>} />
              <Route path={adminPath("/resi/:awb/email")} element={<RequireAuth><EmailPreview /></RequireAuth>} />
              <Route path={adminPath("/update-tracking/:awb")} element={<RequireTrackingUpdater><UpdateTracking /></RequireTrackingUpdater>} />
              <Route path={adminPath("/armada")} element={<RequireNotMitra><FleetList /></RequireNotMitra>} />
              <Route path={adminPath("/armada/:id")} element={<RequireNotMitra><TruckHistory /></RequireNotMitra>} />
              <Route path={adminPath("/kota")} element={<RequireAuth><LocationList /></RequireAuth>} />
              <Route path={adminPath("/customer")} element={<RequireAdmin><CustomerList /></RequireAdmin>} />
              <Route path={adminPath("/mitra")} element={<RequireAdmin><MitraList /></RequireAdmin>} />
              <Route path={adminPath("/layanan")} element={<RequireLayananView><LayananList /></RequireLayananView>} />
              <Route path={adminPath("/notifikasi")} element={<RequireAuth><NotificationCenter /></RequireAuth>} />
              <Route path={adminPath("/feedback")} element={<RequireAuth><FeedbackAdmin /></RequireAuth>} />
              <Route path={adminPath("/audit-log")} element={<RequireAdmin><AuditLogPage /></RequireAdmin>} />
              <Route path={adminPath("/users")} element={<RequireAdmin><UserManagement /></RequireAdmin>} />
              <Route path={adminPath("/recycle-bin")} element={<RequireSuperadmin><RecycleBin /></RequireSuperadmin>} />
              <Route path={adminPath("/company-profile")} element={<RequireSuperadmin><ClientCompanyProfile /></RequireSuperadmin>} />
              <Route path={adminPath("/pemulihan-order")} element={<RequireAdmin><RecoveryRequests /></RequireAdmin>} />
              <Route path={adminPath("/users-driver")} element={<RequireAdmin><DriverUserManagement /></RequireAdmin>} />
              <Route path={adminPath("/rate-publish")} element={<RequireRatePublish><RatePublish /></RequireRatePublish>} />
              {/* Konfigurasi (Portal Admin) - satu halaman (SettingsPage) dengan tiga menu:
                  Tracking, Informasi CS, Informasi Bantuan. Guard & permission tetap RequireAdmin. */}
              <Route path={adminPath("/pengaturan/tracking")} element={<RequireAdmin><SettingsPage section="tracking" /></RequireAdmin>} />
              <Route path={adminPath("/pengaturan/informasi-cs")} element={<RequireAdmin><SettingsPage section="cs" /></RequireAdmin>} />
              <Route path={adminPath("/pengaturan/info-bantuan")} element={<RequireAdmin><SettingsPage section="bantuan" /></RequireAdmin>} />
              <Route path={adminPath("/pengaturan/akun")} element={<RequireAuth><AccountSettings /></RequireAuth>} />
            </>
          )}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AppProviders>
  );
}
