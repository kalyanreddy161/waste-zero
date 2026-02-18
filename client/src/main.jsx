import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { UserProvider } from "./Services/UserContext";
import { LoadingProvider } from "./Services/LoadingContext";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <BrowserRouter>
        <LoadingProvider>
          <UserProvider>
            <App />
          </UserProvider>
        </LoadingProvider>
      </BrowserRouter>
  </React.StrictMode>
);
