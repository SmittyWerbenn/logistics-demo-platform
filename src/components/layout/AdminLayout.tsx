import { adminPath } from "../../utils/urls";
import {
  Building2,
  ChevronRight,
  Handshake,
  Headset,
  History,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPinned,
  Menu,
  MessageSquare,
  RotateCcw,
  Package,
  PackagePlus,
  Settings,
  Tags,
  Trash2,
  Truck,
  Users,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import logoIcon from "../../assets/icon-mark.png";
import { useAuth } from "../../store/AuthContext";
import { roleLabel, type UserRole } from "../../types";
import { ROLE_ACTIVE_CLASS, ROLE_BADGE_CLASS, ROLE_BAR_CLASS } from "../../utils/roleTheme";
import { initials } from "../../utils/initials";
import { useFileUrl } from "../../utils/useFileUrl";
import { NotificationBell } from "./NotificationBell";
import { HeaderClock } from "../HeaderClock";
import { LogoutConfirm } from "../LogoutConfirm";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  /** Roles allowed to see this nav item. Omit to show it to every role. */
  roles?: UserRole[];
}

// Every role except Mitra - used for items a Mitra account shouldn't see
// but that stay open to everyone else (no admin-only intent otherwise).
const NON_MITRA_ROLES: UserRole[] = ["Superadmin", "Admin", "Driver", "Viewer", "Client"];
// Superadmin + Admin (GMS-Admin) - the existing gate for these items, kept
// identical after the menu regroup (moved menus never gain access).
const ADMIN_ONLY_ROLES: UserRole[] = ["Superadmin", "Admin"];
// Menu Rate Publish & Master Layanan: Superadmin, Admin, Viewer, Client
// (view-only for the last two) - unchanged from before the regroup.
const PUBLISHED_VIEW_ROLES: UserRole[] = ["Superadmin", "Admin", "Viewer", "Client"];

/**
 * Portal Admin navigation. Ordered exactly as the agreed structure:
 *   Operasional -> Master Data -> Manajemen User -> Konfigurasi -> Sistem & Keamanan.
 * Group titles are rendered uppercase by the sidebar styling.
 *
 * The `roles` list of every item is the SAME gate it had before the regroup -
 * moving an item to another group never widens access (routes/guards and the
 * API authorization are untouched).
 */
function getNavGroups(role: UserRole): { title: string; items: NavItem[] }[] {
  const isMitra = role === "Mitra";
  return [
    {
      title: "Operasional",
      items: [
        { to: adminPath("/"), label: "Dashboard", icon: LayoutDashboard, end: true },
        {
          to: adminPath("/pengiriman/baru"),
          label: "Buat Pengiriman",
          icon: PackagePlus,
          end: true,
          roles: ["Superadmin", "Admin", "Client"],
        },
        { to: adminPath("/pengiriman"), label: isMitra ? "Paket Saya" : "Data Pengiriman", icon: Package, end: true },
        { to: adminPath("/pemulihan-order"), label: "Pemulihan Order", icon: RotateCcw, end: true, roles: ADMIN_ONLY_ROLES },
        { to: adminPath("/feedback"), label: "Feedback Customer", icon: MessageSquare, end: true, roles: NON_MITRA_ROLES },
      ],
    },
    {
      title: "Master Data",
      items: [
        { to: adminPath("/armada"), label: "Master Armada", icon: Truck, end: false, roles: NON_MITRA_ROLES },
        { to: adminPath("/kota"), label: "Kota & Titik Transit", icon: MapPinned, end: true, roles: NON_MITRA_ROLES },
        { to: adminPath("/rate-publish"), label: "Rate Publish", icon: Tags, end: true, roles: PUBLISHED_VIEW_ROLES },
        { to: adminPath("/layanan"), label: "Master Layanan", icon: Layers, end: true, roles: PUBLISHED_VIEW_ROLES },
      ],
    },
    {
      title: "Manajemen User",
      items: [
        { to: adminPath("/users"), label: "User Admin", icon: Users, end: true, roles: ADMIN_ONLY_ROLES },
        { to: adminPath("/users-driver"), label: "User Driver", icon: Truck, end: true, roles: ADMIN_ONLY_ROLES },
        { to: adminPath("/customer"), label: "Clients", icon: Building2, end: true, roles: ADMIN_ONLY_ROLES },
        { to: adminPath("/mitra"), label: "Mitra", icon: Handshake, end: true, roles: ADMIN_ONLY_ROLES },
      ],
    },
    {
      title: "Konfigurasi",
      items: [
        // One existing page (SettingsPage) with three sections, one menu each:
        // "Tracking" (was labelled "Pengaturan"), Informasi CS, Informasi Bantuan.
        { to: adminPath("/pengaturan/tracking"), label: "Tracking", icon: Settings, end: true, roles: ADMIN_ONLY_ROLES },
        { to: adminPath("/pengaturan/informasi-cs"), label: "Informasi CS", icon: Headset, end: true, roles: ADMIN_ONLY_ROLES },
        { to: adminPath("/pengaturan/info-bantuan"), label: "Informasi Bantuan", icon: LifeBuoy, end: true, roles: ADMIN_ONLY_ROLES },
        // Client logo management on the Company Profile - Superadmin only.
        { to: adminPath("/company-profile"), label: "Client Company Profile", icon: ImageIcon, end: true, roles: ["Superadmin"] },
      ],
    },
    {
      title: "Sistem & Keamanan",
      items: [
        { to: adminPath("/audit-log"), label: "Audit Log", icon: History, end: true, roles: ADMIN_ONLY_ROLES },
        { to: adminPath("/recycle-bin"), label: "Recycle Bin", icon: Trash2, end: true, roles: ["Superadmin"] },
      ],
    },
  ];
}

