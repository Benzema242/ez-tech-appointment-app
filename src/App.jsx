
import { useState, useEffect, useRef } from "react";
// Contact form now uses Resend via /api/send-contact-email
import { supabase } from "./supabase";
import SubscriptionsAdmin from "./SubscriptionsAdmin";

// ─── SERVICES CATALOG ──────────────────────────────────────────────────────
const SERVICES = [
  { id: "cctv_assess", label: "Security Camera Assessment", price: 0, icon: "🔍", note: "FREE Assessment" },
  { id: "cctv_install", label: "Security Camera / CCTV Installation", price: 300, icon: "📷" },
  { id: "network", label: "WiFi Network Setup", price: 200, icon: "📡" },
  { id: "ap", label: "AP Installation", price: 175, icon: "🔗" },
  { id: "starlink_assess", label: "Starlink Assessment", price: 0, icon: "🛰️", note: "FREE Assessment" },
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
const CLIENT_TIMES = ["10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"];

// ─── BOOKING SOURCES ───────────────────────────────────────────────────────
const SOURCES = [
  { id: "call",     label: "Call",     icon: "📞" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬" },
  { id: "facebook", label: "Facebook", icon: "📘" },
  { id: "referred", label: "Referred", icon: "🤝" },
  { id: "walkin",   label: "Walk-in",  icon: "🚶" },
  { id: "website",  label: "Website",  icon: "🌐" },
];

// ─── DATE & CALENDAR HELPERS ───────────────────────────────────────────────
const pad = n => String(n).padStart(2, "0");
const fmtDate = (y, m, d) => `${y}-${pad(m+1)}-${pad(d)}`;
const daysInMonth = (y, m) => new Date(y, m+1, 0).getDate();
const firstDay = (y, m) => new Date(y, m, 1).getDay();
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYNAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── VALIDATION & FORMATTING HELPERS ──────────────────────────────────────
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
const validPhone = (v) => /^\(\d{3}\) \d{3}-\d{4}$/.test((v || "").trim());
const formatPhone = (v) => {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`;
};
const waPhone = (phone) => {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 7)  return `1242${d}`;  // local Nassau, no area code
  if (d.length === 10) return `1${d}`;     // North American with area code
  return d;                                // already has country code
};

// ─── CONTACT INFO ──────────────────────────────────────────────────────────
const CONTACT = {
  phone:     "(242) 805-0777",
  phoneTel:  "tel:+12428050777",
  email:     "info@ez-techgroup.com",
  emailHref: "mailto:info@ez-techgroup.com",
};

// ─── LOOKUP HELPERS ────────────────────────────────────────────────────────
const svc = id => SERVICES.find(s => s.id === id) || { id, label: id, icon: "⚙️", price: 0 };
// Normalises service field: handles legacy text, text[], or empty
const svcList = (service) => {
  const arr = Array.isArray(service) ? service : (service ? [service] : []);
  return arr.map(svc);
};
const timeToHour = t => { const [tp, ap] = t.split(" "); let h = parseInt(tp); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return h; };

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────
const STATUS = {
  pending:        { label: "PENDING",        color: "#f59e0b", bg: "rgba(245,158,11,.15)",  border: "rgba(245,158,11,.4)" },
  approved:       { label: "APPROVED",       color: "#22c55e", bg: "rgba(34,197,94,.15)",   border: "rgba(34,197,94,.4)" },
  denied:         { label: "DENIED",         color: "#ef4444", bg: "rgba(239,68,68,.15)",   border: "rgba(239,68,68,.4)" },
  scheduled_call: { label: "CALL SCHEDULED", color: "#3b82f6", bg: "rgba(59,130,246,.15)",  border: "rgba(59,130,246,.4)" },
};
const safeStatus = s => STATUS[s] || STATUS.pending;

const SESSION_KEY = "ez_admin_authed";

// ─── APP COMPONENT ─────────────────────────────────────────────────────────
export default function App() {

  // ── Routing & Auth ─────────────────────────────────────────────────────
  const getHash = () => window.location.hash;
  const isAdminRoute = () => getHash() === "#/admin";
  const isSubsRoute  = () => getHash() === "#/subscriptions";
  const [mode, setMode] = useState(() => isAdminRoute() ? "admin" : isSubsRoute() ? "subscriptions" : "client");
  const [adminAuthed, setAdminAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const pwRef = useRef(null);
  const [contactForm, setContactForm] = useState({ name:"", email:"", phone:"", message:"" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSucceeded, setContactSucceeded] = useState(false);
  const [contactError, setContactError] = useState(false);
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactError(false);
    try {
      const res = await fetch("/api/send-contact-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) { setContactSucceeded(true); }
      else { setContactError(true); }
    } catch { setContactError(true); }
    setContactSubmitting(false);
  };

  useEffect(() => {
    const onHash = () => setMode(isAdminRoute() ? "admin" : isSubsRoute() ? "subscriptions" : "client");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goAdmin = () => { window.location.hash = "#/admin"; };
  const goClient = () => { window.location.hash = ""; resetClient(); };

  const tryLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    const { data, error } = await supabase.rpc("verify_admin_password", { pw: pwInput });
    setLoginLoading(false);
    if (error || !data) {
      setPwError(true);
      setPwInput("");
      setTimeout(() => pwRef.current?.focus(), 50);
    } else {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAdminAuthed(true);
      setPwError(false);
      setPwInput("");
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminAuthed(false);
    setShowChangePwModal(false);
    goClient();
  };

  // ── Core State ─────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState(null);
  const [adminTab, setAdminTab] = useState("bookings");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", phone:"", services:[], date:"", time:"", notes:"", duration:1 });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const [selDay, setSelDay] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name:"", email:"", phone:"", services:[], date:"", time:"", source:"call", status:"pending", duration:1, notes:"", paid:false });
  const [recurringOn, setRecurringOn] = useState(false);
  const [recurInterval, setRecurInterval] = useState(7);
  const [adminConfirmOverlap, setAdminConfirmOverlap] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showChangePwModal, setShowChangePwModal] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ old:"", newPw:"", confirm:"" });
  const [changePwError, setChangePwError] = useState("");
  const [search, setSearch] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ client:"", phone:"", email:"", service:[] });
  const [editingAdminNote, setEditingAdminNote] = useState(false);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [adminNoteSending, setAdminNoteSending] = useState(false);
  const [contactAction, setContactAction] = useState("confirmation");
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [blackoutDates, setBlackoutDates] = useState([]);
  const [blackoutInput, setBlackoutInput] = useState("");
  const [blackoutReason, setBlackoutReason] = useState("");
  const [blackoutSaving, setBlackoutSaving] = useState(false);

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

  useEffect(() => {
    const channel = supabase
      .channel("bookings-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, ({ new: row }) => {
        setBookings(p => p.some(b => b.id === row.id) ? p : [...p, row].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings" }, ({ new: row }) => {
        setBookings(p => p.map(b => b.id === row.id ? row : b));
        setSelected(sel => sel?.id === row.id ? row : sel);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "bookings" }, ({ old: row }) => {
        setBookings(p => p.filter(b => b.id !== row.id));
        setSelected(sel => sel?.id === row.id ? null : sel);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    supabase.from("blackout_dates").select("*").order("date", { ascending: true }).then(({ data }) => { if (data) setBlackoutDates(data); });
    const ch = supabase.channel("blackout-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "blackout_dates" }, ({ new: row }) => setBlackoutDates(p => [...p, row].sort((a,b) => a.date.localeCompare(b.date))))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "blackout_dates" }, ({ old: row }) => setBlackoutDates(p => p.filter(b => b.id !== row.id)))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    if (!adminAuthed) { document.title = "EZ Tech Solutions"; return; }
    const pending = bookings.filter(b => b.status === "pending").length;
    document.title = pending > 0 ? `(${pending}) EZ Tech Admin` : "EZ Tech Admin";
  }, [adminAuthed, bookings]);

  // ── Toast ──────────────────────────────────────────────────────────────
  const fire = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Booking Actions ────────────────────────────────────────────────────
  const updateStatus = async (id, status) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) { fire("❌ Error updating status"); return; }
    const booking = bookings.find(b => b.id === id);
    setBookings(p => p.map(b => b.id === id ? { ...b, status } : b));
    setSelected(p => p ? { ...p, status } : null);
    const m = { approved: "✅ Approved!", denied: "❌ Denied", scheduled_call: "📞 Call scheduled", pending: "↩ Reset to pending" };
    fire(m[status] || "Updated");
    if (booking?.email && status !== "pending") {
      fetch("/api/send-status-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          name: booking.client,
          email: booking.email,
          phone: booking.phone,
          services: booking.service,
          date: booking.date,
          time: booking.time,
          duration: booking.duration,
          notes: booking.notes,
        }),
      }).catch(() => {});
    }
  };

  const submitBooking = async () => {
    if (submitting) return;
    setSubmitting(true);
    const payload = { client: `${form.firstName} ${form.lastName}`.trim(), service: form.services, date: form.date, time: form.time, status: "pending", phone: form.phone, email: form.email, notes: form.notes, source: "website", duration: form.duration };
    const { data, error } = await supabase.from("bookings").insert(payload).select().single();
    if (error) { fire("❌ Error submitting booking"); setSubmitting(false); return; }
    setBookings(p => [...p, data]);
    setSubmitted(true);
    setSubmitting(false);
    fetch("/api/send-booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        services: form.services.map(id => svc(id).label),
        date: form.date,
        time: form.time,
        notes: form.notes,
      }),
    }).catch(() => {});
  };

  const resetClient = () => { setStep(1); setForm({ firstName:"", lastName:"", email:"", phone:"", services:[], date:"", time:"", notes:"", duration:1 }); setSubmitted(false); };

  const exportCSV = (list, label = "bookings") => {
    const headers = ["Client","Phone","Email","Services","Date","Time","Duration (hrs)","Status","Price","Notes","Booked On"];
    const rows = list.map(b => [
      b.client, b.phone, b.email || "", Array.isArray(b.service) ? b.service.join("; ") : (b.service || ""),
      b.date, b.time, b.duration || 1, b.status, b.price ?? "", b.notes || "", (b.created_at || "").slice(0,10),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type:"text/csv" })), download: `ez-tech-${label}-${todayStr}.csv` });
    a.click();
  };

  const exportPDF = () => {
    const rows = filtered.map(b => {
      const svcs = Array.isArray(b.service) ? b.service.join(", ") : (b.service || "");
      const st = safeStatus(b.status);
      return `<tr>
        <td>${b.client}</td><td>${b.date}</td><td>${b.time}</td>
        <td>${svcs}</td><td>${b.phone}</td>
        <td style="color:${st.color};font-weight:700">${st.label}</td>
        <td>${b.price ? `$${b.price}` : "—"}</td>
      </tr>`;
    }).join("");
    printDoc(`Bookings Export — ${todayStr}`, `
      <table class="dispatch">
        <tr><th>Client</th><th>Date</th><th>Time</th><th>Services</th><th>Phone</th><th>Status</th><th>Price</th></tr>
        ${rows}
      </table>`);
  };

  const downloadBookingIcs = (b) => {
    const services = Array.isArray(b.service) ? b.service.join(', ') : (b.service || 'Service');
    const parseT = (t) => {
      const match = (t || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return { h:0, m:0 };
      let h = parseInt(match[1]); const m = parseInt(match[2]);
      if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
      return { h, m };
    };
    const { h, m } = parseT(b.time);
    const p = n => String(n).padStart(2,'0');
    const [y, mo, d] = (b.date || '').split('-');
    const dtstart = `${y}${mo}${d}T${p(h)}${p(m)}00`;
    const end = new Date(`${b.date}T${p(h)}:${p(m)}:00`);
    end.setHours(end.getHours() + (b.duration || 1));
    const dtend = `${end.getFullYear()}${p(end.getMonth()+1)}${p(end.getDate())}T${p(end.getHours())}${p(end.getMinutes())}00`;
    const phoneDigits = (b.phone || '').replace(/\D/g, '');
    const telUrl = phoneDigits.length === 7
      ? `tel:+1242${phoneDigits}`
      : phoneDigits.length === 10
        ? `tel:+1${phoneDigits}`
        : phoneDigits ? `tel:+${phoneDigits}` : null;
    const icsLines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EZ Tech Solutions//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:booking-${b.id}@ez-techgroup.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g,'').slice(0,15)}Z`,
      `DTSTART;TZID=America/Nassau:${dtstart}`,
      `DTEND;TZID=America/Nassau:${dtend}`,
      `SUMMARY:EZ Tech Solutions — ${services}`,
      `DESCRIPTION:Client: ${b.client}\\nPhone: ${b.phone}\\n${b.notes ? `Notes: ${b.notes}` : ''}`,
      'LOCATION:Nassau\\, Bahamas',
      'STATUS:CONFIRMED',
    ];
    if (telUrl) icsLines.push(`URL:${telUrl}`);
    icsLines.push('END:VEVENT', 'END:VCALENDAR');
    const ics = icsLines.join('\r\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ics], { type:'text/calendar' })), download:`ez-tech-${b.date}.ics` });
    a.click();
  };

  const printDoc = async (title, bodyHtml) => {
    const docRef = `EZT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const dateStr = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    let logoSrc = '';
    try {
      const res = await fetch('/assets/EZTECHLOGO2.png');
      const blob = await res.blob();
      logoSrc = await new Promise(r => { const fr = new FileReader(); fr.onloadend = () => r(fr.result); fr.readAsDataURL(blob); });
    } catch(e) {}
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title} — EZ Tech Solutions</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a2e;font-size:16px;min-height:100vh;display:flex;flex-direction:column;}
      /* ── Header ── */
      .hdr{background:#fff;padding:16px 36px 0;display:flex;align-items:flex-end;justify-content:space-between;}
      .hdr-contact{text-align:right;font-size:14px;color:#444;line-height:2;}
      .hdr-contact span{color:#c9a227;font-weight:700;}
      /* ── Rules ── */
      .gold-rule{height:4px;background:linear-gradient(90deg,#c9a227,#f0c040,#c9a227);}
      .blue-rule{height:4px;background:linear-gradient(90deg,#1e40af,#3b82f6,#1e40af);}
      /* ── Doc info bar ── */
      .doc-bar{background:#f7f5ef;border-bottom:1px solid #e0d9c8;padding:13px 36px;display:flex;align-items:center;justify-content:space-between;}
      .doc-title{font-size:20px;font-weight:800;color:#050b1f;letter-spacing:.5px;}
      .doc-meta{font-size:14px;color:#888;text-align:right;line-height:1.7;}
      .doc-ref{font-size:14px;font-weight:700;color:#c9a227;letter-spacing:1px;}
      /* ── Body ── */
      .body{flex:1;padding:28px 36px;}
      table{width:100%;border-collapse:collapse;margin-top:4px;}
      th{text-align:left;padding:11px 14px;background:#050b1f;color:#c9a227;font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;}
      td{padding:12px 14px;font-size:16px;border-bottom:1px solid #eee;vertical-align:top;color:#1a1a2e;}
      td:first-child{font-weight:600;color:#444;width:36%;background:#fafaf8;}
      tr:last-child td{border-bottom:none;}
      /* Stats grid */
      .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;}
      .stat-card{border:2px solid #e0d9c8;border-radius:6px;padding:14px 18px;background:#fafaf8;}
      .stat-card.gold{border-color:#c9a227;}
      .stat-label{font-size:13px;color:#888;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;}
      .stat-val{font-size:24px;font-weight:900;color:#050b1f;}
      /* Dispatch table — no left-column bold */
      .dispatch td:first-child{font-weight:400;background:#fff;width:auto;}
      .dispatch tr:nth-child(even) td{background:#fafaf8;}
      /* ── Footer ── */
      .ftr-rules{margin-top:auto;}
      .ftr-gold{height:4px;background:linear-gradient(90deg,#c9a227,#f0c040,#c9a227);}
      .ftr-blue{height:4px;background:linear-gradient(90deg,#1e40af,#3b82f6,#1e40af);}
      .ftr{background:#fff;padding:16px 36px;}
      .ftr-disclaimer{font-size:12px;color:#111;line-height:1.6;}
      .ftr-disclaimer strong{color:#111;}
      @media print{@page{margin:0;size:letter}body{height:11in;min-height:unset;}button{display:none;}}
    </style></head><body>
      <div class="hdr">
        ${logoSrc ? `<img src="${logoSrc}" style="width:220px;height:220px;object-fit:contain;object-position:bottom left;" />` : ''}
        <div class="hdr-contact">
          <span>(242) 805-0777</span><br/>
          info@ez-techgroup.com<br/>
          eztechbahamas.com
        </div>
      </div>
      <div class="gold-rule"></div>
      <div class="blue-rule"></div>
      <div class="doc-bar">
        <div class="doc-title">${title}</div>
        <div class="doc-meta">
          <div class="doc-ref">REF: ${docRef}</div>
          <div>${dateStr}</div>
        </div>
      </div>
      <div class="body">${bodyHtml}</div>
      <div class="ftr-rules">
        <div class="ftr-gold"></div>
        <div class="ftr-blue"></div>
      </div>
      <div class="ftr">
        <div class="ftr-disclaimer">
          <strong>CONFIDENTIALITY NOTICE:</strong> This document and the information contained herein are the exclusive property of EZ Tech Solutions and are intended solely for authorised internal use. Unauthorised reproduction, distribution, disclosure, or use of this document — in whole or in part — without the prior written consent of EZ Tech Solutions is strictly prohibited. Any person found to have misused, falsified, or unlawfully distributed information contained in this document will be subject to civil and criminal prosecution to the fullest extent permitted under the laws of The Commonwealth of The Bahamas. EZ Tech Solutions reserves the right to pursue all available legal remedies in the event of any breach. By handling this document, the recipient acknowledges and accepts these terms.
        </div>
      </div>
      <script>setTimeout(()=>window.print(),400);</script>
    </body></html>`);
    win.document.close();
  };

  const sendReminder = (booking) => {
    if (!booking?.email) return;
    fetch("/api/send-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status:"reminder", name:booking.client, email:booking.email, phone:booking.phone, services:booking.service, date:booking.date, time:booking.time, duration:booking.duration, notes:booking.notes }),
    }).then(() => fire("📧 Reminder sent!")).catch(() => fire("❌ Failed to send reminder"));
  };

  const sendConfirmation = (booking) => {
    if (!booking?.email) return;
    fetch("/api/send-booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resendOnly: true, name:booking.client, email:booking.email, phone:booking.phone, services:booking.service, date:booking.date, time:booking.time, notes:booking.notes }),
    }).then(() => fire("📧 Confirmation resent!")).catch(() => fire("❌ Failed to resend confirmation"));
  };

  const submitAdminBooking = async () => {
    const payload = { client: adminForm.name, service: adminForm.services, date: adminForm.date, time: adminForm.time, status: adminForm.status, phone: adminForm.phone, email: adminForm.email, notes: adminForm.notes, source: adminForm.source, duration: adminForm.duration, paid: adminForm.paid };
    const { data, error } = await supabase.from("bookings").insert(payload).select().single();
    if (error) { fire(`❌ ${error.message}`); return; }
    setBookings(p => [...p, data]);
    if (recurringOn && adminForm.date) {
      const next = new Date(adminForm.date + "T00:00:00");
      next.setDate(next.getDate() + recurInterval);
      const nextDate = fmtDate(next.getFullYear(), next.getMonth(), next.getDate());
      const { data: data2 } = await supabase.from("bookings").insert({ ...payload, date: nextDate, paid: false, status: "pending" }).select().single();
      if (data2) setBookings(p => [...p, data2]);
      fire(`✅ Added! Next booking pre-filled for ${nextDate}`);
    } else {
      fire("✅ Appointment added!");
    }
    setShowAddModal(false);
    setRecurringOn(false);
    setAdminForm({ name:"", email:"", phone:"", services:[], date:"", time:"", source:"call", status:"pending", duration:1, notes:"", paid:false });
  };

  const updateBooking = async (id, updates) => {
    const { error } = await supabase.from("bookings").update(updates).eq("id", id);
    if (error) { fire("❌ Error saving changes"); return; }
    setBookings(p => p.map(b => b.id === id ? { ...b, ...updates } : b));
    setSelected(p => p ? { ...p, ...updates } : null);
    fire("✅ Updated!");
  };

  const deleteBooking = async (id) => {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) { fire("❌ Error deleting booking"); return; }
    setBookings(p => p.filter(b => b.id !== id));
    setSelected(null);
    setDeleteConfirm(false);
    fire("🗑 Booking deleted");
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    const { error } = await supabase.from("bookings").delete().in("id", ids);
    if (error) { fire("❌ Error deleting bookings"); return; }
    setBookings(p => p.filter(b => !selectedIds.has(b.id)));
    if (selected && selectedIds.has(selected.id)) setSelected(null);
    setSelectedIds(new Set());
    setEditMode(false);
    setBulkDeleteConfirm(false);
    fire(`🗑 ${ids.length} booking${ids.length !== 1 ? "s" : ""} deleted`);
  };

  const bulkSetStatus = async (status) => {
    const ids = [...selectedIds];
    const { error } = await supabase.from("bookings").update({ status }).in("id", ids);
    if (error) { fire("❌ Error updating status"); return; }
    setBookings(p => p.map(b => selectedIds.has(b.id) ? { ...b, status } : b));
    if (selected && selectedIds.has(selected.id)) setSelected(s => ({ ...s, status }));
    fire(`✅ ${ids.length} booking${ids.length !== 1 ? "s" : ""} → ${status}`);
  };

  const toggleEditMode = () => {
    setEditMode(p => !p);
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  };

  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusCycle  = { pending:"approved", approved:"denied", denied:"pending", scheduled_call:"pending" };
  const waNum        = phone => { const d = (phone||"").replace(/\D/g,""); if(d.length===7) return `1242${d}`; if(d.length===10) return `1${d}`; return d; };
  const waBookingMsg = b => {
    const svcs = Array.isArray(b.service) ? b.service.join(", ") : (b.service || "Service");
    return encodeURIComponent(`Hi ${b.client}, this is EZ Tech Solutions. Your appointment for ${svcs} is confirmed for ${b.date} at ${b.time}. Contact us if you need to reschedule. 📞 (242) 805-0777`);
  };

  const submitChangePassword = async () => {
    if (!changePwForm.old) { setChangePwError("Enter your current password"); return; }
    if (changePwForm.newPw.length < 6) { setChangePwError("New password must be at least 6 characters"); return; }
    if (changePwForm.newPw !== changePwForm.confirm) { setChangePwError("New passwords don't match"); return; }
    const { data, error } = await supabase.rpc("change_admin_password", { old_pw: changePwForm.old, new_pw: changePwForm.newPw });
    if (error || !data) {
      setChangePwError("Incorrect current password");
    } else {
      fire("✅ Password updated!");
      setShowChangePwModal(false);
      setChangePwForm({ old:"", newPw:"", confirm:"" });
      setChangePwError("");
    }
  };

  // ── Service toggle helpers ─────────────────────────────────────────────
  const toggleService = (arr, id) =>
    arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  // ── Availability Helpers ───────────────────────────────────────────────
  const isClientBooked = (date, time) => {
    const slotH = timeToHour(time);
    return bookings.some(b => {
      if (b.date !== date || b.status !== "approved") return false;
      const bH = timeToHour(b.time); const dur = b.duration || 1;
      return slotH >= bH && slotH < bH + dur;
    });
  };

  const hasAdminConflict = (date, time, duration) => {
    if (!date || !time) return false;
    const startH = timeToHour(time); const endH = startH + (duration || 1);
    return bookings.some(b => {
      if (b.date !== date || (b.status !== "approved" && b.status !== "pending")) return false;
      const bH = timeToHour(b.time); const bEnd = bH + (b.duration || 1);
      return startH < bEnd && endH > bH;
    });
  };

  const dayMark = (ds) => {
    const day = bookings.filter(b => b.date === ds);
    if (day.some(b => b.status === "approved")) return "approved";
    if (day.some(b => b.status === "pending")) return "pending";
    return null;
  };

  const todayStr = fmtDate(now.getFullYear(), now.getMonth(), now.getDate());
  const next7Str = fmtDate(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const pendingCount = bookings.filter(b => b.status === "pending").length;
  const todayCount = bookings.filter(b => b.date === todayStr).length;
  const revenue = bookings
    .filter(b => b.status === "approved")
    .reduce((sum, b) => {
      if (b.price != null) return sum + b.price;
      return sum + svcList(b.service).reduce((s2, sv) => s2 + (sv.price || 0), 0);
    }, 0);
  const paidRevenue = bookings
    .filter(b => b.paid)
    .reduce((sum, b) => {
      if (b.price != null) return sum + b.price;
      return sum + svcList(b.service).reduce((s2, sv) => s2 + (sv.price || 0), 0);
    }, 0);
  const relativeDate = (ds) => {
    const diff = Math.round((new Date(ds + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return ds;
  };
  const filtered = bookings
    .filter(b => filter === "all" || b.status === filter)
    .filter(b => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return b.client.toLowerCase().includes(q) ||
             (b.phone || "").includes(search) ||
             (b.email || "").toLowerCase().includes(q);
    })
    .filter(b => !dateFrom || b.date >= dateFrom)
    .filter(b => !dateTo   || b.date <= dateTo)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Global Styles ──────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#050d1a;font-family:'Exo 2',sans-serif;}
    ::-webkit-scrollbar{width:5px;height:5px;}
    ::-webkit-scrollbar-track{background:#0a1628;}
    ::-webkit-scrollbar-thumb{background:#c9a227;border-radius:2px;}
    input,select,textarea{background:rgba(255,255,255,.05);border:1px solid rgba(201,162,39,.3);color:#e8e0cc;padding:11px 14px;font-family:'Exo 2',sans-serif;font-size:16px;width:100%;border-radius:3px;outline:none;transition:all .2s;}
    input:focus,select:focus,textarea:focus{border-color:#c9a227;box-shadow:0 0 0 2px rgba(201,162,39,.15);}
    select option{background:#0a1628;}
    .btn{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;cursor:pointer;border:none;border-radius:3px;transition:all .2s;padding:10px 18px;}
    .btn:hover{filter:brightness(1.15);transform:translateY(-1px);}
    .btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
    .gold{background:linear-gradient(135deg,#c9a227,#f0c040);color:#050d1a;}
    .ghost{background:transparent;border:1px solid rgba(201,162,39,.4);color:#c9a227;}
    .ghost:hover{background:rgba(201,162,39,.1);}
    .filter-btn:hover{border-color:#c9a227!important;color:#f0c040!important;background:rgba(201,162,39,.15)!important;}
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
    .timeslot{padding:9px 10px;border-radius:3px;cursor:pointer;font-size:14px;font-weight:600;text-align:center;border:1px solid rgba(201,162,39,.25);background:rgba(201,162,39,.05);color:#c9a227;transition:all .15s;}
    .timeslot:hover{background:rgba(201,162,39,.15);}
    .timeslot.sel{background:#c9a227;color:#050d1a;}
    .timeslot.taken{background:rgba(100,100,100,.1);border-color:rgba(100,100,100,.2);color:#555;cursor:not-allowed;text-decoration:line-through;}
    .cell{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:3px;cursor:pointer;font-size:17px;border:1px solid transparent;transition:all .15s;font-weight:500;}
    .cell:hover{border-color:rgba(201,162,39,.4);background:rgba(201,162,39,.08);}
    .cell.today{border-color:#c9a227;color:#c9a227;font-weight:700;}
    .cell.has-app{background:rgba(34,197,94,.18);color:#4ade80;}
    .cell.has-pen{background:rgba(245,158,11,.18);color:#fbbf24;}
    .cell.sel-day{background:#c9a227!important;color:#050d1a!important;font-weight:700;}
    .cell.disabled-past{opacity:.25;cursor:not-allowed;}
    .cell.blacked-out{background:rgba(239,68,68,.12);color:#f87171;border-color:rgba(239,68,68,.3);cursor:not-allowed;text-decoration:line-through;opacity:.6;}
    .row{padding:13px 14px;border-radius:4px;cursor:pointer;border:1px solid rgba(201,162,39,.1);background:rgba(201,162,39,.03);transition:all .15s;margin-bottom:8px;}
    .row:hover{background:rgba(201,162,39,.08);border-color:rgba(201,162,39,.3);}
    .row.active{background:rgba(201,162,39,.12);border-color:rgba(201,162,39,.5);}
    .logo-circle{width:42px;height:42px;border-radius:50%;border:2px solid #c9a227;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-weight:900;font-size:18px;color:#fff;background:linear-gradient(135deg,#1e3a5f,#0a1628);box-shadow:0 0 12px rgba(201,162,39,.4);flex-shrink:0;}
    .shake{animation:shake .4s ease;}
    @keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-6px);}40%{transform:translateX(6px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}
    .svc-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.25);border-radius:3px;font-size:13px;color:#c9a227;}
    .fs-error{font-size:13px;color:#f87171;margin-top:5px;display:block;}
    .side-col{width:220px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;position:sticky;top:20px;align-self:flex-start;}
    .side-photo{width:100%;border-radius:8px;object-fit:cover;border:1px solid rgba(201,162,39,.25);display:block;box-shadow:0 4px 18px rgba(0,0,0,.5);}
    @media(max-width:1080px){.side-col{display:none;}}
    .mobile-back{display:none;}
    .admin-detail{flex:1 1 340px;}
    @media(max-width:768px){
      .mobile-back{display:block;}
      .admin-panels{flex-direction:column!important;}
      .admin-list{border-right:none!important;}
      .admin-detail{display:none;}
      .admin-panels.has-sel .admin-list{display:none;}
      .admin-panels.has-sel .admin-detail{display:block!important;width:100%;}
      .filter-row{overflow-x:auto;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;padding-bottom:6px;}
      .filter-row .btn{flex-shrink:0;}
      .stats-bar{padding:10px 14px!important;gap:8px!important;}
      .stat-card{padding:10px 12px!important;flex:1 1 80px!important;}
      .stat-val{font-size:22px!important;}
      .admin-hdr-btns .btn{padding:7px 8px!important;font-size:13px!important;letter-spacing:1px!important;}
    }
    .filter-mobile-select{display:none!important;}
    @media(max-width:600px){
      .filter-mobile-select{display:block!important;flex:1;min-width:0;}
      .filter-desktop-btns{display:none!important;}
    }
    @media(max-width:480px){
      .admin-list,.admin-detail{padding:10px 12px!important;}
      .contact-grid{grid-template-columns:1fr!important;}
      .reschedule-grid{grid-template-columns:1fr!important;}
      .admin-hdr{padding:0px 12px!important;gap:8px!important;}
      .admin-hdr .logo-circle{width:34px!important;height:34px!important;font-size:17px!important;}
      .admin-tabs{padding:0 8px!important;}
      .admin-tabs>button{padding:12px 12px!important;font-size:13px!important;letter-spacing:1px!important;}
      .stats-bar{padding:8px 10px!important;gap:6px!important;}
      .stat-card{flex:1 1 60px!important;padding:7px 8px!important;min-width:0!important;}
      .stat-val{font-size:17px!important;}
      .stat-card>div:first-child{font-size:7px!important;}
    }
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
            <div style={{ fontSize:"clamp(9px,1.4vw,11px)", color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:"clamp(0.5px,0.2vw,1.5px)", marginBottom:4 }}>{label.toUpperCase()}</div>
            <a href={href} style={{ fontSize:"clamp(12px,2vw,15px)", color:"#8899aa", textDecoration:"none" }}>{value}</a>
          </div>
        ))}
      </div>
      <div style={{ fontSize:"clamp(10px,1.5vw,12px)", color:"#445566", letterSpacing:"clamp(0.3px,0.1vw,1px)", fontFamily:"'Orbitron',sans-serif" }}>
        © {new Date().getFullYear()} EZ Tech Solutions · All Rights Reserved · Powered by <a href="https://nueradigital.com/" target="_blank" rel="noopener noreferrer" style={{ color:"#60a5fa", textDecoration:"underline dotted" }}>Nuera Digital</a>
      </div>
      <div style={{ marginTop:6 }}>
        <a href="https://eztechbahamas.com/privacy" target="_blank" rel="noopener noreferrer" style={{ fontSize:"clamp(10px,1.5vw,12px)", color:"#ffffff", textDecoration:"underline dotted", textUnderlineOffset:"3px", fontFamily:"'Orbitron',sans-serif", letterSpacing:"clamp(0.3px,0.1vw,1px)" }}>Privacy Policy</a>
      </div>
    </div>
  );

  // ── Shared multi-service selector ──────────────────────────────────────
  // Used in both client step 2 and admin add modal
  const ServiceSelector = ({ selected: sel, onChange, compact = false }) => (
    <div style={{ display:"flex", flexDirection:"column", gap: compact ? 5 : 7 }}>
      {SERVICES.map(s => {
        const on = sel.includes(s.id);
        return (
          <div
            key={s.id}
            onClick={() => onChange(toggleService(sel, s.id))}
            style={{
              padding: compact ? "9px 12px" : "12px",
              borderRadius:4, cursor:"pointer",
              border: on ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.15)",
              background: on ? "rgba(201,162,39,.12)" : "rgba(201,162,39,.03)",
              display:"flex", alignItems:"center", gap: compact ? 10 : 12,
              transition:"all .15s",
            }}
          >
            <span style={{ fontSize: compact ? 18 : 22, flexShrink:0 }}>{s.icon}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, color: on ? "#f0c040" : "#e8e0cc", fontSize: compact ? 12 : 13 }}>{s.label}</div>
              {s.note && !compact && <div style={{ fontSize:13, color:"#c9a227", marginTop:2 }}>{s.note}</div>}
              {(s.id === "starlink" || s.id === "cctv_install") && !compact && <div style={{ fontSize:11, color:"#e8d9a0", marginTop:3, opacity:0.85 }}>50% non-refundable deposit required to book</div>}
            </div>
            <div style={{
              width:18, height:18, borderRadius:"50%", flexShrink:0,
              border: on ? "none" : "1px solid rgba(201,162,39,.3)",
              background: on ? "#c9a227" : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, color:"#050d1a", fontWeight:900,
              transition:"all .15s",
            }}>{on ? "✓" : ""}</div>
          </div>
        );
      })}
    </div>
  );

  // ── Admin Password Gate ────────────────────────────────────────────────
  const AdminGate = () => (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} className="circuit">
      <div className="card slide-in" style={{ width:"100%", maxWidth:380, padding:"36px 32px" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div className="logo-circle" style={{ width:56, height:56, fontSize:22, margin:"0 auto 14px" }}>EZ</div>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:17, fontWeight:900, color:"#fff", letterSpacing:2 }}>
            EZ TECH <span style={{ color:"#c9a227" }}>SOLUTIONS</span>
          </div>
          <div style={{ fontSize:13, color:"#7788aa", letterSpacing:2, marginTop:6, fontFamily:"'Orbitron',sans-serif" }}>ADMIN ACCESS</div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label htmlFor="admin-pw" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:6 }}>PASSWORD</label>
          <input
            id="admin-pw"
            ref={pwRef}
            type="password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false); }}
            onKeyDown={e => e.key === "Enter" && tryLogin()}
            placeholder="Enter admin password"
            autoFocus
            className={pwError ? "shake" : ""}
            style={ pwError ? { borderColor:"#ef4444", boxShadow:"0 0 0 2px rgba(239,68,68,.2)" } : {} }
          />
          {pwError && <div style={{ fontSize:13, color:"#f87171", marginTop:6 }}>Incorrect password. Try again.</div>}
        </div>
        <button className="btn gold" style={{ width:"100%", padding:"13px", fontSize:14, letterSpacing:2 }} onClick={tryLogin} disabled={loginLoading}>
          {loginLoading ? "VERIFYING…" : "UNLOCK DASHBOARD"}
        </button>
        <div style={{ textAlign:"center", marginTop:16 }}>
          <button onClick={goClient} style={{ background:"none", border:"none", color:"#556677", fontSize:13, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>
            ← Back to booking page
          </button>
        </div>
      </div>
    </div>
  );

  // ── Admin View ─────────────────────────────────────────────────────────
  const AdminView = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflowX:"hidden", width:"100%" }}>

      {/* Admin Header */}
      <div className="admin-hdr" style={{ position:"relative", padding:"12px 24px", borderBottom:"1px solid rgba(201,162,39,.2)", background:"linear-gradient(180deg,rgba(10,22,40,.95),rgba(10,22,40,.85))", display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
        <img src={`${import.meta.env.BASE_URL}assets/EZTECHLOGO-wide.png`} alt="EZ Tech" style={{ height:80, width:"auto", flexShrink:0 }} />
        <div style={{ position:"absolute", left:0, right:0, textAlign:"center", pointerEvents:"none" }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:20, fontWeight:900, color:"#f0c040", letterSpacing:2 }}>BOOKING MANAGER</div>
        </div>
        <div className="admin-hdr-btns" style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn ghost" style={{ padding:"8px 12px", fontSize:12 }} onClick={() => { setShowChangePwModal(true); setChangePwError(""); setChangePwForm({ old:"", newPw:"", confirm:"" }); }}>🔑 CHANGE PW</button>
          <button className="btn ghost" style={{ padding:"8px 12px", fontSize:12 }} onClick={() => { window.location.hash = "#/subscriptions"; }}>📱 SUBSCRIPTIONS</button>
          <button className="btn ghost" onClick={goClient}>👤 CLIENT VIEW</button>
          <button className="btn danger" style={{ padding:"10px 14px", fontSize:12 }} onClick={logout}>LOGOUT</button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar" style={{ padding:"16px 24px", display:"flex", gap:12, flexWrap:"wrap", borderBottom:"1px solid rgba(201,162,39,.1)" }}>
        {[
          { l:"TODAY",    v:todayCount,                                              c:"#a78bfa" },
          { l:"TOTAL",    v:bookings.length,                                         c:"#c9a227" },
          { l:"PENDING",  v:pendingCount,                                            c:"#f59e0b" },
          { l:"APPROVED", v:bookings.filter(b=>b.status==="approved").length,        c:"#22c55e" },
          { l:"CALLS",    v:bookings.filter(b=>b.status==="scheduled_call").length,  c:"#3b82f6" },
          { l:"REVENUE",  v:`$${revenue}`, sub: paidRevenue > 0 ? `$${paidRevenue} paid` : null, c:"#34d399" },
        ].map(s => (
          <div key={s.l} className="card stat-card" style={{ padding:"12px 18px", flex:"1 1 100px" }}>
            <div style={{ fontSize:11, letterSpacing:2, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", marginBottom:4 }}>{s.l}</div>
            <div className="stat-val" style={{ fontFamily:"'Orbitron',sans-serif", fontSize:24, fontWeight:900, color:s.c }}>
              {s.v}
              {s.l==="PENDING" && pendingCount > 0 && <span className="pulse" style={{ marginLeft:6, fontSize:16 }}>●</span>}
              {s.l==="TODAY" && todayCount > 0 && <span className="pulse" style={{ marginLeft:6, fontSize:16 }}>●</span>}
            </div>
            {s.sub && <div style={{ fontSize:11, color:"#34d399", marginTop:3, fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs" style={{ padding:"0 24px", display:"flex", borderBottom:"1px solid rgba(201,162,39,.15)", overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {[["bookings","📋 BOOKINGS"],["upcoming","🗓 UPCOMING"],["calendar","📅 CALENDAR"],["stats","📊 STATS"],["blackout","⛔ BLOCK DATES"]].map(([k,l]) => (
          <button key={k} onClick={() => setAdminTab(k)} style={{ padding:"14px 20px", background:"transparent", border:"none", borderBottom: adminTab===k ? "2px solid #c9a227" : "2px solid transparent", color: adminTab===k ? "#c9a227" : "#7788aa", fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, letterSpacing:1.5, cursor:"pointer", transition:"all .2s", flexShrink:0, whiteSpace:"nowrap" }}>{l}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", minHeight:0, display:"flex", flexDirection:"column" }}>
        {adminTab === "bookings" ? (

          // ── Bookings Tab ──────────────────────────────────────────────
          <div className={`admin-panels${selected ? " has-sel" : ""}`} style={{ display:"flex", flexWrap:"wrap", flex:1 }}>

            {/* List Panel */}
            <div className="admin-list" style={{ flex:"1 1 340px", padding:"16px 24px", borderRight:"1px solid rgba(201,162,39,.1)" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone or email…"
                style={{ marginBottom:10, fontSize:16, padding:"11px 14px" }}
              />
              <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
                {/* Desktop: filter buttons */}
                <div className="filter-desktop-btns filter-row" style={{ display:"flex", gap:6, flexWrap:"wrap", flex:1, minWidth:0 }}>
                  {[["all","ALL"],["pending","PENDING"],["approved","APPROVED"],["scheduled_call","CALLS"],["denied","DENIED"]].map(([k,l]) => (
                    <button key={k} onClick={() => setFilter(k)} className="btn filter-btn" style={{ padding:"8px 13px", fontSize:14, background: filter===k ? "rgba(201,162,39,.2)" : "transparent", border:"1px solid rgba(201,162,39,.3)", color: filter===k ? "#f0c040" : "#7788aa" }}>{l}</button>
                  ))}
                </div>
                {/* Mobile: filter dropdown */}
                <select className="filter-mobile-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ padding:"9px 10px", fontSize:15, flex:1, minWidth:0, textAlign:"center", textAlignLast:"center" }}>
                  {[["all","ALL"],["pending","PENDING"],["approved","APPROVED"],["scheduled_call","CALLS"],["denied","DENIED"]].map(([k,l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
                <button className="btn ghost" style={{ padding:"8px 10px", fontSize:13, flexShrink:0, color: editMode ? "#f0c040" : "#7788aa" }} onClick={toggleEditMode}>{editMode ? "DONE" : "SEL"}</button>
                {!editMode && (
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <button className="btn ghost" style={{ padding:"8px 10px", fontSize:13 }} onClick={() => setShowExportMenu(v => !v)}>⬇ EXP</button>
                    {showExportMenu && (
                      <>
                        <div style={{ position:"fixed", inset:0, zIndex:199 }} onClick={() => setShowExportMenu(false)} />
                        <div style={{ position:"absolute", top:"calc(100% + 4px)", right:0, zIndex:200, background:"#0a1628", border:"1px solid rgba(201,162,39,.3)", borderRadius:4, minWidth:150, boxShadow:"0 8px 24px rgba(0,0,0,.6)", overflow:"hidden" }}>
                          {[
                            { label:"⬇ Download CSV", action: () => { exportCSV(filtered, "bookings"); setShowExportMenu(false); } },
                            { label:"🖨 Download PDF", action: () => { exportPDF(); setShowExportMenu(false); } },
                          ].map(({ label, action }) => (
                            <button key={label} onClick={action} style={{ display:"block", width:"100%", padding:"12px 16px", background:"transparent", border:"none", borderBottom:"1px solid rgba(201,162,39,.1)", color:"#c9a227", fontSize:14, fontFamily:"'Orbitron',sans-serif", letterSpacing:.5, cursor:"pointer", textAlign:"left" }}
                              onMouseEnter={e => e.currentTarget.style.background="rgba(201,162,39,.1)"}
                              onMouseLeave={e => e.currentTarget.style.background="transparent"}
                            >{label}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!editMode && <button className="btn gold" style={{ padding:"8px 10px", fontSize:13, flexShrink:0 }} onClick={() => { setShowAddModal(true); setAdminConfirmOverlap(false); }}>＋</button>}
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize:15, padding:"9px 10px", colorScheme:"dark", flex:1, minWidth:0 }} title="From date" />
                <span style={{ fontSize:15, color:"#556677", flexShrink:0 }}>to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize:15, padding:"9px 10px", colorScheme:"dark", flex:1, minWidth:0 }} title="To date" />
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} disabled={!dateFrom && !dateTo} style={{ background: (dateFrom||dateTo) ? "rgba(201,162,39,.15)" : "transparent", border:`1px solid ${(dateFrom||dateTo) ? "rgba(201,162,39,.4)" : "rgba(100,100,100,.25)"}`, color:(dateFrom||dateTo) ? "#c9a227" : "#445566", fontSize:12, cursor:(dateFrom||dateTo) ? "pointer" : "default", flexShrink:0, padding:"9px 10px", borderRadius:3, fontFamily:"'Orbitron',sans-serif", letterSpacing:1, transition:"all .2s" }} title="Clear dates">CLEAR</button>
              </div>

              {editMode && filtered.length > 0 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, padding:"6px 4px" }}>
                  <button onClick={() => setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(b => b.id)))} style={{ background:"none", border:"none", color:"#c9a227", fontSize:15, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>
                    {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
                  </button>
                  <span style={{ fontSize:15, color:"#7788aa" }}>{selectedIds.size} selected</span>
                </div>
              )}

              {filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:40, color:"#556677" }}>No bookings</div>
              ) : filtered.map(b => {
                const svcs = svcList(b.service);
                const first = svcs[0] || { icon:"⚙️", label:"Unknown" };
                const extra = svcs.length - 1;
                const st = safeStatus(b.status);
                return (
                  <div
                    key={b.id}
                    className={"row " + (!editMode && selected?.id === b.id ? "active" : "") + (editMode && selectedIds.has(b.id) ? " active" : "")}
                    onClick={() => editMode ? toggleSelectId(b.id) : (() => { setSelected(b); setDeleteConfirm(false); setEditingNotes(false); setEditingPrice(false); setEditingDetails(false); setEditingAdminNote(false); setAdminNoteInput(""); })()}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      {editMode ? (
                        <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0, border: selectedIds.has(b.id) ? "none" : "1px solid rgba(201,162,39,.4)", background: selectedIds.has(b.id) ? "#c9a227" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#050d1a", fontWeight:900, transition:"all .15s" }}>
                          {selectedIds.has(b.id) ? "✓" : ""}
                        </div>
                      ) : (
                        <span style={{ fontSize:22 }}>{first.icon}</span>
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, color:"#e8e0cc", fontSize:18, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.client}</div>
                        <div style={{ fontSize:15, color:"#7788aa", marginTop:2, display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{first.label}</span>
                          {extra > 0 && <span style={{ flexShrink:0, padding:"1px 6px", background:"rgba(201,162,39,.15)", border:"1px solid rgba(201,162,39,.3)", borderRadius:3, fontSize:11, color:"#c9a227" }}>+{extra} more</span>}
                        </div>
                        <div style={{ fontSize:15, color:"#c9a227", marginTop:3, fontFamily:"'Orbitron',sans-serif" }}>{relativeDate(b.date)} · {b.time}</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); if (!editMode) updateStatus(b.id, statusCycle[b.status] ?? "pending"); }}
                          title={editMode ? "" : `Tap to → ${statusCycle[b.status] ?? "pending"}`}
                          style={{ padding:"3px 8px", borderRadius:3, fontSize:11, fontFamily:"'Orbitron',sans-serif", fontWeight:700, letterSpacing:1, color:st.color, background:st.bg, border:`1px solid ${st.border}`, whiteSpace:"nowrap", cursor: editMode ? "default" : "pointer" }}>
                          {st.label}
                        </button>
                        {!editMode && b.phone && (
                          <a href={`https://wa.me/${waNum(b.phone)}?text=${waBookingMsg(b)}`} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ padding:"4px 8px", borderRadius:3, background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.25)", color:"#25d366", fontSize:14, textDecoration:"none" }}>
                            💬
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bulk action bar */}
              {editMode && selectedIds.size > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", padding:"8px 10px", background:"rgba(201,162,39,.08)", border:"1px solid rgba(201,162,39,.25)", borderRadius:4, marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"#f0c040", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5, alignSelf:"center", flex:1 }}>{selectedIds.size} selected</span>
                    <button className="btn ok"    style={{ padding:"5px 10px", fontSize:11 }} onClick={() => bulkSetStatus("approved")}>✅ APPROVE</button>
                    <button className="btn danger" style={{ padding:"5px 10px", fontSize:11 }} onClick={() => bulkSetStatus("denied")}>❌ DENY</button>
                    <button className="btn ghost"  style={{ padding:"5px 10px", fontSize:11 }} onClick={() => exportCSV(bookings.filter(b => selectedIds.has(b.id)), "selected")}>⬇ CSV</button>
                    <button className="btn danger" style={{ padding:"5px 10px", fontSize:11 }} onClick={() => setBulkDeleteConfirm(true)}>🗑 DELETE</button>
                  </div>
                  {bulkDeleteConfirm && (
                    <div style={{ padding:"10px 12px", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:4 }}>
                      <div style={{ fontSize:13, color:"#fca5a5", marginBottom:8 }}>⚠️ Permanently delete {selectedIds.size} booking{selectedIds.size !== 1 ? "s" : ""}?</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="btn danger" style={{ flex:1, padding:"7px", fontSize:12 }} onClick={bulkDelete}>YES, DELETE</button>
                        <button className="btn ghost"  style={{ flex:1, padding:"7px", fontSize:12 }} onClick={() => setBulkDeleteConfirm(false)}>CANCEL</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Detail Panel */}
            <div className="admin-detail">
              {!selected ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"rgba(201,162,39,.3)", padding:40 }}>
                  <div style={{ fontSize:56, marginBottom:14 }}>📋</div>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, letterSpacing:2, textAlign:"center" }}>SELECT A BOOKING</div>
                </div>
              ) : (() => {
                const svcs = svcList(selected.service);
                const first = svcs[0] || { icon:"⚙️", label:"Unknown", price:0 };
                const st = safeStatus(selected.status);
                const totalPrice = svcs.reduce((sum, s) => sum + (s.price || 0), 0);
                const priceDisplay = totalPrice === 0 ? (svcs.some(s => s.note) ? svcs.map(s=>s.note).filter(Boolean)[0] : "Free") : `$${totalPrice}`;
                return (
                  <div style={{ padding:24 }} className="slide-in">

                    {/* Mobile back button */}
                    <div className="mobile-back" style={{ marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <button onClick={() => { setSelected(null); setDeleteConfirm(false); setEditingNotes(false); setEditingPrice(false); setEditingDetails(false); setEditingAdminNote(false); setAdminNoteInput(""); }} style={{ background:"none", border:"none", color:"#c9a227", fontSize:14, cursor:"pointer", fontFamily:"'Exo 2',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
                        ← Back to list
                      </button>
                      <button onClick={() => {
                        const services = Array.isArray(selected.service) ? selected.service.join(', ') : (selected.service || '—');
                        printDoc(`Booking — ${selected.client}`, `
                          <table>
                            <tr><th>Field</th><th>Details</th></tr>
                            <tr><td>Client</td><td>${selected.client}</td></tr>
                            <tr><td>Phone</td><td>${selected.phone || '—'}</td></tr>
                            <tr><td>Email</td><td>${selected.email || '—'}</td></tr>
                            <tr><td>Services</td><td>${services}</td></tr>
                            <tr><td>Date</td><td>${selected.date}</td></tr>
                            <tr><td>Time</td><td>${selected.time} (Nassau time)</td></tr>
                            <tr><td>Duration</td><td>${selected.duration || 1} hour${(selected.duration||1)!==1?'s':''}</td></tr>
                            <tr><td>Status</td><td>${selected.status}</td></tr>
                            <tr><td>Price</td><td>${selected.price != null ? '$'+selected.price : '—'}</td></tr>
                            <tr><td>Paid</td><td>${selected.paid ? 'Yes' : 'No'}</td></tr>
                            <tr><td>Notes</td><td>${selected.notes || '—'}</td></tr>
                          </table>`);
                      }} style={{ background:"none", border:"1px solid rgba(201,162,39,.4)", color:"#c9a227", fontSize:13, cursor:"pointer", fontFamily:"'Exo 2',sans-serif", padding:"5px 10px", borderRadius:4 }}>🖨 Print</button>
                    </div>

                    {/* Header */}
                    <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
                      <span style={{ fontSize:32, flexShrink:0 }}>{first.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:17, fontWeight:700, color:"#f0c040" }}>{selected.client}</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                          {svcs.map(s => (
                            <span key={s.id} className="svc-chip">{s.icon} {s.label}</span>
                          ))}
                        </div>
                      </div>
                      <span style={{ padding:"4px 10px", borderRadius:3, fontSize:12, fontFamily:"'Orbitron',sans-serif", fontWeight:700, letterSpacing:1, color:st.color, background:st.bg, border:`1px solid ${st.border}`, whiteSpace:"nowrap", flexShrink:0 }}>{st.label}</span>
                    </div>

                    {[
                      ["📅 Date",     selected.date],
                      ["🕐 Time",     selected.time],
                      ["📡 Source",   (() => { const src = SOURCES.find(s2 => s2.id === selected.source); return src ? `${src.icon} ${src.label}` : "🌐 Website"; })()],
                      ["⏱ Duration", `${selected.duration || 1} hour${(selected.duration || 1) !== 1 ? "s" : ""}`],
                    ].map(([l,v]) => (
                      <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid rgba(201,162,39,.1)", gap:10 }}>
                        <span style={{ fontSize:17, color:"#7788aa" }}>{l}</span>
                        <span style={{ fontSize:17, color:"#e8e0cc", fontWeight:500, textAlign:"right" }}>{v}</span>
                      </div>
                    ))}

                    {/* Editable client details */}
                    <div style={{ marginTop:10, padding:12, background:"rgba(201,162,39,.04)", border:"1px solid rgba(201,162,39,.12)", borderRadius:4 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <div style={{ fontSize:12, color:"#c9a227", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5 }}>CLIENT DETAILS</div>
                        {!editingDetails && (
                          <button onClick={() => { setDetailsForm({ client: selected.client || "", phone: selected.phone || "", email: selected.email || "", service: Array.isArray(selected.service) ? [...selected.service] : selected.service ? [selected.service] : [] }); setEditingDetails(true); }} style={{ background:"none", border:"none", color:"#c9a227", fontSize:13, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>✏️ Edit</button>
                        )}
                      </div>
                      {editingDetails ? (
                        <>
                          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                            <div>
                              <div style={{ fontSize:12, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:4 }}>NAME</div>
                              <input value={detailsForm.client} onChange={e => setDetailsForm(p => ({ ...p, client: e.target.value }))} style={{ fontSize:15, width:"100%" }} />
                            </div>
                            <div>
                              <div style={{ fontSize:12, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:4 }}>PHONE</div>
                              <input value={detailsForm.phone} onChange={e => setDetailsForm(p => ({ ...p, phone: e.target.value }))} style={{ fontSize:15, width:"100%" }} />
                            </div>
                            <div>
                              <div style={{ fontSize:12, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:4 }}>EMAIL</div>
                              <input value={detailsForm.email} onChange={e => setDetailsForm(p => ({ ...p, email: e.target.value }))} style={{ fontSize:15, width:"100%" }} />
                            </div>
                            <div>
                              <div style={{ fontSize:12, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:6 }}>SERVICES</div>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                                {SERVICES.map(s => {
                                  const checked = detailsForm.service.includes(s.id);
                                  return (
                                    <button key={s.id} type="button"
                                      onClick={() => setDetailsForm(p => ({ ...p, service: checked ? p.service.filter(x => x !== s.id) : [...p.service, s.id] }))}
                                      style={{ padding:"5px 10px", fontSize:13, borderRadius:3, cursor:"pointer", background: checked ? "rgba(201,162,39,.2)" : "transparent", border: checked ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.2)", color: checked ? "#f0c040" : "#556677" }}>
                                      {s.icon} {s.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:8, marginTop:10 }}>
                            <button className="btn gold" style={{ padding:"6px 14px", fontSize:12 }} onClick={() => { updateBooking(selected.id, { client: detailsForm.client, phone: detailsForm.phone, email: detailsForm.email, service: detailsForm.service }); setEditingDetails(false); }}>SAVE</button>
                            <button className="btn ghost" style={{ padding:"6px 14px", fontSize:12 }} onClick={() => setEditingDetails(false)}>CANCEL</button>
                          </div>
                        </>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:17 }}><span style={{ color:"#7788aa" }}>📞 Phone</span><span style={{ color:"#e8e0cc" }}>{selected.phone || "—"}</span></div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:17, paddingTop:4 }}><span style={{ color:"#7788aa" }}>✉️ Email</span><span style={{ color:"#e8e0cc", textAlign:"right", maxWidth:"65%", wordBreak:"break-all" }}>{selected.email || "—"}</span></div>
                        </div>
                      )}
                    </div>

                    {/* Editable Price */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid rgba(201,162,39,.1)", gap:10 }}>
                      <span style={{ fontSize:17, color:"#7788aa", flexShrink:0 }}>
                        💰 {selected.price != null ? "Price" : "Est. Price"}
                      </span>
                      {editingPrice ? (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:15, color:"#e8e0cc" }}>$</span>
                          <input
                            type="number"
                            min="0"
                            value={priceInput}
                            onChange={e => setPriceInput(e.target.value)}
                            style={{ width:90, fontSize:14, padding:"5px 8px" }}
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter") { updateBooking(selected.id, { price: priceInput === "" ? null : Number(priceInput) }); setEditingPrice(false); }
                              if (e.key === "Escape") setEditingPrice(false);
                            }}
                          />
                          <button className="btn gold" style={{ padding:"5px 10px", fontSize:12 }} onClick={() => { updateBooking(selected.id, { price: priceInput === "" ? null : Number(priceInput) }); setEditingPrice(false); }}>SAVE</button>
                          <button className="btn ghost" style={{ padding:"5px 10px", fontSize:12 }} onClick={() => setEditingPrice(false)}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:17, fontWeight:500, color: selected.price != null ? "#34d399" : "#e8e0cc" }}>
                            {selected.price != null ? `$${selected.price}` : priceDisplay}
                          </span>
                          {selected.price != null && (
                            <button onClick={() => { updateBooking(selected.id, { price: null }); }} style={{ background:"none", border:"none", color:"#556677", fontSize:12, cursor:"pointer" }} title="Clear custom price">✕</button>
                          )}
                          <button onClick={() => { setPriceInput(selected.price != null ? String(selected.price) : ""); setEditingPrice(true); }} style={{ background:"none", border:"none", color:"#c9a227", fontSize:13, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>✏️ Edit</button>
                        </div>
                      )}
                    </div>

                    {/* Paid toggle */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid rgba(201,162,39,.1)" }}>
                      <span style={{ fontSize:17, color:"#7788aa" }}>💳 Payment</span>
                      <button
                        onClick={() => updateBooking(selected.id, { paid: !selected.paid })}
                        style={{ padding:"4px 14px", fontSize:13, fontFamily:"'Orbitron',sans-serif", letterSpacing:.5, fontWeight:700, borderRadius:3, cursor:"pointer", transition:"all .15s",
                          background: selected.paid ? "rgba(52,211,153,.15)" : "transparent",
                          border: `1px solid ${selected.paid ? "#34d399" : "rgba(201,162,39,.3)"}`,
                          color: selected.paid ? "#34d399" : "#556677" }}
                      >{selected.paid ? "✓ PAID" : "MARK AS PAID"}</button>
                    </div>

                    {/* Client history */}
                    {(() => {
                      const history = bookings.filter(b => b.id !== selected.id && (b.phone === selected.phone || (selected.email && b.email === selected.email)));
                      if (history.length === 0) return null;
                      const last = history.sort((a,b) => b.date.localeCompare(a.date))[0];
                      return (
                        <div style={{ padding:"10px 12px", marginTop:10, background:"rgba(59,130,246,.06)", border:"1px solid rgba(59,130,246,.18)", borderRadius:4 }}>
                          <div style={{ fontSize:12, color:"#60a5fa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:4 }}>CLIENT HISTORY</div>
                          <div style={{ fontSize:14, color:"#93bbf0" }}>
                            {history.length} previous booking{history.length !== 1 ? "s" : ""} — last on {last.date}
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ marginTop:14, padding:14, background:"rgba(201,162,39,.05)", border:"1px solid rgba(201,162,39,.15)", borderRadius:8 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                        <div style={{ fontSize:15, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5 }}>NOTES</div>
                        {!editingNotes && (
                          <button onClick={() => { setNotesInput(selected.notes || ""); setEditingNotes(true); }} style={{ background:"none", border:"none", color:"#c9a227", fontSize:15, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>✏️ Edit</button>
                        )}
                      </div>
                      {editingNotes ? (
                        <>
                          <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} rows={4} style={{ fontSize:16, resize:"vertical", padding:"10px 12px", borderRadius:6 }} placeholder="Add notes…" />
                          <div style={{ display:"flex", gap:8, marginTop:10 }}>
                            <button className="btn gold" style={{ padding:"11px 18px", fontSize:15, borderRadius:8 }} onClick={() => { updateBooking(selected.id, { notes: notesInput }); setEditingNotes(false); }}>SAVE</button>
                            <button className="btn ghost" style={{ padding:"11px 18px", fontSize:15, borderRadius:8 }} onClick={() => setEditingNotes(false)}>CANCEL</button>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:16, color: selected.notes ? "#c8bfa8" : "#445566", fontStyle: selected.notes ? "normal" : "italic" }}>
                          {selected.notes || "No notes — click Edit to add"}
                        </div>
                      )}
                    </div>

                    {/* Admin-only note */}
                    <div style={{ marginTop:14, padding:14, background:"rgba(239,68,68,.05)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ fontSize:12, color:"#f87171", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5 }}>🔒 ADMIN NOTE</div>
                          <div style={{ fontSize:11, color:"#556677", fontStyle:"italic" }}>internal only</div>
                        </div>
                        {!editingAdminNote && (
                          <button onClick={() => { setAdminNoteInput(selected.admin_notes || ""); setEditingAdminNote(true); }} style={{ background:"none", border:"none", color:"#f87171", fontSize:13, cursor:"pointer", fontFamily:"'Exo 2',sans-serif" }}>✏️ Edit</button>
                        )}
                      </div>
                      {editingAdminNote ? (
                        <>
                          <textarea
                            rows={3}
                            value={adminNoteInput}
                            onChange={e => setAdminNoteInput(e.target.value)}
                            placeholder="Add an internal note about this booking…"
                            style={{ fontSize:15, resize:"vertical", padding:"10px 12px", borderRadius:6, width:"100%", borderColor:"rgba(239,68,68,.3)" }}
                            autoFocus
                          />
                          <div style={{ display:"flex", gap:8, marginTop:10 }}>
                            <button
                              className="btn"
                              disabled={adminNoteSending}
                              style={{ padding:"10px 18px", fontSize:13, borderRadius:6, background:"rgba(239,68,68,.15)", border:"1px solid rgba(239,68,68,.35)", color:"#f87171" }}
                              onClick={async () => {
                                setAdminNoteSending(true);
                                await updateBooking(selected.id, { admin_notes: adminNoteInput.trim() || null });
                                if (adminNoteInput.trim()) {
                                  const svcs = svcList(selected.service);
                                  await fetch("/api/send-admin-note-email", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      client: selected.client,
                                      phone: selected.phone,
                                      email: selected.email,
                                      services: svcs.map(s => s.label),
                                      date: selected.date,
                                      time: selected.time,
                                      duration: selected.duration || 1,
                                      status: selected.status,
                                      note: adminNoteInput.trim(),
                                    }),
                                  });
                                }
                                setAdminNoteSending(false);
                                setEditingAdminNote(false);
                              }}
                            >{adminNoteSending ? "SAVING…" : "SAVE & SEND"}</button>
                            <button className="btn ghost" style={{ padding:"10px 18px", fontSize:13, borderRadius:6 }} onClick={() => setEditingAdminNote(false)}>CANCEL</button>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:15, color: selected.admin_notes ? "#e8c8c8" : "#445566", fontStyle: selected.admin_notes ? "normal" : "italic" }}>
                          {selected.admin_notes || "No admin note — click Edit to add"}
                        </div>
                      )}
                    </div>

                    {/* Reschedule */}
                    <div style={{ marginTop:18, padding:16, background:"rgba(201,162,39,.04)", border:"1px solid rgba(201,162,39,.12)", borderRadius:8 }}>
                      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, letterSpacing:2, color:"#c9a227", marginBottom:14 }}>RESCHEDULE</div>
                      <div className="reschedule-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                        <div style={{ minWidth:0, paddingRight:10 }}>
                          <div style={{ fontSize:14, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", marginBottom:6 }}>DATE</div>
                          <input type="date" value={selected.date} onChange={e => updateBooking(selected.id, { date: e.target.value })} style={{ fontSize:16, padding:"11px 10px", colorScheme:"dark", width:"100%", borderRadius:6 }} />
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:14, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", marginBottom:6 }}>START TIME</div>
                          <select value={selected.time} onChange={e => updateBooking(selected.id, { time: e.target.value })} style={{ fontSize:16, padding:"11px 8px", borderRadius:6, width:"100%" }}>
                            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:14, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", marginBottom:8 }}>DURATION</div>
                        <div style={{ display:"flex", gap:4 }}>
                          {[1,2,3,4,5,6,7,8].map(h => {
                            const isSel = (selected.duration || 1) === h;
                            return <button key={h} type="button" onClick={() => updateBooking(selected.id, { duration: h })} className="btn" style={{ flex:1, padding:"10px 2px", fontSize:14, borderRadius:6, background: isSel ? "rgba(201,162,39,.25)" : "transparent", border: isSel ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.15)", color: isSel ? "#f0c040" : "#556677" }}>{h}h</button>;
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {(() => {
                      const ab = { fontSize:15, padding:"13px 18px", borderRadius:8, boxShadow:"0 3px 8px rgba(0,0,0,0.35)", letterSpacing:1, textAlign:"center" };
                      const sendBtnW = 80;
                      return (
                      <div style={{ marginTop:14, display:"grid", gridTemplateColumns:`1fr ${sendBtnW}px`, gap:10, alignItems:"start" }}>
                        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, letterSpacing:2, color:"#c9a227", gridColumn:"1/-1", marginBottom:-2 }}>ADMIN ACTIONS</div>
                        {selected.status === "pending" ? (
                          <>
                            <button className="btn ok"     style={{ ...ab, gridColumn:"1/-1" }} onClick={() => updateStatus(selected.id, "approved")}>✅ APPROVE BOOKING</button>
                            <button className="btn blue"   style={{ ...ab, gridColumn:"1/-1" }} onClick={() => updateStatus(selected.id, "scheduled_call")}>📞 SCHEDULE A CALL</button>
                            <button className="btn danger" style={{ ...ab, gridColumn:"1/-1" }} onClick={() => updateStatus(selected.id, "denied")}>❌ DENY BOOKING</button>
                          </>
                        ) : (
                          <button className="btn ghost" style={{ ...ab, gridColumn:"1/-1" }} onClick={() => updateStatus(selected.id, "pending")}>↩ RESET TO PENDING</button>
                        )}
                        {/* Contact dropdown — col 1 only, SEND in col 2 */}
                        <select value={contactAction} onChange={e => setContactAction(e.target.value)} style={{ fontSize:15, padding:"13px 12px", borderRadius:8, background:"transparent", border:"1px solid rgba(201,162,39,.4)", color:"#c9a227", fontFamily:"'Orbitron',sans-serif", fontWeight:700, letterSpacing:1, boxShadow:"0 3px 8px rgba(0,0,0,0.35)", cursor:"pointer", textAlign:"center", textAlignLast:"center", width:"100%" }}>
                          {selected.email && <option value="confirmation">📧 Resend Confirmation</option>}
                          {selected.email && <option value="reminder">📧 Send Reminder</option>}
                          {selected.phone && <option value="whatsapp">💬 WhatsApp Client</option>}
                        </select>
                        <button className="btn ghost" style={{ ...ab, padding:"13px 8px" }} onClick={() => {
                          if (contactAction === "confirmation") sendConfirmation(selected);
                          else if (contactAction === "reminder") sendReminder(selected);
                          else if (contactAction === "whatsapp") window.open(`https://wa.me/${waPhone(selected.phone)}?text=${encodeURIComponent(`Hi ${selected.client}, this is EZ Tech Solutions. We're reaching out about your ${Array.isArray(selected.service) ? selected.service[0] : selected.service} appointment on ${selected.date} at ${selected.time}. Please let us know if you have any questions.`)}`, "_blank");
                        }}>SEND</button>
                        <button className="btn ghost" style={{ ...ab, gridColumn:"1/-1" }} onClick={() => downloadBookingIcs(selected)}>📅 DOWNLOAD .ICS</button>
                        <div style={{ gridColumn:"1/-1" }}>
                          {deleteConfirm ? (
                            <div>
                              <div style={{ padding:10, background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8, fontSize:14, color:"#fca5a5", marginBottom:8 }}>
                                ⚠️ Permanently delete this booking?
                              </div>
                              <div style={{ display:"flex", gap:8 }}>
                                <button className="btn ghost"  style={{ ...ab, flex:1 }} onClick={() => setDeleteConfirm(false)}>CANCEL</button>
                                <button className="btn danger" style={{ ...ab, flex:1 }} onClick={() => deleteBooking(selected.id)}>YES, DELETE</button>
                              </div>
                            </div>
                          ) : (
                            <button className="btn danger" style={{ ...ab, width:"100%", opacity:.7 }} onClick={() => setDeleteConfirm(true)}>🗑 DELETE BOOKING</button>
                          )}
                        </div>
                      </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          </div>

        ) : adminTab === "upcoming" ? (

          // ── Upcoming Tab ──────────────────────────────────────────────
          (() => {
            const upcoming = bookings
              .filter(b => b.date >= todayStr && b.date <= next7Str && b.status !== "denied")
              .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
            return (
              <div style={{ flex:1, padding:24, overflowY:"auto" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:17, fontWeight:700, color:"#f0c040", letterSpacing:1.5 }}>NEXT 7 DAYS</div>
                  {upcoming.length > 0 && (
                    <button className="btn ghost" style={{ fontSize:14, padding:"6px 14px" }} onClick={() => {
                      const rows = upcoming.map(b => {
                        const diff = Math.round((new Date(b.date+"T00:00:00") - new Date(todayStr+"T00:00:00")) / 86400000);
                        const day = diff===0?"Today":diff===1?"Tomorrow":`In ${diff} days`;
                        const svcs = Array.isArray(b.service) ? b.service.join(', ') : (b.service||'—');
                        return `<tr><td>${b.date}<br/><small>${day}</small></td><td><strong>${b.client}</strong></td><td>${svcs}</td><td>${b.time}</td><td>${b.duration||1}h</td><td>${b.phone||'—'}</td><td>${b.status}</td></tr>`;
                      }).join('');
                      printDoc('Dispatch Sheet — Next 7 Days', `<table class="dispatch"><tr><th>Date</th><th>Client</th><th>Services</th><th>Time</th><th>Duration</th><th>Phone</th><th>Status</th></tr>${rows}</table>`);
                    }}>🖨 Print Dispatch</button>
                  )}
                </div>
                <div style={{ fontSize:16, color:"#7788aa", marginBottom:20 }}>{upcoming.length} appointment{upcoming.length !== 1 ? "s" : ""} coming up</div>
                {upcoming.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 0", color:"#445566", fontFamily:"'Orbitron',sans-serif", fontSize:15, letterSpacing:1 }}>NO UPCOMING APPOINTMENTS</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {upcoming.map(b => {
                      const diff = Math.round((new Date(b.date + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000);
                      const dayLabel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `In ${diff} days`;
                      const st = STATUS[b.status] || STATUS.pending;
                      return (
                        <div key={b.id} className="card" style={{ padding:"16px 20px", display:"flex", gap:16, alignItems:"flex-start", cursor:"pointer", border:`1px solid ${st.border}` }}
                          onClick={() => { setSelected(b); setDeleteConfirm(false); setAdminTab("bookings"); }}>
                          <div style={{ minWidth:64, textAlign:"center" }}>
                            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, color:"#c9a227", letterSpacing:1 }}>{b.date.slice(5).replace("-","/")}</div>
                            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color: diff === 0 ? "#f0c040" : "#e8e0cc", marginTop:3 }}>{dayLabel}</div>
                            <div style={{ fontSize:15, color:"#7788aa", marginTop:3 }}>{b.time}</div>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:17, color:"#e8e0cc", marginBottom:4 }}>{b.client}</div>
                            <div style={{ fontSize:15, color:"#7788aa", marginBottom:6 }}>{Array.isArray(b.service) ? b.service.join(", ") : b.service}</div>
                            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                              <span style={{ fontSize:14, color:st.color, background:st.bg, border:`1px solid ${st.border}`, borderRadius:3, padding:"3px 9px", fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>{st.label}</span>
                              {b.duration && <span style={{ fontSize:14, color:"#7788aa" }}>{b.duration}h</span>}
                              {b.phone && <span style={{ fontSize:14, color:"#7788aa" }}>{b.phone}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()

        ) : adminTab === "calendar" ? (

          // ── Calendar Tab ──────────────────────────────────────────────
          <div style={{ flex:1, padding:24, overflowY:"auto", display:"flex", gap:20, flexWrap:"wrap" }}>
            <div className="card" style={{ padding:20, minWidth:340, flex:"0 0 auto" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <button className="btn ghost" style={{ padding:"6px 14px", fontSize:18 }} onClick={() => { if(calM===0){setCalM(11);setCalY(y=>y-1);}else setCalM(m=>m-1); }}>‹</button>
                <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:17, fontWeight:700, color:"#f0c040" }}>{MONTHS[calM]} {calY}</span>
                <button className="btn ghost" style={{ padding:"6px 14px", fontSize:18 }} onClick={() => { if(calM===11){setCalM(0);setCalY(y=>y+1);}else setCalM(m=>m+1); }}>›</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,46px))", gap:4, marginBottom:4 }}>
                {DAYNAMES.map(d => <div key={d} style={{ textAlign:"center", fontFamily:"'Orbitron',sans-serif", fontSize:13, letterSpacing:1, color:"#c9a227", padding:"6px 0" }}>{d}</div>)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,46px))", gap:4 }}>
                {Array(firstDay(calY, calM)).fill(null).map((_,i) => <div key={`e${i}`} />)}
                {Array(daysInMonth(calY, calM)).fill(null).map((_,i) => {
                  const d = i+1; const ds = fmtDate(calY, calM, d); const mark = dayMark(ds);
                  let cls = "cell";
                  if (ds === todayStr)         cls += " today";
                  if (mark === "approved")     cls += " has-app";
                  else if (mark === "pending") cls += " has-pen";
                  if (selDay === ds)           cls += " sel-day";
                  return <div key={d} className={cls} onClick={() => setSelDay(ds === selDay ? null : ds)}>{d}</div>;
                })}
              </div>
              <div style={{ display:"flex", gap:18, marginTop:18, justifyContent:"center", flexWrap:"wrap" }}>
                {[["#4ade80","Approved"],["#fbbf24","Pending"]].map(([c,l]) => (
                  <div key={l} style={{ display:"flex", alignItems:"center", gap:7, fontSize:15, color:"#7788aa" }}>
                    <div style={{ width:13, height:13, borderRadius:3, background:c }} />{l}
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ flex:"1 1 240px", padding:18, minWidth:260, overflowY:"auto" }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, letterSpacing:2, color:"#c9a227", marginBottom:16 }}>
                {selDay ? `📅 ${selDay}` : "SELECT A DAY"}
              </div>
              {selDay ? (() => {
                const coveredSlots = {};
                bookings
                  .filter(b => b.date === selDay && (b.status === "approved" || b.status === "pending" || b.status === "scheduled_call"))
                  .forEach(b => {
                    const startH = timeToHour(b.time); const dur = b.duration || 1;
                    TIMES.forEach(t => { const h = timeToHour(t); if (h >= startH && h < startH + dur) coveredSlots[t] = b; });
                  });
                return (
                  <div>
                    {TIMES.map((t, idx) => {
                      const b = coveredSlots[t];
                      const isStart = b && timeToHour(b.time) === timeToHour(t);
                      const nextT = TIMES[idx + 1];
                      const isEnd = b && (!nextT || coveredSlots[nextT]?.id !== b.id);
                      const st = b ? safeStatus(b.status) : null;
                      return (
                        <div key={t} style={{ display:"flex", gap:8, minHeight:52 }}>
                          <div style={{ width:70, paddingTop:16, fontSize:13, color: !b || isStart ? "#556677" : "transparent", textAlign:"right", flexShrink:0, fontFamily:"'Orbitron',sans-serif", letterSpacing:.5 }}>{t}</div>
                          <div style={{ flex:1 }}>
                            {!b ? (
                              <div style={{ height:46, borderTop:"1px solid rgba(201,162,39,.07)" }} />
                            ) : (
                              <div style={{
                                height:"100%", minHeight:46,
                                background: st.bg, borderLeft: `2px solid ${st.border}`, borderRight: `1px solid ${st.border}`,
                                borderTop: isStart ? `1px solid ${st.border}` : "none",
                                borderBottom: isEnd ? `1px solid ${st.border}` : "none",
                                borderTopLeftRadius: isStart ? 4 : 0, borderTopRightRadius: isStart ? 4 : 0,
                                borderBottomLeftRadius: isEnd ? 4 : 0, borderBottomRightRadius: isEnd ? 4 : 0,
                                padding: isStart ? "8px 10px 4px" : "0 10px", cursor:"pointer",
                              }} onClick={() => { setSelected(b); setDeleteConfirm(false); setAdminTab("bookings"); }}>
                                {isStart && (() => {
                                  const svcs = svcList(b.service);
                                  const first = svcs[0] || { label:"Unknown" };
                                  const extra = svcs.length - 1;
                                  return (
                                    <>
                                      <div style={{ fontWeight:700, color:"#e8e0cc", fontSize:16, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.client}</div>
                                      <div style={{ fontSize:14, color:st.color, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                        {first.label}{extra > 0 ? ` +${extra}` : ""}
                                      </div>
                                      {(b.duration || 1) > 1 && <div style={{ fontSize:13, color:"#7788aa", marginTop:2 }}>⏱ {b.duration}h</div>}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : <div style={{ color:"#556677", padding:20, textAlign:"center", fontSize:15 }}>Click a day to see bookings</div>}
            </div>
          </div>

        ) : adminTab === "blackout" ? (

          // ── Block Dates Tab ──────────────────────────────────────────
          <div style={{ padding:24, maxWidth:520 }}>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>⛔ BLOCK DATES</div>
            <div style={{ fontSize:14, color:"#7788aa", marginBottom:20 }}>Blocked dates are completely unavailable to clients — no time slots will be shown.</div>

            {/* Add form */}
            <div style={{ padding:16, background:"rgba(239,68,68,.05)", border:"1px solid rgba(239,68,68,.2)", borderRadius:8, marginBottom:20 }}>
              <div style={{ fontSize:12, color:"#f87171", fontFamily:"'Orbitron',sans-serif", letterSpacing:1.5, marginBottom:12 }}>ADD BLOCKED DATE</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <div style={{ fontSize:12, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:5 }}>DATE *</div>
                  <input type="date" value={blackoutInput} onChange={e => setBlackoutInput(e.target.value)} style={{ fontSize:15, padding:"10px", colorScheme:"dark", width:"100%", borderRadius:6, borderColor:"rgba(239,68,68,.3)" }} />
                </div>
                <div>
                  <div style={{ fontSize:12, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:5 }}>REASON (OPTIONAL)</div>
                  <input type="text" value={blackoutReason} onChange={e => setBlackoutReason(e.target.value)} placeholder="e.g. Travel, Public holiday, Team event…" style={{ fontSize:15, padding:"10px", width:"100%", borderRadius:6 }} />
                </div>
                <button
                  className="btn"
                  disabled={!blackoutInput || blackoutSaving || blackoutDates.some(b => b.date === blackoutInput)}
                  style={{ padding:"11px", fontSize:13, borderRadius:6, background: blackoutInput ? "rgba(239,68,68,.15)" : "transparent", border:"1px solid rgba(239,68,68,.35)", color: blackoutInput ? "#f87171" : "#556677" }}
                  onClick={async () => {
                    setBlackoutSaving(true);
                    const { error } = await supabase.from("blackout_dates").insert({ date: blackoutInput, reason: blackoutReason.trim() || null });
                    if (error) { fire("❌ Error blocking date"); } else { setBlackoutInput(""); setBlackoutReason(""); fire("⛔ Date blocked"); }
                    setBlackoutSaving(false);
                  }}
                >{blackoutSaving ? "SAVING…" : blackoutDates.some(b => b.date === blackoutInput) && blackoutInput ? "ALREADY BLOCKED" : "⛔ BLOCK DATE"}</button>
              </div>
            </div>

            {/* List */}
            {blackoutDates.length === 0 ? (
              <div style={{ textAlign:"center", color:"#445566", fontSize:14, padding:"20px 0", fontStyle:"italic" }}>No dates blocked — clients can book any available day.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {blackoutDates.map(b => (
                  <div key={b.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:"rgba(239,68,68,.05)", border:"1px solid rgba(239,68,68,.18)", borderRadius:6, gap:10 }}>
                    <div>
                      <div style={{ fontWeight:600, color:"#f0c040", fontSize:15 }}>{b.date}</div>
                      {b.reason && <div style={{ fontSize:13, color:"#7788aa", marginTop:2 }}>{b.reason}</div>}
                    </div>
                    <button
                      onClick={async () => { await supabase.from("blackout_dates").delete().eq("id", b.id); fire("✅ Date unblocked"); }}
                      style={{ background:"none", border:"1px solid rgba(239,68,68,.3)", color:"#f87171", fontSize:12, padding:"5px 10px", borderRadius:4, cursor:"pointer", flexShrink:0 }}
                    >REMOVE</button>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : (

          // ── Stats Tab ────────────────────────────────────────────────
          (() => {
            const last12 = Array.from({length:12}, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
              const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
              return { key, label: MONTHS[d.getMonth()].slice(0,3), year: d.getFullYear() };
            });
            const monthStats = last12.map(({ key, label, year }) => {
              const mb = bookings.filter(b => b.date && b.date.startsWith(key));
              const rev = mb.filter(b => b.status === "approved").reduce((s, b) => s + (b.price != null ? b.price : svcList(b.service).reduce((s2,sv) => s2+(sv.price||0),0)), 0);
              const paid = mb.filter(b => b.paid).reduce((s, b) => s + (b.price != null ? b.price : svcList(b.service).reduce((s2,sv) => s2+(sv.price||0),0)), 0);
              return { key, label, year, total: mb.length, rev, paid };
            });
            const maxRev = Math.max(...monthStats.map(m => m.rev), 1);
            const totalRev = monthStats.reduce((s,m) => s+m.rev, 0);
            const totalPaid = monthStats.reduce((s,m) => s+m.paid, 0);
            const avgRev = Math.round(totalRev / 12);
            const bestMonth = monthStats.reduce((a,b) => b.rev > a.rev ? b : a, monthStats[0]);
            const approvedCount = bookings.filter(b => b.status === "approved").length;
            const approvalRate = bookings.length ? Math.round((approvedCount / bookings.length) * 100) : 0;
            return (
              <div style={{ flex:1, padding:24, overflowY:"auto" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:17, fontWeight:700, color:"#f0c040", letterSpacing:1.5 }}>REVENUE — LAST 12 MONTHS</div>
                  <button className="btn ghost" style={{ fontSize:14, padding:"6px 14px" }} onClick={() => {
                    const rows = monthStats.map(m => `<tr><td>${m.label} ${m.year}</td><td>${m.total}</td><td>$${m.rev}</td><td>$${m.paid}</td></tr>`).join('');
                    printDoc('Revenue Report — Last 12 Months', `
                      <div class="stat-grid">
                        <div class="stat-card"><div class="stat-label">12-MONTH REVENUE</div><div class="stat-val">$${totalRev}</div></div>
                        <div class="stat-card"><div class="stat-label">TOTAL PAID</div><div class="stat-val">$${totalPaid}</div></div>
                        <div class="stat-card"><div class="stat-label">MONTHLY AVG</div><div class="stat-val">$${avgRev}</div></div>
                        <div class="stat-card"><div class="stat-label">BEST MONTH</div><div class="stat-val">${bestMonth.label} $${bestMonth.rev}</div></div>
                        <div class="stat-card"><div class="stat-label">APPROVAL RATE</div><div class="stat-val">${approvalRate}%</div></div>
                        <div class="stat-card"><div class="stat-label">TOTAL BOOKINGS</div><div class="stat-val">${bookings.length}</div></div>
                      </div>
                      <table style="margin-top:24px"><tr><th>Month</th><th>Bookings</th><th>Revenue</th><th>Paid</th></tr>${rows}</table>`);
                  }}>🖨 Print Report</button>
                </div>
                <div style={{ fontSize:16, color:"#7788aa", marginBottom:20 }}>Gold = approved revenue · Green overlay = paid</div>

                {/* Bar chart — horizontally scrollable on mobile */}
                <div className="card" style={{ padding:"20px 16px 10px", marginBottom:20, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:180, minWidth:660 }}>
                    {monthStats.map(m => (
                      <div key={m.key} style={{ flex:1, minWidth:44, display:"flex", flexDirection:"column", alignItems:"center", gap:3, height:"100%" }}>
                        <div style={{ flex:1, width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                          {m.rev > 0 && (
                            <div style={{ fontSize:13, color:"#e8e0cc", textAlign:"center", marginBottom:4, fontFamily:"'Orbitron',sans-serif" }}>${m.rev >= 1000 ? `${(m.rev/1000).toFixed(1)}k` : m.rev}</div>
                          )}
                          <div style={{ width:"100%", height:`${Math.max((m.rev/maxRev)*130, m.rev > 0 ? 4 : 0)}px`, background:"rgba(201,162,39,.35)", borderRadius:"2px 2px 0 0", position:"relative", overflow:"hidden", transition:"height .3s" }}>
                            {m.paid > 0 && (
                              <div style={{ position:"absolute", bottom:0, width:"100%", height:`${(m.paid/m.rev)*100}%`, background:"rgba(52,211,153,.55)", borderRadius:"2px 2px 0 0" }} />
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize:13, color:"#ffffff", fontFamily:"'Orbitron',sans-serif", textAlign:"center", letterSpacing:.3, marginTop:2 }}>{m.label}</div>
                        {m.total > 0 && <div style={{ fontSize:13, color:"#c9a227", textAlign:"center", fontWeight:700 }}>{m.total}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary cards */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                  {[
                    { l:"12-MONTH REVENUE", v:`$${totalRev}`, c:"#c9a227" },
                    { l:"TOTAL PAID",       v:`$${totalPaid}`, c:"#34d399" },
                    { l:"MONTHLY AVG",      v:`$${avgRev}`, c:"#a78bfa" },
                    { l:"BEST MONTH",       v:`${bestMonth.label} $${bestMonth.rev}`, c:"#f0c040" },
                    { l:"APPROVAL RATE",    v:`${approvalRate}%`, c:"#22c55e" },
                    { l:"TOTAL BOOKINGS",   v:bookings.length, c:"#c9a227" },
                  ].map(s => (
                    <div key={s.l} className="card" style={{ padding:"16px 18px" }}>
                      <div style={{ fontSize:13, letterSpacing:1.5, color:"#7788aa", fontFamily:"'Orbitron',sans-serif", marginBottom:6 }}>{s.l}</div>
                      <div style={{ fontSize:24, fontWeight:900, color:s.c, fontFamily:"'Orbitron',sans-serif" }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()

        )}
      </div>

      {/* Add Appointment Modal */}
      {showAddModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setShowAddModal(false)}>
          <div className="card slide-in" style={{ width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", padding:24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5 }}>ADD APPOINTMENT</div>
              <button className="btn ghost" style={{ padding:"4px 10px", fontSize:14 }} onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label htmlFor="admin-name" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>FULL NAME *</label>
                <input id="admin-name" value={adminForm.name} onChange={e => setAdminForm({...adminForm, name:e.target.value})} placeholder="Client name" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label htmlFor="admin-phone" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>PHONE *</label>
                  <input id="admin-phone" type="tel" value={adminForm.phone} onChange={e => setAdminForm({...adminForm, phone:formatPhone(e.target.value)})} placeholder="(242) 555-0000" />
                </div>
                <div>
                  <label htmlFor="admin-email" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>EMAIL</label>
                  <input id="admin-email" type="email" value={adminForm.email} onChange={e => setAdminForm({...adminForm, email:e.target.value})} placeholder="email@example.com" />
                </div>
              </div>

              {/* Multi-service selector */}
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <label style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif" }}>SERVICES *</label>
                  {adminForm.services.length > 0 && (
                    <span style={{ fontSize:12, color:"#c9a227", fontFamily:"'Orbitron',sans-serif" }}>{adminForm.services.length} selected</span>
                  )}
                </div>
                <div style={{ maxHeight:220, overflowY:"auto", paddingRight:2 }}>
                  {ServiceSelector({ selected: adminForm.services, onChange: v => setAdminForm({...adminForm, services:v}), compact: true })}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label htmlFor="admin-date" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>DATE *</label>
                  <input id="admin-date" type="date" value={adminForm.date} onChange={e => { setAdminForm({...adminForm, date:e.target.value}); setAdminConfirmOverlap(false); }} style={{ colorScheme:"dark" }} />
                </div>
                <div>
                  <label htmlFor="admin-time" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>TIME *</label>
                  <select id="admin-time" value={adminForm.time} onChange={e => { setAdminForm({...adminForm, time:e.target.value}); setAdminConfirmOverlap(false); }}>
                    <option value="">Select time…</option>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:8 }}>SOURCE *</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {SOURCES.map(src => (
                    <button key={src.id} type="button" onClick={() => setAdminForm({...adminForm, source:src.id})} className="btn" style={{ padding:"7px 12px", fontSize:12, background: adminForm.source === src.id ? "rgba(201,162,39,.25)" : "transparent", border: adminForm.source === src.id ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.2)", color: adminForm.source === src.id ? "#f0c040" : "#7788aa" }}>{src.icon} {src.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:8 }}>DURATION *</label>
                <div style={{ display:"flex", gap:5 }}>
                  {[1,2,3,4,5,6,7,8].map(h => (
                    <button key={h} type="button" onClick={() => { setAdminForm({...adminForm, duration:h}); setAdminConfirmOverlap(false); }} className="btn" style={{ flex:1, padding:"7px 2px", fontSize:12, background: adminForm.duration === h ? "rgba(201,162,39,.25)" : "transparent", border: adminForm.duration === h ? "1px solid #c9a227" : "1px solid rgba(201,162,39,.2)", color: adminForm.duration === h ? "#f0c040" : "#7788aa" }}>{h}h</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:8 }}>INITIAL STATUS</label>
                <div style={{ display:"flex", gap:6 }}>
                  {[
                    { k:"pending",        l:"PENDING",  bg:"rgba(245,158,11,.2)",  border:"#f59e0b", c:"#fbbf24" },
                    { k:"approved",       l:"APPROVED", bg:"rgba(34,197,94,.2)",   border:"#22c55e", c:"#4ade80" },
                    { k:"scheduled_call", l:"CALL",     bg:"rgba(59,130,246,.2)",  border:"#3b82f6", c:"#60a5fa" },
                  ].map(({k,l,bg,border,c}) => (
                    <button key={k} type="button" onClick={() => setAdminForm({...adminForm, status:k})} className="btn" style={{ padding:"7px 10px", fontSize:12, flex:1, background: adminForm.status === k ? bg : "transparent", border: adminForm.status === k ? `1px solid ${border}` : "1px solid rgba(201,162,39,.2)", color: adminForm.status === k ? c : "#7788aa" }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"12px", background:"rgba(201,162,39,.05)", border:"1px solid rgba(201,162,39,.15)", borderRadius:4 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <label style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif" }}>RECURRING</label>
                  <button type="button" onClick={() => setRecurringOn(r => !r)}
                    style={{ padding:"5px 14px", fontSize:13, fontFamily:"'Orbitron',sans-serif", letterSpacing:.5, fontWeight:700, borderRadius:3, cursor:"pointer", transition:"all .15s",
                      background: recurringOn ? "rgba(201,162,39,.2)" : "transparent",
                      border: `1px solid ${recurringOn ? "#c9a227" : "rgba(201,162,39,.3)"}`,
                      color: recurringOn ? "#f0c040" : "#556677" }}
                  >{recurringOn ? "✓ ON" : "OFF"}</button>
                </div>
                {recurringOn && (
                  <div style={{ display:"flex", gap:6 }}>
                    {[{ l:"Weekly", v:7 },{ l:"2 Weeks", v:14 },{ l:"Monthly", v:30 }].map(({ l, v }) => (
                      <button key={v} type="button" onClick={() => setRecurInterval(v)} className="btn"
                        style={{ flex:1, padding:"6px 4px", fontSize:12,
                          background: recurInterval === v ? "rgba(201,162,39,.2)" : "transparent",
                          border: `1px solid ${recurInterval === v ? "#c9a227" : "rgba(201,162,39,.2)"}`,
                          color: recurInterval === v ? "#f0c040" : "#7788aa" }}
                      >{l}</button>
                    ))}
                  </div>
                )}
                {recurringOn && <div style={{ fontSize:12, color:"#556677" }}>A second pending booking will be auto-created {recurInterval} days after this one.</div>}
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <label style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif" }}>PAYMENT</label>
                <button type="button" onClick={() => setAdminForm({...adminForm, paid:!adminForm.paid})}
                  style={{ padding:"5px 14px", fontSize:13, fontFamily:"'Orbitron',sans-serif", letterSpacing:.5, fontWeight:700, borderRadius:3, cursor:"pointer", transition:"all .15s",
                    background: adminForm.paid ? "rgba(52,211,153,.15)" : "transparent",
                    border: `1px solid ${adminForm.paid ? "#34d399" : "rgba(201,162,39,.3)"}`,
                    color: adminForm.paid ? "#34d399" : "#556677" }}
                >{adminForm.paid ? "✓ PAID" : "MARK AS PAID"}</button>
              </div>
              <div>
                <label htmlFor="admin-notes" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>NOTES</label>
                <textarea id="admin-notes" rows={2} value={adminForm.notes} onChange={e => setAdminForm({...adminForm, notes:e.target.value})} placeholder="Additional notes, location, or special requirements…" />
              </div>
            </div>

            {hasAdminConflict(adminForm.date, adminForm.time, adminForm.duration) && !adminConfirmOverlap && (
              <div style={{ marginTop:12, padding:10, background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:4, fontSize:13, color:"#fca5a5" }}>
                ⚠️ This time slot overlaps with an existing booking.
              </div>
            )}

            {adminConfirmOverlap ? (
              <div style={{ marginTop:16 }}>
                <div style={{ padding:13, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.35)", borderRadius:4, fontSize:14, color:"#fca5a5", marginBottom:12 }}>
                  ⚠️ This appointment overlaps with an existing booking. Are you sure?
                </div>
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button className="btn ghost" onClick={() => setAdminConfirmOverlap(false)}>NO, GO BACK</button>
                  <button className="btn danger" onClick={submitAdminBooking}>YES, ADD ANYWAY</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
                <button className="btn ghost" onClick={() => setShowAddModal(false)}>CANCEL</button>
                <button className="btn gold" disabled={!adminForm.name || !adminForm.phone || !adminForm.services.length || !adminForm.date || !adminForm.time || !adminForm.source} onClick={() => {
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

      {/* Change Password Modal */}
      {showChangePwModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setShowChangePwModal(false)}>
          <div className="card slide-in" style={{ width:"100%", maxWidth:400, padding:28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5 }}>🔑 CHANGE PASSWORD</div>
              <button className="btn ghost" style={{ padding:"4px 10px", fontSize:14 }} onClick={() => setShowChangePwModal(false)}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label htmlFor="cpw-old" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>CURRENT PASSWORD *</label>
                <input id="cpw-old" type="password" value={changePwForm.old} onChange={e => { setChangePwForm(f => ({...f, old:e.target.value})); setChangePwError(""); }} placeholder="Enter current password" autoFocus />
              </div>
              <div>
                <label htmlFor="cpw-new" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>NEW PASSWORD *</label>
                <input id="cpw-new" type="password" value={changePwForm.newPw} onChange={e => { setChangePwForm(f => ({...f, newPw:e.target.value})); setChangePwError(""); }} placeholder="Min. 6 characters" />
              </div>
              <div>
                <label htmlFor="cpw-confirm" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>CONFIRM NEW PASSWORD *</label>
                <input id="cpw-confirm" type="password" value={changePwForm.confirm} onChange={e => { setChangePwForm(f => ({...f, confirm:e.target.value})); setChangePwError(""); }} placeholder="Re-enter new password" onKeyDown={e => e.key === "Enter" && submitChangePassword()} />
              </div>
              {changePwError && (
                <div style={{ padding:"9px 12px", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:4, fontSize:13, color:"#fca5a5" }}>
                  ⚠️ {changePwError}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
              <button className="btn ghost" onClick={() => setShowChangePwModal(false)}>CANCEL</button>
              <button className="btn gold" disabled={!changePwForm.old || !changePwForm.newPw || !changePwForm.confirm} onClick={submitChangePassword}>UPDATE PASSWORD</button>
            </div>
          </div>
        </div>
      )}

      {SiteFooter({ light: true })}
    </div>
  );

  // ── Client View ────────────────────────────────────────────────────────
  const ClientView = () => {
    const canNext1 = form.firstName && form.lastName && validEmail(form.email) && validPhone(form.phone);
    const canNext2 = form.services.length > 0;
    const canNext3 = form.date && form.time;

    return (
      <div style={{ minHeight:"100vh" }} className="circuit">

        {/* Client Header */}
        <div style={{
          position:"sticky", top:0, zIndex:100,
          background:"linear-gradient(180deg,rgba(5,13,26,.97),rgba(10,22,40,.93))",
          borderBottom:"1px solid rgba(201,162,39,.25)",
          backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
          padding:"2px clamp(8px,1.5vw,16px)",
          display:"flex", alignItems:"center", justifyContent:"center", gap:"clamp(10px,2vw,20px)"
        }}>
          <img src={`${import.meta.env.BASE_URL}assets/EZTECHLOGO-wide.png`} alt="EZ Tech Solutions" style={{ height:80, width:"auto", flexShrink:0 }} />
          <div style={{ fontSize:"clamp(15px,3vw,24px)", fontWeight:900, color:"#c9a227", letterSpacing:"clamp(1px,0.4vw,3px)", fontStyle:"italic" }}>
            Providing Fast and Quality Services
          </div>
        </div>

        <div style={{ display:"flex", gap:16, alignItems:"flex-start", maxWidth:1260, margin:"0 auto", padding:"24px 16px" }}>

          {/* Left photo column */}
          <div className="side-col">
            <img className="side-photo" src={`${import.meta.env.BASE_URL}assets/pexels-lukasz-klimkiewicz-42373578-7364948.jpg`} alt="Security camera on ceiling" style={{ height:200 }} />
            <img className="side-photo" src={`${import.meta.env.BASE_URL}assets/pexels-life-7463021.jpg`} alt="Security camera on wall" style={{ height:260 }} />
            <img className="side-photo" src={`${import.meta.env.BASE_URL}assets/pexels-atypeek-5966513.jpg`} alt="Dome security camera" style={{ height:220 }} />
          </div>

          <div style={{ flex:1, maxWidth:560, minWidth:0, margin:"0 auto" }}>

          {submitted ? (
            <div className="card" style={{ padding:30, textAlign:"center" }}>
              <div style={{ fontSize:60, marginBottom:14 }}>✅</div>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:20, fontWeight:900, color:"#f0c040", marginBottom:10, letterSpacing:1.5 }}>BOOKING RECEIVED</div>
              <div style={{ color:"#c8bfa8", marginBottom:8, fontSize:16 }}>Thank you, <span style={{ color:"#c9a227", fontWeight:700 }}>{form.firstName}</span>!</div>
              <div style={{ color:"#7788aa", fontSize:15, marginBottom:18 }}>
                Your request for{" "}
                <strong style={{ color:"#e8e0cc" }}>{form.services.map(id => svc(id).label).join(", ")}</strong>
                {" "}on <strong style={{ color:"#e8e0cc" }}>{form.date}</strong> at <strong style={{ color:"#e8e0cc" }}>{form.time}</strong> has been submitted.
              </div>
              <div style={{ padding:14, background:"rgba(201,162,39,.08)", border:"1px solid rgba(201,162,39,.2)", borderRadius:4, marginBottom:18, fontSize:14, color:"#c8bfa8" }}>
                Our team will review your request and contact you at <strong style={{ color:"#c9a227" }}>{form.phone}</strong> to <strong>approve</strong>, <strong>schedule a call</strong>, or <strong>follow up</strong>.
              </div>
              <div style={{ fontSize:13, color:"#7788aa", marginBottom:18 }}>📞 {CONTACT.phone} · ✉️ {CONTACT.email}</div>
              <button className="btn gold" onClick={resetClient}>BOOK ANOTHER SERVICE</button>
            </div>
          ) : (
            <>
              {/* Hero CTA */}
              <div style={{ textAlign:"center", marginBottom:28 }}>
                <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:"clamp(22px,6vw,36px)", fontWeight:900, color:"#fff", letterSpacing:"clamp(1px,0.4vw,3px)", lineHeight:1.15, marginBottom:10 }}>
                  APPOINTMENT <span style={{ color:"#c9a227" }}>BOOKING</span>
                </div>
                <div style={{ width:48, height:3, background:"linear-gradient(90deg,#c9a227,#f0c040)", borderRadius:2, margin:"0 auto 14px" }} />
                <div style={{ fontSize:"clamp(13px,2.5vw,15px)", color:"#8899aa", lineHeight:1.6 }}>
                  Book your tech service in minutes.<br />
                  <span style={{ color:"#c9a227", fontStyle:"italic" }}>Select a service · Pick a time · We confirm.</span>
                </div>
              </div>

              {/* Step Progress */}
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", marginBottom:20 }}>
                {[{n:1,label:"Info"},{n:2,label:"Service"},{n:3,label:"Date"},{n:4,label:"Confirm"}].map(({n,label}) => (
                  <div key={n} style={{ display:"flex", alignItems:"flex-start" }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700, background: step >= n ? "#c9a227" : "transparent", color: step >= n ? "#050d1a" : "#556677", border: step >= n ? "none" : "1px solid #556677" }}>{n}</div>
                      <div style={{ fontSize:11, color: step >= n ? "#c9a227" : "#556677", fontFamily:"'Orbitron',sans-serif", letterSpacing:0.5, whiteSpace:"nowrap" }}>{label}</div>
                    </div>
                    {n < 4 && <div style={{ width:20, height:1, background: step > n ? "#c9a227" : "#556677", marginTop:14 }} />}
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding:22 }}>

                {/* Step 1 — Contact Info */}
                {step === 1 && (
                  <div className="slide-in">
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>YOUR INFORMATION</div>
                    <div style={{ fontSize:14, color:"#7788aa", marginBottom:18 }}>Step 1 of 4 · Tell us about yourself</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      <div style={{ display:"flex", gap:10 }}>
                        <div style={{ flex:1 }}>
                          <label htmlFor="cl-fname" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>FIRST NAME *</label>
                          <input id="cl-fname" value={form.firstName} onChange={e => setForm({...form, firstName:e.target.value})} placeholder="John" />
                        </div>
                        <div style={{ flex:1 }}>
                          <label htmlFor="cl-lname" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>LAST NAME *</label>
                          <input id="cl-lname" value={form.lastName} onChange={e => setForm({...form, lastName:e.target.value})} placeholder="Smith" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="cl-email" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>EMAIL *</label>
                        <input id="cl-email" type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="you@email.com" />
                        {form.email && !validEmail(form.email) && <div style={{ fontSize:13, color:"#f87171", marginTop:4 }}>Please enter a valid email address.</div>}
                      </div>
                      <div>
                        <label htmlFor="cl-phone" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>PHONE *</label>
                        <input id="cl-phone" type="tel" value={form.phone} onChange={e => setForm({...form, phone:formatPhone(e.target.value)})} placeholder="(242) 555-0000" />
                        {form.phone && !validPhone(form.phone) && <div style={{ fontSize:13, color:"#f87171", marginTop:4 }}>Format: (242) 555-0000</div>}
                      </div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20 }}>
                      <button className="btn gold" disabled={!canNext1} onClick={() => setStep(2)}>NEXT →</button>
                    </div>
                  </div>
                )}

                {/* Step 2 — Service Multi-Select */}
                {step === 2 && (
                  <div className="slide-in">
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>SELECT SERVICES</div>
                    <div style={{ fontSize:14, color:"#7788aa", marginBottom:16 }}>Step 2 of 4 · Select one or more services</div>

                    <div style={{ maxHeight:420, overflowY:"auto", paddingRight:2 }}>
                      {ServiceSelector({ selected: form.services, onChange: v => setForm({...form, services:v}) })}
                    </div>

                    {/* Selected summary bar */}
                    {form.services.length > 0 && (
                      <div style={{ marginTop:12, padding:"9px 13px", background:"rgba(201,162,39,.08)", border:"1px solid rgba(201,162,39,.25)", borderRadius:4, display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:13, color:"#c9a227", fontFamily:"'Orbitron',sans-serif", flexShrink:0 }}>{form.services.length} SELECTED</span>
                        <div style={{ flex:1, fontSize:13, color:"#8899aa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {form.services.map(id => svc(id).label).join(" · ")}
                        </div>
                      </div>
                    )}

                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:14 }}>
                      <button className="btn ghost" onClick={() => setStep(1)}>← BACK</button>
                      <button className="btn gold" disabled={!canNext2} onClick={() => setStep(3)}>NEXT →</button>
                    </div>
                  </div>
                )}

                {/* Step 3 — Date & Time */}
                {step === 3 && (
                  <div className="slide-in">
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>PICK A DATE & TIME</div>
                    <div style={{ fontSize:14, color:"#7788aa", marginBottom:16 }}>Step 3 of 4 · Select a date, then pick an available time slot</div>
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <button className="btn ghost" style={{ padding:"5px 10px" }} onClick={() => { if(calM===0){setCalM(11);setCalY(y=>y-1);}else setCalM(m=>m-1); }}>‹</button>
                        <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700, color:"#f0c040" }}>{MONTHS[calM]} {calY}</span>
                        <button className="btn ghost" style={{ padding:"5px 10px" }} onClick={() => { if(calM===11){setCalM(0);setCalY(y=>y+1);}else setCalM(m=>m+1); }}>›</button>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:3 }}>
                        {DAYNAMES.map(d => <div key={d} style={{ textAlign:"center", fontFamily:"'Orbitron',sans-serif", fontSize:11, letterSpacing:1, color:"#c9a227", padding:"4px 0" }}>{d}</div>)}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
                        {Array(firstDay(calY, calM)).fill(null).map((_,i) => <div key={`e${i}`} />)}
                        {Array(daysInMonth(calY, calM)).fill(null).map((_,i) => {
                          const d = i+1; const ds = fmtDate(calY, calM, d); const mark = dayMark(ds);
                          const isPast = ds < todayStr;
                          const isBlackedOut = blackoutDates.some(b => b.date === ds);
                          let cls = "cell";
                          if (ds === todayStr)         cls += " today";
                          if (mark === "approved")     cls += " has-app";
                          else if (mark === "pending") cls += " has-pen";
                          if (isPast)                  cls += " disabled-past";
                          if (isBlackedOut)            cls += " blacked-out";
                          if (form.date === ds)        cls += " sel-day";
                          return <div key={d} className={cls} onClick={() => !isPast && !isBlackedOut && setForm({...form, date:ds, time:""})}>{d}</div>;
                        })}
                      </div>
                      <div style={{ display:"flex", gap:12, marginTop:10, justifyContent:"center", flexWrap:"wrap", fontSize:12, color:"#7788aa" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:9, height:9, background:"#4ade80", borderRadius:2 }} />Booked</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:9, height:9, background:"#fbbf24", borderRadius:2 }} />Pending</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:9, height:9, border:"1px solid #c9a227", borderRadius:2 }} />Today</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:9, height:9, background:"rgba(239,68,68,.3)", borderRadius:2 }} />Unavailable</div>
                      </div>
                    </div>
                    {form.date && (
                      <div>
                        <div style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", marginBottom:4 }}>AVAILABLE TIMES · {form.date}</div>
                        <div style={{ fontSize:12, color:"#556677", marginBottom:8 }}>All times are Nassau time (EST, UTC−5){form.services.some(id => ["starlink","cctv_install"].includes(id)) ? " · Installation bookings: 10:00 AM – 3:00 PM only" : ""}</div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                          {(form.services.some(id => ["starlink","cctv_install"].includes(id))
                            ? CLIENT_TIMES.filter(t => { const h = timeToHour(t); return h >= 10 && h <= 15; })
                            : CLIENT_TIMES
                          ).map(t => {
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
                    <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>REVIEW & SUBMIT</div>
                    <div style={{ fontSize:14, color:"#7788aa", marginBottom:16 }}>Step 4 of 4 · Confirm your booking</div>
                    <div style={{ background:"rgba(201,162,39,.05)", border:"1px solid rgba(201,162,39,.2)", borderRadius:4, padding:16, marginBottom:14 }}>
                      {[
                        ["NAME",  `${form.firstName} ${form.lastName}`.trim()],
                        ["EMAIL", form.email],
                        ["PHONE", form.phone],
                        ["DATE",  form.date],
                        ["TIME",  form.time],
                      ].map(([l,v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid rgba(201,162,39,.1)", gap:10 }}>
                          <span style={{ fontSize:12, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif" }}>{l}</span>
                          <span style={{ fontSize:15, color:"#e8e0cc", fontWeight:500, textAlign:"right" }}>{v}</span>
                        </div>
                      ))}
                      {/* Services block */}
                      <div style={{ padding:"7px 0" }}>
                        <span style={{ fontSize:12, color:"#7788aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:6 }}>SERVICES</span>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          {form.services.map(id => {
                            const s = svc(id);
                            return (
                              <div key={id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ fontSize:16 }}>{s.icon}</span>
                                <span style={{ fontSize:15, color:"#e8e0cc", fontWeight:500 }}>{s.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="cl-notes" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>ADDITIONAL NOTES (OPTIONAL)</label>
                      <textarea id="cl-notes" rows={3} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Tell us about your project, location, or any special requirements..." />
                    </div>
                    {form.services.includes("starlink") && (
                      <div style={{ marginTop:14, padding:14, background:"rgba(201,162,39,.07)", border:"1px solid rgba(201,162,39,.35)", borderRadius:4, fontSize:13, color:"#e8d9a0", lineHeight:1.6 }}>
                        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1.5, color:"#c9a227", marginBottom:6 }}>DEPOSIT REQUIRED — STARLINK INSTALLATION</div>
                        A <strong>50% non-refundable deposit</strong> is required to secure your Starlink system and confirm your installation appointment. This deposit is applied toward the total cost of your service and guarantees equipment allocation and scheduling on your behalf. Our team will provide payment instructions upon approval of your booking.
                      </div>
                    )}
                    {form.services.includes("cctv_install") && (
                      <div style={{ marginTop:14, padding:14, background:"rgba(201,162,39,.07)", border:"1px solid rgba(201,162,39,.35)", borderRadius:4, fontSize:13, color:"#e8d9a0", lineHeight:1.6 }}>
                        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1.5, color:"#c9a227", marginBottom:6 }}>DEPOSIT REQUIRED — SECURITY CAMERA INSTALLATION</div>
                        A <strong>50% non-refundable deposit</strong> is required to confirm your custom security system order and secure your installation appointment. Your system is tailored to your property to ensure full coverage, and this deposit guarantees equipment procurement and scheduling on your behalf. Our team will provide payment instructions upon approval of your booking.
                      </div>
                    )}
                    <div style={{ marginTop:14, padding:11, background:"rgba(59,130,246,.08)", border:"1px solid rgba(59,130,246,.2)", borderRadius:4, fontSize:13, color:"#93bbf0" }}>
                      ℹ️ After submitting, our team will review your request and reach out to <strong>approve</strong>, <strong>schedule a call</strong>, or follow up.
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
                      <button className="btn ghost" onClick={() => setStep(3)}>← BACK</button>
                      <button className="btn gold" onClick={submitBooking} disabled={submitting}>{submitting ? "SUBMITTING…" : "✓ SUBMIT BOOKING"}</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Contact Form ─────────────────────────────────────────── */}
          <div style={{ marginTop:28 }}>
            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:22 }}>
              <div style={{ flex:1, height:1, background:"rgba(201,162,39,.2)" }} />
              <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, letterSpacing:2.5, color:"#556677", whiteSpace:"nowrap" }}>OR SEND US A MESSAGE</span>
              <div style={{ flex:1, height:1, background:"rgba(201,162,39,.2)" }} />
            </div>

            <div className="card" style={{ padding:22 }}>
              {contactSucceeded ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ fontSize:52, marginBottom:12 }}>✉️</div>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:17, fontWeight:900, color:"#f0c040", letterSpacing:1.5, marginBottom:8 }}>MESSAGE SENT</div>
                  <div style={{ fontSize:15, color:"#c8bfa8" }}>Thanks! We'll get back to you shortly.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:700, color:"#f0c040", letterSpacing:1.5, marginBottom:4 }}>CONTACT US</div>
                  <div style={{ fontSize:14, color:"#7788aa", marginBottom:18 }}>Have a question or need a quote? Drop us a message.</div>

                  <form onSubmit={handleContactSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <div>
                      <label htmlFor="cf-name" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>FULL NAME *</label>
                      <input id="cf-name" type="text" value={contactForm.name} onChange={e => setContactForm({...contactForm, name:e.target.value})} placeholder="John Smith" required />
                    </div>

                    <div className="contact-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      <div>
                        <label htmlFor="cf-email" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>EMAIL *</label>
                        <input id="cf-email" type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email:e.target.value})} placeholder="you@email.com" required />
                      </div>
                      <div>
                        <label htmlFor="cf-phone" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>PHONE</label>
                        <input id="cf-phone" type="tel" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone:formatPhone(e.target.value)})} placeholder="(242) 555-0000" required />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cf-message" style={{ fontSize:13, color:"#c9a227", letterSpacing:1, fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:5 }}>MESSAGE *</label>
                      <textarea id="cf-message" value={contactForm.message} onChange={e => setContactForm({...contactForm, message:e.target.value})} rows={4} placeholder="Tell us how we can help…" required />
                    </div>

                    {contactError && (
                      <div style={{ padding:"9px 12px", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", borderRadius:4, fontSize:13, color:"#fca5a5" }}>
                        ⚠️ Something went wrong. Please try again.
                      </div>
                    )}

                    <button type="submit" className="btn gold" style={{ padding:"13px", fontSize:14, letterSpacing:2 }} disabled={contactSubmitting}>
                      {contactSubmitting ? "SENDING…" : "SEND MESSAGE →"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          <div style={{ textAlign:"center", marginTop:28, paddingBottom:8 }}>
            <img src={`${import.meta.env.BASE_URL}assets/EZTECHLOGO-wide.png`} alt="EZ Tech Solutions" style={{ height:"clamp(60px, 14vw, 100px)", width:"auto" }} />
          </div>
          </div>{/* end center column */}

          {/* Right photo column */}
          <div className="side-col">
            <img className="side-photo" src={`${import.meta.env.BASE_URL}assets/architectural-lighting.png`} alt="Architectural lighting" style={{ height:220 }} />
            <img className="side-photo" src={`${import.meta.env.BASE_URL}assets/pexels-brett-sayles-2881224.jpg`} alt="Network switch with cables" style={{ height:220 }} />
            <img className="side-photo" src={`${import.meta.env.BASE_URL}assets/pexels-vladimirsrajber-13963756.jpg`} alt="Network switch with LEDs" style={{ height:220 }} />
          </div>

        </div>{/* end 3-col wrapper */}

        {SiteFooter({})}

        {/* WhatsApp floating button */}
        <a
          href="https://wa.me/message/NXWSA4R4RGQBH1"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position:"fixed", bottom:24, right:24, zIndex:999,
            width:56, height:56, borderRadius:"50%",
            background:"#25d366",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 16px rgba(37,211,102,.5)",
            transition:"transform .2s, box-shadow .2s",
            textDecoration:"none",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform="scale(1.1)"; e.currentTarget.style.boxShadow="0 6px 22px rgba(37,211,102,.7)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="0 4px 16px rgba(37,211,102,.5)"; }}
          title="Chat with us on WhatsApp"
        >
          <svg viewBox="0 0 32 32" width="30" height="30" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2C8.268 2 2 8.268 2 16c0 2.482.672 4.808 1.845 6.805L2 30l7.388-1.818A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.826-1.593l-.418-.248-4.385 1.079 1.107-4.278-.273-.44A11.45 11.45 0 0 1 4.5 16C4.5 9.596 9.596 4.5 16 4.5S27.5 9.596 27.5 16 22.404 27.5 16 27.5zm6.29-8.372c-.344-.172-2.036-1.004-2.352-1.118-.316-.115-.546-.172-.776.172-.23.344-.89 1.118-1.09 1.348-.2.23-.402.258-.746.086-.344-.172-1.452-.535-2.767-1.707-1.022-.912-1.712-2.038-1.913-2.382-.2-.344-.021-.53.15-.7.155-.154.344-.402.516-.603.172-.2.23-.344.344-.573.115-.23.058-.43-.029-.603-.086-.172-.776-1.872-1.063-2.563-.28-.672-.564-.58-.776-.59l-.66-.011c-.23 0-.603.086-.918.43-.316.344-1.205 1.177-1.205 2.869 0 1.692 1.233 3.326 1.405 3.556.172.23 2.427 3.706 5.879 5.197.822.355 1.463.567 1.963.726.824.263 1.574.226 2.167.137.66-.099 2.036-.832 2.323-1.636.287-.803.287-1.491.2-1.636-.086-.144-.316-.23-.66-.402z"/>
          </svg>
        </a>
      </div>
    );
  };

  // ── Root Render ────────────────────────────────────────────────────────
  if (loading && mode !== "subscriptions") return (
    <div style={{ minHeight:"100vh", background:"#050d1a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }} className="circuit">
      <style>{css}</style>
      <div className="logo-circle" style={{ width:60, height:60, fontSize:24 }}>EZ</div>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:14, color:"#c9a227", letterSpacing:3 }} className="pulse">LOADING…</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#050d1a", color:"#e8e0cc", overflowX:"hidden", maxWidth:"100vw" }} className="circuit">
      <style>{css}</style>
      {toast && (
        <div className="slide-in" style={{ position:"fixed", top:20, right:20, zIndex:9999, padding:"12px 20px", background:"linear-gradient(135deg,#c9a227,#f0c040)", color:"#050d1a", borderRadius:4, fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700, letterSpacing:1, boxShadow:"0 8px 24px rgba(0,0,0,.4)" }}>
          {toast}
        </div>
      )}
      {mode === "subscriptions"
        ? <SubscriptionsAdmin onGoClient={goClient} />
        : mode === "admin"
          ? (adminAuthed ? AdminView() : AdminGate())
          : ClientView()
      }
    </div>
  );
}
