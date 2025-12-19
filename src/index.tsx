// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/scrollbar.css";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { NotesProvider } from "./context/NotesContext";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find root element");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <NotesProvider>
        <App />
      </NotesProvider>
    </AuthProvider>
  </React.StrictMode>
);
