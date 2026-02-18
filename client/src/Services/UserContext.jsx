import React, { createContext, useState, useEffect, useCallback } from "react";

export const UserContext = createContext({ user: null, setUser: () => {}, loading: true, refreshUser: () => {} });

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:3000/auth/home", {
        method: "GET",
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) setUser(data.user);
        else setUser(null);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // fetch session-backed user on provider mount so UI persists across refresh
    refreshUser();
  }, [refreshUser]);

  return (
    <UserContext.Provider value={{ user, setUser, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;
