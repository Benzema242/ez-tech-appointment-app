
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// ─── SERVICES CATALOG ──────────────────────────────────────────────────────
const SERVICES = [
  { id: "cctv_assess", label: "Security Camera Assessment", price: 0, icon: "🔍", note: "FREE Assessment" },
  { id: "cctv_install", label: "Security Camera / CCTV Installation", price: 300, icon: "📷" },
  { id: "network", label: "WiFi Network Setup", price: 200, icon: "📡" },
  { id: "ap", label: "AP Installation", price: 175, icon: "🔗" },
  { id: "starlink", label: "Starlink Installation", price: 250, icon: "🛰️" },
  { id: "lighting", label: "Smart Lighting (EZ Tech Lighting)", price: 0, icon: "💡", note: "FREE Consultation" },
  { id: "av", label: "Audio Visual Production", price: 200, icon: "🎚️" },
  { id: "tv_mount", label: "TV Mounting", price: 100, icon: "📺" },
  { id: "repair", label: "Phone / Laptop / Console Repair", price: 80, icon: "🔧" },
  { id: "software", label: "Computer Software Installation", price: 75, icon: "💻" },
  { id: "iptv", label: "IPTV Setup", price: 60, icon: "📺" },
  { id: "it_support", label: "General IT Support", price: 100, icon: "🛠️" },
];

// ─── TIME SLOTS ────────────────────────────────────────────────────────────
const TIMES = ["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM"];

// Client-facing hours only (10 AM – 6 PM, includes noon)
const CLIENT_TIMES = ["10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"];

// ─── BOOKING SOURCES ───────────────────────────────────────────────────────
const SOURCES = [
  { id: "call",      label: "Call",      icon: "📞" },
  { id: "whatsapp",  label: "WhatsApp",  icon: "💬" },
  { id: "facebook",  label: "Facebook",  icon: "📘" },
  { id: "referred",  label: "Referred",  icon: "🤝" },
  { id: "walkin",    label: "Walk-in",   icon: "🚶" },
  { id: "website",   label: "Website",   icon: "🌐" },
];


// ─── DATE & CALENDAR HELPERS ───────────────────────────────────────────────
const pad = n => String(n).padStart(2, "0");
const fmtDate = (y, m, d) => `${y}-${pad(m+1)}-${pad(d)}`;
const daysInMonth = (y, m) => new Date(y, m+1, 0).getDate();
const firstDay = (y, m) => new Date(y, m, 1).getDay();
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYNAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── CONTACT INFO ──────────────────────────────────────────────────────────
const CONTACT = {
  phone:     "(242) 805-0777",
  phoneTel:  "tel:+12428050777",
  email:     "info@ez-techgroup.com",
  emailHref: "mailto:info@ez-techgroup.com",
};

// ─── LOOKUP HELPERS ────────────────────────────────────────────────────────
const svc = id => SERVICES.find(s => s.id === id) || { label: id, icon: "⚙️", price: 0 };
const timeToHour = t => { const [tp, ap] = t.split(" "); let h = parseInt(tp); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return h; };

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────
const STATUS = {
  pending:        { label: "PENDING",        color: "#f59e0b", bg: "rgba(245,158,11,.15)", border: "rgba(245,158,11,.4)" },
  approved:       { label: "APPROVED",       color: "#22c55e", bg: "rgba(34,197,94,.15)",  border: "rgba(34,197,94,.4)" },
  denied:         { label: "DENIED",         color: "#ef4444", bg: "rgba(239,68,68,.15)",  border: "rgba(239,68,68,.4)" },
  scheduled_call: { label: "CALL SCHEDULED", color: "#3b82f6", bg: "rgba(59,130,246,.15)", border: "rgba(59,130,246,.4)" },
};

