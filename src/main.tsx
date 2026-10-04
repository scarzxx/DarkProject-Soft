import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PreferencesOverlay from "./components/PreferencesOverlay";
import "./styles.css";
import "./preferences.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <PreferencesOverlay />
  </React.StrictMode>,
);
