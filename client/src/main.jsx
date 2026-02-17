import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { UserProvider } from "./Services/UserContext";
import { LoadingProvider } from "./Services/LoadingContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <LoadingProvider>
            <UserProvider>
              <App />
            </UserProvider>
          </LoadingProvider>
        </QueryClientProvider>
      </BrowserRouter>
  </React.StrictMode>
);
