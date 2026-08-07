"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Lock, Moon, Sun, LogOut, Trash2,
  Save, CheckCircle, AlertTriangle, Eye, EyeOff, Loader2,
  Upload, Camera, X, Twitter, Linkedin, Github, Globe, Bell, Pencil,
  MessageSquare, Zap, Shield, Crop, RotateCw, ZoomIn, ZoomOut, Move,
  Swords, Trophy, Calendar
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useTheme } from "@/lib/ThemeContext";
import * as Dialog from "@radix-ui/react-dialog";

// ── Reusable section card ─────────────────────────────────────────
function Section({ title, description, icon, children }: {
  title: string; description: string;
  icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#DEDCD3] dark:border-[#35352C] flex items-start gap-3 bg-[#FAFAF8] dark:bg-[#14140F]">
        <div className="w-8 h-8 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] flex items-center justify-center text-[#6B2737] dark:text-[#B5677A] flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-heading text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{title}</h2>
          <p className="text-xs text-[#8C8B82] mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Input field ───────────────────────────────────────────────────
function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#5B5A52] dark:text-[#ABA99C]">{label}</label>
      <input
        {...props}
        className="w-full px-4 py-2.5 border border-[#DEDCD3] dark:border-[#35352C]
                   bg-[#FAFAF8] dark:bg-[#14140F] text-sm text-[#1B1B18] dark:text-[#F2F1EA]
                   placeholder:text-[#8C8B82] outline-none
                   focus:border-[#6B2737] transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ── Textarea field ─────────────────────────────────────────────────
function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#5B5A52] dark:text-[#ABA99C]">{label}</label>
      <textarea
        {...props}
        rows={4}
        className="w-full px-4 py-2.5 border border-[#DEDCD3] dark:border-[#35352C]
                   bg-[#FAFAF8] dark:bg-[#14140F] text-sm text-[#1B1B18] dark:text-[#F2F1EA]
                   placeholder:text-[#8C8B82] outline-none resize-none
                   focus:border-[#6B2737] transition-colors"
      />
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────
function Toggle({ checked, onChange, label, icon }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#EAE8E1] dark:border-[#262620] last:border-0">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-[#8C8B82]">{icon}</span>}
        <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{label}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-200 border ${
          checked
            ? "bg-[#6B2737] border-[#6B2737]"
            : "bg-[#EAE8E1] dark:bg-[#262620] border-[#DEDCD3] dark:border-[#35352C]"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── Toast message ─────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`flex items-center gap-2 text-xs px-4 py-3 border ${type === "success"
      ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]"
      : "bg-[#F5E7E4] dark:bg-[#2C1816] border-[#8C2E24] text-[#8C2E24] dark:text-[#D08A7E]"
      }`}>
      {type === "success"
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

// ── Image Cropper Component ─────────────────────────────────────────────
function ImageCropper({ imageSrc, onCropComplete, onCancel }: { imageSrc: string; onCropComplete: (croppedBlob: Blob) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      drawImage();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    drawImage();
  }, [offset, rotation]);

  const drawImage = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    const size = Math.min(img.width, img.height);
    const sx = (img.width - size) / 2;
    const sy = (img.height - size) / 2;
    ctx.drawImage(
      img,
      sx, sy, size, size,
      -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height
    );

    ctx.restore();
  };

  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const coords = getRelativeCoords(e);
    setDragStart({ x: coords.x - offset.x, y: coords.y - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const coords = getRelativeCoords(e);
    setOffset({
      x: coords.x - dragStart.x,
      y: coords.y - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoom = (delta: number) => {
    zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current + delta));
    drawImage();
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onCropComplete(blob);
    }, "image/png");
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-full w-64 h-64 bg-gray-100 dark:bg-gray-800 cursor-move select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <canvas ref={canvasRef} width={256} height={256} className="w-full h-full" />
        <div className="absolute inset-0 rounded-full border-4 border-white/50 pointer-events-none" />
      </div>
      <div className="flex items-center gap-4">
        <button onClick={() => handleZoom(0.2)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => handleZoom(-0.2)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
          <ZoomOut className="w-5 h-5" />
        </button>
        <button onClick={handleRotate} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
          <RotateCw className="w-5 h-5" />
        </button>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-700 dark:text-gray-300">
          Cancel
        </button>
        <button onClick={handleApply} className="px-6 py-2 bg-[#6366F1] text-white rounded-xl flex items-center gap-2">
          <Crop className="w-4 h-4" /> Apply
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // ThemeContext only exposes toggleTheme, so we derive a "select" helper
  const selectTheme = (t: "light" | "dark") => {
    if (t !== theme) toggleTheme();
  };

  // Profile state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [initials, setInitials] = useState("?");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    twitter: "",
    linkedin: "",
    github: "",
    website: ""
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_notifications: true,
    push_notifications: true,
    battle_invites: true,
    contest_reminders: true
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showViewImageModal, setShowViewImageModal] = useState(false);

  // Password state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwds, setShowPwds] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Delete-account confirmation
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // ── Load user on mount ─────────────────────────────────────────
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const name = (user.user_metadata?.full_name as string)
      || (user.user_metadata?.name as string)
      || user.email?.split("@")[0]
      || "";
    setDisplayName(name);
    setEmail(user.email ?? "");
    setInitials(name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?");

    // Load profile from profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setAvatarUrl(profile.avatar_url);
      setBio(profile.bio || "");
      setSocialLinks({
        twitter: profile.social_links?.twitter || "",
        linkedin: profile.social_links?.linkedin || "",
        github: profile.social_links?.github || "",
        website: profile.social_links?.website || ""
      });
      setNotificationPrefs({
        email_notifications: profile.notification_preferences?.email_notifications ?? true,
        push_notifications: profile.notification_preferences?.push_notifications ?? true,
        battle_invites: profile.notification_preferences?.battle_invites ?? true,
        contest_reminders: profile.notification_preferences?.contest_reminders ?? true
      });
    }
  };

  // ── Handle image selection for cropping ───────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      setProfileMsg({ text: "Please upload an image file.", type: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setProfileMsg({ text: "Image size must be less than 5MB.", type: "error" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setTempAvatarUrl(event.target?.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  // ── Handle cropped image upload ─────────────────────────────────────────
  const handleCroppedImage = async (croppedBlob: Blob) => {
    setShowCropper(false);
    setAvatarUploading(true);
    setProfileMsg(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileName = `${user.id}/${Date.now()}.png`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/png"
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      setAvatarUrl(publicUrl);
      setProfileMsg({ text: "Avatar cropped and uploaded successfully! Click 'Save Profile' to keep it.", type: "success" });
    } catch (error: any) {
      console.error("Upload error:", error);
      setProfileMsg({ text: error.message || "Failed to upload avatar.", type: "error" });
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Remove avatar ─────────────────────────────────────────────────
  const removeAvatar = async () => {
    try {
      setAvatarUrl(null);
      setProfileMsg({ text: "Avatar removed! Click 'Save Profile' to confirm.", type: "success" });
    } catch (error: any) {
      setProfileMsg({ text: error.message || "Failed to remove avatar.", type: "error" });
    }
  };

  // ── Save profile ─────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!displayName.trim()) {
      setProfileMsg({ text: "Display name cannot be empty.", type: "error" }); return;
    }
    setProfileSaving(true); setProfileMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    if (error) {
      setProfileMsg({ text: error.message, type: "error" });
    } else {
      // Also update profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: displayName.trim(),
          avatar_url: avatarUrl,
          bio: bio,
          social_links: socialLinks,
          notification_preferences: notificationPrefs,
          updated_at: new Date().toISOString(),
        });
      }
      const ini = displayName.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      setInitials(ini);
      setProfileMsg({ text: "Profile updated successfully!", type: "success" });
    }
    setProfileSaving(false);
  };

  // ── Change password ───────────────────────────────────────────────
  const changePassword = async () => {
    if (!newPwd) { setPwdMsg({ text: "Please enter a new password.", type: "error" }); return; }
    if (newPwd.length < 8) { setPwdMsg({ text: "Password must be at least 8 characters.", type: "error" }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ text: "Passwords do not match.", type: "error" }); return; }
    setPwdSaving(true); setPwdMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) {
      setPwdMsg({ text: error.message, type: "error" });
    } else {
      setPwdMsg({ text: "Password changed successfully!", type: "success" });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    }
    setPwdSaving(false);
  };

  // ── Delete account ───────────────────────────────────────────────
  const deleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      setDeleteMsg({ text: 'Type "DELETE" (all caps) to confirm.', type: "error" }); return;
    }
    setDeleting(true); setDeleteMsg(null);
    const supabase = createClient();
    // Delete all user data first
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("questly_quiz_attempts").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);
    }
    // Sign out (Supabase free tier doesn't allow self-deletion via anon key)
    await supabase.auth.signOut();
    router.push("/");
    setDeleting(false);
  };

  // ── Sign out ─────────────────────────────────────────────────────
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Settings</h1>
        <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">Manage your account and preferences</p>
      </div>

      <div className="space-y-6">
        {/* ── Profile ── */}
        <Section title="Profile" description="Update your display name, avatar, and bio" icon={<User className="w-4 h-4" />}>
          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 object-cover border border-[#DEDCD3] dark:border-[#35352C]"
                />
              ) : (
                <div className="w-16 h-16 bg-[#6B2737] flex items-center justify-center text-white text-xl font-bold">
                  {initials}
                </div>
              )}
              {/* Edit button */}
              <div className="absolute -bottom-1 -right-1">
                <button
                  onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  className="w-7 h-7 bg-[#6B2737] flex items-center justify-center text-white cursor-pointer hover:bg-[#551F2C] transition-colors"
                >
                  {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Avatar menu */}
              {showAvatarMenu && (
                <>
                  <div className="absolute top-full left-0 z-50 w-48 mt-2 bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] shadow-md overflow-hidden">
                    <div className="py-1">
                      {avatarUrl && (
                        <button
                          onClick={() => {
                            setShowAvatarMenu(false);
                            setShowViewImageModal(true);
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-xs text-[#1B1B18] dark:text-[#F2F1EA] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] w-full text-left"
                        >
                          <Eye className="w-4 h-4" />
                          View photo
                        </button>
                      )}
                      <label className="flex items-center gap-3 px-4 py-2 text-xs text-[#1B1B18] dark:text-[#F2F1EA] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] cursor-pointer w-full text-left">
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setShowAvatarMenu(false);
                            handleImageSelect(e);
                          }}
                          className="hidden"
                          disabled={avatarUploading}
                        />
                        Change photo
                      </label>
                      {avatarUrl && (
                        <button
                          onClick={() => {
                            setShowAvatarMenu(false);
                            removeAvatar();
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-xs text-[#8C2E24] hover:bg-[#F5E7E4] dark:hover:bg-[#2C1816] w-full text-left"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove photo
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAvatarMenu(false)}
                  />
                </>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{displayName || "—"}</p>
              <p className="text-xs text-[#8C8B82]">{email}</p>
              <p className="text-[10px] text-[#8C8B82] mt-0.5">
                Upload a profile picture (max 5MB)
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <Field
              label="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your full name"
            />
            <TextArea
              label="Bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us a little about yourself..."
            />
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-[#5B5A52] dark:text-[#ABA99C]">Social Links</p>
              <div className="relative">
                <Twitter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8B82]" />
                <input
                  type="url"
                  placeholder="https://twitter.com/username"
                  value={socialLinks.twitter}
                  onChange={e => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none focus:border-[#6B2737] transition-colors"
                />
              </div>
              <div className="relative">
                <Linkedin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8B82]" />
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={socialLinks.linkedin}
                  onChange={e => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none focus:border-[#6B2737] transition-colors"
                />
              </div>
              <div className="relative">
                <Github className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8B82]" />
                <input
                  type="url"
                  placeholder="https://github.com/username"
                  value={socialLinks.github}
                  onChange={e => setSocialLinks({ ...socialLinks, github: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none focus:border-[#6B2737] transition-colors"
                />
              </div>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8B82]" />
                <input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={socialLinks.website}
                  onChange={e => setSocialLinks({ ...socialLinks, website: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none focus:border-[#6B2737] transition-colors"
                />
              </div>
            </div>
            <Field
              label="Email Address"
              value={email}
              disabled
              type="email"
              placeholder="your@email.com"
            />
            <p className="text-[11px] text-[#8C8B82]">
              Email cannot be changed here. Contact support if needed.
            </p>
          </div>
          {profileMsg && <div className="mt-4">{<Toast msg={profileMsg.text} type={profileMsg.type} />}</div>}
          <div className="flex justify-end mt-4">
            <button
              onClick={saveProfile}
              disabled={profileSaving}
              className="flex items-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] disabled:opacity-50
                         text-white text-xs font-medium px-4 py-2 transition-colors"
            >
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </button>
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications" description="Manage your notification preferences" icon={<Bell className="w-4 h-4" />}>
          <div className="space-y-0">
            <Toggle
              checked={notificationPrefs.email_notifications}
              onChange={(v) => setNotificationPrefs({ ...notificationPrefs, email_notifications: v })}
              label="Email Notifications"
              icon={<Mail className="w-4 h-4" />}
            />
            <Toggle
              checked={notificationPrefs.push_notifications}
              onChange={(v) => setNotificationPrefs({ ...notificationPrefs, push_notifications: v })}
              label="Push Notifications"
              icon={<Bell className="w-4 h-4" />}
            />
            <Toggle
              checked={notificationPrefs.battle_invites}
              onChange={(v) => setNotificationPrefs({ ...notificationPrefs, battle_invites: v })}
              label="Battle Invites"
              icon={<Swords className="w-4 h-4" />}
            />
            <Toggle
              checked={notificationPrefs.contest_reminders}
              onChange={(v) => setNotificationPrefs({ ...notificationPrefs, contest_reminders: v })}
              label="Contest Reminders"
              icon={<Trophy className="w-4 h-4" />}
            />
          </div>
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance" description="Choose your preferred theme" icon={theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map(t => (
              <button
                key={t}
                onClick={() => selectTheme(t)}
                className={`flex items-center gap-3 px-4 py-3 border transition-colors ${theme === t
                  ? "border-[#6B2737] bg-[#F3E7E9] dark:bg-[#2E1A20]"
                  : "border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] hover:bg-[#EAE8E1] dark:hover:bg-[#262620]"
                  }`}
              >
                <div className={`w-7 h-7 flex items-center justify-center ${t === "light" ? "bg-[#FAFAF8]" : "bg-[#1C1C16]"
                  }`}>
                  {t === "light"
                    ? <Sun className="w-4 h-4 text-[#93670F]" />
                    : <Moon className="w-4 h-4 text-[#ABA99C]" />}
                </div>
                <div className="text-left">
                  <div className={`text-xs font-semibold capitalize ${theme === t ? "text-[#6B2737] dark:text-[#B5677A]" : "text-[#1B1B18] dark:text-[#F2F1EA]"
                    }`}>{t} Mode</div>
                  <div className="text-[10px] text-[#8C8B82]">
                    {t === "light" ? "Clean & bright" : "Easy on the eyes"}
                  </div>
                </div>
                {theme === t && (
                  <CheckCircle className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A] ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#8C8B82] mt-3">
            Your preference is saved to this browser automatically.
          </p>
        </Section>

        {/* ── Security / Password ── */}
        <Section title="Security" description="Change your account password" icon={<Lock className="w-4 h-4" />}>
          <div className="space-y-4">
            <div className="relative">
              <Field
                label="New Password"
                type={showPwds ? "text" : "password"
                }
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Min. 8 characters"
              />
              <button
                onClick={() => setShowPwds(v => !v)}
                className="absolute right-3 bottom-2.5 text-[#8C8B82] hover:text-[#5B5A52]"
                type="button"
              >
                {showPwds ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Field
              label="Confirm Password"
              type={showPwds ? "text" : "password"
              }
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Repeat new password"
            />
            {/* Password strength indicator */}
            {newPwd.length > 0 && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map(i => {
                    const strength = Math.min(
                      4,
                      (newPwd.length >= 8 ? 1 : 0) +
                      (/[A-Z]/.test(newPwd) ? 1 : 0) +
                      (/[0-9]/.test(newPwd) ? 1 : 0) +
                      (/[^A-Za-z0-9]/.test(newPwd) ? 1 : 0)
                    );
                    return (
                      <div key={i} className={`h-1 flex-1 transition-colors ${i <= strength
                        ? strength <= 1 ? "bg-[#8C2E24]" : strength <= 2 ? "bg-[#93670F]" : strength <= 3 ? "bg-[#2F6B3A]" : "bg-[#2F6B3A]"
                        : "bg-[#DEDCD3] dark:bg-[#35352C]"
                        }`} />
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#8C8B82]">
                  Include uppercase, numbers, and symbols for a stronger password.
                </p>
              </div>
            )}
          </div>
          {pwdMsg && <div className="mt-4">{<Toast msg={pwdMsg.text} type={pwdMsg.type} />}</div>}
          <button
            onClick={changePassword}
            disabled={pwdSaving || !newPwd || !confirmPwd}
            className="mt-4 flex items-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] disabled:opacity-50
                     text-white text-xs font-medium px-4 py-2 transition-colors"
          >
            {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Update Password
          </button>
        </Section>

        {/* ── Account actions ── */}
        <Section title="Account" description="Session and account management" icon={<LogOut className="w-4 h-4" />}>
          <div className="space-y-3">
            {/* Sign out */}
            <div className="flex items-center justify-between py-3 border-b border-[#EAE8E1] dark:border-[#262620]">
              <div>
                <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">Sign Out</p>
                <p className="text-xs text-[#8C8B82]">End your current session</p>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]
                           border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] px-4 py-2
                           hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>

            {/* Email info */}
            <div className="flex items-center gap-3 py-3 border-b border-[#EAE8E1] dark:border-[#262620]">
              <Mail className="w-4 h-4 text-[#8C8B82]" />
              <div>
                <p className="text-xs text-[#8C8B82]">Logged in as</p>
                <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{email}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Danger zone ── */}
        <div className="bg-white dark:bg-[#1C1C16] border border-[#8C2E24] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#8C2E24] flex items-start gap-3 bg-[#F5E7E4] dark:bg-[#2C1816]">
            <div className="w-8 h-8 border border-[#8C2E24] flex items-center justify-center text-[#8C2E24] flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-medium text-[#8C2E24]">Danger Zone</h2>
              <p className="text-xs text-[#8C2E24] mt-0.5">
                These actions are permanent and cannot be undone.
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-[#1B1B18] dark:text-[#F2F1EA] mb-1 font-medium">Delete Account</p>
            <p className="text-xs text-[#8C8B82] mb-4">
              This will permanently remove all your quizzes, certificates, and account data.
            </p>
            <Field
              label='Type "DELETE" to confirm'
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
            {deleteMsg && <div className="mt-4">{<Toast msg={deleteMsg.text} type={deleteMsg.type} />}</div>}
            <button
              onClick={deleteAccount}
              disabled={deleting || deleteConfirm !== "DELETE"}
              className="mt-4 flex items-center gap-2 bg-[#8C2E24] hover:bg-[#6D241C] disabled:opacity-40
                       text-white text-xs font-medium px-4 py-2 transition-colors"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Crop Dialog */}
      <Dialog.Root open={showCropper} onOpenChange={setShowCropper}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-white dark:bg-[#1e293b] border border-[#E5E7EB] dark:border-[#334155] p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            <Dialog.Title className="text-lg font-bold text-[#111827] dark:text-[#f8fafc] mb-4">
              Crop & Adjust Your Avatar
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[#6B7280] dark:text-[#94a3b8] mb-6">
              Zoom, rotate, and drag to adjust your profile picture.
            </Dialog.Description>
            {tempAvatarUrl && (
              <ImageCropper
                imageSrc={tempAvatarUrl}
                onCropComplete={handleCroppedImage}
                onCancel={() => setShowCropper(false)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* View Image Modal */}
      <Dialog.Root open={showViewImageModal} onOpenChange={setShowViewImageModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] max-h-[90vh] w-[90vw] max-w-[700px] bg-transparent focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 border-0">
            <Dialog.Title className="sr-only">Profile picture</Dialog.Title>
            <Dialog.Description className="sr-only">View and close your profile picture</Dialog.Description>
            <Dialog.Close className="absolute -top-4 -right-4 w-10 h-10 bg-white dark:bg-[#1e293b] rounded-full flex items-center justify-center text-[#374151] dark:text-[#f8fafc] hover:bg-gray-100 dark:hover:bg-[#334155] transition-all shadow-lg z-10">
              <X className="w-6 h-6" />
            </Dialog.Close>
            {avatarUrl && (
              <div className="shadow-2xl rounded-3xl overflow-hidden">
                <img
                  src={avatarUrl}
                  alt="Profile picture"
                  className="w-full h-auto object-contain"
                />
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
