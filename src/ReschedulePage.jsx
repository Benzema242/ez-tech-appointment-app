import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const CLIENT_TIMES = ["10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#050d1a;font-family:'Exo 2',sans-serif;}
  input,select{background:rgba(255,255,255,.05);border:1px solid rgba(201,162,39,.3);color:#e8e0cc;padding:11px 14px;font-family:'Exo 2',sans-serif;font-size:16px;width:100%;border-radius:3px;outline:none;transition:all .2s;}
  input:focus,select:focus{border-color:#c9a227;box-shadow:0 0 0 2px rgba(201,162,39,.15);}
  select option{background:#0a1628;}
  .btn{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;cursor:pointer;border:none;border-radius:3px;transition:all .2s;padding:10px 18px;}
  .btn:disabled{opacity:.4;cursor:not-allowed;}
  .gold{background:linear-gradient(135deg,#c9a227,#f0c040);color:#050d1a;}
  .circuit{background-image:linear-gradient(rgba(201,162,39,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,162,39,.03) 1px,transparent 1px);background-size:40px 40px;}
  .card{background:rgba(10,22,40,.95);border:1px solid rgba(201,162,39,.2);border-radius:6px;}
  .logo-circle{width:42px;height:42px;border-radius:50%;border:2px solid #c9a227;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-weight:900;font-size:18px;color:#fff;background:linear-gradient(135deg,#1e3a5f,#0a1628);box-shadow:0 0 12px rgba(201,162,39,.4);}
  .pulse{animation:p 1.8s infinite;}
  @keyframes p{0%,100%{opacity:1;}50%{opacity:.4;}}
  .slide-in{animation:sl .25s ease;}
  @keyframes sl{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
`;

export default function ReschedulePage({ bookingId }) {
  const [status, setStatus]   = useState("loading"); // loading | form | submitting | success | not-found | error
  const [booking, setBooking] = useState(null);
  const [form, setForm]       = useState({ date: "", time: "10:00 AM" });

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    supabase.from("bookings").select("*").eq("id", bookingId).single()
      .then(({ data, error }) => {
        if (error || !data) { setStatus("not-found"); return; }
        if (data.status === "cancelled" || data.status === "denied") { setStatus("error"); return; }
        setBooking(data);
        setStatus("form");
      })
      .catch(() => setStatus("not-found"));
  }, [bookingId]);

  const submit = async () => {
    if (!form.date || !form.time) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/reschedule-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookingId, date: form.date, time: form.time }),
      });
      setStatus(res.ok ? "success" : "form");
    } catch {
      setStatus("form");
    }
  };

  const svcList = booking
    ? (Array.isArray(booking.service) ? booking.service.join(", ") : booking.service || "—")
    : "";

  return (
    <div style={{ minHeight: "100vh", background: "#050d1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} className="circuit">
      <style>{css}</style>
      <div className="card slide-in" style={{ width: "100%", maxWidth: 440, padding: "36px 32px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="logo-circle" style={{ width: 56, height: 56, fontSize: 22, margin: "0 auto 14px" }}>EZ</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>
            EZ TECH <span style={{ color: "#c9a227" }}>SOLUTIONS</span>
          </div>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <div style={{ textAlign: "center", color: "#7788aa", fontSize: 14 }} className="pulse">Loading your booking…</div>
        )}

        {/* Not found */}
        {status === "not-found" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
            <div style={{ color: "#f87171", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Booking not found</div>
            <div style={{ color: "#7788aa", fontSize: 13 }}>This reschedule link may be invalid or expired.</div>
            <p style={{ marginTop: 16, fontSize: 13, color: "#c9a227" }}>📞 (242) 805-0777</p>
          </div>
        )}

        {/* Can't reschedule */}
        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "#f87171", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Can't reschedule</div>
            <div style={{ color: "#7788aa", fontSize: 13 }}>This booking has been cancelled or denied. Please contact us to book a new appointment.</div>
            <a href="https://booking.eztechbahamas.com" style={{ display: "inline-block", marginTop: 20, padding: "10px 24px", background: "#c9a227", color: "#050d1a", borderRadius: 4, textDecoration: "none", fontWeight: 700, fontSize: 13, fontFamily: "'Orbitron',sans-serif" }}>Book New Appointment</a>
          </div>
        )}

        {/* Form */}
        {(status === "form" || status === "submitting") && booking && (
          <>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 700, color: "#f0c040", letterSpacing: 1, marginBottom: 16, textAlign: "center" }}>🔄 RESCHEDULE APPOINTMENT</div>

            <div style={{ padding: "12px 16px", background: "rgba(201,162,39,.06)", border: "1px solid rgba(201,162,39,.15)", borderRadius: 4, marginBottom: 20, fontSize: 13 }}>
              <div style={{ color: "#7788aa", marginBottom: 4 }}>Current appointment</div>
              <div style={{ color: "#e8e0cc", fontWeight: 600 }}>{svcList}</div>
              <div style={{ color: "#556677", marginTop: 2 }}>{booking.date} · {booking.time}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#c9a227", letterSpacing: 1, fontFamily: "'Orbitron',sans-serif", display: "block", marginBottom: 5 }}>NEW DATE *</label>
                <input type="date" min={todayStr} value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ colorScheme: "dark" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#c9a227", letterSpacing: 1, fontFamily: "'Orbitron',sans-serif", display: "block", marginBottom: 5 }}>NEW TIME *</label>
                <select value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}>
                  {CLIENT_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <button className="btn gold" style={{ width: "100%", padding: "13px", fontSize: 14, letterSpacing: 1, marginTop: 22 }}
              disabled={!form.date || status === "submitting"}
              onClick={submit}>
              {status === "submitting" ? "SENDING REQUEST…" : "REQUEST NEW TIME"}
            </button>
            <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#445566" }}>
              Your request will be reviewed and confirmed by our team.
            </div>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>REQUEST SENT!</div>
            <div style={{ color: "#c8bfa8", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Your reschedule request for <strong style={{ color: "#f0c040" }}>{form.date}</strong> at <strong style={{ color: "#f0c040" }}>{form.time}</strong> has been received. We'll confirm your new time shortly.
            </div>
            <div style={{ fontSize: 13, color: "#c9a227" }}>📞 (242) 805-0777 · info@ez-techgroup.com</div>
          </div>
        )}

      </div>
    </div>
  );
}
