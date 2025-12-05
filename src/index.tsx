// src/main.tsx (or index.tsx)
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/scrollbar.css";
import { AuthProvider } from "./context/AuthContext";
import { NotesProvider } from "./context/NotesContext";   // <-- IMPORTANT
import { useAuth } from "./context/AuthContext";

function Root() {
  const { user } = useAuth();
  return (
    <NotesProvider userId={user?.id ?? null}>
      <App />
    </NotesProvider>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find root element");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
