import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PreferencesOverlay from "./components/PreferencesOverlay";
import { LanguageProvider } from "./lib/i18n";
import "./styles.css";
import "./effects.css";
import "./preferences.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider><App /><PreferencesOverlay /></LanguageProvider>
  </React.StrictMode>,
);
