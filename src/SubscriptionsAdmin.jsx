import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const SESSION_KEY = "ez_admin_authed";
const pad = n => String(n).padStart(2, "0");
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const waPhone = phone => {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 7)  return `1242${d}`;
  if (d.length === 10) return `1${d}`;
  return d;
};

const waRenewalMsg = sub =>
  encodeURIComponent(`Hi ${sub.name}, your ${sub.plan} subscription expires on ${fmtDate(sub.expiration)}. Please contact us to renew and avoid any interruption to your service. 📞 (242) 805-0777`);

const formatPhone = v => {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`;
};

const IPTV_PRICES  = { 1: 30, 3: 75, 6: 135, 12: 260 };
const MOVIE_PRICES = { 1: 20, 3: 50, 6: 100 };

const presetPrice = (plan, months, devices) => {
  const mo  = parseInt(months)  || 1;
  const dev = parseInt(devices) || 2;
  if (plan === "IPTV") {
    const base = IPTV_PRICES[mo];
    if (base == null) return null;
    const extraDevices = Math.max(0, dev - 2);
    const extraCost    = extraDevices * 25 * Math.ceil(mo / 3);
    return base + extraCost;
  }
  if (plan === "Movies & TV") {
    const base = MOVIE_PRICES[mo];
    return base != null ? base : null;
  }
  return null;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const addMonthsToDate = (dateStr, months) => {
  if (!dateStr || !months) return "";
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + (parseInt(months) || 1));
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const daysUntil = isoStr => {
  if (!isoStr) return null;
  const exp = new Date(isoStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((exp - now) / 86400000);
};

const fmtDate = isoStr => {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Island Luck", "Cash App", "PayPal"];
const PAYMENT_EMOJI = { "Cash": "💵", "Bank Transfer": "🏦", "Island Luck": "🎰", "Cash App": "💸", "PayPal": "🅿️" };

const BLANK = () => {
  const sd = todayStr();
  return {
    name: "", phone: "", email: "", plan: "IPTV",
    duration_months: 1, price: "30", devices: 2,
    username: "", password: "", start_date: sd,
    expiration: addMonthsToDate(sd, 1),
    status: "active", notes: "", payment_method: "Bank Transfer",
  };
};

export default function SubscriptionsAdmin({ onGoClient }) {
  const [authed, setAuthed]     = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [pw, setPw]             = useState("");
  const [pwErr, setPwErr]       = useState(false);
  const [pwLoading, setPwLoad]  = useState(false);
  const pwRef = useRef(null);

  const [subs, setSubs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("list");
  const [search, setSearch]     = useState("");
  const [planFilter, setPlanFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [toast, setToast]       = useState(null);
  const [showPw, setShowPw]     = useState(false);

  const [showModal, setShowModal]           = useState(false);
  const [editId, setEditId]                 = useState(null);
  const [form, setForm]                     = useState(BLANK());
  const [saving, setSaving]                 = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState(false);
  const [reminderConfirm, setReminderConfirm] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [editNotes, setEditNotes]           = useState(false);
  const [notesInput, setNotesInput]         = useState("");
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewForm, setRenewForm]           = useState({ duration_months:1, price:"", payment_method:"Bank Transfer", devices:2 });
  const [renewing, setRenewing]             = useState(false);

  useEffect(() => {
    if (!authed) return;
    supabase
      .from("subscriptions")
      .select("*")
      .order("expiration", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setSubs(data);
        setLoading(false);
      });
  }, [authed]);

  const fire = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const tryLogin = async () => {
    if (pwLoading) return;
    setPwLoad(true);
    const { data, error } = await supabase.rpc("verify_admin_password", { pw });
    setPwLoad(false);
    if (error || !data) { setPwErr(true); setPw(""); setTimeout(() => pwRef.current?.focus(), 50); }
    else { sessionStorage.setItem(SESSION_KEY, "1"); setAuthed(true); setPwErr(false); setPw(""); }
  };

  const doLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    if (onGoClient) onGoClient();
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openAdd = () => { setForm(BLANK()); setEditId(null); setShowModal(true); };

  const openEdit = sub => {
    setForm({
      name:            sub.name || "",
      phone:           sub.phone || "",
      email:           sub.email || "",
      plan:            sub.plan || "IPTV",
      duration_months: sub.duration_months || 1,
      price:           sub.price != null ? String(sub.price) : "",
      devices:         sub.devices || 1,
      username:        sub.username || "",
      password:        sub.password || "",
      start_date:      sub.start_date || todayStr(),
      expiration:      sub.expiration ? new Date(sub.expiration).toISOString().slice(0, 10) : "",
      status:          sub.status || "active",
      notes:           sub.notes || "",
      payment_method:  sub.payment_method || "Bank Transfer",
    });
    setEditId(sub.id);
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "start_date" || field === "duration_months") {
        next.expiration = addMonthsToDate(
          field === "start_date"      ? value : prev.start_date,
          field === "duration_months" ? value : prev.duration_months
        );
      }
      if (["plan", "duration_months", "devices"].includes(field)) {
        const p = presetPrice(
          field === "plan"            ? value : next.plan,
          field === "duration_months" ? value : next.duration_months,
          field === "devices"         ? value : next.devices
        );
        if (p != null) next.price = String(p);
      }
      return next;
    });
  };

  const saveSub = async () => {
    if (!form.name.trim() || !form.plan || !form.expiration) return;
    setSaving(true);
    const payload = {
      name:            form.name.trim(),
      phone:           form.phone.trim(),
      email:           form.email.trim(),
      plan:            form.plan,
      duration_months: parseInt(form.duration_months) || 1,
      price:           parseInt(form.price) || 0,
      devices:         parseInt(form.devices) || 1,
      username:        form.username.trim(),
      password:        form.password.trim(),
      start_date:      form.start_date,
      expiration:      new Date(form.expiration + "T23:59:59").toISOString(),
      status:          form.status,
      notes:           form.notes.trim(),
      payment_method:  form.payment_method || "Bank Transfer",
    };
    if (editId) {
      const existing = subs.find(s => s.id === editId);
      const expChanged = existing &&
        new Date(existing.expiration).toISOString().slice(0, 10) !== form.expiration;
      if (expChanged) {
        payload.reminded_7d      = false;
        payload.reminded_2d      = false;
        payload.reminded_expired = false;
        if (new Date(payload.expiration) > new Date()) payload.status = "active";
      }
      const { error } = await supabase.from("subscriptions").update(payload).eq("id", editId);
      if (error) { fire("❌ Error saving"); setSaving(false); return; }
      setSubs(p => p.map(s => s.id === editId ? { ...s, ...payload, id: editId } : s));
      if (selected?.id === editId) setSelected(s => ({ ...s, ...payload }));
      fire("✅ Updated");
    } else {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert({ ...payload, reminded_7d: false, reminded_2d: false, reminded_expired: false })
        .select()
        .single();
      if (error) { fire("❌ Error adding"); setSaving(false); return; }
      setSubs(p => [...p, data].sort((a, b) => new Date(a.expiration) - new Date(b.expiration)));
      // Send welcome email if client has an email address
      if (payload.email) {
        fetch("/api/send-subscription-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
      fire("✅ Subscription added" + (payload.email ? " · Welcome email sent" : ""));
    }
    setSaving(false);
    setShowModal(false);
  };

  const deleteSub = async () => {
    if (!selected) return;
    const { error } = await supabase.from("subscriptions").delete().eq("id", selected.id);
    if (error) { fire("❌ Error deleting"); return; }
    setSubs(p => p.filter(s => s.id !== selected.id));
    setSelected(null);
    setDeleteConfirm(false);
    fire("🗑 Deleted");
  };

  const sendReminder = async () => {
    if (!selected || sendingReminder) return;
    setSendingReminder(true);
    try {
      const res = await fetch("/api/send-subscription-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       selected.name,
          email:      selected.email,
          phone:      selected.phone,
          plan:       selected.plan,
          expiration: selected.expiration,
          manual:     true,
        }),
      });
      fire(res.ok ? "📧 Reminder sent!" : "❌ Failed to send");
    } catch { fire("❌ Failed to send"); }
    setSendingReminder(false);
    setReminderConfirm(false);
  };

  const saveNotes = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("subscriptions").update({ notes: notesInput }).eq("id", selected.id);
    if (error) { fire("❌ Error saving notes"); return; }
    setSubs(p => p.map(s => s.id === selected.id ? { ...s, notes: notesInput } : s));
    setSelected(s => ({ ...s, notes: notesInput }));
    setEditNotes(false);
    fire("✅ Notes saved");
  };

  // ── Renewal ───────────────────────────────────────────────────────────────
  const openRenew = sub => {
    const mo = sub.duration_months || 1;
    const dev = sub.devices || 2;
    setRenewForm({
      duration_months: mo,
      devices:         dev,
      price:           String(presetPrice(sub.plan, mo, dev) ?? sub.price ?? ""),
      payment_method:  sub.payment_method || "Bank Transfer",
    });
    setShowRenewModal(true);
  };

  const handleRenewChange = (field, value) => {
    setRenewForm(prev => {
      const next = { ...prev, [field]: value };
      if (["duration_months", "devices"].includes(field)) {
        const p = presetPrice(
          selected?.plan,
          field === "duration_months" ? value : next.duration_months,
          field === "devices"         ? value : next.devices
        );
        if (p != null) next.price = String(p);
      }
      return next;
    });
  };

  const submitRenewal = async () => {
    if (!selected || renewing) return;
    setRenewing(true);
    // Roll from current expiry if still active, otherwise from today
    const baseDate = daysUntil(selected.expiration) > 0
      ? new Date(selected.expiration).toISOString().slice(0, 10)
      : todayStr();
    const newExpiry = new Date(addMonthsToDate(baseDate, renewForm.duration_months) + "T23:59:59").toISOString();
    const patch = {
      expiration:      newExpiry,
      duration_months: parseInt(renewForm.duration_months) || 1,
      price:           parseInt(renewForm.price) || 0,
      devices:         parseInt(renewForm.devices) || 2,
      payment_method:  renewForm.payment_method,
      status:          "active",
      reminded_7d:     false,
      reminded_2d:     false,
      reminded_expired:false,
    };
    const { error } = await supabase.from("subscriptions").update(patch).eq("id", selected.id);
    if (error) { fire("❌ Renewal failed"); setRenewing(false); return; }
    const updated = { ...selected, ...patch };
    setSubs(p => p.map(s => s.id === selected.id ? updated : s));
    setSelected(updated);
    // Send renewal email
    if (selected.email) {
      fetch("/api/send-subscription-renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:            selected.name,
          email:           selected.email,
          phone:           selected.phone,
          plan:            selected.plan,
          duration_months: patch.duration_months,
          price:           patch.price,
          devices:         patch.devices,
          expiration:      newExpiry,
          payment_method:  renewForm.payment_method,
        }),
      }).catch(() => {});
    }
    setRenewing(false);
    setShowRenewModal(false);
    fire("🔄 Renewed!" + (selected.email ? " · Confirmation email sent" : ""));
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const now           = new Date();
  const activeCount   = subs.filter(s => s.status === "active" && daysUntil(s.expiration) > 0).length;
  const expiringCount = subs.filter(s => s.status === "active" && daysUntil(s.expiration) > 0 && daysUntil(s.expiration) <= 7).length;
  const expiredCount  = subs.filter(s => s.status === "expired" || (s.status === "active" && daysUntil(s.expiration) <= 0)).length;
  const totalRev      = subs.filter(s => s.status !== "cancelled").reduce((sum, s) => sum + (s.price || 0), 0);
  const iptvRev       = subs.filter(s => s.plan === "IPTV"         && s.status !== "cancelled").reduce((sum, s) => sum + (s.price || 0), 0);
  const movieRev      = subs.filter(s => s.plan === "Movies & TV"  && s.status !== "cancelled").reduce((sum, s) => sum + (s.price || 0), 0);

  const filtered = subs
    .filter(s => planFilter === "all" || s.plan === planFilter)
    .filter(s => {
      if (statusFilter === "expiring") return s.status === "active" && daysUntil(s.expiration) > 0 && daysUntil(s.expiration) <= 7;
      if (statusFilter === "all")      return true;
      return s.status === statusFilter;
    })
    .filter(s => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (s.name  || "").toLowerCase().includes(q) ||
             (s.phone || "").includes(search) ||
             (s.email || "").toLowerCase().includes(q);
    });

  const rowColor = sub => {
    if (sub.status === "cancelled") return { border:"1px solid rgba(119,136,170,.2)", background:"rgba(119,136,170,.03)" };
    const days = daysUntil(sub.expiration);
    if (sub.status === "expired" || days <= 0) return { border:"1px solid rgba(239,68,68,.3)", background:"rgba(239,68,68,.04)", borderLeft:"3px solid rgba(239,68,68,.7)" };
    if (days <= 7)                             return { border:"1px solid rgba(245,158,11,.3)", background:"rgba(245,158,11,.04)", borderLeft:"3px solid rgba(245,158,11,.7)" };
    return { border:"1px solid rgba(34,197,94,.25)", background:"rgba(34,197,94,.02)", borderLeft:"3px solid rgba(34,197,94,.5)" };
  };

  const expiryInfo = sub => {
    if (sub.status === "cancelled") return { text:"CANCELLED", color:"#7788aa" };
    const days = daysUntil(sub.expiration);
    if (days === null) return { text:"—", color:"#7788aa" };
    if (days <= 0)  return { text:`Expired ${Math.abs(days)}d ago`, color:"#ef4444" };
    if (days === 1) return { text:"Expires tomorrow", color:"#f59e0b" };
    if (days <= 7)  return { text:`Expires in ${days}d`, color:"#f59e0b" };
    return { text:fmtDate(sub.expiration), color:"#34d399" };
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { key:`${d.getFullYear()}-${pad(d.getMonth()+1)}`, label:MONTHS_SHORT[d.getMonth()], year:d.getFullYear() };
  });
  const monthStats = last12.map(({ key, label, year }) => {
    const ms    = subs.filter(s => s.start_date?.startsWith(key) && s.status !== "cancelled");
    const iptv  = ms.filter(s => s.plan === "IPTV").reduce((sum, s) => sum + (s.price || 0), 0);
    const movie = ms.filter(s => s.plan === "Movies & TV").reduce((sum, s) => sum + (s.price || 0), 0);
    return { key, label, year, total:ms.length, iptv, movie, rev:iptv+movie };
  });
  const maxRev     = Math.max(...monthStats.map(m => m.rev), 1);
  const totalRev12 = monthStats.reduce((s, m) => s + m.rev, 0);
  const avgRev     = Math.round(totalRev12 / 12);
  const bestMonth  = monthStats.reduce((a, b) => b.rev > a.rev ? b : a, monthStats[0]);
  const iptvSubs   = subs.filter(s => s.plan === "IPTV"        && s.status === "active" && daysUntil(s.expiration) > 0).length;
  const movieSubs  = subs.filter(s => s.plan === "Movies & TV" && s.status === "active" && daysUntil(s.expiration) > 0).length;

  const lbl = (text) => (
    <label style={{ fontSize:11, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>{text}</label>
  );

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} className="circuit">
        <div className="card slide-in" style={{ width:"100%", maxWidth:380, padding:"36px 32px" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div className="logo-circle" style={{ width:56, height:56, fontSize:20, margin:"0 auto 14px" }}>EZ</div>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:900, color:"#fff", letterSpacing:2 }}>
              EZ TECH <span style={{ color:"#c9a227" }}>SOLUTIONS</span>
            </div>
            <div style={{ fontSize:11, color:"#7788aa", letterSpacing:2, marginTop:6, fontFamily:"'Orbitron',sans-serif" }}>SUBSCRIPTION MANAGER</div>
          </div>
          <div style={{ marginBottom:14 }}>
            {lbl("PASSWORD")}
            <input
              ref={pwRef} type="password" value={pw}
              onChange={e => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={e => e.key === "Enter" && tryLogin()}
              placeholder="Enter admin password" autoFocus
              className={pwErr ? "shake" : ""}
              style={pwErr ? { borderColor:"#ef4444", boxShadow:"0 0 0 2px rgba(239,68,68,.2)" } : {}}
            />
            {pwErr && <div style={{ fontSize:11, color:"#f87171", marginTop:6 }}>Incorrect password.</div>}
          </div>
          <button className="btn gold" style={{ width:"100%", padding:"13px", fontSize:12, letterSpacing:2 }} onClick={tryLogin} disabled={pwLoading}>
            {pwLoading ? "VERIFYING…" : "UNLOCK DASHBOARD"}
          </button>
          <div style={{ textAlign:"center", marginTop:16 }}>
            <button onClick={onGoClient} style={{ background:"none", border:"none", color:"#556677", fontSize:11, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>
              ← Back to booking page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflowX:"hidden", width:"100%" }}>

      {toast && (
        <div className="slide-in" style={{ position:"fixed", top:20, right:20, zIndex:9999, padding:"12px 20px", background:"linear-gradient(135deg,#c9a227,#f0c040)", color:"#050d1a", borderRadius:4, fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700, letterSpacing:1, boxShadow:"0 8px 24px rgba(0,0,0,.4)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="admin-hdr" style={{ padding:"16px 24px", borderBottom:"1px solid rgba(201,162,39,.2)", background:"linear-gradient(180deg,rgba(10,22,40,.95),rgba(10,22,40,.85))", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
        <img src={`${import.meta.env.BASE_URL}assets/EZTECHLOGO2.png`} alt="EZ Tech" style={{ height:56, width:"auto", flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:900, color:"#fff", letterSpacing:2 }}>EZ TECH <span style={{ color:"#c9a227" }}>SOLUTIONS</span></div>
          <div style={{ fontSize:10, color:"#7788aa", letterSpacing:1, marginTop:1 }}>SUBSCRIPTION MANAGER</div>
        </div>
        <div className="admin-hdr-btns" style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn ghost" style={{ padding:"8px 12px", fontSize:10 }} onClick={() => { window.location.hash = "#/admin"; }}>📋 BOOKINGS</button>
          <button className="btn ghost" onClick={onGoClient}>👤 CLIENT VIEW</button>
          <button className="btn danger" style={{ padding:"10px 14px", fontSize:10 }} onClick={doLogout}>LOGOUT</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="stats-bar" style={{ padding:"16px 24px", display:"flex", gap:12, flexWrap:"wrap", borderBottom:"1px solid rgba(201,162,39,.1)" }}>
        {[
          { l:"ACTIVE",   v:activeCount,    c:"#22c55e" },
          { l:"EXPIRING", v:expiringCount,  c:"#f59e0b", pulse:expiringCount > 0 },
          { l:"EXPIRED",  v:expiredCount,   c:"#ef4444", pulse:expiredCount > 0 },
          { l:"REVENUE",  v:`$${totalRev}`, c:"#c9a227" },
          { l:"IPTV",     v:`$${iptvRev}`,  c:"#3b82f6" },
          { l:"MOVIES",   v:`$${movieRev}`, c:"#a78bfa" },
        ].map(s => (
          <div key={s.l} className="card stat-card" style={{ padding:"12px 18px", flex:"1 1 100px" }}>
            <div style={{ fontSize:9, letterSpacing:2, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", marginBottom:4 }}>{s.l}</div>
            <div className="stat-val" style={{ fontFamily:"'Orbitron',sans-serif", fontSize:22, fontWeight:900, color:s.c }}>
              {s.v}
              {s.pulse && <span className="pulse" style={{ marginLeft:6, fontSize:14 }}>●</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ padding:"0 24px", display:"flex", borderBottom:"1px solid rgba(201,162,39,.15)", overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {[["list","📋 SUBSCRIPTIONS"],["stats","📊 STATS"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:"14px 20px", background:"transparent", border:"none", borderBottom:tab===k?"2px solid #c9a227":"2px solid transparent", color:tab===k?"#c9a227":"#7788aa", fontFamily:"'Orbitron',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1.5, cursor:"pointer", transition:"all .2s", flexShrink:0, whiteSpace:"nowrap" }}>{l}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", minHeight:0, display:"flex", flexDirection:"column" }}>

        {tab === "list" ? (

          // ── Subscriptions tab ─────────────────────────────────────────────
          <div className={`admin-panels${selected ? " has-sel" : ""}`} style={{ display:"flex", flexWrap:"wrap", flex:1 }}>

            {/* List panel */}
            <div className="admin-list" style={{ flex:"0 0 380px", padding:"20px", overflowY:"auto", borderRight:"1px solid rgba(201,162,39,.1)" }}>

              {/* Search + Add */}
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <input
                  placeholder="Search name / phone / email…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex:1, fontSize:13, padding:"9px 12px" }}
                />
                <button className="btn gold" style={{ padding:"9px 14px", fontSize:10, whiteSpace:"nowrap" }} onClick={openAdd}>＋ ADD</button>
              </div>

              {/* Plan filter */}
              <div className="filter-row" style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                {["all","IPTV","Movies & TV"].map(f => (
                  <button key={f} className="btn filter-btn" onClick={() => setPlanFilter(f)}
                    style={{ padding:"6px 12px", fontSize:10, letterSpacing:.5,
                      background:planFilter===f?"rgba(201,162,39,.15)":"transparent",
                      border:`1px solid ${planFilter===f?"#c9a227":"rgba(201,162,39,.2)"}`,
                      color:planFilter===f?"#f0c040":"#556677" }}>
                    {f === "all" ? "ALL PLANS" : f}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <div className="filter-row" style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
                {[["all","ALL"],["active","ACTIVE"],["expiring","EXPIRING"],["expired","EXPIRED"],["cancelled","CANCELLED"]].map(([f, l]) => (
                  <button key={f} className="btn filter-btn" onClick={() => setStatusFilter(f)}
                    style={{ padding:"6px 12px", fontSize:10, letterSpacing:.5,
                      background:statusFilter===f?"rgba(201,162,39,.15)":"transparent",
                      border:`1px solid ${statusFilter===f?"#c9a227":"rgba(201,162,39,.2)"}`,
                      color:statusFilter===f?"#f0c040":"#556677" }}>
                    {l}
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={{ textAlign:"center", padding:30, color:"#556677", fontFamily:"'Orbitron',sans-serif", fontSize:11, letterSpacing:2 }} className="pulse">LOADING…</div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:30, color:"#556677", fontSize:13 }}>No subscriptions found</div>
              ) : filtered.map(sub => {
                const ei = expiryInfo(sub);
                return (
                  <div key={sub.id}
                    onClick={() => { setSelected(sub); setDeleteConfirm(false); setEditNotes(false); setReminderConfirm(false); setShowPw(false); }}
                    style={{ ...rowColor(sub), borderRadius:4, cursor:"pointer", padding:"12px 14px", marginBottom:8, transition:"all .15s", outline:selected?.id===sub.id?"2px solid rgba(201,162,39,.5)":"none" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, color:"#e8e0cc", fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sub.name}</div>
                        <div style={{ fontSize:12, color:"#7788aa", marginTop:3 }}>
                          <span style={{ padding:"2px 7px", borderRadius:2, fontSize:10, marginRight:6,
                            background:sub.plan==="IPTV"?"rgba(59,130,246,.15)":"rgba(167,139,250,.15)",
                            border:`1px solid ${sub.plan==="IPTV"?"rgba(59,130,246,.3)":"rgba(167,139,250,.3)"}`,
                            color:sub.plan==="IPTV"?"#60a5fa":"#c4b5fd" }}>{sub.plan}</span>
                          {sub.duration_months}mo · ${sub.price}
                        </div>
                        <div style={{ fontSize:12, marginTop:4, color:ei.color }}>{ei.text}</div>
                        {(sub.reminded_7d || sub.reminded_2d || sub.reminded_expired) && (
                          <div style={{ display:"flex", gap:4, marginTop:5, flexWrap:"wrap" }}>
                            {sub.reminded_7d      && <span style={{ fontSize:9, padding:"2px 5px", borderRadius:2, background:"rgba(201,162,39,.15)", border:"1px solid rgba(201,162,39,.3)", color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>7D ✓</span>}
                            {sub.reminded_2d      && <span style={{ fontSize:9, padding:"2px 5px", borderRadius:2, background:"rgba(245,158,11,.15)", border:"1px solid rgba(245,158,11,.3)", color:"#f59e0b", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>2D ✓</span>}
                            {sub.reminded_expired && <span style={{ fontSize:9, padding:"2px 5px", borderRadius:2, background:"rgba(239,68,68,.15)", border:"1px solid rgba(239,68,68,.3)",  color:"#ef4444", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>EXP ✓</span>}
                          </div>
                        )}
                      </div>
                      {sub.phone && (
                        <a href={`https://wa.me/${waPhone(sub.phone)}?text=${waRenewalMsg(sub)}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ flexShrink:0, padding:"5px 9px", borderRadius:3, background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.25)", color:"#25d366", fontSize:13, textDecoration:"none" }}>
                          💬
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="admin-detail" style={{ flex:1, overflowY:"auto" }}>
              {!selected ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"rgba(201,162,39,.3)", padding:40, height:"100%" }}>
                  <div style={{ fontSize:56, marginBottom:14 }}>📱</div>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, letterSpacing:2, textAlign:"center" }}>SELECT A SUBSCRIPTION</div>
                </div>
              ) : (() => {
                const ei   = expiryInfo(selected);
                const days = daysUntil(selected.expiration);
                return (
                  <div style={{ padding:24 }} className="slide-in">

                    {/* Mobile back */}
                    <div className="mobile-back" style={{ marginBottom:14 }}>
                      <button onClick={() => { setSelected(null); setDeleteConfirm(false); setEditNotes(false); }}
                        style={{ background:"none", border:"none", color:"#c9a227", fontSize:12, cursor:"pointer", fontFamily:"'Exo 2',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
                        ← Back to list
                      </button>
                    </div>

                    {/* Header */}
                    <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:700, color:"#f0c040" }}>{selected.name}</div>
                        <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
                          <span style={{ padding:"3px 10px", borderRadius:3, fontSize:11, fontFamily:"'Orbitron',sans-serif", fontWeight:700, letterSpacing:.5,
                            background:selected.plan==="IPTV"?"rgba(59,130,246,.15)":"rgba(167,139,250,.15)",
                            border:`1px solid ${selected.plan==="IPTV"?"rgba(59,130,246,.4)":"rgba(167,139,250,.4)"}`,
                            color:selected.plan==="IPTV"?"#60a5fa":"#c4b5fd" }}>{selected.plan}</span>
                          <span style={{ padding:"3px 10px", borderRadius:3, fontSize:11, fontFamily:"'Orbitron',sans-serif", fontWeight:700, letterSpacing:.5,
                            color:selected.status==="active"?"#22c55e":selected.status==="cancelled"?"#7788aa":"#ef4444",
                            background:selected.status==="active"?"rgba(34,197,94,.1)":selected.status==="cancelled"?"rgba(119,136,170,.1)":"rgba(239,68,68,.1)",
                            border:`1px solid ${selected.status==="active"?"rgba(34,197,94,.3)":selected.status==="cancelled"?"rgba(119,136,170,.3)":"rgba(239,68,68,.3)"}`}}>
                            {(selected.status || "active").toUpperCase()}
                          </span>
                          <span style={{ fontSize:13, color:ei.color, fontWeight:600 }}>{ei.text}</span>
                        </div>
                      </div>
                      <button className="btn ghost" style={{ padding:"7px 12px", fontSize:10, flexShrink:0 }} onClick={() => openEdit(selected)}>✏️ EDIT</button>
                    </div>

                    {/* Contact */}
                    <div style={{ marginBottom:12, padding:12, background:"rgba(201,162,39,.04)", border:"1px solid rgba(201,162,39,.12)", borderRadius:4 }}>
                      <div style={{ fontSize:10, color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5, marginBottom:8 }}>CONTACT</div>
                      {selected.phone && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid rgba(201,162,39,.08)" }}>
                          <span style={{ fontSize:14, color:"#7788aa" }}>📞 Phone</span>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:14, color:"#e8e0cc" }}>{selected.phone}</span>
                            <a href={`https://wa.me/${waPhone(selected.phone)}?text=${waRenewalMsg(selected)}`} target="_blank" rel="noopener noreferrer"
                              style={{ padding:"4px 10px", borderRadius:3, background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.25)", color:"#25d366", fontSize:11, textDecoration:"none", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>
                              💬 WA
                            </a>
                          </div>
                        </div>
                      )}
                      {selected.email && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0" }}>
                          <span style={{ fontSize:14, color:"#7788aa" }}>✉️ Email</span>
                          <span style={{ fontSize:13, color:"#e8e0cc", textAlign:"right", maxWidth:"65%", wordBreak:"break-all" }}>{selected.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Subscription details */}
                    <div style={{ marginBottom:12, padding:12, background:"rgba(201,162,39,.04)", border:"1px solid rgba(201,162,39,.12)", borderRadius:4 }}>
                      <div style={{ fontSize:10, color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5, marginBottom:8 }}>SUBSCRIPTION DETAILS</div>
                      {[
                        ["Duration",  `${selected.duration_months} month${selected.duration_months !== 1 ? "s" : ""}`],
                        ["Price",     `$${selected.price}`],
                        ...(selected.plan === "IPTV" && selected.devices > 1 ? [["Devices", String(selected.devices)]] : []),
                        ["Start",     fmtDate(selected.start_date)],
                        ["Expires",   fmtDate(selected.expiration)],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid rgba(201,162,39,.08)" }}>
                          <span style={{ fontSize:14, color:"#7788aa" }}>{l}</span>
                          <span style={{ fontSize:14, color:"#e8e0cc", fontWeight:500 }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Credentials */}
                    {(selected.username || selected.password) && (
                      <div style={{ marginBottom:12, padding:12, background:"rgba(201,162,39,.04)", border:"1px solid rgba(201,162,39,.12)", borderRadius:4 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <div style={{ fontSize:10, color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5 }}>CREDENTIALS</div>
                          <button onClick={() => setShowPw(p => !p)} style={{ background:"none", border:"none", color:"#556677", fontSize:11, cursor:"pointer" }}>
                            {showPw ? "🙈 Hide" : "👁 Show"}
                          </button>
                        </div>
                        {selected.username && (
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid rgba(201,162,39,.08)" }}>
                            <span style={{ fontSize:14, color:"#7788aa" }}>Username</span>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:13, color:"#e8e0cc", fontFamily:"monospace" }}>{selected.username}</span>
                              <button onClick={() => { navigator.clipboard.writeText(selected.username); fire("📋 Username copied"); }}
                                style={{ background:"none", border:"1px solid rgba(201,162,39,.25)", borderRadius:3, color:"#c9a227", fontSize:10, padding:"2px 7px", cursor:"pointer", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>
                                COPY
                              </button>
                            </div>
                          </div>
                        )}
                        {selected.password && (
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0" }}>
                            <span style={{ fontSize:14, color:"#7788aa" }}>Password</span>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:13, color:"#e8e0cc", fontFamily:"monospace" }}>{showPw ? selected.password : "••••••••"}</span>
                              <button onClick={() => { navigator.clipboard.writeText(selected.password); fire("📋 Password copied"); }}
                                style={{ background:"none", border:"1px solid rgba(201,162,39,.25)", borderRadius:3, color:"#c9a227", fontSize:10, padding:"2px 7px", cursor:"pointer", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>
                                COPY
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    <div style={{ marginBottom:16, padding:12, background:"rgba(201,162,39,.04)", border:"1px solid rgba(201,162,39,.12)", borderRadius:4 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:editNotes ? 8 : 4 }}>
                        <div style={{ fontSize:10, color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5 }}>NOTES</div>
                        {!editNotes && <button onClick={() => { setNotesInput(selected.notes || ""); setEditNotes(true); }} style={{ background:"none", border:"none", color:"#c9a227", fontSize:11, cursor:"pointer" }}>✏️ Edit</button>}
                      </div>
                      {editNotes ? (
                        <>
                          <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} rows={3} style={{ fontSize:13, resize:"vertical" }} />
                          <div style={{ display:"flex", gap:8, marginTop:8 }}>
                            <button className="btn gold" style={{ padding:"6px 14px", fontSize:10 }} onClick={saveNotes}>SAVE</button>
                            <button className="btn ghost" style={{ padding:"6px 14px", fontSize:10 }} onClick={() => setEditNotes(false)}>CANCEL</button>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:13, color:selected.notes ? "#c8bfa8" : "#445566", fontStyle:selected.notes ? "normal" : "italic" }}>
                          {selected.notes || "No notes"}
                        </div>
                      )}
                    </div>

                    {/* Renew */}
                    <button className="btn ok" style={{ width:"100%", padding:"11px", fontSize:11, marginBottom:10, letterSpacing:1 }}
                      onClick={() => openRenew(selected)}>
                      🔄 RENEW SUBSCRIPTION
                    </button>

                    {/* Send Reminder */}
                    <div style={{ marginBottom:10 }}>
                      {!reminderConfirm ? (
                        <button className="btn blue" style={{ width:"100%", padding:"10px", fontSize:10 }}
                          onClick={() => setReminderConfirm(true)} disabled={!selected.email}>
                          📧 SEND REMINDER EMAIL
                        </button>
                      ) : (
                        <div style={{ padding:12, background:"rgba(59,130,246,.08)", border:"1px solid rgba(59,130,246,.25)", borderRadius:4 }}>
                          <div style={{ fontSize:11, color:"#93c5fd", marginBottom:8 }}>Send reminder to {selected.email}?</div>
                          <div style={{ display:"flex", gap:8 }}>
                            <button className="btn blue" style={{ flex:1, padding:"8px", fontSize:10 }} onClick={sendReminder} disabled={sendingReminder}>
                              {sendingReminder ? "SENDING…" : "SEND"}
                            </button>
                            <button className="btn ghost" style={{ flex:1, padding:"8px", fontSize:10 }} onClick={() => setReminderConfirm(false)}>CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    {!deleteConfirm ? (
                      <button className="btn danger" style={{ width:"100%", padding:"10px", fontSize:10 }} onClick={() => setDeleteConfirm(true)}>
                        🗑 DELETE SUBSCRIPTION
                      </button>
                    ) : (
                      <div style={{ padding:12, background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:4 }}>
                        <div style={{ fontSize:12, color:"#fca5a5", marginBottom:10 }}>⚠️ Permanently delete {selected.name}?</div>
                        <div style={{ display:"flex", gap:8 }}>
                          <button className="btn danger" style={{ flex:1, padding:"8px", fontSize:10 }} onClick={deleteSub}>YES, DELETE</button>
                          <button className="btn ghost"  style={{ flex:1, padding:"8px", fontSize:10 }} onClick={() => setDeleteConfirm(false)}>CANCEL</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

        ) : (

          // ── Stats tab ─────────────────────────────────────────────────────
          <div style={{ flex:1, padding:24, overflowY:"auto" }}>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>SUBSCRIPTION REVENUE — LAST 12 MONTHS</div>
            <div style={{ fontSize:13, color:"#7788aa", marginBottom:20 }}>Blue = IPTV · Purple = Movies & TV</div>

            {/* Bar chart */}
            <div className="card" style={{ padding:"20px 16px 10px", marginBottom:20, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
              <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:180, minWidth:660 }}>
                {monthStats.map(m => (
                  <div key={m.key} style={{ flex:1, minWidth:44, display:"flex", flexDirection:"column", alignItems:"center", gap:3, height:"100%" }}>
                    <div style={{ flex:1, width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                      {m.rev > 0 && (
                        <div style={{ fontSize:11, color:"#e8e0cc", textAlign:"center", marginBottom:4, fontFamily:"'Orbitron',sans-serif" }}>
                          ${m.rev >= 1000 ? `${(m.rev/1000).toFixed(1)}k` : m.rev}
                        </div>
                      )}
                      <div style={{ width:"100%", height:`${Math.max((m.rev/maxRev)*130, m.rev>0?4:0)}px`, borderRadius:"2px 2px 0 0", position:"relative", overflow:"hidden", transition:"height .3s" }}>
                        {m.rev > 0 && (
                          <>
                            <div style={{ position:"absolute", bottom:0, left:0, width:"100%", height:`${(m.iptv/m.rev)*100}%`, background:"rgba(59,130,246,.55)" }} />
                            <div style={{ position:"absolute", top:0, left:0, width:"100%", height:`${(m.movie/m.rev)*100}%`, background:"rgba(167,139,250,.55)" }} />
                          </>
                        )}
                        {m.rev === 0 && <div style={{ width:"100%", height:4, background:"rgba(201,162,39,.1)" }} />}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:"#ffffff", fontFamily:"'Orbitron',sans-serif", textAlign:"center", letterSpacing:.3, marginTop:2 }}>{m.label}</div>
                    {m.total > 0 && <div style={{ fontSize:11, color:"#c9a227", textAlign:"center", fontWeight:700 }}>{m.total}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
              {[
                { l:"12-MONTH REVENUE",  v:`$${totalRev12}`,                      c:"#c9a227" },
                { l:"MONTHLY AVG",       v:`$${avgRev}`,                          c:"#a78bfa" },
                { l:"BEST MONTH",        v:`${bestMonth.label} $${bestMonth.rev}`, c:"#f0c040" },
                { l:"IPTV REVENUE",      v:`$${iptvRev}`,                         c:"#3b82f6" },
                { l:"MOVIES REVENUE",    v:`$${movieRev}`,                        c:"#a78bfa" },
                { l:"ACTIVE IPTV",       v:iptvSubs,                              c:"#22c55e" },
                { l:"ACTIVE MOVIES",     v:movieSubs,                             c:"#22c55e" },
                { l:"TOTAL ACTIVE",      v:activeCount,                           c:"#34d399" },
              ].map(s => (
                <div key={s.l} className="card" style={{ padding:"16px 18px" }}>
                  <div style={{ fontSize:11, letterSpacing:1.5, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", marginBottom:6 }}>{s.l}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:s.c, fontFamily:"'Orbitron',sans-serif" }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:2000, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"20px 16px", overflowY:"auto" }}
          onClick={() => setShowModal(false)}>
          <div className="card slide-in" style={{ width:"100%", maxWidth:520, padding:28, marginTop:20, marginBottom:20 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040", letterSpacing:1.5 }}>
                {editId ? "✏️ EDIT SUBSCRIPTION" : "＋ NEW SUBSCRIPTION"}
              </div>
              <button className="btn ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Name */}
              <div>
                {lbl("NAME *")}
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="Full name" />
              </div>

              {/* Phone + Email */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  {lbl("PHONE")}
                  <input type="tel" value={form.phone} onChange={e => handleFormChange("phone", formatPhone(e.target.value))} placeholder="(242) 555-0000" />
                </div>
                <div>
                  {lbl("EMAIL")}
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))} placeholder="email@example.com" />
                </div>
              </div>

              {/* Plan */}
              <div>
                {lbl("PLAN *")}
                <select value={form.plan} onChange={e => handleFormChange("plan", e.target.value)}>
                  <option value="IPTV">IPTV</option>
                  <option value="Movies & TV">Movies & TV</option>
                </select>
              </div>

              {/* Months + Price + Devices */}
              <div style={{ display:"grid", gridTemplateColumns:`1fr 1fr${form.plan === "IPTV" ? " 1fr" : ""}`, gap:10 }}>
                <div>
                  {lbl("MONTHS *")}
                  <input type="number" min="1" max="60" value={form.duration_months}
                    onChange={e => handleFormChange("duration_months", parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  {lbl("PRICE ($) *")}
                  <input type="number" min="0" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price:e.target.value }))} placeholder="0" />
                  {(() => {
                    const pp = presetPrice(form.plan, form.duration_months, form.devices);
                    return pp != null && String(pp) !== form.price ? (
                      <button onClick={() => setForm(f => ({ ...f, price:String(presetPrice(f.plan, f.duration_months, f.devices)) }))}
                        style={{ background:"none", border:"none", color:"#c9a227", fontSize:10, cursor:"pointer", marginTop:3, padding:0, fontFamily:"'Exo 2',sans-serif" }}>
                        ↺ Use preset: ${pp}
                      </button>
                    ) : null;
                  })()}
                </div>
                {form.plan === "IPTV" && (
                  <div>
                    {lbl("DEVICES")}
                    <input type="number" min="1" max="10" value={form.devices}
                      onChange={e => handleFormChange("devices", parseInt(e.target.value) || 1)} />
                  </div>
                )}
              </div>

              {/* Username + Password */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  {lbl("USERNAME")}
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username:e.target.value }))} placeholder="Account username" />
                </div>
                <div>
                  {lbl("PASSWORD")}
                  <input value={form.password} onChange={e => setForm(f => ({ ...f, password:e.target.value }))} placeholder="Account password" />
                </div>
              </div>

              {/* Start date + Expiration */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  {lbl("START DATE *")}
                  <input type="date" value={form.start_date} onChange={e => handleFormChange("start_date", e.target.value)} />
                </div>
                <div>
                  {lbl("EXPIRATION *")}
                  <input type="date" value={form.expiration} onChange={e => setForm(f => ({ ...f, expiration:e.target.value }))} />
                  <span style={{ fontSize:10, color:"#7788aa", marginTop:3, display:"block" }}>Auto-set from start + months</span>
                </div>
              </div>

              {/* Status */}
              <div>
                {lbl("STATUS")}
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Payment Method */}
              <div>
                {lbl("PAYMENT METHOD")}
                <div style={{ display:"flex", gap:8 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button key={m} type="button" onClick={() => setForm(f => ({ ...f, payment_method:m }))}
                      style={{ flex:1, padding:"10px", fontSize:12, borderRadius:3, cursor:"pointer", transition:"all .15s",
                        background: form.payment_method === m ? "rgba(201,162,39,.2)" : "transparent",
                        border: `1px solid ${form.payment_method === m ? "#c9a227" : "rgba(201,162,39,.2)"}`,
                        color: form.payment_method === m ? "#f0c040" : "#556677",
                        fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                      {PAYMENT_EMOJI[m]} {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                {lbl("NOTES")}
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))}
                  rows={2} placeholder="Optional notes…" style={{ resize:"vertical" }} />
              </div>
            </div>

            <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
              <button className="btn ghost" onClick={() => setShowModal(false)}>CANCEL</button>
              <button className="btn gold" disabled={!form.name.trim() || !form.expiration || !form.price || saving} onClick={saveSub}>
                {saving ? "SAVING…" : (editId ? "UPDATE" : "ADD SUBSCRIPTION")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {showRenewModal && selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={() => setShowRenewModal(false)}>
          <div className="card slide-in" style={{ width:"100%", maxWidth:420, padding:28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#f0c040", letterSpacing:1.5 }}>🔄 RENEW SUBSCRIPTION</div>
              <button className="btn ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={() => setShowRenewModal(false)}>✕</button>
            </div>

            <div style={{ padding:"10px 14px", background:"rgba(201,162,39,.06)", border:"1px solid rgba(201,162,39,.15)", borderRadius:4, marginBottom:18 }}>
              <div style={{ fontWeight:700, color:"#f0c040", fontSize:14 }}>{selected.name}</div>
              <div style={{ fontSize:12, color:"#7788aa", marginTop:3 }}>
                <span style={{ color: selected.plan==="IPTV"?"#60a5fa":"#c4b5fd" }}>{selected.plan}</span>
                {" · "}Current expiry: <span style={{ color:"#c9a227" }}>{(() => { const d = daysUntil(selected.expiration); return d > 0 ? `${d}d remaining` : "Expired"; })()}</span>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Duration + Devices */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                <div>
                  {lbl("MONTHS")}
                  <input type="number" min="1" max="60" value={renewForm.duration_months}
                    onChange={e => handleRenewChange("duration_months", parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  {lbl("DEVICES")}
                  <input type="number" min="1" max="10" value={renewForm.devices}
                    onChange={e => handleRenewChange("devices", parseInt(e.target.value) || 2)} />
                </div>
                <div>
                  {lbl("PRICE ($)")}
                  <input type="number" min="0" value={renewForm.price}
                    onChange={e => setRenewForm(f => ({ ...f, price:e.target.value }))} />
                  {(() => {
                    const pp = presetPrice(selected.plan, renewForm.duration_months, renewForm.devices);
                    return pp != null && String(pp) !== renewForm.price ? (
                      <button onClick={() => setRenewForm(f => ({ ...f, price:String(presetPrice(selected.plan, f.duration_months, f.devices)) }))}
                        style={{ background:"none", border:"none", color:"#c9a227", fontSize:10, cursor:"pointer", marginTop:3, padding:0 }}>
                        ↺ Preset: ${pp}
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* New expiry preview */}
              <div style={{ padding:"10px 14px", background:"rgba(34,197,94,.06)", border:"1px solid rgba(34,197,94,.2)", borderRadius:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, color:"#7788aa" }}>New expiration</span>
                <span style={{ fontSize:13, fontWeight:700, color:"#34d399" }}>
                  {(() => {
                    const base = daysUntil(selected.expiration) > 0
                      ? new Date(selected.expiration).toISOString().slice(0, 10)
                      : todayStr();
                    return fmtDate(addMonthsToDate(base, renewForm.duration_months));
                  })()}
                </span>
              </div>

              {/* Payment Method */}
              <div>
                {lbl("PAYMENT METHOD")}
                <div style={{ display:"flex", gap:8 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button key={m} type="button" onClick={() => setRenewForm(f => ({ ...f, payment_method:m }))}
                      style={{ flex:1, padding:"10px", fontSize:12, borderRadius:3, cursor:"pointer", transition:"all .15s",
                        background: renewForm.payment_method === m ? "rgba(201,162,39,.2)" : "transparent",
                        border: `1px solid ${renewForm.payment_method === m ? "#c9a227" : "rgba(201,162,39,.2)"}`,
                        color: renewForm.payment_method === m ? "#f0c040" : "#556677",
                        fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                      {PAYMENT_EMOJI[m]} {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
              <button className="btn ghost" onClick={() => setShowRenewModal(false)}>CANCEL</button>
              <button className="btn ok" disabled={!renewForm.price || renewing} onClick={submitRenewal}>
                {renewing ? "RENEWING…" : "✓ CONFIRM RENEWAL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
