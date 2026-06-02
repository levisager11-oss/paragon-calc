import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EmbedCalculator from "./components/EmbedCalculator.jsx";
import "./components/EmbedCalculator.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <EmbedCalculator />
  </StrictMode>
);
