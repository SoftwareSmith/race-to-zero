import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./tailwind.css";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found");
}

document.documentElement.classList.add("scroll-smooth");
document.body.classList.add(
  "min-h-screen",
  "min-w-80",
  "bg-[#050608]",
  "bg-[radial-gradient(circle_at_12%_10%,rgba(255,255,255,0.03),transparent_20%),radial-gradient(circle_at_88%_0%,rgba(255,255,255,0.02),transparent_18%)]",
  "font-sans",
  "text-stone-100",
  "antialiased",
  "[font-synthesis:none]",
  "[-webkit-font-smoothing:antialiased]",
  "[-moz-osx-font-smoothing:grayscale]",
  "selection:bg-sky-400/28",
  "selection:text-stone-50",
);
rootElement.classList.add("min-h-screen");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
