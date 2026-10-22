import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

/** Password field with a lock icon and an eye button to reveal what was typed. */
export function PasswordInput({
  value,
  onChange,
  className,
  placeholder = "********",
}: {
  value: string;
  onChange: (value: string) => void;
  /** Classes for the <input> (padding for the icons is added on top). */
  className: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        required
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${className} pr-10`}
        placeholder={placeholder}
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
