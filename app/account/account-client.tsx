"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Check, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { t, type Lang } from "@/lib/i18n";
import type { MemberRole } from "@/lib/types";
import { LanguageToggle } from "@/components/dashboard/language-toggle";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

const CARD = "card-base mb-4";
const LABEL = "font-label mb-1.5 block text-[11px] uppercase text-[var(--t4)]";
const LABEL_LS = { letterSpacing: "0.1em" };
const INPUT = "h-11 rounded-xl border-[var(--border)] focus-visible:ring-[var(--blue)]";
const PRIMARY_BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-medium transition-colors disabled:opacity-50";

function roleLabel(lang: Lang, role: MemberRole | null): string {
  if (role === "owner") return t(lang, "roleOwnerLabel");
  if (role === "manager") return t(lang, "roleManagerLabel");
  return t(lang, "roleViewerLabel");
}

export function AccountClient({
  lang,
  userId,
  email,
  name: initialName,
  phone: initialPhone,
  avatarUrl: initialAvatar,
  memberRole,
  googleLinked,
  googleEmail,
  hasPassword,
  projects,
}: {
  lang: Lang;
  userId: string;
  email: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  memberRole: MemberRole | null;
  googleLinked: boolean;
  googleEmail: string | null;
  hasPassword: boolean;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const tl = (k: string) => t(lang, k);

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentEmail, setCurrentEmail] = useState(email);
  const [savingEmail, setSavingEmail] = useState(false);

  const profileDirty = name.trim() !== initialName || phone.trim() !== initialPhone;

  // ── Avatar: reuse the same public `logos` bucket the project logos live in,
  // namespaced under avatars/<userId> so a re-upload overwrites in place. ──
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error(lang === "zh" ? "图片请小于 3MB" : "Image must be under 3MB");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `avatars/${userId}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (uploadErr) {
      toast.error(uploadErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    const res = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: publicUrl }),
    });
    if (!res.ok) {
      toast.error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    } else {
      setAvatar(publicUrl);
      toast.success(tl("savedLabel"));
      router.refresh();
    }
    setUploading(false);
  }

  async function handleAvatarRemove() {
    setUploading(true);
    const supabase = createClient();
    if (avatar) {
      const filePath = avatar.split("/logos/")[1]?.split("?")[0];
      if (filePath) await supabase.storage.from("logos").remove([filePath]);
    }
    const res = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: "" }),
    });
    if (!res.ok) {
      toast.error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    } else {
      setAvatar(null);
      router.refresh();
    }
    setUploading(false);
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    const res = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
    });
    if (!res.ok) {
      toast.error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    } else {
      toast.success(tl("savedLabel"));
      router.refresh();
    }
    setSavingProfile(false);
  }

  async function handleUpdatePassword() {
    if (newPassword.length < 6) {
      toast.error(tl("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(tl("passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    // Re-authenticate with the current password before allowing the change, so
    // an unattended (but still signed-in) session can't reset the password.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: currentEmail, password: currentPassword });
    if (reauthErr) {
      toast.error(tl("currentPasswordWrong"));
      setSavingPassword(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(tl("passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  }

  // Google-only accounts have no password to verify — this ADDS one (which then
  // becomes a fallback login, a prerequisite for safely switching Google).
  async function handleSetPassword() {
    if (newPassword.length < 6) { toast.error(tl("passwordTooShort")); return; }
    if (newPassword !== confirmPassword) { toast.error(tl("passwordMismatch")); return; }
    setSavingPassword(true);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); setSavingPassword(false); return; }
    toast.success(tl("passwordSet"));
    setNewPassword("");
    setConfirmPassword("");
    router.refresh();
    setSavingPassword(false);
  }

  async function handleUpdateEmail() {
    if (!emailPassword) { toast.error(tl("currentPassword")); return; }
    setSavingEmail(true);
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: newEmail.trim(), currentPassword: emailPassword }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || `HTTP ${res.status}`);
      setSavingEmail(false);
      return;
    }
    // Pick up the new email in the session JWT so identity stays consistent.
    await createClient().auth.refreshSession();
    setCurrentEmail(data.email);
    setShowEmailForm(false);
    setNewEmail("");
    setEmailPassword("");
    toast.success(tl("emailUpdated"));
    router.refresh();
    setSavingEmail(false);
  }

  const [googleBusy, setGoogleBusy] = useState(false);

  // Supabase returns "Manual linking is disabled" when the project toggle is off
  // — surface a friendly, actionable message instead of the raw error.
  const googleErr = (msg: string) => (/manual linking/i.test(msg) ? tl("googleLinkingDisabled") : msg);

  async function handleConnectGoogle() {
    setGoogleBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });
    // On success the browser redirects to Google, so we only reach here on error.
    if (error) { toast.error(googleErr(error.message)); setGoogleBusy(false); }
  }

  async function handleUnlinkGoogle() {
    setGoogleBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUserIdentities();
    const g = data?.identities?.find((i) => i.provider === "google");
    if (!g) { setGoogleBusy(false); return; }
    const { error } = await supabase.auth.unlinkIdentity(g);
    if (error) { toast.error(googleErr(error.message)); setGoogleBusy(false); return; }
    toast.success(tl("googleUnlinked"));
    router.refresh();
    setGoogleBusy(false);
  }

  // "Change" = drop the current Google link, then start linking a new one.
  async function handleChangeGoogle() {
    setGoogleBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUserIdentities();
    const g = data?.identities?.find((i) => i.provider === "google");
    if (g) {
      const { error } = await supabase.auth.unlinkIdentity(g);
      if (error) { toast.error(googleErr(error.message)); setGoogleBusy(false); return; }
    }
    await handleConnectGoogle();
  }

  const initial = (name || email).charAt(0).toUpperCase();

  return (
    <div>
      {/* Header — Back / Sign Out now live in the workspace sidebar. */}
      <div className="mb-8">
        <h1 className="font-heading text-[30px] font-semibold tracking-tight text-[var(--t1)]">{tl("myAccount")}</h1>
        <p className="mt-1 text-[14px] text-[var(--t3)]">{tl("accountSubtitle")}</p>
      </div>

      {/* ── Profile ── */}
      <section className={CARD}>
        <h2 className="mb-4 font-heading text-[17px] font-semibold text-[var(--t1)]">{tl("profileSection")}</h2>
        <div className="flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sand)] font-heading text-[24px] font-semibold text-[var(--t2)]">
              {initial}
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            <label className={`${PRIMARY_BTN} cursor-pointer border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] hover:bg-[var(--bg3)]`}>
              <Camera className="h-4 w-4" />
              {uploading ? tl("savingLabel") : tl("uploadPhoto")}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
            {avatar && (
              <button
                onClick={handleAvatarRemove}
                disabled={uploading}
                className={`${PRIMARY_BTN} border border-[var(--border)] bg-[var(--bg2)] text-[var(--t3)] hover:text-[var(--red)]`}
              >
                <Trash2 className="h-4 w-4" />
                {tl("removePhoto")}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} style={LABEL_LS}>{tl("displayName")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={INPUT} />
          </div>
          <div>
            <label className={LABEL} style={LABEL_LS}>{tl("phoneLabel")}</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+60 12 345 6789" className={INPUT} />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile || !profileDirty || !name.trim()}
            className={PRIMARY_BTN}
            style={{ background: "var(--t1)", color: "var(--bg)" }}
          >
            {savingProfile ? tl("savingLabel") : tl("saveChanges")}
          </button>
        </div>
      </section>

      {/* ── Security ── */}
      <section className={CARD}>
        <h2 className="mb-4 font-heading text-[17px] font-semibold text-[var(--t1)]">{tl("securitySection")}</h2>
        {!hasPassword ? (
          <>
            <p className="mb-4 text-[13px] text-[var(--t3)]">{tl("setPasswordHint")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} style={LABEL_LS}>{tl("newPassword")}</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} autoComplete="new-password" className={INPUT} />
              </div>
              <div>
                <label className={LABEL} style={LABEL_LS}>{tl("confirmPassword")}</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" minLength={6} autoComplete="new-password" className={INPUT} />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleSetPassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className={PRIMARY_BTN}
                style={{ background: "var(--t1)", color: "var(--bg)" }}
              >
                {savingPassword ? tl("savingLabel") : tl("setPassword")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 sm:max-w-[calc(50%-0.5rem)]">
              <label className={LABEL} style={LABEL_LS}>{tl("currentPassword")}</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className={INPUT} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} style={LABEL_LS}>{tl("newPassword")}</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} autoComplete="new-password" className={INPUT} />
              </div>
              <div>
                <label className={LABEL} style={LABEL_LS}>{tl("confirmPassword")}</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" minLength={6} autoComplete="new-password" className={INPUT} />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleUpdatePassword}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className={PRIMARY_BTN}
                style={{ background: "var(--t1)", color: "var(--bg)" }}
              >
                {savingPassword ? tl("savingLabel") : tl("updatePassword")}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Account & sign-in ── */}
      <section className={CARD}>
        <h2 className="mb-4 font-heading text-[17px] font-semibold text-[var(--t1)]">{tl("accountSection")}</h2>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3">
          <span className="text-[13px] text-[var(--t3)]">{tl("signInEmail")}</span>
          <div className="flex items-center gap-3">
            <span className="num text-[13px] font-medium text-[var(--t1)]">{currentEmail}</span>
            {hasPassword && !showEmailForm && (
              <button
                onClick={() => setShowEmailForm(true)}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] font-medium text-[var(--t1)] transition-colors hover:bg-[var(--bg3)]"
              >
                {tl("changeEmail")}
              </button>
            )}
          </div>
        </div>

        {showEmailForm && (
          <div className="border-b border-[var(--border)] py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} style={LABEL_LS}>{tl("newEmailLabel")}</label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" className={INPUT} />
              </div>
              <div>
                <label className={LABEL} style={LABEL_LS}>{tl("currentPassword")}</label>
                <Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className={INPUT} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-[var(--t4)]">{tl("emailChangeHint")}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleUpdateEmail}
                disabled={savingEmail || !newEmail || !emailPassword}
                className={PRIMARY_BTN}
                style={{ background: "var(--t1)", color: "var(--bg)" }}
              >
                {savingEmail ? tl("savingLabel") : tl("updateEmail")}
              </button>
              <button
                onClick={() => { setShowEmailForm(false); setNewEmail(""); setEmailPassword(""); }}
                className={`${PRIMARY_BTN} border border-[var(--border)] bg-[var(--bg2)] text-[var(--t3)] hover:bg-[var(--bg3)]`}
              >
                {tl("cancelLabel")}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 py-3">
          <span className="pt-1 text-[13px] text-[var(--t3)]">Google</span>
          <div className="flex flex-col items-end gap-1.5">
            {googleLinked ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--green)]">
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="num max-w-[220px] truncate">{googleEmail || tl("googleLinked")}</span>
                </span>
                {hasPassword ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleChangeGoogle}
                      disabled={googleBusy}
                      className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] font-medium text-[var(--t1)] transition-colors hover:bg-[var(--bg3)] disabled:opacity-50"
                    >
                      {tl("changeGoogle")}
                    </button>
                    <button
                      onClick={handleUnlinkGoogle}
                      disabled={googleBusy}
                      className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] font-medium text-[var(--t3)] transition-colors hover:text-[var(--red)] disabled:opacity-50"
                    >
                      {tl("unlinkGoogle")}
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--t4)]">{tl("googleOnlyNote")}</span>
                )}
              </>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={googleBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--t1)] transition-colors hover:bg-[var(--bg3)] disabled:opacity-50"
              >
                {tl("connectGoogle")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── My access ── */}
      <section className={CARD}>
        <h2 className="mb-1 font-heading text-[17px] font-semibold text-[var(--t1)]">{tl("accessSection")}</h2>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[13px] text-[var(--t3)]">{tl("yourRole")}:</span>
          <span className="rounded-full bg-[var(--bg3)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--t1)]">
            {roleLabel(lang, memberRole)}
          </span>
        </div>
        <label className={LABEL} style={LABEL_LS}>{tl("projectsAccess")}</label>
        {projects.length === 0 ? (
          <p className="text-[13px] text-[var(--t4)]">{tl("noProjectsAssigned")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/${p.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5 text-[13px] font-medium text-[var(--t1)] no-underline transition-colors hover:bg-[var(--bg3)]"
              >
                {p.name}
                <ExternalLink className="h-3.5 w-3.5 text-[var(--t4)]" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Preferences ── */}
      <section className={CARD}>
        <h2 className="mb-4 font-heading text-[17px] font-semibold text-[var(--t1)]">{tl("preferencesSection")}</h2>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3">
          <span className="text-[13px] text-[var(--t3)]">{tl("languageLabel")}</span>
          <LanguageToggle lang={lang} />
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-[13px] text-[var(--t3)]">{tl("themeLabel")}</span>
          <ThemeToggle />
        </div>
      </section>
    </div>
  );
}
