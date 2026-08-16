// src/lib/queryClient.ts
import { QueryClient, MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '../api/client'

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => toast.error(getErrorMessage(error)),
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime:    1000 * 60 * 10,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status: number } }).response?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
    },
  },
})
