import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LoadingProvider } from "./Services/LoadingContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { meQueryOptions } from "./Services/useMe";
import { initializeTheme } from "./Services/theme";

const queryClient = new QueryClient();

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <LoadingProvider>
          <App />
        </LoadingProvider>
        {/* <ReactQueryDevtools initialIsOpen={true} /> */}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
