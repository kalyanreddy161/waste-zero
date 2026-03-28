import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "./useMe";

/**
 * Custom hook to fetch and cache user applications using react-query.
 * Applications are kept in sync with opportunity updates.
 * 
 * @returns {Object} { data: applications, isLoading, error, refetch }
 */
export const useApplications = () => {
  return useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/applications/my`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load applications");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: Infinity, // Never stale by default (rely on invalidation)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};

/**
 * Helper function to update application in react-query cache
 * Used when socket notifies of application status changes
 * 
 * @param {Object} queryClient - React Query client
 * @param {string} appId - Application ID to update
 * @param {string} status - New status (accepted, rejected, pending)
 */
export const updateApplicationInCache = (queryClient, appId, status) => {
  try {
    queryClient.setQueryData(["applications"], (old) => {
      if (!Array.isArray(old)) return old;
      return old.map((app) =>
        String(app._id) === String(appId) ? { ...app, status } : app
      );
    });
  } catch (e) { }
};

/**
 * Helper function to invalidate applications cache
 * Forces refetch on next use
 * 
 * @param {Object} queryClient - React Query client
 */
export const invalidateApplicationsCache = (queryClient) => {
  try {
    queryClient.invalidateQueries({ queryKey: ["applications"] });
  } catch (e) { }
};
