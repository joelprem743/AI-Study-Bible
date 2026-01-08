// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/scrollbar.css";
import "./index.css";
import { HashRouter } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { NotesProvider } from "./context/NotesContext";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find root element");



ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <NotesProvider>
          <App />
        </NotesProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);

