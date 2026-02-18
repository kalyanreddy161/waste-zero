import React, { createContext, useState, useContext, useCallback } from "react";

const LoadingContext = createContext({ isLoading: false, setLoading: () => {}, withLoading: (fn) => fn });

export const LoadingProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);

  // helper to wrap async functions and manage loading state
  const withLoading = useCallback(
    (asyncFn) => async (...args) => {
      try {
        setIsLoading(true);
        return await asyncFn(...args);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading: setIsLoading, withLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => useContext(LoadingContext);

export default LoadingContext;
