import { useQuery } from "@tanstack/react-query";

export const API_BASE = "http://localhost:3000";

export const fetchMe = async () => {
  const res = await fetch(`${API_BASE}/me`, {
    credentials: "include",
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to fetch user");
  const payload = await res.json();
  return payload.user;
};

export const meQueryOptions = {
  queryKey: ["me"],
  queryFn: fetchMe,
  staleTime: 60 * 1000,
};

export const useMe = () => {
  return useQuery(meQueryOptions);
};

