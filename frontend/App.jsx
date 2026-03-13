import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG — change API URL and family name here ─────────────────────────────
const API         = "http://localhost:8000";
const FAMILY_NAME = "Our Family Registry"; // ← change to your family name

// ─── Constants ────────────────────────────────────────────────────────────────
const RELATIONS = ["Father","Mother","Son","Daughter","Brother","Sister","Husband","Wife",
  "Grandfather","Grandmother","Grandson","Granddaughter","Uncle","Aunt","Nephew","Niece","Cousin","Guardian","Ward"];

const GEN_LABELS = {1:"Founders & Elders",2:"Second Generation",3:"Third Generation",
  4:"Fourth Generation",5:"Fifth Generation"};

const GEN_COLORS = {
  1: { from:"#7c3aed", to:"#4f46e5", light:"#ede9fe", text:"#4f46e5" },
  2: { from:"#0891b2", to:"#0e7490", light:"#cffafe", text:"#0e7490" },
  3: { from:"#059669", to:"#047857", light:"#d1fae5", text:"#047857" },
  4: { from:"#d97706", to:"#b45309", light:"#fef3c7", text:"#b45309" },
  5: { from:"#e11d48", to:"#be123c", light:"#ffe4e6", text:"#be123c" },
};

const GCOL = {
  Male:   { bg:"#1e40af", light:"#dbeafe", accent:"#3b82f6", gradient:"linear-gradient(135deg,#1e3a8a,#1e40af)" },
  Female: { bg:"#9d174d", light:"#fce7f3", accent:"#ec4899", gradient:"linear-gradient(135deg,#831843,#9d174d)" },
  Other:  { bg:"#065f46", light:"#d1fae5", accent:"#10b981", gradient:"linear-gradient(135deg,#064e3b,#065f46)" },
};

// ─── API client ───────────────────────────────────────────────────────────────
async function api(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inits  = n => n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
const ageVal = dob => dob ? Math.floor((Date.now() - new Date(dob)) / (365.25*24*3600*1000)) : null;

function getUpcomingBirthdays(members, days = 30) {
  const today = new Date(); today.setHours(0,0,0,0);
  return members
    .filter(m => m.dob)
    .map(m => {
      const bday = new Date(m.dob);
      let next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const diff = Math.round((next - today) / (24*3600*1000));
      return { ...m, nextBirthday: next, daysUntil: diff, age: ageVal(m.dob) + 1 };
    })
    .filter(m => m.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Base styles ──────────────────────────────────────────────────────────────
const inp = {
  width:"100%", padding:"10px 14px", border:"2px solid #e2e8f0",
  borderRadius:10, fontSize:15, fontFamily:"'Inter',sans-serif",
  color:"#1e293b", background:"#f8fafc", outline:"none", boxSizing:"border-box",
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ member, size = 64, onClick, editable = false }) {
  const c = GCOL[member.gender] || GCOL.Other;
  return (
    <div onClick={onClick} style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0, position:"relative",
      cursor: editable ? "pointer" : "default",
      boxShadow:`0 4px 20px ${c.bg}55`,
    }}>
      {member.photo ? (
        <img src={member.photo} alt={member.name} style={{
          width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover",
          border:`3px solid rgba(255,255,255,0.4)`,
        }} />
      ) : (
        <div style={{
          width:"100%", height:"100%", borderRadius:"50%",
          background: c.gradient,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:size*0.32, fontWeight:800, color:"#fff",
          fontFamily:"'Playfair Display',serif",
          border:"3px solid rgba(255,255,255,0.3)",
        }}>{inits(member.name)}</div>
      )}
      {editable && (
        <div style={{
          position:"absolute", bottom:0, right:0,
          background:"#6366f1", borderRadius:"50%", width:size*0.32, height:size*0.32,
          display:"flex", alignItems:"center", justifyContent:"center",
          border:"2px solid white", fontSize:size*0.14,
        }}>📷</div>
      )}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, children, error }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{
        display:"block", fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600,
        color:"#64748b", marginBottom:5, letterSpacing:"0.05em", textTransform:"uppercase",
      }}>{label}</label>
      {children}
      {error && <div style={{ color:"#ef4444", fontSize:12, marginTop:3 }}>{error}</div>}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ show, onClose, title, children, width = 520 }) {
  if (!show) return null;
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(2,6,23,0.75)", backdropFilter:"blur(6px)",
      zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }} onClick={onClose}>
      <div style={{
        background:"#fff", borderRadius:24, width:"100%", maxWidth:width,
        maxHeight:"92vh", overflowY:"auto",
        boxShadow:"0 40px 100px rgba(0,0,0,0.35)",
        animation:"modalIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding:"20px 24px 14px", borderBottom:"1px solid #f1f5f9",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          position:"sticky", top:0, background:"#fff", zIndex:1, borderRadius:"24px 24px 0 0",
        }}>
          <h2 style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:20, color:"#0f172a" }}>{title}</h2>
          <button onClick={onClose} style={{
            background:"#f1f5f9", border:"none", borderRadius:"50%",
            width:32, height:32, cursor:"pointer", fontSize:18, color:"#64748b",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>×</button>
        </div>
        <div style={{ padding:"20px 24px 28px" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type = "success" }) {
  if (!msg) return null;
  const colors = {
    success: { bg:"#064e3b", text:"#6ee7b7", icon:"✓" },
    error:   { bg:"#7f1d1d", text:"#fca5a5", icon:"✕" },
    info:    { bg:"#1e3a5f", text:"#93c5fd", icon:"ℹ" },
  };
  const c = colors[type] || colors.success;
  return (
    <div style={{
      position:"fixed", bottom:28, right:28, zIndex:9999,
      background:c.bg, color:c.text, padding:"13px 22px", borderRadius:14,
      fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:500,
      boxShadow:"0 8px 32px rgba(0,0,0,0.4)", animation:"slideUp 0.4s ease",
      display:"flex", alignItems:"center", gap:8,
    }}>
      <span style={{ fontWeight:700 }}>{c.icon}</span> {msg}
    </div>
  );
}

// ─── Photo Upload ─────────────────────────────────────────────────────────────
function PhotoUpload({ member, token, onUpdated }) {
  const fileRef = useRef();
  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Photo must be under 2MB"); return; }
    try {
      const base64 = await fileToBase64(file);
      await api("/members/me", { method:"PUT", body:JSON.stringify({ photo: base64 }) }, token);
      onUpdated();
    } catch (err) { alert(err.message); }
  };
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile} />
      <Avatar member={member} size={88} editable onClick={() => fileRef.current?.click()} />
      <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"'Inter',sans-serif", marginTop:4, textAlign:"center" }}>
        Tap to change photo
      </div>
    </>
  );
}