// ─── APP COMPONENT ─────────────────────────────────────────────────────────
export default function App() {

  // ── State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState("admin");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [adminTab, setAdminTab] = useState("bookings");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:"", email:"", phone:"", service:"", date:"", time:"", notes:"" });
  const [submitted, setSubmitted] = useState(false);
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const [selDay, setSelDay] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name:"", email:"", phone:"", service:"", date:"", time:"", source:"call", status:"pending", duration:1, notes:"" });
  const [adminConfirmOverlap, setAdminConfirmOverlap] = useState(false);

  // ── Load bookings from Supabase ────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("bookings")
      .select("*")
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setBookings(data);
        setLoading(false);
      });
  }, []);

  // ── Toast Notification ─────────────────────────────────────────────────
  const fire = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Booking Actions ────────────────────────────────────────────────────
  const updateStatus = async (id, status) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) { fire("❌ Error updating status"); return; }
    setBookings(p => p.map(b => b.id === id ? { ...b, status } : b));
    setSelected(p => p ? { ...p, status } : null);
    const m = { approved: "✅ Approved!", denied: "❌ Denied", scheduled_call: "📞 Call scheduled", pending: "↩ Reset to pending" };
    fire(m[status] || "Updated");
  };

  const submitBooking = async () => {
    const payload = { client: form.name, service: form.service, date: form.date, time: form.time, status: "pending", phone: form.phone, email: form.email, notes: form.notes, source: "website", duration: 1 };
    const { data, error } = await supabase.from("bookings").insert(payload).select().single();
    if (error) { fire("❌ Error submitting booking"); return; }
    setBookings(p => [...p, data]);
    setSubmitted(true);
  };

  const resetClient = () => { setStep(1); setForm({ name:"", email:"", phone:"", service:"", date:"", time:"", notes:"" }); setSubmitted(false); };

  const submitAdminBooking = async () => {
    const payload = { client: adminForm.name, service: adminForm.service, date: adminForm.date, time: adminForm.time, status: adminForm.status, phone: adminForm.phone, email: adminForm.email, notes: adminForm.notes, source: adminForm.source, duration: adminForm.duration };
    const { data, error } = await supabase.from("bookings").insert(payload).select().single();
    if (error) { fire("❌ Error adding appointment"); return; }
    setBookings(p => [...p, data]);
    setShowAddModal(false);
    setAdminForm({ name:"", email:"", phone:"", service:"", date:"", time:"", source:"call", status:"pending", duration:1, notes:"" });
    fire("✅ Appointment added!");
  };

  const updateBooking = async (id, updates) => {
    const { error } = await supabase.from("bookings").update(updates).eq("id", id);
    if (error) { fire("❌ Error saving changes"); return; }
    setBookings(p => p.map(b => b.id === id ? { ...b, ...updates } : b));
    setSelected(p => p ? { ...p, ...updates } : null);
    fire("✅ Updated!");
  };

  // ── Availability Helpers ───────────────────────────────────────────────

  // Admin day-view: approved + pending bookings block slots
  const isBooked = (date, time) => {
    const slotH = timeToHour(time);
    return bookings.some(b => {
      if (b.date !== date || (b.status !== "approved" && b.status !== "pending")) return false;
      const bH = timeToHour(b.time);
      const dur = b.duration || 1;
      return slotH >= bH && slotH < bH + dur;
    });
  };

  // Client booking: only approved bookings block slots (pending stays open)
  const isClientBooked = (date, time) => {
    const slotH = timeToHour(time);
    return bookings.some(b => {
      if (b.date !== date || b.status !== "approved") return false;
      const bH = timeToHour(b.time);
      const dur = b.duration || 1;
      return slotH >= bH && slotH < bH + dur;
    });
  };

  // Admin add: detect any time overlap with existing bookings
  const hasAdminConflict = (date, time, duration) => {
    if (!date || !time) return false;
    const startH = timeToHour(time);
    const endH = startH + (duration || 1);
    return bookings.some(b => {
      if (b.date !== date || (b.status !== "approved" && b.status !== "pending")) return false;
      const bH = timeToHour(b.time);
      const bEnd = bH + (b.duration || 1);
      return startH < bEnd && endH > bH;
    });
  };

  const dayMark = (ds) => {
    const day = bookings.filter(b => b.date === ds);
    if (day.some(b => b.status === "approved")) return "approved";
    if (day.some(b => b.status === "pending")) return "pending";
    return null;
  };

  const filtered = bookings.filter(b => filter === "all" || b.status === filter).sort((a,b) => a.date.localeCompare(b.date));
  const pendingCount = bookings.filter(b => b.status === "pending").length;
  const todayStr = fmtDate(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Global Styles ──────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#050d1a;font-family:'Exo 2',sans-serif;}
    ::-webkit-scrollbar{width:5px;height:5px;}
    ::-webkit-scrollbar-track{background:#0a1628;}
    ::-webkit-scrollbar-thumb{background:#c9a227;border-radius:2px;}
    input,select,textarea{background:rgba(255,255,255,.05);border:1px solid rgba(201,162,39,.3);color:#e8e0cc;padding:11px 14px;font-family:'Exo 2',sans-serif;font-size:14px;width:100%;border-radius:3px;outline:none;transition:all .2s;}
    input:focus,select:focus,textarea:focus{border-color:#c9a227;box-shadow:0 0 0 2px rgba(201,162,39,.15);}
    select option{background:#0a1628;}
    .btn{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;cursor:pointer;border:none;border-radius:3px;transition:all .2s;padding:10px 18px;}
    .btn:hover{filter:brightness(1.15);transform:translateY(-1px);}
    .btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
    .gold{background:linear-gradient(135deg,#c9a227,#f0c040);color:#050d1a;}
    .ghost{background:transparent;border:1px solid rgba(201,162,39,.4);color:#c9a227;}
    .ghost:hover{background:rgba(201,162,39,.1);}
    .danger{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;}
    .danger:hover{background:rgba(239,68,68,.25);}
    .ok{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#4ade80;}
    .ok:hover{background:rgba(34,197,94,.25);}
    .blue{background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.4);color:#60a5fa;}
    .blue:hover{background:rgba(59,130,246,.25);}
    .card{background:rgba(10,22,40,.95);border:1px solid rgba(201,162,39,.2);border-radius:6px;}
    .circuit{background-image:linear-gradient(rgba(201,162,39,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,162,39,.03) 1px,transparent 1px);background-size:40px 40px;}
    .slide-in{animation:sl .25s ease;}
    @keyframes sl{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    .pulse{animation:p 1.8s infinite;}
    @keyframes p{0%,100%{opacity:1;}50%{opacity:.4;}}
    .timeslot{padding:9px 10px;border-radius:3px;cursor:pointer;font-size:12px;font-weight:600;text-align:center;border:1px solid rgba(201,162,39,.25);background:rgba(201,162,39,.05);color:#c9a227;transition:all .15s;}
    .timeslot:hover{background:rgba(201,162,39,.15);}
    .timeslot.sel{background:#c9a227;color:#050d1a;}
    .timeslot.taken{background:rgba(100,100,100,.1);border-color:rgba(100,100,100,.2);color:#555;cursor:not-allowed;text-decoration:line-through;}
    .cell{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:3px;cursor:pointer;font-size:13px;border:1px solid transparent;transition:all .15s;font-weight:500;}
    .cell:hover{border-color:rgba(201,162,39,.4);background:rgba(201,162,39,.08);}
    .cell.today{border-color:#c9a227;color:#c9a227;font-weight:700;}
    .cell.has-app{background:rgba(34,197,94,.18);color:#4ade80;}
    .cell.has-pen{background:rgba(245,158,11,.18);color:#fbbf24;}
    .cell.sel-day{background:#c9a227!important;color:#050d1a!important;font-weight:700;}
    .cell.disabled-past{opacity:.25;cursor:not-allowed;}
    .row{padding:13px 14px;border-radius:4px;cursor:pointer;border:1px solid rgba(201,162,39,.1);background:rgba(201,162,39,.03);transition:all .15s;margin-bottom:8px;}
    .row:hover{background:rgba(201,162,39,.08);border-color:rgba(201,162,39,.3);}
    .row.active{background:rgba(201,162,39,.12);border-color:rgba(201,162,39,.5);}
    .logo-circle{width:42px;height:42px;border-radius:50%;border:2px solid #c9a227;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-weight:900;font-size:16px;color:#fff;background:linear-gradient(135deg,#1e3a5f,#0a1628);box-shadow:0 0 12px rgba(201,162,39,.4);flex-shrink:0;}
  `;

  // ── Shared Footer ──────────────────────────────────────────────────────
  const SiteFooter = ({ light = false }) => (
    <div style={{
      borderTop: `1px solid ${light ? "rgba(201,162,39,.15)" : "rgba(201,162,39,.12)"}`,
      padding: "clamp(18px,3vw,28px) clamp(16px,5vw,48px)",
      textAlign: "center",
      background: light ? "rgba(5,13,26,.85)" : "rgba(5,13,26,.6)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    }}>
      <div style={{ display:"flex", justifyContent:"center", gap:"clamp(20px,4vw,48px)", flexWrap:"wrap", marginBottom:14 }}>
        {[
          { label:"Phone", value:CONTACT.phone, href:CONTACT.phoneTel },
          { label:"Email", value:CONTACT.email, href:CONTACT.emailHref },
        ].map(({ label, value, href }) => (
          <div key={label} style={{ textAlign:"center" }}>
            <div style={{ fontSize:"clamp(8px,1.4vw,10px)", color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:"clamp(0.5px,0.2vw,1.5px)", marginBottom:4 }}>{label.toUpperCase()}</div>
            <a href={href} style={{ fontSize:"clamp(11px,2vw,14px)", color:"#8899aa", textDecoration:"none" }}>{value}</a>
          </div>
        ))}
      </div>
      <div style={{ fontSize:"clamp(9px,1.5vw,11px)", color:"#445566", letterSpacing:"clamp(0.3px,0.1vw,1px)", fontFamily:"'Orbitron',sans-serif" }}>
        © {new Date().getFullYear()} EZ Tech Solutions · All Rights Reserved
      </div>
    </div>
  );

  // ── Admin View ─────────────────────────────────────────────────────────
  const AdminView = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>

      {/* Admin Header */}
      <div style={{ padding:"16px 24px", borderBottom:"1px solid rgba(201,162,39,.2)", background:"linear-gradient(180deg,rgba(10,22,40,.95),rgba(10,22,40,.85))", display:"flex", alignItems:"center", gap:14 }}>
        <div className="logo-circle">EZ</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:900, color:"#fff", letterSpacing:2 }}>EZ TECH <span style={{ color:"#c9a227" }}>SOLUTIONS</span></div>
          <div style={{ fontSize:10, color:"#7788aa", letterSpacing:1, marginTop:1 }}>ADMIN DASHBOARD · BENZ</div>
        </div>
        <button className="btn ghost" onClick={() => { setMode("client"); resetClient(); }}>👤 CLIENT VIEW</button>
      </div>

      {/* Stats Bar */}
      <div style={{ padding:"16px 24px", display:"flex", gap:12, flexWrap:"wrap", borderBottom:"1px solid rgba(201,162,39,.1)" }}>
        {[
          { l:"TOTAL",    v:bookings.length,                                      c:"#c9a227" },
          { l:"PENDING",  v:pendingCount,                                          c:"#f59e0b" },
          { l:"APPROVED", v:bookings.filter(b=>b.status==="approved").length,      c:"#22c55e" },
          { l:"CALLS",    v:bookings.filter(b=>b.status==="scheduled_call").length, c:"#3b82f6" },
        ].map(s => (
          <div key={s.l} className="card" style={{ padding:"12px 18px", flex:"1 1 120px" }}>
            <div style={{ fontSize:9, letterSpacing:2, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", marginBottom:4 }}>{s.l}</div>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:24, fontWeight:900, color:s.c }}>
              {s.v}
              {s.l==="PENDING" && pendingCount > 0 && <span className="pulse" style={{ marginLeft:6, fontSize:14 }}>●</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ padding:"0 24px", display:"flex", gap:0, borderBottom:"1px solid rgba(201,162,39,.15)" }}>
        {[["bookings","📋 BOOKINGS"],["calendar","📅 CALENDAR"]].map(([k,l]) => (
          <button key={k} onClick={() => setAdminTab(k)} style={{ padding:"14px 20px", background:"transparent", border:"none", borderBottom: adminTab===k ? "2px solid #c9a227" : "2px solid transparent", color: adminTab===k ? "#c9a227" : "#7788aa", fontFamily:"'Orbitron',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1.5, cursor:"pointer", transition:"all .2s" }}>{l}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", minHeight:0, display:"flex", flexDirection:"column" }}>
        {adminTab === "bookings" ? (

          // ── Bookings Tab ──────────────────────────────────────────────
          <div style={{ display:"flex", flexWrap:"wrap", flex:1 }}>
            {/* Bookings List Panel */}
            <div style={{ flex:"1 1 340px", padding:"16px 24px", borderRight:"1px solid rgba(201,162,39,.1)" }}>

              {/* Filter Bar + Add Button */}
              <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", flex:1 }}>
                  {[["all","ALL"],["pending","PENDING"],["approved","APPROVED"],["scheduled_call","CALLS"],["denied","DENIED"]].map(([k,l]) => (
                    <button key={k} onClick={() => setFilter(k)} className="btn" style={{ padding:"6px 11px", fontSize:10, background: filter===k ? "rgba(201,162,39,.2)" : "transparent", border:"1px solid rgba(201,162,39,.3)", color: filter===k ? "#f0c040" : "#7788aa" }}>{l}</button>
                  ))}
                </div>
                <button className="btn gold" style={{ padding:"7px 14px", fontSize:10, flexShrink:0 }} onClick={() => { setShowAddModal(true); setAdminConfirmOverlap(false); }}>＋ ADD</button>
              </div>

              {/* Booking Rows */}
              {filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:40, color:"#556677" }}>No bookings</div>
              ) : filtered.map(b => {
                const s = svc(b.service);
                const st = STATUS[b.status];
                return (
                  <div key={b.id} className={"row " + (selected?.id === b.id ? "active" : "")} onClick={() => setSelected(b)}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:20 }}>{s.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, color:"#e8e0cc", fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.client}</div>
                        <div style={{ fontSize:11, color:"#7788aa", marginTop:2 }}>{s.label}</div>
                        <div style={{ fontSize:11, color:"#c9a227", marginTop:3, fontFamily:"'Orbitron',sans-serif" }}>{b.date} · {b.time}</div>
                      </div>
                      <span style={{ padding:"3px 8px", borderRadius:3, fontSize:9, fontFamily:"'Orbitron',sans-serif", fontWeight:700, letterSpacing:1, color:st.color, background:st.bg, border:`1px solid ${st.border}`, whiteSpace:"nowrap" }}>{st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Booking Detail Panel */}
            <div style={{ flex:"1 1 340px" }}>
              {!selected ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"rgba(201,162,39,.3)", padding:40 }}>
                  <div style={{ fontSize:56, marginBottom:14 }}>📋</div>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, letterSpacing:2, textAlign:"center" }}>SELECT A BOOKING</div>
                </div>
              ) : (() => {
                const s = svc(selected.service);
                const st = STATUS[selected.status];
                return (
                  <div style={{ padding:24 }} className="slide-in">

                    {/* Client + Service Header */}
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                      <span style={{ fontSize:32 }}>{s.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040" }}>{selected.client}</div>
                        <div style={{ fontSize:13, color:"#8899aa", marginTop:2 }}>{s.label}</div>
                      </div>
                      <span style={{ padding:"4px 10px", borderRadius:3, fontSize:10, fontFamily:"'Orbitron',sans-serif", fontWeight:700, letterSpacing:1, color:st.color, background:st.bg, border:`1px solid ${st.border}` }}>{st.label}</span>
                    </div>

                    {/* Appointment Details */}
                    {[
                      ["📅 Date",       selected.date],
                      ["🕐 Time",       selected.time],
                      ["📞 Phone",      selected.phone],
                      ["✉️ Email",      selected.email],
                      ["💰 Est. Price", s.price === 0 ? (s.note || "Free") : `$${s.price}`],
                      ["📡 Source",     (() => { const src = SOURCES.find(s2 => s2.id === selected.source); return src ? `${src.icon} ${src.label}` : "🌐 Website"; })()],
                      ["⏱ Duration",   `${selected.duration || 1} hour${(selected.duration || 1) !== 1 ? "s" : ""}`],
                    ].map(([l,v]) => (
                      <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid rgba(201,162,39,.1)", gap:10 }}>
                        <span style={{ fontSize:13, color:"#7788aa" }}>{l}</span>
                        <span style={{ fontSize:13, color:"#e8e0cc", fontWeight:500, textAlign:"right" }}>{v}</span>
                      </div>
                    ))}

                    {/* Notes */}
                    {selected.notes && (
                      <div style={{ marginTop:14, padding:12, background:"rgba(201,162,39,.05)", border:"1px solid rgba(201,162,39,.15)", borderRadius:4 }}>
                        <div style={{ fontSize:10, color:"#7788aa", marginBottom:5, fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5 }}>NOTES</div>
                        <div style={{ fontSize:13, color:"#c8bfa8" }}>{selected.notes}</div>
                      </div>
                    )}

                    {/* Reschedule Controls */}
                    <div style={{ marginTop:18, padding:14, background:"rgba(201,162,39,.04)", border:"1px solid rgba(201,162,39,.12)", borderRadius:4 }}>
                      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:2, color:"#c9a227", marginBottom:12 }}>RESCHEDULE</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:10, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", marginBottom:5 }}>START TIME</div>
                          <select value={selected.time} onChange={e => updateBooking(selected.id, { time: e.target.value })} style={{ fontSize:12 }}>
                            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", marginBottom:5 }}>DURATION</div>
                          <div style={{ display:"flex", gap:4 }}>
                            {[1,2,3,4,5,6,7,8].map(h => {
                              const sel = (selected.duration || 1) === h;
                              return <button key={h} type="button" onClick={() => updateBooking(selected.id, { duration: h })} className="btn" style={{ flex:1, padding:"6px 2px", fontSize:10, background: sel ? "rgba(201,162,39,.25)" : "transparent", border: sel ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.15)", color: sel ? "#f0c040" : "#556677" }}>{h}h</button>;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:2, color:"#c9a227", marginBottom:4 }}>ADMIN ACTIONS</div>
                      {selected.status === "pending" ? (
                        <>
                          <button className="btn ok"     onClick={() => updateStatus(selected.id, "approved")}>✅ APPROVE BOOKING</button>
                          <button className="btn blue"   onClick={() => updateStatus(selected.id, "scheduled_call")}>📞 SCHEDULE A CALL</button>
                          <button className="btn danger" onClick={() => updateStatus(selected.id, "denied")}>❌ DENY BOOKING</button>
                        </>
                      ) : (
                        <button className="btn ghost" onClick={() => updateStatus(selected.id, "pending")}>↩ RESET TO PENDING</button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        ) : (

          // ── Calendar Tab ──────────────────────────────────────────────
          <div style={{ flex:1, padding:24, overflowY:"auto", display:"flex", gap:20, flexWrap:"wrap" }}>

            {/* Month Grid */}
            <div className="card" style={{ padding:18, minWidth:300, flex:"0 0 auto" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <button className="btn ghost" style={{ padding:"5px 11px" }} onClick={() => { if(calM===0){setCalM(11);setCalY(y=>y-1);}else setCalM(m=>m-1); }}>‹</button>
                <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040" }}>{MONTHS[calM]} {calY}</span>
                <button className="btn ghost" style={{ padding:"5px 11px" }} onClick={() => { if(calM===11){setCalM(0);setCalY(y=>y+1);}else setCalM(m=>m+1); }}>›</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,40px))", gap:3, marginBottom:4 }}>
                {DAYNAMES.map(d => <div key={d} style={{ textAlign:"center", fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:1, color:"#c9a227", padding:"5px 0" }}>{d}</div>)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,40px))", gap:3 }}>
                {Array(firstDay(calY, calM)).fill(null).map((_,i) => <div key={`e${i}`} />)}
                {Array(daysInMonth(calY, calM)).fill(null).map((_,i) => {
                  const d = i+1;
                  const ds = fmtDate(calY, calM, d);
                  const mark = dayMark(ds);
                  let cls = "cell";
                  if (ds === todayStr)          cls += " today";
                  if (mark === "approved")       cls += " has-app";
                  else if (mark === "pending")   cls += " has-pen";
                  if (selDay === ds)             cls += " sel-day";
                  return <div key={d} className={cls} onClick={() => setSelDay(ds === selDay ? null : ds)}>{d}</div>;
                })}
              </div>
              {/* Legend */}
              <div style={{ display:"flex", gap:14, marginTop:16, justifyContent:"center", flexWrap:"wrap" }}>
                {[["#4ade80","Approved"],["#fbbf24","Pending"]].map(([c,l]) => (
                  <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#7788aa" }}>
                    <div style={{ width:9, height:9, borderRadius:2, background:c }} />{l}
                  </div>
                ))}
              </div>
            </div>

            {/* Day Timeline */}
            <div className="card" style={{ flex:"1 1 240px", padding:18, minWidth:260, overflowY:"auto" }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, letterSpacing:2, color:"#c9a227", marginBottom:14 }}>
                {selDay ? `📅 ${selDay}` : "SELECT A DAY"}
              </div>
              {selDay ? (() => {
                // Build a map of which TIMES slots each booking covers
                const coveredSlots = {};
                bookings
                  .filter(b => b.date === selDay && (b.status === "approved" || b.status === "pending" || b.status === "scheduled_call"))
                  .forEach(b => {
                    const startH = timeToHour(b.time);
                    const dur = b.duration || 1;
                    TIMES.forEach(t => { const h = timeToHour(t); if (h >= startH && h < startH + dur) coveredSlots[t] = b; });
                  });
                return (
                  <div>
                    {TIMES.map((t, idx) => {
                      const b       = coveredSlots[t];
                      const isStart = b && timeToHour(b.time) === timeToHour(t);
                      const nextT   = TIMES[idx + 1];
                      const isEnd   = b && (!nextT || coveredSlots[nextT]?.id !== b.id);
                      const st      = b ? STATUS[b.status] : null;
                      return (
                        <div key={t} style={{ display:"flex", gap:8, minHeight:46 }}>
                          {/* Time label — only shown on empty slots or booking start */}
                          <div style={{ width:62, paddingTop:14, fontSize:9, color: !b || isStart ? "#556677" : "transparent", textAlign:"right", flexShrink:0, fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>{t}</div>
                          <div style={{ flex:1 }}>
                            {!b ? (
                              // Empty slot
                              <div style={{ height:46, borderTop:"1px solid rgba(201,162,39,.07)" }} />
                            ) : (
                              // Booking block — top/bottom border only on start/end rows
                              <div style={{
                                height:"100%", minHeight:46,
                                background:           st.bg,
                                borderLeft:           `2px solid ${st.border}`,
                                borderRight:          `1px solid ${st.border}`,
                                borderTop:            isStart ? `1px solid ${st.border}` : "none",
                                borderBottom:         isEnd   ? `1px solid ${st.border}` : "none",
                                borderTopLeftRadius:  isStart ? 4 : 0,
                                borderTopRightRadius: isStart ? 4 : 0,
                                borderBottomLeftRadius:  isEnd ? 4 : 0,
                                borderBottomRightRadius: isEnd ? 4 : 0,
                                padding: isStart ? "8px 10px 4px" : "0 10px",
                                cursor:"pointer",
                              }} onClick={() => { setSelected(b); setAdminTab("bookings"); }}>
                                {isStart && (
                                  <>
                                    <div style={{ fontWeight:700, color:"#e8e0cc", fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.client}</div>
                                    <div style={{ fontSize:10, color:st.color, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{svc(b.service).label}</div>
                                    {(b.duration || 1) > 1 && <div style={{ fontSize:9, color:"#7788aa", marginTop:2 }}>⏱ {b.duration}h</div>}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : <div style={{ color:"#556677", padding:20, textAlign:"center", fontSize:13 }}>Click a day to see bookings</div>}
            </div>
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showAddModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setShowAddModal(false)}>
          <div className="card slide-in" style={{ width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto", padding:24 }} onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040", letterSpacing:1.5 }}>ADD APPOINTMENT</div>
              <button className="btn ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            {/* Modal Form Fields */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

              {/* Client Name */}
              <div>
                <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>FULL NAME *</label>
                <input value={adminForm.name} onChange={e => setAdminForm({...adminForm, name:e.target.value})} placeholder="Client name" />
              </div>

              {/* Phone + Email */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>PHONE *</label>
                  <input type="tel" value={adminForm.phone} onChange={e => setAdminForm({...adminForm, phone:e.target.value})} placeholder="(242) 555-0000" />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>EMAIL</label>
                  <input type="email" value={adminForm.email} onChange={e => setAdminForm({...adminForm, email:e.target.value})} placeholder="email@example.com" />
                </div>
              </div>

              {/* Service */}
              <div>
                <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>SERVICE *</label>
                <select value={adminForm.service} onChange={e => setAdminForm({...adminForm, service:e.target.value})}>
                  <option value="">Select a service…</option>
                  {SERVICES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                </select>
              </div>

              {/* Date + Time */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>DATE *</label>
                  <input type="date" value={adminForm.date} onChange={e => { setAdminForm({...adminForm, date:e.target.value}); setAdminConfirmOverlap(false); }} style={{ colorScheme:"dark" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>TIME *</label>
                  <select value={adminForm.time} onChange={e => { setAdminForm({...adminForm, time:e.target.value}); setAdminConfirmOverlap(false); }}>
                    <option value="">Select time…</option>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Source */}
              <div>
                <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:8 }}>SOURCE *</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {SOURCES.map(src => (
                    <button key={src.id} type="button" onClick={() => setAdminForm({...adminForm, source:src.id})} className="btn" style={{ padding:"7px 12px", fontSize:10, background: adminForm.source === src.id ? "rgba(201,162,39,.25)" : "transparent", border: adminForm.source === src.id ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.2)", color: adminForm.source === src.id ? "#f0c040" : "#7788aa" }}>{src.icon} {src.label}</button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:8 }}>DURATION *</label>
                <div style={{ display:"flex", gap:5 }}>
                  {[1,2,3,4,5,6,7,8].map(h => (
                    <button key={h} type="button" onClick={() => { setAdminForm({...adminForm, duration:h}); setAdminConfirmOverlap(false); }} className="btn" style={{ flex:1, padding:"7px 2px", fontSize:10, background: adminForm.duration === h ? "rgba(201,162,39,.25)" : "transparent", border: adminForm.duration === h ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.2)", color: adminForm.duration === h ? "#f0c040" : "#7788aa" }}>{h}h</button>
                  ))}
                </div>
              </div>

              {/* Initial Status */}
              <div>
                <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:8 }}>INITIAL STATUS</label>
                <div style={{ display:"flex", gap:6 }}>
                  {[
                    { k:"pending",        l:"PENDING",  bg:"rgba(245,158,11,.2)",  border:"#f59e0b", c:"#fbbf24" },
                    { k:"approved",       l:"APPROVED", bg:"rgba(34,197,94,.2)",   border:"#22c55e", c:"#4ade80" },
                    { k:"scheduled_call", l:"CALL",     bg:"rgba(59,130,246,.2)",  border:"#3b82f6", c:"#60a5fa" },
                  ].map(({k,l,bg,border,c}) => (
                    <button key={k} type="button" onClick={() => setAdminForm({...adminForm, status:k})} className="btn" style={{ padding:"7px 10px", fontSize:10, flex:1, background: adminForm.status === k ? bg : "transparent", border: adminForm.status === k ? `1px solid ${border}` : "1px solid rgba(201,162,39,.2)", color: adminForm.status === k ? c : "#7788aa" }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>NOTES</label>
                <textarea rows={2} value={adminForm.notes} onChange={e => setAdminForm({...adminForm, notes:e.target.value})} placeholder="Additional notes, location, or special requirements…" />
              </div>
            </div>

            {/* Passive overlap indicator */}
            {hasAdminConflict(adminForm.date, adminForm.time, adminForm.duration) && !adminConfirmOverlap && (
              <div style={{ marginTop:12, padding:10, background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:4, fontSize:11, color:"#fca5a5" }}>
                ⚠️ This time slot overlaps with an existing booking.
              </div>
            )}

            {/* Modal Actions — confirmation step when overlap detected */}
            {adminConfirmOverlap ? (
              <div style={{ marginTop:16 }}>
                <div style={{ padding:13, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.35)", borderRadius:4, fontSize:12, color:"#fca5a5", marginBottom:12 }}>
                  ⚠️ This appointment overlaps with an existing booking. Are you sure you want to add it anyway?
                </div>
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button className="btn ghost" onClick={() => setAdminConfirmOverlap(false)}>NO, GO BACK</button>
                  <button className="btn danger" onClick={submitAdminBooking}>YES, ADD ANYWAY</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
                <button className="btn ghost" onClick={() => setShowAddModal(false)}>CANCEL</button>
                <button className="btn gold" disabled={!adminForm.name || !adminForm.phone || !adminForm.service || !adminForm.date || !adminForm.time || !adminForm.source} onClick={() => {
                  if (hasAdminConflict(adminForm.date, adminForm.time, adminForm.duration)) {
                    setAdminConfirmOverlap(true);
                  } else {
                    submitAdminBooking();
                  }
                }}>＋ ADD APPOINTMENT</button>
              </div>
            )}
          </div>
        </div>
      )}

      {SiteFooter({ light: true })}
    </div>
  );

  // ── Client View ────────────────────────────────────────────────────────
  const ClientView = () => {
    const canNext1 = form.name && form.email && form.phone;
    const canNext2 = form.service;
    const canNext3 = form.date && form.time;

    return (
      <div style={{ minHeight:"100vh" }} className="circuit">

        {/* Client Header — full-width sticky website-style */}
        <div style={{
          position:"sticky", top:0, zIndex:100,
          background:"linear-gradient(180deg,rgba(5,13,26,.97),rgba(10,22,40,.93))",
          borderBottom:"1px solid rgba(201,162,39,.25)",
          backdropFilter:"blur(10px)",
          WebkitBackdropFilter:"blur(10px)",
          padding:"clamp(10px,2vw,18px) clamp(16px,5vw,56px)",
          display:"flex", alignItems:"center", gap:"clamp(10px,2vw,20px)"
        }}>
          <div className="logo-circle" style={{ width:"clamp(40px,6vw,54px)", height:"clamp(40px,6vw,54px)", fontSize:"clamp(14px,2.2vw,20px)", flexShrink:0 }}>EZ</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:"clamp(15px,3vw,24px)", fontWeight:900, color:"#fff", letterSpacing:"clamp(1px,0.4vw,3px)" }}>
              EZ TECH <span style={{ color:"#c9a227" }}>SOLUTIONS</span>
            </div>
            <div style={{ fontSize:"clamp(9px,1.6vw,12px)", color:"#c9a227", letterSpacing:"clamp(0.5px,0.2vw,1.5px)", marginTop:3, fontStyle:"italic" }}>
              Providing Fast and Quality Services
            </div>
          </div>
          <button className="btn ghost" style={{ padding:"clamp(6px,1vw,10px) clamp(10px,1.8vw,16px)", fontSize:"clamp(9px,1.4vw,11px)", flexShrink:0 }} onClick={() => setMode("admin")}>ADMIN</button>
        </div>

        <div style={{ maxWidth:560, margin:"0 auto", padding:"24px 16px" }}>

          {submitted ? (

            // ── Success Screen ──────────────────────────────────────────
            <div className="card" style={{ padding:30, textAlign:"center" }}>
              <div style={{ fontSize:60, marginBottom:14 }}>✅</div>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:18, fontWeight:900, color:"#f0c040", marginBottom:10, letterSpacing:1.5 }}>BOOKING RECEIVED</div>
              <div style={{ color:"#c8bfa8", marginBottom:8, fontSize:14 }}>Thank you, <span style={{ color:"#c9a227", fontWeight:700 }}>{form.name}</span>!</div>
              <div style={{ color:"#7788aa", fontSize:13, marginBottom:18 }}>Your request for <strong style={{ color:"#e8e0cc" }}>{svc(form.service).label}</strong> on <strong style={{ color:"#e8e0cc" }}>{form.date}</strong> at <strong style={{ color:"#e8e0cc" }}>{form.time}</strong> has been submitted.</div>
              <div style={{ padding:14, background:"rgba(201,162,39,.08)", border:"1px solid rgba(201,162,39,.2)", borderRadius:4, marginBottom:18, fontSize:12, color:"#c8bfa8" }}>
                Our team will review your request and contact you at <strong style={{ color:"#c9a227" }}>{form.phone}</strong> to <strong>approve</strong>, <strong>schedule a call</strong>, or <strong>follow up</strong>.
              </div>
              <div style={{ fontSize:11, color:"#7788aa", marginBottom:18 }}>📞 {CONTACT.phone} · ✉️ {CONTACT.email}</div>
              <button className="btn gold" onClick={resetClient}>BOOK ANOTHER SERVICE</button>
            </div>

          ) : (
            <>
              {/* Step Progress Indicator */}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:20, justifyContent:"center" }}>
                {[1,2,3,4].map(n => (
                  <div key={n} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700, background: step >= n ? "#c9a227" : "transparent", color: step >= n ? "#050d1a" : "#556677", border: step >= n ? "none" : "1px solid #556677" }}>{n}</div>
                    {n < 4 && <div style={{ width:20, height:1, background: step > n ? "#c9a227" : "#556677" }} />}
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding:22 }}>

                {/* Step 1 — Contact Info */}
                {step === 1 && (
                  <div className="slide-in">
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>YOUR INFORMATION</div>
                    <div style={{ fontSize:12, color:"#7788aa", marginBottom:18 }}>Step 1 of 4 · Tell us about yourself</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      <div><label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>FULL NAME *</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="John Smith" /></div>
                      <div><label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>EMAIL *</label><input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="you@email.com" /></div>
                      <div><label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>PHONE *</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="(242) 555-0000" /></div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20 }}>
                      <button className="btn gold" disabled={!canNext1} onClick={() => setStep(2)}>NEXT →</button>
                    </div>
                  </div>
                )}

                {/* Step 2 — Service Selection */}
                {step === 2 && (
                  <div className="slide-in">
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>SELECT SERVICE</div>
                    <div style={{ fontSize:12, color:"#7788aa", marginBottom:16 }}>Step 2 of 4 · What do you need?</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7, maxHeight:400, overflowY:"auto" }}>
                      {SERVICES.map(s => (
                        <div key={s.id} onClick={() => setForm({...form, service:s.id})} style={{ padding:12, borderRadius:4, cursor:"pointer", border: form.service === s.id ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.15)", background: form.service === s.id ? "rgba(201,162,39,.12)" : "rgba(201,162,39,.03)", display:"flex", alignItems:"center", gap:12, transition:"all .15s" }}>
                          <span style={{ fontSize:22 }}>{s.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, color:"#e8e0cc", fontSize:13 }}>{s.label}</div>
                          </div>
                          {form.service === s.id && <span style={{ color:"#c9a227", fontSize:18 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
                      <button className="btn ghost" onClick={() => setStep(1)}>← BACK</button>
                      <button className="btn gold" disabled={!canNext2} onClick={() => setStep(3)}>NEXT →</button>
                    </div>
                  </div>
                )}

                {/* Step 3 — Date & Time */}
                {step === 3 && (
                  <div className="slide-in">
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>PICK A DATE & TIME</div>
                    <div style={{ fontSize:12, color:"#7788aa", marginBottom:16 }}>Step 3 of 4 · Select a date, then pick an available time slot</div>

                    {/* Calendar Picker */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <button className="btn ghost" style={{ padding:"5px 10px" }} onClick={() => { if(calM===0){setCalM(11);setCalY(y=>y-1);}else setCalM(m=>m-1); }}>‹</button>
                        <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700, color:"#f0c040" }}>{MONTHS[calM]} {calY}</span>
                        <button className="btn ghost" style={{ padding:"5px 10px" }} onClick={() => { if(calM===11){setCalM(0);setCalY(y=>y+1);}else setCalM(m=>m+1); }}>›</button>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:3 }}>
                        {DAYNAMES.map(d => <div key={d} style={{ textAlign:"center", fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:1, color:"#c9a227", padding:"4px 0" }}>{d}</div>)}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
                        {Array(firstDay(calY, calM)).fill(null).map((_,i) => <div key={`e${i}`} />)}
                        {Array(daysInMonth(calY, calM)).fill(null).map((_,i) => {
                          const d = i+1;
                          const ds = fmtDate(calY, calM, d);
                          const mark = dayMark(ds);
                          const isPast = ds < todayStr;
                          const blocked = isPast;
                          let cls = "cell";
                          if (ds === todayStr)        cls += " today";
                          if (mark === "approved")     cls += " has-app";
                          else if (mark === "pending") cls += " has-pen";
                          if (isPast)                  cls += " disabled-past";
                          if (form.date === ds)        cls += " sel-day";
                          return <div key={d} className={cls} onClick={() => !blocked && setForm({...form, date:ds, time:""})}>{d}</div>;
                        })}
                      </div>
                      {/* Calendar Legend */}
                      <div style={{ display:"flex", gap:12, marginTop:10, justifyContent:"center", flexWrap:"wrap", fontSize:10, color:"#7788aa" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:9, height:9, background:"#4ade80", borderRadius:2 }} />Booked</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:9, height:9, background:"#fbbf24", borderRadius:2 }} />Pending</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:9, height:9, border:"1px solid #c9a227", borderRadius:2 }} />Today</div>
                      </div>
                    </div>

                    {/* Time Slot Picker */}
                    {form.date && (
                      <div>
                        <div style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", marginBottom:8 }}>AVAILABLE TIMES · {form.date}</div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                          {CLIENT_TIMES.map(t => {
                            const taken = isClientBooked(form.date, t);
                            return <div key={t} className={"timeslot " + (form.time === t ? "sel" : "") + (taken ? " taken" : "")} onClick={() => !taken && setForm({...form, time:t})}>{t}</div>;
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
                      <button className="btn ghost" onClick={() => setStep(2)}>← BACK</button>
                      <button className="btn gold" disabled={!canNext3} onClick={() => setStep(4)}>NEXT →</button>
                    </div>
                  </div>
                )}

                {/* Step 4 — Review & Submit */}
                {step === 4 && (
                  <div className="slide-in">
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>REVIEW & SUBMIT</div>
                    <div style={{ fontSize:12, color:"#7788aa", marginBottom:16 }}>Step 4 of 4 · Confirm your booking</div>
                    <div style={{ background:"rgba(201,162,39,.05)", border:"1px solid rgba(201,162,39,.2)", borderRadius:4, padding:16, marginBottom:14 }}>
                      {[
                        ["NAME",    form.name],
                        ["EMAIL",   form.email],
                        ["PHONE",   form.phone],
                        ["SERVICE", svc(form.service).label],
                        ["DATE",    form.date],
                        ["TIME",    form.time],
                      ].map(([l,v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid rgba(201,162,39,.1)", gap:10 }}>
                          <span style={{ fontSize:10, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif" }}>{l}</span>
                          <span style={{ fontSize:13, color:"#e8e0cc", fontWeight:500, textAlign:"right" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>ADDITIONAL NOTES (OPTIONAL)</label>
                      <textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Tell us about your project, location, or any special requirements..." />
                    </div>
                    <div style={{ marginTop:14, padding:11, background:"rgba(59,130,246,.08)", border:"1px solid rgba(59,130,246,.2)", borderRadius:4, fontSize:11, color:"#93bbf0" }}>
                      ℹ️ After submitting, our team will review your request and reach out to <strong>approve</strong>, <strong>schedule a call</strong>, or follow up.
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
                      <button className="btn ghost" onClick={() => setStep(3)}>← BACK</button>
                      <button className="btn gold" onClick={submitBooking}>✓ SUBMIT BOOKING</button>
                    </div>
                  </div>
                )}
              </div>

            </>
          )}

          {/* Bottom Brand Logo — screen blend removes the black background */}
          <div style={{ textAlign:"center", marginTop:28, paddingBottom:8 }}>
            <img src={`${import.meta.env.BASE_URL}assets/EZTECHLOGO BLACK.jpg`} alt="EZ Tech Solutions" style={{ height:"clamp(120px, 32vw, 200px)", width:"auto", objectFit:"contain", mixBlendMode:"screen", opacity:0.85 }} />
          </div>
        </div>

        {/* Footer */}
        {SiteFooter({})}
      </div>
    );
  };

  // ── Root Render ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#050d1a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }} className="circuit">
      <style>{css}</style>
      <div className="logo-circle" style={{ width:60, height:60, fontSize:22 }}>EZ</div>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:12, color:"#c9a227", letterSpacing:3 }} className="pulse">LOADING…</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#050d1a", color:"#e8e0cc" }} className="circuit">
      <style>{css}</style>
      {toast && (
        <div className="slide-in" style={{ position:"fixed", top:20, right:20, zIndex:9999, padding:"12px 20px", background:"linear-gradient(135deg,#c9a227,#f0c040)", color:"#050d1a", borderRadius:4, fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700, letterSpacing:1, boxShadow:"0 8px 24px rgba(0,0,0,.4)" }}>
          {toast}
        </div>
      )}
      {mode === "admin" ? AdminView() : ClientView()}
    </div>
  );
}