/**
 * Breadcrumb (group > menu) derived from the SAME nav definition above, so the
 * labels always follow the menu. The longest matching path wins, which keeps
 * sub-pages such as /armada/:id under their own menu; `end` items only match
 * exactly. Returns null for pages that aren't in the menu (e.g. /resi/:awb).
 */
function findNavCrumb(role: UserRole, pathname: string): { group: string; label: string } | null {
  let best: { group: string; label: string; to: string } | null = null;
  for (const group of getNavGroups(role)) {
    for (const item of group.items) {
      if (item.roles && !item.roles.includes(role)) continue;
      const isMatch = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (isMatch && (!best || item.to.length > best.to.length)) {
        best = { group: group.title, label: item.label, to: item.to };
      }
    }
  }
  return best ? { group: best.group, label: best.label } : null;
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { logout, profile } = useAuth();
  const avatarUrl = useFileUrl(profile?.fotoFileId);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!profile) return null;

  // Breadcrumb follows the (new) menu structure, so its label always matches
  // the sidebar entry for the page being viewed.
  const crumb = findNavCrumb(profile.role, pathname);

  function handleLogout() {
    setLogoutOpen(false);
    logout();
    navigate(adminPath("/login"), { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Top bar */}
      <header className={`no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-t-4 border-slate-200 ${profile ? ROLE_BAR_CLASS[profile.role] : ""} bg-white px-4 sm:px-6`}>
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Buka menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <img src={logoIcon} alt="GMS Logistics" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900">GMS Logistics</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">Sistem Tracking &amp; Resi Digital</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <HeaderClock />
          <NotificationBell />
          <NavLink
            to={adminPath("/pengaturan/akun")}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100"
            title="Pengaturan Akun"
          >
            <span className="hidden text-sm text-slate-500 sm:block">{profile.nama}</span>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.nama} className="h-full w-full object-cover" />
              ) : (
                initials(profile.nama)
              )}
            </div>
          </NavLink>
          <button
            onClick={() => setLogoutOpen(true)}
            title="Logout"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 sm:px-3 sm:text-sm"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </header>

      <LogoutConfirm
        open={logoutOpen}
        nama={profile?.nama}
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`no-print fixed inset-y-0 left-0 top-16 z-20 w-64 transform overflow-y-auto border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-4 p-4">
            {getNavGroups(profile.role).map((group) => {
              const items = group.items.filter((item) => !item.roles || item.roles.includes(profile.role));
              if (items.length === 0) return null;
              return (
                <div key={group.title}>
                  <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-1">
                    {items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? profile ? ROLE_ACTIVE_CLASS[profile.role] : "bg-blue-900 text-white"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`
                        }
                      >
                        <item.icon size={18} />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="mx-4 mt-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
            <p className={`inline-block rounded-full px-2 py-0.5 font-medium ${ROLE_BADGE_CLASS[profile.role]}`}>{roleLabel(profile.role)}</p>
            <p className="mt-1">Sistem Tracking &amp; Resi Digital &mdash; PT Gangsar Mitra Suatama.</p>
          </div>
        </aside>

        {mobileOpen && (
          <div
            className="no-print fixed inset-0 z-10 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0">
          {crumb && (
            <nav
              aria-label="Breadcrumb"
              className="no-print mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400"
            >
              <span className="uppercase tracking-wide">{crumb.group}</span>
              <ChevronRight size={12} className="shrink-0" />
              <span className="font-medium text-slate-600">{crumb.label}</span>
            </nav>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