// ─── Birthday Panel ───────────────────────────────────────────────────────────
function BirthdayPanel({ members, onDismiss }) {
  const upcoming = getUpcomingBirthdays(members, 30);
  if (upcoming.length === 0) return null;

  const today = upcoming.filter(m => m.daysUntil === 0);
  const soon  = upcoming.filter(m => m.daysUntil > 0);

  return (
    <div style={{
      background:"linear-gradient(135deg,#7c3aed,#4f46e5)",
      margin:"0 0 28px", borderRadius:20,
      padding:"20px 24px", animation:"fadeDown 0.5s ease",
      boxShadow:"0 8px 32px rgba(124,58,237,0.3)",
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:24 }}>🎂</span>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:"#fff" }}>
              {today.length > 0 ? `🎉 Birthday Today!` : "Upcoming Birthdays"}
            </div>
            <div style={{ fontSize:12, color:"#c4b5fd", fontFamily:"'Inter',sans-serif" }}>
              {upcoming.length} in the next 30 days
            </div>
          </div>
        </div>
        <button onClick={onDismiss} style={{
          background:"rgba(255,255,255,0.15)", border:"none", borderRadius:10,
          padding:"6px 14px", cursor:"pointer", color:"#e0d7ff",
          fontFamily:"'Inter',sans-serif", fontSize:12,
        }}>Dismiss</button>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
        {upcoming.slice(0, 6).map(m => {
          const isToday = m.daysUntil === 0;
          return (
            <div key={m.id} style={{
              background: isToday ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
              borderRadius:12, padding:"10px 14px",
              display:"flex", alignItems:"center", gap:10,
              border: isToday ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.15)",
              animation: isToday ? "pulse 2s infinite" : "none",
            }}>
              <Avatar member={m} size={36} />
              <div>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:"#fff" }}>
                  {m.name}
                </div>
                <div style={{ fontSize:11, color:"#c4b5fd" }}>
                  {isToday ? `🎉 Turning ${m.age} today!`
                    : m.daysUntil === 1 ? `Tomorrow · Turning ${m.age}`
                    : `In ${m.daysUntil} days · Turning ${m.age}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({ member, isSelf, onClick }) {
  const [h, setH] = useState(false);
  const c   = GCOL[member.gender] || GCOL.Other;
  const gc  = GEN_COLORS[member.generation] || GEN_COLORS[1];
  const a   = ageVal(member.dob);
  const rels = Object.keys(member.relations || {}).length;

  // Check if birthday today or soon
  const bdays = getUpcomingBirthdays([member], 7);
  const bday  = bdays[0];

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        background:"#fff", borderRadius:20, cursor:"pointer",
        width:200, flexShrink:0,
        border:`2px solid ${isSelf ? "#6366f1" : h ? c.accent : "#f1f5f9"}`,
        boxShadow: h
          ? `0 20px 50px ${c.bg}44, 0 4px 16px rgba(0,0,0,0.1)`
          : "0 2px 12px rgba(0,0,0,0.07)",
        transform: h ? "translateY(-8px) scale(1.03)" : "translateY(0) scale(1)",
        transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        overflow:"hidden", position:"relative",
      }}
    >
      {/* Top gradient bar */}
      <div style={{
        height:6, background:`linear-gradient(90deg,${gc.from},${gc.to})`,
      }} />

      {/* Self badge */}
      {isSelf && (
        <div style={{
          position:"absolute", top:14, right:10,
          background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
          color:"#fff", fontSize:9, fontWeight:800, borderRadius:20,
          padding:"2px 8px", fontFamily:"'Inter',sans-serif", letterSpacing:"0.05em",
          boxShadow:"0 2px 8px rgba(99,102,241,0.4)",
        }}>YOU</div>
      )}

      {/* Birthday badge */}
      {bday && (
        <div style={{
          position:"absolute", top:14, left:10,
          background: bday.daysUntil === 0
            ? "linear-gradient(135deg,#f59e0b,#d97706)"
            : "rgba(245,158,11,0.15)",
          color: bday.daysUntil === 0 ? "#fff" : "#d97706",
          fontSize:10, borderRadius:20, padding:"2px 8px",
          fontFamily:"'Inter',sans-serif", fontWeight:700,
          border: bday.daysUntil === 0 ? "none" : "1px solid #fcd34d",
        }}>
          {bday.daysUntil === 0 ? "🎂 Today!" : `🎂 ${bday.daysUntil}d`}
        </div>
      )}

      <div style={{ padding:"16px 16px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
        <Avatar member={member} size={70} />

        <div style={{ textAlign:"center", width:"100%" }}>
          <div style={{
            fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700,
            color:"#0f172a", lineHeight:1.2, marginBottom:3,
          }}>{member.name}</div>
          {a !== null && (
            <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"'Inter',sans-serif" }}>
              {a} years old
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:5, flexWrap:"wrap", justifyContent:"center" }}>
          <span style={{
            background:c.light, color:c.bg, borderRadius:20,
            padding:"2px 10px", fontSize:11, fontWeight:600,
            fontFamily:"'Inter',sans-serif",
          }}>{member.gender}</span>
          <span style={{
            background:gc.light, color:gc.text, borderRadius:20,
            padding:"2px 10px", fontSize:11, fontWeight:600,
            fontFamily:"'Inter',sans-serif",
          }}>Gen {member.generation}</span>
        </div>

        {rels > 0 && (
          <div style={{
            fontSize:11, color:"#94a3b8", fontFamily:"'Inter',sans-serif",
            display:"flex", alignItems:"center", gap:4,
          }}>
            <span>🔗</span> {rels} relation{rels !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Family Tree View ─────────────────────────────────────────────────────────
function FamilyTreeView({ members, currentUserId, onClickMember }) {
  const containerRef = useRef(null);
  const cardRefs     = useRef({});
  const [lines, setLines] = useState([]);

  const byGen = {};
  members.forEach(m => {
    if (!byGen[m.generation]) byGen[m.generation] = [];
    byGen[m.generation].push(m);
  });
  const gens = Object.keys(byGen).map(Number).sort();

  // Build parent→child connections from relations
  const connections = [];
  members.forEach(member => {
    Object.entries(member.relations || {}).forEach(([relatedId, relType]) => {
      if (["Father","Mother"].includes(relType)) {
        // member's father/mother is relatedId → relatedId → member
        connections.push({ from: relatedId, to: member.id, type: "parent-child" });
      }
      if (relType === "Husband" || relType === "Wife") {
        const a = member.id, b = relatedId;
        if (!connections.find(c => (c.from===a&&c.to===b) || (c.from===b&&c.to===a) && c.type==="spouse")) {
          connections.push({ from: a, to: b, type: "spouse" });
        }
      }
    });
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const newLines = [];

    connections.forEach(({ from, to, type }) => {
      const fromEl = cardRefs.current[from];
      const toEl   = cardRefs.current[to];
      if (!fromEl || !toEl) return;
      const fR = fromEl.getBoundingClientRect();
      const tR = toEl.getBoundingClientRect();
      const x1 = fR.left + fR.width / 2  - container.left;
      const y1 = fR.top  + fR.height / 2 - container.top;
      const x2 = tR.left + tR.width / 2  - container.left;
      const y2 = tR.top  + tR.height / 2 - container.top;
      newLines.push({ x1, y1, x2, y2, type });
    });
    setLines(newLines);
  }, [members, connections.length]);

  if (gens.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:80, color:"#94a3b8", fontFamily:"'Inter',sans-serif", fontSize:16 }}>
        No family members yet
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position:"relative", minHeight:300 }}>
      {/* SVG connection lines */}
      <svg style={{
        position:"absolute", inset:0, width:"100%", height:"100%",
        pointerEvents:"none", zIndex:0, overflow:"visible",
      }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#a5b4fc" />
          </marker>
        </defs>
        {lines.map((l, i) => {
          const mx = (l.x1 + l.x2) / 2;
          const my = (l.y1 + l.y2) / 2;
          if (l.type === "spouse") {
            return (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="#f9a8d4" strokeWidth={2} strokeDasharray="6,4" opacity={0.7} />
            );
          }
          return (
            <path key={i}
              d={`M ${l.x1} ${l.y1} C ${l.x1} ${my}, ${l.x2} ${my}, ${l.x2} ${l.y2}`}
              fill="none" stroke="#a5b4fc" strokeWidth={2.5} opacity={0.6}
              markerEnd="url(#arrowhead)"
            />
          );
        })}
      </svg>

      {/* Generation rows */}
      {gens.map((gen, gi) => {
        const gc = GEN_COLORS[gen] || GEN_COLORS[1];
        return (
          <div key={gen} style={{ position:"relative", zIndex:1, marginBottom:48 }}>
            {/* Generation label */}
            <div style={{
              display:"flex", alignItems:"center", gap:12, marginBottom:20,
            }}>
              <div style={{
                background:`linear-gradient(135deg,${gc.from},${gc.to})`,
                color:"#fff", borderRadius:12, padding:"6px 18px",
                fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700,
                boxShadow:`0 4px 14px ${gc.from}55`,
              }}>Gen {gen}</div>
              <div style={{
                fontFamily:"'Playfair Display',serif", fontSize:18,
                fontWeight:700, color:"#1e293b",
              }}>{GEN_LABELS[gen]}</div>
              <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${gc.from}44,transparent)` }} />
              <div style={{ fontSize:12, color:"#94a3b8", fontFamily:"'Inter',sans-serif" }}>
                {byGen[gen].length} members
              </div>
            </div>

            {/* Cards */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:18, paddingLeft:8 }}>
              {byGen[gen].map(m => (
                <div
                  key={m.id}
                  ref={el => { if (el) cardRefs.current[m.id] = el; }}
                  data-member-id={m.id}
                >
                  <MemberCard
                    member={m}
                    isSelf={m.id === currentUserId}
                    onClick={() => onClickMember(m)}
                  />
                </div>
              ))}
            </div>

            {/* Connector to next generation */}
            {gi < gens.length - 1 && (
              <div style={{
                display:"flex", justifyContent:"center", marginTop:20,
                color:`${gc.to}`, fontSize:20, opacity:0.4,
              }}>▼</div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      {connections.length > 0 && (
        <div style={{
          display:"flex", gap:20, flexWrap:"wrap",
          padding:"12px 16px", background:"#f8fafc",
          borderRadius:12, border:"1px solid #e2e8f0",
          fontFamily:"'Inter',sans-serif", fontSize:12, color:"#64748b",
        }}>
          <span style={{ display:"flex", alignItems:"center", gap:6 }}>
            <svg width="30" height="12">
              <path d="M0 6 C8 6, 22 6, 30 6" stroke="#a5b4fc" strokeWidth="2.5" fill="none" />
            </svg>
            Parent-Child
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:6 }}>
            <svg width="30" height="12">
              <line x1="0" y1="6" x2="30" y2="6" stroke="#f9a8d4" strokeWidth="2" strokeDasharray="5,3" />
            </svg>
            Spouse
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [mode,setMode]     = useState("login");
  const [form,setForm]     = useState({ username:"",password:"",confirm:"",name:"",dob:"",gender:"Male",generation:1,about:"" });
  const [errors,setErrors] = useState({});
  const [msg,setMsg]       = useState("");
  const [busy,setBusy]     = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const doLogin = async () => {
    if (!form.username || !form.password) return setErrors({ username:"Fill all fields" });
    setBusy(true); setErrors({});
    try {
      const data = await api("/auth/login", { method:"POST", body:JSON.stringify({ username:form.username.trim(), password:form.password }) });
      onLogin(data);
    } catch (err) { setErrors({ username: err.message }); }
    finally { setBusy(false); }
  };

  const doRegister = async () => {
    const e = {};
    if (!form.name.trim())       e.name     = "Required";
    if (form.username.length<3)  e.username = "Min 3 characters";
    if (form.password.length<6)  e.password = "Min 6 characters";
    if (form.password!==form.confirm) e.confirm = "Passwords don't match";
    if (Object.keys(e).length) return setErrors(e);
    setBusy(true); setErrors({});
    try {
      await api("/auth/register", { method:"POST", body:JSON.stringify({
        name:form.name.trim(), username:form.username.trim(), password:form.password,
        dob:form.dob||null, gender:form.gender, generation:parseInt(form.generation), about:form.about||null,
      }) });
      setMsg("Registration submitted! Waiting for admin approval.");
      setMode("login");
      setForm({ username:"",password:"",confirm:"",name:"",dob:"",gender:"Male",generation:1,about:"" });
    } catch (err) { setErrors({ username: err.message }); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg,#0f0c29,#302b63,#24243e)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
    }}>
      {/* Floating orbs */}
      <div style={{ position:"fixed", top:"10%", left:"15%", width:300, height:300,
        background:"radial-gradient(circle,rgba(99,102,241,0.3),transparent)",
        borderRadius:"50%", filter:"blur(60px)", pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:"15%", right:"10%", width:250, height:250,
        background:"radial-gradient(circle,rgba(168,85,247,0.25),transparent)",
        borderRadius:"50%", filter:"blur(50px)", pointerEvents:"none" }} />

      <div style={{
        background:"rgba(255,255,255,0.97)", borderRadius:28, width:"100%", maxWidth:480,
        boxShadow:"0 48px 120px rgba(0,0,0,0.5)", overflow:"hidden",
        animation:"modalIn 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Hero banner */}
        <div style={{
          background:"linear-gradient(135deg,#1e1b4b,#312e81,#4338ca)",
          padding:"36px 32px 28px", textAlign:"center", position:"relative",
        }}>
          <div style={{
            position:"absolute", inset:0,
            background:"url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }} />
          <div style={{ fontSize:54, marginBottom:10, position:"relative" }}>🌳</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:900,
            color:"#e0e7ff", letterSpacing:"-0.02em", position:"relative" }}>
            {FAMILY_NAME}
          </div>
          <div style={{ fontSize:11, color:"#818cf8", letterSpacing:"0.15em", marginTop:6, position:"relative" }}>
            PRESERVING MEMORIES ACROSS GENERATIONS
          </div>
        </div>

        <div style={{ padding:"28px 32px 32px" }}>
          {/* Tabs */}
          <div style={{ display:"flex", background:"#f1f5f9", borderRadius:14, padding:4, marginBottom:24 }}>
            {["login","register"].map(t => (
              <button key={t} onClick={() => { setMode(t); setErrors({}); setMsg(""); }} style={{
                flex:1, padding:"9px", border:"none", borderRadius:11, cursor:"pointer",
                fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700,
                background: mode===t ? "linear-gradient(135deg,#4338ca,#6366f1)" : "transparent",
                color: mode===t ? "#fff" : "#64748b",
                transition:"all 0.2s", boxShadow: mode===t ? "0 4px 12px rgba(99,102,241,0.35)" : "none",
              }}>
                {t === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {msg && (
            <div style={{ background:"#ecfdf5", color:"#065f46", padding:"12px 16px",
              borderRadius:12, marginBottom:18, fontSize:13, fontFamily:"'Inter',sans-serif",
              border:"1px solid #6ee7b7", display:"flex", alignItems:"center", gap:8 }}>
              ✓ {msg}
            </div>
          )}

          {mode === "login" ? (
            <>
              <Field label="Username" error={errors.username}>
                <input style={{ ...inp, borderColor:errors.username?"#ef4444":"#e2e8f0" }}
                  value={form.username} onChange={set("username")} placeholder="your_username"
                  onKeyDown={e => e.key==="Enter" && doLogin()} />
              </Field>
              <Field label="Password" error={errors.password}>
                <input type="password" style={{ ...inp, borderColor:errors.password?"#ef4444":"#e2e8f0" }}
                  value={form.password} onChange={set("password")} placeholder="••••••••"
                  onKeyDown={e => e.key==="Enter" && doLogin()} />
              </Field>
              <button onClick={doLogin} disabled={busy} style={{
                width:"100%", padding:"13px",
                background:"linear-gradient(135deg,#4338ca,#6366f1,#818cf8)",
                border:"none", borderRadius:12, cursor:busy?"not-allowed":"pointer",
                fontFamily:"'Playfair Display',serif", fontSize:17, color:"#fff",
                fontWeight:700, marginTop:4,
                opacity:busy?0.7:1, boxShadow:"0 8px 24px rgba(99,102,241,0.4)",
                transition:"all 0.2s",
              }}>
                {busy ? "Signing in…" : "Sign In →"}
              </button>
              <div style={{ textAlign:"center", marginTop:16, fontSize:11, color:"#94a3b8", fontFamily:"'Inter',sans-serif" }}>
                Admin — username: <code style={{ background:"#f1f5f9", padding:"1px 6px", borderRadius:4 }}>admin</code>
                &nbsp;/&nbsp;
                <code style={{ background:"#f1f5f9", padding:"1px 6px", borderRadius:4 }}>family@admin123</code>
              </div>
            </>
          ) : (
            <>
              <Field label="Full Name *" error={errors.name}>
                <input style={{ ...inp, borderColor:errors.name?"#ef4444":"#e2e8f0" }}
                  value={form.name} onChange={set("name")} placeholder="e.g. Ramesh Kumar Sharma" />
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Date of Birth">
                  <input type="date" style={inp} value={form.dob} onChange={set("dob")} />
                </Field>
                <Field label="Gender">
                  <select style={inp} value={form.gender} onChange={set("gender")}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Generation">
                <select style={inp} value={form.generation} onChange={set("generation")}>
                  {[1,2,3,4,5].map(g => (
                    <option key={g} value={g}>Gen {g} — {GEN_LABELS[g]}</option>
                  ))}
                </select>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Username *" error={errors.username}>
                  <input style={{ ...inp, borderColor:errors.username?"#ef4444":"#e2e8f0" }}
                    value={form.username} onChange={set("username")} placeholder="unique_id" />
                </Field>
                <Field label="Password *" error={errors.password}>
                  <input type="password" style={{ ...inp, borderColor:errors.password?"#ef4444":"#e2e8f0" }}
                    value={form.password} onChange={set("password")} placeholder="min 6 chars" />
                </Field>
              </div>
              <Field label="Confirm Password *" error={errors.confirm}>
                <input type="password" style={{ ...inp, borderColor:errors.confirm?"#ef4444":"#e2e8f0" }}
                  value={form.confirm} onChange={set("confirm")} placeholder="repeat password" />
              </Field>
              <Field label="About (optional)">
                <textarea style={{ ...inp, minHeight:56, resize:"vertical" }}
                  value={form.about} onChange={set("about")} placeholder="A short note about yourself…" />
              </Field>
              <button onClick={doRegister} disabled={busy} style={{
                width:"100%", padding:"13px",
                background:"linear-gradient(135deg,#065f46,#059669,#10b981)",
                border:"none", borderRadius:12, cursor:busy?"not-allowed":"pointer",
                fontFamily:"'Playfair Display',serif", fontSize:17, color:"#fff",
                fontWeight:700, opacity:busy?0.7:1,
                boxShadow:"0 8px 24px rgba(5,150,105,0.35)",
              }}>
                {busy ? "Submitting…" : "Request Registration →"}
              </button>
              <div style={{ textAlign:"center", marginTop:10, fontSize:11, color:"#94a3b8", fontFamily:"'Inter',sans-serif" }}>
                Your request will be reviewed by admin before you can sign in
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────
function EditForm({ member, onSave, onClose, busy }) {
  const [form,setForm] = useState({
    name:member.name, dob:member.dob||"", gender:member.gender,
    generation:member.generation, about:member.about||"",
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <Field label="Full Name">
        <input style={inp} value={form.name} onChange={set("name")} />
      </Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Date of Birth">
          <input type="date" style={inp} value={form.dob} onChange={set("dob")} />
        </Field>
        <Field label="Gender">
          <select style={inp} value={form.gender} onChange={set("gender")}>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </Field>
      </div>
      <Field label="Generation">
        <select style={inp} value={form.generation} onChange={set("generation")}>
          {[1,2,3,4,5].map(g => <option key={g} value={g}>Gen {g} — {GEN_LABELS[g]}</option>)}
        </select>
      </Field>
      <Field label="About">
        <textarea style={{ ...inp, minHeight:70, resize:"vertical" }} value={form.about} onChange={set("about")} />
      </Field>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
        <button onClick={onClose} style={{
          padding:"9px 20px", background:"transparent",
          border:"2px solid #e2e8f0", borderRadius:10, cursor:"pointer",
          fontFamily:"'Inter',sans-serif", color:"#64748b", fontSize:14,
        }}>Cancel</button>
        <button onClick={() => onSave({ ...form, generation:parseInt(form.generation) })} disabled={busy} style={{
          padding:"9px 22px",
          background:"linear-gradient(135deg,#4338ca,#6366f1)",
          border:"none", borderRadius:10, cursor:busy?"not-allowed":"pointer",
          fontFamily:"'Inter',sans-serif", fontSize:14, color:"#fff",
          fontWeight:700, opacity:busy?0.7:1,
          boxShadow:"0 4px 14px rgba(99,102,241,0.35)",
        }}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── View / Relations Modal ───────────────────────────────────────────────────
function ViewModal({ member, currentUserId, currentUserToken, allMembers, onClose, onUpdated, onEditSelf }) {
  const [tab,setTab]       = useState("profile");
  const [selId,setSelId]   = useState("");
  const [selRel,setSelRel] = useState("Father");
  const [busy,setBusy]     = useState(false);
  const [saved,setSaved]   = useState(false);
  const isSelf = member.id === currentUserId;
  const c   = GCOL[member.gender] || GCOL.Other;
  const gc  = GEN_COLORS[member.generation] || GEN_COLORS[1];
  const a   = ageVal(member.dob);
  const rels = member.relations || {};

  const addRel = async () => {
    if (!selId) return;
    setBusy(true);
    try {
      await api(`/members/${member.id}/relations`, {
        method:"POST", body:JSON.stringify({ related_member_id:selId, relation_type:selRel }),
      }, currentUserToken);
      await onUpdated(); setSaved(true); setTimeout(() => setSaved(false), 1500); setSelId("");
    } catch (err) { alert(err.message); }
    finally { setBusy(false); }
  };

  const removeRel = async id => {
    try {
      await api(`/members/${member.id}/relations/${id}`, { method:"DELETE" }, currentUserToken);
      onUpdated();
    } catch {}
  };

  const TABS = ["profile","relations","info"];

  return (
    <Modal show={true} onClose={onClose} title="" width={560}>
      {/* Profile header */}
      <div style={{
        background:`linear-gradient(135deg,${gc.from},${gc.to})`,
        margin:"-20px -24px 20px", padding:"24px 24px 20px",
        display:"flex", gap:16, alignItems:"center",
        borderRadius:"0 0 0 0",
      }}>
        <Avatar member={member} size={74} />
        <div style={{ flex:1 }}>
          {isSelf && (
            <div style={{
              background:"rgba(255,255,255,0.25)", color:"#fff", fontSize:10,
              fontWeight:800, borderRadius:20, padding:"2px 10px",
              display:"inline-block", marginBottom:6, letterSpacing:"0.05em",
            }}>YOUR PROFILE</div>
          )}
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, color:"#fff", lineHeight:1.1 }}>
            {member.name}
          </div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)", marginTop:4, fontFamily:"'Inter',sans-serif" }}>
            {member.gender} · Gen {member.generation} — {GEN_LABELS[member.generation]}
          </div>
          {member.dob && (
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", marginTop:3, fontFamily:"'Inter',sans-serif" }}>
              📅 {new Date(member.dob).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}
              {a !== null && ` · ${a} years old`}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:20, background:"#f8fafc", borderRadius:12, padding:4 }}>
        {[
          { key:"profile", label:"👤 Profile" },
          { key:"relations", label:"🔗 Relations" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex:1, padding:"8px", border:"none", borderRadius:9, cursor:"pointer",
            fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:tab===t.key?700:400,
            background: tab===t.key ? `linear-gradient(135deg,${gc.from},${gc.to})` : "transparent",
            color: tab===t.key ? "#fff" : "#64748b", transition:"all 0.2s",
            boxShadow: tab===t.key ? `0 4px 12px ${gc.from}44` : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "profile" && (
        <div>
          {member.about && (
            <div style={{
              background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:12,
              padding:"12px 16px", marginBottom:16,
              fontFamily:"'Inter',sans-serif", fontSize:14, color:"#6b21a8",
              fontStyle:"italic",
            }}>
              "{member.about}"
            </div>
          )}
          <div style={{
            display:"grid", gridTemplateColumns:"1fr 1fr", gap:10,
            background:"#f8fafc", borderRadius:14, padding:16,
            border:"1px solid #e2e8f0", marginBottom:16,
            fontFamily:"'Inter',sans-serif", fontSize:13,
          }}>
            {[
              { label:"USERNAME", value:`@${member.username}` },
              { label:"JOINED",   value: new Date(member.registered_at).toLocaleDateString("en-IN") },
              { label:"GENERATION", value:`Gen ${member.generation}` },
              { label:"RELATIONS", value:`${Object.keys(rels).length} assigned` },
            ].map(item => (
              <div key={item.label}>
                <div style={{ color:"#94a3b8", fontSize:10, fontWeight:700, letterSpacing:"0.08em", marginBottom:2 }}>
                  {item.label}
                </div>
                <div style={{ color:"#1e293b", fontWeight:500 }}>{item.value}</div>
              </div>
            ))}
          </div>
          {isSelf && (
            <button onClick={onEditSelf} style={{
              width:"100%", padding:"11px",
              background:`linear-gradient(135deg,${gc.from},${gc.to})`,
              border:"none", borderRadius:12, cursor:"pointer",
              fontFamily:"'Inter',sans-serif", fontSize:15, color:"#fff",
              fontWeight:700, boxShadow:`0 4px 16px ${gc.from}44`,
            }}>✏️ Edit My Profile</button>
          )}
        </div>
      )}

      {tab === "relations" && (
        <div>
          <p style={{ fontFamily:"'Inter',sans-serif", color:"#64748b", fontSize:13, margin:"0 0 14px" }}>
            {isSelf
              ? "Assign how other members relate to you. These will appear on the family tree."
              : `View-only. Only ${member.name} can edit their own relations.`}
          </p>

          {isSelf && (
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              <div style={{ flex:"2 1 140px" }}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, fontFamily:"'Inter',sans-serif" }}>Member</div>
                <select style={{ ...inp, padding:"9px 10px" }} value={selId} onChange={e => setSelId(e.target.value)}>
                  <option value="">— Select member —</option>
                  {allMembers.filter(m => m.id !== member.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name} (Gen {m.generation})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex:"2 1 120px" }}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, fontFamily:"'Inter',sans-serif" }}>Relation</div>
                <select style={{ ...inp, padding:"9px 10px" }} value={selRel} onChange={e => setSelRel(e.target.value)}>
                  {RELATIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display:"flex", alignItems:"flex-end" }}>
                <button onClick={addRel} disabled={busy || !selId} style={{
                  padding:"10px 16px",
                  background: selId ? "linear-gradient(135deg,#065f46,#059669)" : "#e2e8f0",
                  color: selId ? "#6ee7b7" : "#94a3b8",
                  border:"none", borderRadius:10, cursor:selId?"pointer":"not-allowed",
                  fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600,
                  transition:"all 0.2s",
                }}>+ Add</button>
              </div>
            </div>
          )}

          {saved && (
            <div style={{
              background:"#ecfdf5", color:"#065f46", padding:"8px 14px",
              borderRadius:10, marginBottom:12, fontSize:13, fontFamily:"'Inter',sans-serif",
              border:"1px solid #6ee7b7",
            }}>✓ Relation saved!</div>
          )}

          {Object.keys(rels).length === 0 ? (
            <div style={{ textAlign:"center", color:"#cbd5e1", fontFamily:"'Inter',sans-serif", padding:"28px 0", fontSize:14 }}>
              No relations assigned yet
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {Object.entries(rels).map(([mid, rel]) => {
                const rm = allMembers.find(m => m.id === mid);
                if (!rm) return null;
                const rc = GCOL[rm.gender] || GCOL.Other;
                return (
                  <div key={mid} style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:"#f8fafc", borderRadius:14, padding:"10px 14px",
                    border:"1px solid #e2e8f0",
                  }}>
                    <Avatar member={rm} size={38} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#0f172a" }}>
                        {rm.name}
                      </div>
                      <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"'Inter',sans-serif" }}>
                        Gen {rm.generation}
                      </div>
                    </div>
                    <span style={{
                      background:rc.light, color:rc.bg, borderRadius:20,
                      padding:"3px 12px", fontSize:12, fontFamily:"'Inter',sans-serif", fontWeight:700,
                    }}>{rel}</span>
                    {isSelf && (
                      <button onClick={() => removeRel(mid)} style={{
                        background:"#fee2e2", border:"none", borderRadius:8,
                        padding:"4px 10px", cursor:"pointer", color:"#dc2626", fontSize:12,
                      }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Member Home ──────────────────────────────────────────────────────────────
function MemberHome({ session, onLogout }) {
  const { access_token: token, user } = session;
  const [members,setMembers]     = useState([]);
  const [viewM,setViewM]         = useState(null);
  const [editSelf,setEditSelf]   = useState(false);

  const [genFilter,setGenFilter] = useState("all");
  const [genderFilter,setGenderFilter] = useState("all");
  const [viewMode,setViewMode]   = useState("cards"); // cards | tree
  const [toast,setToast]         = useState(null);
  const [busy,setBusy]           = useState(false);
  const [bdayDismissed,setBdayDismissed] = useState(false);
  const [mobileMenuOpen,setMobileMenuOpen] = useState(false);

  const showToast = (msg, type="success") => {
    setToast({msg,type}); setTimeout(() => setToast(null), 2500);
  };

  const loadMembers = useCallback(async () => {
    try { setMembers(await api("/members", {}, token)); } catch {}
  }, [token]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const saveEdit = async form => {
    setBusy(true);
    try {
      await api("/members/me", { method:"PUT", body:JSON.stringify(form) }, token);
      await loadMembers(); setEditSelf(false); showToast("Profile updated ✓");
    } catch (err) { showToast(err.message,"error"); }
    finally { setBusy(false); }
  };

  const me = members.find(m => m.id === user.id) || user;

  // Filtered members
  let filtered = members;
  if (genFilter !== "all")  filtered = filtered.filter(m => m.generation === parseInt(genFilter));
  if (genderFilter !== "all") filtered = filtered.filter(m => m.gender === genderFilter);

  const byGen = {};
  filtered.forEach(m => { if (!byGen[m.generation]) byGen[m.generation]=[]; byGen[m.generation].push(m); });
  const gens = Object.keys(byGen).map(Number).sort();
  const allGens = [...new Set(members.map(m=>m.generation))].sort();

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'Inter',sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Header ── */}
      <header style={{
        background:"linear-gradient(135deg,#1e1b4b,#312e81,#4338ca)",
        boxShadow:"0 4px 24px rgba(30,27,75,0.4)", position:"sticky", top:0, zIndex:100,
      }}>
        {/* Family Name Banner */}
        <div style={{
          borderBottom:"1px solid rgba(255,255,255,0.08)",
          padding:"10px 24px",
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(0,0,0,0.15)",
        }}>
          <div style={{
            fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700,
            color:"#c7d2fe", letterSpacing:"0.2em", textTransform:"uppercase",
          }}>
            🌳 {FAMILY_NAME}
          </div>
        </div>

        {/* Main nav */}
        <div style={{
          padding:"12px 24px", display:"flex", alignItems:"center", gap:12,
          maxWidth:1300, margin:"0 auto",
        }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:12 }}>
            <Avatar member={me} size={36} />
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#e0e7ff" }}>
                {me.name}
              </div>
              <div style={{ fontSize:11, color:"#818cf8" }}>
                Gen {me.generation} · {GEN_LABELS[me.generation]}
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display:"flex", background:"rgba(255,255,255,0.1)", borderRadius:10, padding:3 }}>
            {[
              { key:"cards", icon:"⊞", label:"Cards" },
              { key:"tree",  icon:"🌳", label:"Tree" },
            ].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)} style={{
                padding:"6px 14px", border:"none", borderRadius:8, cursor:"pointer",
                fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600,
                background: viewMode===v.key ? "rgba(255,255,255,0.25)" : "transparent",
                color: viewMode===v.key ? "#fff" : "rgba(255,255,255,0.5)",
                transition:"all 0.2s",
              }}>{v.icon} {v.label}</button>
            ))}
          </div>

          {/* Actions */}
          <button onClick={() => setEditSelf(true)} style={{
            padding:"8px 16px", background:"rgba(255,255,255,0.15)",
            border:"1px solid rgba(255,255,255,0.25)", borderRadius:10, cursor:"pointer",
            fontFamily:"'Inter',sans-serif", fontSize:13, color:"#e0e7ff", fontWeight:600,
            whiteSpace:"nowrap",
          }}>✏️ My Profile</button>

          <button onClick={onLogout} style={{
            padding:"8px 14px", background:"rgba(239,68,68,0.2)",
            border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, cursor:"pointer",
            fontFamily:"'Inter',sans-serif", fontSize:13, color:"#fca5a5",
          }}>Sign Out</button>
        </div>

        {/* Stats bar */}
        <div style={{
          padding:"8px 24px", background:"rgba(0,0,0,0.2)",
          maxWidth:1300, margin:"0 auto",
          display:"flex", gap:24, flexWrap:"wrap",
        }}>
          {[
            { label:"Members", value:members.length, icon:"👥" },
            { label:"Generations", value:allGens.length, icon:"🏛️" },
            { label:"Relations mapped", value:members.reduce((a,m)=>a+Object.keys(m.relations||{}).length,0), icon:"🔗" },
          ].map(s => (
            <div key={s.label} style={{ fontSize:12, color:"#818cf8", display:"flex", alignItems:"center", gap:5 }}>
              {s.icon} <strong style={{ color:"#c7d2fe" }}>{s.value}</strong> {s.label}
            </div>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:1300, margin:"0 auto", padding:"28px 20px" }}>

        {/* Birthday panel */}
        {!bdayDismissed && <BirthdayPanel members={members} onDismiss={() => setBdayDismissed(true)} />}

        {/* Filters */}
        {members.length > 0 && (
          <div style={{
            display:"flex", gap:10, marginBottom:24, flexWrap:"wrap",
            alignItems:"center",
          }}>
            <span style={{ fontSize:13, color:"#64748b", fontWeight:600 }}>Filter:</span>
            {/* Generation filter */}
            <select
              value={genFilter}
              onChange={e => setGenFilter(e.target.value)}
              style={{
                ...inp, width:"auto", padding:"7px 12px", fontSize:13,
                background:"#fff", border:"2px solid #e2e8f0", borderRadius:10,
              }}
            >
              <option value="all">All Generations</option>
              {allGens.map(g => <option key={g} value={g}>Gen {g} — {GEN_LABELS[g]}</option>)}
            </select>
            {/* Gender filter */}
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value)}
              style={{
                ...inp, width:"auto", padding:"7px 12px", fontSize:13,
                background:"#fff", border:"2px solid #e2e8f0", borderRadius:10,
              }}
            >
              <option value="all">All Genders</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
            {(genFilter!=="all" || genderFilter!=="all") && (
              <button onClick={() => { setGenFilter("all"); setGenderFilter("all"); }} style={{
                padding:"7px 14px", background:"#fee2e2", color:"#dc2626",
                border:"none", borderRadius:10, cursor:"pointer", fontSize:12, fontWeight:600,
              }}>✕ Clear Filters</button>
            )}
            <span style={{ fontSize:12, color:"#94a3b8", marginLeft:"auto" }}>
              Showing {filtered.length} of {members.length} members
            </span>
          </div>
        )}

        {/* Content */}
        {viewMode === "tree" ? (
          <div style={{
            background:"#fff", borderRadius:20, padding:"28px 24px",
            boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
              <div style={{
                fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, color:"#1e293b",
              }}>🌳 Family Tree</div>
              <div style={{ flex:1, height:2, background:"linear-gradient(90deg,#6366f1,transparent)", borderRadius:2 }} />
              <div style={{ fontSize:12, color:"#94a3b8" }}>
                Lines show parent-child & spouse relations
              </div>
            </div>
            <FamilyTreeView
              members={filtered}
              currentUserId={user.id}
              onClickMember={m => setViewM(m)}
            />
          </div>
        ) : (
          gens.length === 0 ? (
            <div style={{
              textAlign:"center", padding:"80px 40px",
              background:"#fff", borderRadius:24, border:"1px solid #e2e8f0",
            }}>
              <div style={{ fontSize:64, marginBottom:16 }}>👨‍👩‍👧‍👦</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, color:"#1e293b", marginBottom:8 }}>
                No members found
              </div>
              <div style={{ color:"#94a3b8", fontSize:14 }}>Try adjusting your filters</div>
            </div>
          ) : gens.map(gen => {
            const gc = GEN_COLORS[gen] || GEN_COLORS[1];
            return (
              <div key={gen} style={{ marginBottom:44, animation:"fadeUp 0.5s ease" }}>
                {/* Generation header */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
                  <div style={{
                    background:`linear-gradient(135deg,${gc.from},${gc.to})`,
                    color:"#fff", borderRadius:12, padding:"6px 18px",
                    fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700,
                    boxShadow:`0 4px 14px ${gc.from}55`,
                  }}>Gen {gen}</div>
                  <div style={{
                    fontFamily:"'Playfair Display',serif", fontSize:20,
                    fontWeight:700, color:"#1e293b",
                  }}>{GEN_LABELS[gen]}</div>
                  <div style={{ flex:1, height:2, background:`linear-gradient(90deg,${gc.from}33,transparent)`, borderRadius:2 }} />
                  <div style={{ fontSize:12, color:"#94a3b8" }}>{byGen[gen].length} members</div>
                </div>

                {/* Cards */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:18 }}>
                  {byGen[gen].map(m => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      isSelf={m.id === user.id}
                      onClick={() => setViewM(m)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign:"center", padding:"20px", color:"#94a3b8",
        fontSize:12, fontFamily:"'Inter',sans-serif", borderTop:"1px solid #e2e8f0",
      }}>
        🌳 {FAMILY_NAME} · Built with love for family
      </footer>

      {/* Modals */}
      {viewM && (
        <ViewModal
          member={members.find(m => m.id === viewM.id) || viewM}
          currentUserId={user.id}
          currentUserToken={token}
          allMembers={members}
          onClose={() => setViewM(null)}
          onUpdated={loadMembers}
          onEditSelf={() => { setViewM(null); setEditSelf(true); }}
        />
      )}
      <Modal show={editSelf} onClose={() => setEditSelf(false)} title="Edit My Profile">
        {editSelf && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, marginBottom:20 }}>
            <PhotoUpload member={me} token={token} onUpdated={loadMembers} />
          </div>
        )}
        <EditForm member={me} onSave={saveEdit} onClose={() => setEditSelf(false)} busy={busy} />
      </Modal>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({ session, onLogout }) {
  const token = session.access_token;
  const [users,setUsers]   = useState([]);
  const [tab,setTab]       = useState("pending");
  const [editU,setEditU]   = useState(null);
  const [toast,setToast]   = useState(null);
  const [busy,setBusy]     = useState(false);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(() => setToast(null), 2500); };
  const load = useCallback(async () => {
    try { setUsers(await api("/admin/users", {}, token)); } catch {}
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const approve  = async id => { try { await api(`/admin/users/${id}/approve`,{method:"PUT"},token); load(); showToast("Member approved ✓"); } catch (e) { showToast(e.message,"error"); }};
  const reject   = async id => { try { await api(`/admin/users/${id}/reject`, {method:"PUT"},token); load(); showToast("Member rejected","error"); } catch (e) { showToast(e.message,"error"); }};
  const del      = async id => { if (!window.confirm("Delete permanently?")) return; try { await api(`/admin/users/${id}`,{method:"DELETE"},token); load(); showToast("Deleted"); } catch (e) { showToast(e.message,"error"); }};
  const saveEdit = async form => {
    setBusy(true);
    try { await api(`/admin/users/${editU.id}`,{method:"PUT",body:JSON.stringify(form)},token); setEditU(null); load(); showToast("Updated ✓"); }
    catch (e) { showToast(e.message,"error"); }
    finally { setBusy(false); }
  };

  const pending  = users.filter(u => u.status==="pending");
  const approved = users.filter(u => u.status==="approved");
  const rejected = users.filter(u => u.status==="rejected");
  const byGen = {};
  approved.forEach(m => { if (!byGen[m.generation]) byGen[m.generation]=[]; byGen[m.generation].push(m); });
  const gens = Object.keys(byGen).map(Number).sort();

  const current = tab==="pending"?pending:tab==="approved"?approved:rejected;

  const TABS = [
    {key:"pending",  label:"⏳ Pending",  count:pending.length,  color:"#7c3aed"},
    {key:"approved", label:"✓ Approved", count:approved.length, color:"#059669"},
    {key:"rejected", label:"✕ Rejected", count:rejected.length, color:"#dc2626"},
    {key:"tree",     label:"🌳 Family Tree", count:null,         color:"#0891b2"},
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <header style={{
        background:"linear-gradient(135deg,#0f172a,#1e293b,#1e1b4b)",
        boxShadow:"0 4px 24px rgba(0,0,0,0.3)", position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{
          borderBottom:"1px solid rgba(255,255,255,0.08)",
          padding:"10px 24px", textAlign:"center",
        }}>
          <div style={{
            fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700,
            color:"#94a3b8", letterSpacing:"0.2em", textTransform:"uppercase",
          }}>
            🌳 {FAMILY_NAME} · Admin Dashboard
          </div>
        </div>
        <div style={{
          padding:"12px 24px", display:"flex", alignItems:"center", gap:14,
          maxWidth:1300, margin:"0 auto",
        }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:900, color:"#e2e8f0" }}>
              Admin Control Panel
            </div>
          </div>
          <div style={{ display:"flex", gap:20, fontSize:13, color:"#64748b" }}>
            <span style={{ color:"#6ee7b7" }}>✓ {approved.length} approved</span>
            {pending.length>0 && (
              <span style={{ color:"#fbbf24", fontWeight:700,
                background:"rgba(251,191,36,0.15)", padding:"3px 12px", borderRadius:20 }}>
                ⏳ {pending.length} pending
              </span>
            )}
          </div>
          <button onClick={onLogout} style={{
            padding:"8px 18px", background:"rgba(239,68,68,0.2)",
            border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, cursor:"pointer",
            fontFamily:"'Inter',sans-serif", fontSize:13, color:"#fca5a5", fontWeight:600,
          }}>Sign Out</button>
        </div>
      </header>

      <div style={{ maxWidth:1300, margin:"0 auto", padding:"28px 20px" }}>
        {/* Tab bar */}
        <div style={{ display:"flex", gap:4, marginBottom:28, flexWrap:"wrap" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:"10px 22px", border:"none", borderRadius:12, cursor:"pointer",
              fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700,
              background: tab===t.key ? t.color : "#fff",
              color: tab===t.key ? "#fff" : "#64748b",
              boxShadow: tab===t.key ? `0 4px 16px ${t.color}55` : "0 2px 8px rgba(0,0,0,0.06)",
              border: tab===t.key ? "none" : "2px solid #e2e8f0",
              transition:"all 0.2s",
            }}>
              {t.label}{t.count !== null ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>

        {/* Family Tree tab */}
        {tab === "tree" && (
          <div style={{
            background:"#fff", borderRadius:20, padding:"28px 24px",
            boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0",
          }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, color:"#1e293b", marginBottom:24 }}>
              🌳 Family Tree
            </div>
            <FamilyTreeView
              members={approved}
              currentUserId={null}
              onClickMember={m => setEditU(m)}
            />
          </div>
        )}

        {/* List tabs */}
        {tab !== "tree" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {current.length === 0 && (
              <div style={{
                textAlign:"center", padding:60, color:"#94a3b8",
                fontFamily:"'Playfair Display',serif", fontSize:18,
                background:"#fff", borderRadius:20, border:"1px solid #e2e8f0",
              }}>
                No {tab} members
              </div>
            )}
            {current.map(u => {
              const gc = GEN_COLORS[u.generation] || GEN_COLORS[1];
              return (
                <div key={u.id} style={{
                  background:"#fff", borderRadius:18, padding:"16px 20px",
                  display:"flex", alignItems:"center", gap:14,
                  boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0",
                  animation:"fadeUp 0.3s ease",
                }}>
                  <Avatar member={u} size={52} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, color:"#0f172a" }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize:13, color:"#64748b", marginTop:2, fontFamily:"'Inter',sans-serif" }}>
                      @{u.username} · {u.gender} ·&nbsp;
                      <span style={{ background:gc.light, color:gc.text, borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:600 }}>
                        Gen {u.generation}
                      </span>
                      {u.dob && ` · ${ageVal(u.dob)} yrs`}
                    </div>
                    {u.about && (
                      <div style={{ fontSize:12, color:"#94a3b8", fontStyle:"italic", marginTop:2, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        "{u.about}"
                      </div>
                    )}
                    <div style={{ fontSize:11, color:"#cbd5e1", marginTop:3, fontFamily:"'Inter',sans-serif" }}>
                      Registered: {new Date(u.registered_at).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    {tab === "pending" && <>
                      <button onClick={() => approve(u.id)} style={{ padding:"8px 16px",
                        background:"linear-gradient(135deg,#065f46,#059669)", color:"#6ee7b7",
                        border:"none", borderRadius:10, cursor:"pointer", fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600 }}>
                        ✓ Approve
                      </button>
                      <button onClick={() => reject(u.id)} style={{ padding:"8px 16px",
                        background:"linear-gradient(135deg,#7f1d1d,#dc2626)", color:"#fca5a5",
                        border:"none", borderRadius:10, cursor:"pointer", fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600 }}>
                        ✕ Reject
                      </button>
                    </>}
                    {tab === "approved" && <>
                      <button onClick={() => setEditU(u)} style={{ padding:"8px 14px",
                        background:"#f1f5f9", color:"#475569", border:"2px solid #e2e8f0",
                        borderRadius:10, cursor:"pointer", fontSize:13 }}>✏️ Edit</button>
                      <button onClick={() => del(u.id)} style={{ padding:"8px 12px",
                        background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:10, cursor:"pointer", fontSize:13 }}>🗑️</button>
                    </>}
                    {tab === "rejected" && <>
                      <button onClick={() => approve(u.id)} style={{ padding:"8px 14px",
                        background:"linear-gradient(135deg,#065f46,#059669)", color:"#6ee7b7",
                        border:"none", borderRadius:10, cursor:"pointer", fontFamily:"'Inter',sans-serif", fontSize:13 }}>Re-approve</button>
                      <button onClick={() => del(u.id)} style={{ padding:"8px 12px",
                        background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:10, cursor:"pointer", fontSize:13 }}>🗑️</button>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal show={!!editU} onClose={() => setEditU(null)} title="Edit Member Profile">
        {editU && <EditForm member={editU} onSave={saveEdit} onClose={() => setEditU(null)} busy={busy} />}
      </Modal>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession] = useState(null);
  const handleLogin  = data => setSession(data);
  const handleLogout = ()   => setSession(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes modalIn  { from { opacity:0; transform:scale(0.9) translateY(24px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp  { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse    { 0%,100% { box-shadow:0 0 0 0 rgba(255,255,255,0.3) } 50% { box-shadow:0 0 0 8px rgba(255,255,255,0) } }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Inter',sans-serif; }
        ::-webkit-scrollbar { width:6px }
        ::-webkit-scrollbar-track { background:#f1f5f9 }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px }
        input:focus, select:focus, textarea:focus {
          border-color:#6366f1 !important;
          box-shadow:0 0 0 3px rgba(99,102,241,0.15) !important;
          outline:none;
        }
        @media (max-width: 640px) {
          header { padding:10px 14px !important; }
          main   { padding:16px 12px !important; }
          .hide-mobile { display:none !important; }
        }
      `}</style>
      {!session                   && <AuthPage onLogin={handleLogin} />}
      {session?.role === "admin"  && <AdminPanel  session={session} onLogout={handleLogout} />}
      {session?.role === "member" && <MemberHome  session={session} onLogout={handleLogout} />}
    </>
  );
}
