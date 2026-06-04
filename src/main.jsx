import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ReschedulePage from "./ReschedulePage.jsx";

const rescheduleId = new URLSearchParams(window.location.search).get("reschedule");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {rescheduleId ? <ReschedulePage bookingId={rescheduleId} /> : <App />}
  </StrictMode>
);
