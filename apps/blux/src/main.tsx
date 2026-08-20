import { createRoot } from "react-dom/client";
import "@gallery/shared/styles.css";
import { Root } from "./App";

// No <React.StrictMode>: BluxProvider runs createConfig() in a mount effect
// without a cleanup, and StrictMode's double-mount would initialize the Blux
// modal host twice in dev.
createRoot(document.getElementById("root")!).render(<Root />);
