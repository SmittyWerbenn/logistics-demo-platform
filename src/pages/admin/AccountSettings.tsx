import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, KeyRound, Save, Upload, UserCog } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "../../components/layout/AdminLayout";
import { useAuth } from "../../store/AuthContext";
import { roleLabel } from "../../types";
import { uploadFile } from "../../utils/apiClient";
import { checkPhotoSize, compressImage, MAX_PHOTO_SIZE_MB } from "../../utils/compressImage";
import { initials } from "../../utils/initials";
import { useFileUrl } from "../../utils/useFileUrl";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function AccountSettings() {
  const navigate = useNavigate();
  const { profile, updateProfile, changePassword } = useAuth();
  const existingAvatarUrl = useFileUrl(profile?.fotoFileId);

  const [nama, setNama] = useState(profile?.nama ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [newFotoDataUrl, setNewFotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkPhotoSize(file);
    if (sizeError) {
      setPhotoError(sizeError);
      return;
    }
    setPhotoError(null);
    compressImage(file, 320, 0.8)
      .then((dataUrl) => setNewFotoDataUrl(dataUrl))
      .catch(() => setPhotoError("Gagal memproses foto. Coba foto lain."));
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  if (!profile) return null;

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    let fotoFileId: string | undefined;
    if (newFotoDataUrl) {
      const uploaded = await uploadFile(newFotoDataUrl, "user_avatar", profile!.id).catch(() => null);
      fotoFileId = uploaded?.id;
    }
    const result = await updateProfile({ nama: nama.trim() || profile!.nama, email: email.trim(), fotoFileId });
    setSavingProfile(false);
    if (result.ok) {
      setNewFotoDataUrl(null);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } else {
      setProfileError(result.error);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword.length < 8) {
      setPasswordError("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak cocok.");
      return;
    }
    setChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setChangingPassword(false);
    if (!result.ok) {
      setPasswordError(result.error ?? "Gagal mengganti password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2500);
  }

  const avatarPreview = newFotoDataUrl ?? existingAvatarUrl;

  return (
    <AdminLayout>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> Kembali
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pengaturan Akun</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola profil dan keamanan akun Anda.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <UserCog size={17} className="text-blue-900" />
            <h2 className="text-sm font-semibold text-slate-800">Profil</h2>
          </div>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-lg font-semibold text-amber-700">
              {avatarPreview ? (
                <img src={avatarPreview} alt={nama} className="h-full w-full object-cover" />
              ) : (
                initials(nama)
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{profile.nama}</p>
              <p className="text-xs text-slate-400">Role: {roleLabel(profile.role)}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900">
                  <Camera size={13} /> Kamera
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900">
                  <Upload size={13} /> Upload Foto
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Maks {MAX_PHOTO_SIZE_MB}MB</p>
            </div>
          </div>
          {photoError && <p className="mb-4 text-xs font-medium text-red-600">{photoError}</p>}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Nama Tampilan</span>
            <input
              required
              className={inputClass}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Anda"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Email</span>
            <input
              required
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@gms-logistics.id"
            />
          </label>

          {profileError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle size={15} />
              {profileError}
            </div>
          )}
          {profileSaved && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} />
              Perubahan profil disimpan.
            </div>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            <Save size={15} />
            Simpan Perubahan
          </button>
        </form>

        {/* Password */}
        <form
          onSubmit={handleChangePassword}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={17} className="text-blue-900" />
            <h2 className="text-sm font-semibold text-slate-800">Ganti Password</h2>
          </div>

          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Password Saat Ini</span>
              <input
                required
                type="password"
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Password Baru</span>
              <input
                required
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Konfirmasi Password Baru
              </span>
              <input
                required
                type="password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          </div>

          {passwordError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              <AlertTriangle size={15} />
              {passwordError}
            </div>
          )}
          {passwordSaved && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} />
              Password berhasil diubah.
            </div>
          )}

          <button
            type="submit"
            disabled={changingPassword}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            <KeyRound size={15} />
            Ubah Password
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
