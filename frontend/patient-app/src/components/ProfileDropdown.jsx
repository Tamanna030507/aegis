/**
 * VIGIL — ProfileDropdown component
 *
 * Place this file at:
 *   frontend/patient-app/src/components/ProfileDropdown.jsx
 *   frontend/physician-dashboard/src/components/ProfileDropdown.jsx
 *
 * Usage:
 *   import ProfileDropdown from "./components/ProfileDropdown";
 *   // Inside any page/layout:
 *   <ProfileDropdown />
 *
 * Props: none — reads from useAuth() internally.
 * For emergency alert: only shown for patient role.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";

// ── Inline styles (no Tailwind dependency) ───────────────────────────────────
const S = {
  wrap: {
    position: "relative",
    display:  "inline-block",
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    zIndex: 1000,
  },
  avatar: (role) => ({
    width:  40,
    height: 40,
    borderRadius: "50%",
    background: role === "physician"
      ? "linear-gradient(135deg, #00a3ff, #0070cc)"
      : "linear-gradient(135deg, #00d2b4, #009e87)",
    border: "2px solid rgba(255,255,255,0.25)",
    cursor: "pointer",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:  14,
    fontWeight: 700,
    color:  "#fff",
    letterSpacing: 0.5,
    overflow: "hidden",
    transition: "box-shadow 0.2s, transform 0.15s",
    boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
    flexShrink: 0,
    userSelect: "none",
  }),
  avatarOpen: {
    boxShadow: "0 0 0 3px rgba(0,210,180,0.45), 0 2px 10px rgba(0,0,0,0.35)",
    transform: "scale(1.05)",
  },
  dropdown: {
    position:  "absolute",
    top:       "calc(100% + 10px)",
    right:     0,
    minWidth:  240,
    background: "rgba(10,18,16,0.97)",
    border:    "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
    backdropFilter: "blur(20px)",
    padding:   "8px 0",
    overflow:  "hidden",
    animation: "vigil-dd-in 0.18s cubic-bezier(0.4,0,0.2,1) both",
  },
  header: {
    padding:    "14px 18px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    marginBottom: 4,
  },
  headerName: {
    fontSize: 14, fontWeight: 700, color: "#fff",
    marginBottom: 2, whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200,
  },
  headerSub: {
    fontSize: 11, color: "rgba(255,255,255,0.38)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200,
  },
  rolePill: (role) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    marginTop: 6, padding: "2px 8px", borderRadius: 20,
    fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase",
    background: role === "physician" ? "rgba(0,163,255,0.15)" : "rgba(0,210,180,0.15)",
    border: `1px solid ${role === "physician" ? "rgba(0,163,255,0.3)" : "rgba(0,210,180,0.3)"}`,
    color:  role === "physician" ? "#00a3ff" : "#00d2b4",
  }),
  item: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "11px 18px",
    cursor: "pointer",
    fontSize: 13, color: "rgba(255,255,255,0.75)",
    transition: "background 0.15s, color 0.15s",
    border: "none", background: "none",
    width: "100%", textAlign: "left",
    fontFamily: "'DM Sans', 'Inter', sans-serif",
  },
  itemIcon: {
    width: 30, height: 30, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, flexShrink: 0,
  },
  divider: {
    height: 1, background: "rgba(255,255,255,0.07)",
    margin: "4px 0",
  },
  emergencyBtn: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "11px 18px",
    cursor: "pointer",
    fontSize: 13, color: "#ff4d4d",
    border: "none", background: "none",
    width: "100%", textAlign: "left",
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    transition: "background 0.15s",
  },
  emergencyIcon: {
    width: 30, height: 30, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, flexShrink: 0,
    background: "rgba(255,77,77,0.15)",
  },
  logoutBtn: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "11px 18px",
    cursor: "pointer",
    fontSize: 13, color: "rgba(255,255,255,0.5)",
    border: "none", background: "none",
    width: "100%", textAlign: "left",
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    transition: "background 0.15s, color 0.15s",
  },
  modal: {
    position: "fixed", inset: 0, zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
    animation: "vigil-fade 0.2s ease both",
  },
  modalCard: {
    background: "rgba(10,18,16,0.98)",
    border:  "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "32px 28px",
    maxWidth: 420, width: "90vw",
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    animation: "vigil-dd-in 0.25s cubic-bezier(0.4,0,0.2,1) both",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ user, open, onClick }) {
  return (
    <button
      onClick={onClick}
      title={user?.name || user?.email || "Profile"}
      style={{ ...S.avatar(user?.role), ...(open ? S.avatarOpen : {}), padding: 0, border: "2px solid rgba(255,255,255,0.2)" }}
    >
      {user?.picture ? (
        <img src={user.picture} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
      ) : (
        <span style={{ fontSize: 13, fontWeight: 700 }}>{user?.initials || "?"}</span>
      )}
    </button>
  );
}

function Item({ icon, bg, label, onClick, style = {} }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{ ...S.item, background: hovered ? "rgba(255,255,255,0.05)" : "transparent", ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ ...S.itemIcon, background: bg }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Personal Info Modal ───────────────────────────────────────────────────────
function PersonalInfoModal({ user, onClose }) {
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ ...S.avatar(user?.role), width: 56, height: 56, fontSize: 20, flexShrink: 0 }}>
            {user?.picture
              ? <img src={user.picture} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : <span>{user?.initials}</span>}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{user?.name || "Anonymous"}</div>
            <div style={S.rolePill(user?.role)}>
              {user?.role === "physician" ? "🩺" : "🧬"} {user?.role}
            </div>
          </div>
        </div>

        {[
          { label: "Email",  value: user?.email || "—", icon: "✉️" },
          { label: "Phone",  value: user?.phone || "—", icon: "📱" },
          { label: "User ID",value: user?.id?.slice(0, 8) + "…" || "—", icon: "🔑" },
          { label: "Auth",   value: user?.auth_method === "google" ? "Google OAuth" : "Mobile OTP", icon: "🔐" },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <span style={{ width: 30, textAlign: "center", fontSize: 16 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>{value}</div>
            </div>
          </div>
        ))}

        <button
          onClick={onClose}
          style={{ marginTop: 20, width: "100%", padding: "12px", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 10, background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Emergency Confirm Modal ───────────────────────────────────────────────────
function EmergencyModal({ onConfirm, onCancel, sending, sent }) {
  return (
    <div style={S.modal} onClick={onCancel}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{sent ? "✅" : "🚨"}</div>
          {sent ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Alert Sent!</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Your physician has been notified and will respond shortly.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#ff4d4d", marginBottom: 8 }}>Emergency Alert</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.6 }}>
                This will immediately notify your physician with a high-priority alert. Only use in a genuine medical emergency.
              </div>
            </>
          )}
        </div>

        {!sent && (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={onCancel}
              style={{ flex: 1, padding: "13px", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 10, background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={sending}
              style={{ flex: 1, padding: "13px", border: "none", borderRadius: 10, background: sending ? "rgba(255,77,77,0.4)" : "#ff4d4d", color: "#fff", cursor: sending ? "wait" : "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700 }}
            >
              {sending ? "Sending…" : "Send Alert"}
            </button>
          </div>
        )}

        {sent && (
          <button
            onClick={onCancel}
            style={{ width: "100%", padding: "13px", border: "none", borderRadius: 10, background: "rgba(0,210,180,0.2)", color: "#00d2b4", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700 }}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ProfileDropdown ──────────────────────────────────────────────────────
export default function ProfileDropdown() {
  const { user, logout, sendEmergencyAlert } = useAuth();
  const [open,         setOpen]         = useState(false);
  const [showInfo,     setShowInfo]     = useState(false);
  const [showEmergency,setShowEmergency]= useState(false);
  const [alertSending, setAlertSending] = useState(false);
  const [alertSent,    setAlertSent]    = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleEmergency = useCallback(async () => {
    setAlertSending(true);
    await sendEmergencyAlert("Emergency! Patient needs immediate assistance.");
    setAlertSending(false);
    setAlertSent(true);
  }, [sendEmergencyAlert]);

  if (!user) return null;

  return (
    <>
      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes vigil-dd-in {
          from { opacity:0; transform: translateY(-8px) scale(0.96); }
          to   { opacity:1; transform: translateY(0)    scale(1);    }
        }
        @keyframes vigil-fade {
          from { opacity:0; } to { opacity:1; }
        }
        .vigil-item:hover  { background: rgba(255,255,255,0.06) !important; color: #fff !important; }
        .vigil-logout:hover { background: rgba(255,60,60,0.08)  !important; color: #ff6b6b !important; }
        .vigil-emg:hover    { background: rgba(255,77,77,0.12)  !important; }
      `}</style>

      <div ref={ref} style={S.wrap}>
        <Avatar user={user} open={open} onClick={() => setOpen(v => !v)} />

        {open && (
          <div style={S.dropdown}>
            {/* Header */}
            <div style={S.header}>
              <div style={S.headerName}>{user.name || "VIGIL User"}</div>
              <div style={S.headerSub}>{user.email || user.phone || ""}</div>
              <div style={S.rolePill(user.role)}>
                {user.role === "physician" ? "🩺" : "🧬"} {user.role}
              </div>
            </div>

            {/* Personal Info */}
            <Item
              icon="👤"
              bg="rgba(0,163,255,0.15)"
              label="Personal Info"
              onClick={() => { setOpen(false); setShowInfo(true); }}
              style={{ color: "rgba(255,255,255,0.8)" }}
            />

            {/* Emergency Alert — patients only */}
            {user.role === "patient" && (
              <>
                <div style={S.divider} />
                <button
                  className="vigil-emg"
                  onClick={() => { setOpen(false); setAlertSent(false); setShowEmergency(true); }}
                  style={S.emergencyBtn}
                >
                  <span style={S.emergencyIcon}>🚨</span>
                  Emergency Alert
                </button>
                <div style={S.divider} />
              </>
            )}

            {/* Logout */}
            <button
              className="vigil-logout"
              onClick={() => { setOpen(false); logout(); }}
              style={S.logoutBtn}
            >
              <span style={{ ...S.itemIcon, background: "rgba(255,60,60,0.12)" }}>🚪</span>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Personal Info Modal */}
      {showInfo && <PersonalInfoModal user={user} onClose={() => setShowInfo(false)} />}

      {/* Emergency Modal */}
      {showEmergency && (
        <EmergencyModal
          sending={alertSending}
          sent={alertSent}
          onConfirm={handleEmergency}
          onCancel={() => { setShowEmergency(false); setAlertSent(false); }}
        />
      )}
    </>
  );
}
