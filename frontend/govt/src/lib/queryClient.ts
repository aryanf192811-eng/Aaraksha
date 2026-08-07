// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '../api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,    // 2 minutes
      gcTime:    1000 * 60 * 10,   // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry 401/403/404
        const status = (error as { response?: { status: number } }).response?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
    },
    mutations: {
      onError: (error) => {
        const msg = getErrorMessage(error)
        toast.error(msg)
      },
    },
  },
})
