import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for mutations with optimistic UI updates on updates/deletes only.
 * Reverts on error.
 */
export function useOptimisticMutation({
  mutationFn,
  queryKey,
  onSuccess,
  onError,
  optimisticData = null,
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous data
      const previousData = queryClient.getQueryData(queryKey);

      // Set optimistic data if provided
      if (optimisticData) {
        queryClient.setQueryData(queryKey, optimisticData);
      }

      return { previousData };
    },
    onSuccess: (data, variables, context) => {
      // Revalidate query
      queryClient.invalidateQueries({ queryKey });
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      // Revert to previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onError?.(error, variables, context);
    },
  });
}