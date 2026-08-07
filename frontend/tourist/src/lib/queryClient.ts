// src/lib/queryClient.ts
import { QueryClient, MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '../api/client'

export const queryClient = new QueryClient({
  // MutationCache (not defaultOptions.mutations) is used for the global error
  // toast because only its onError receives the Mutation instance — needed to
  // read `meta.suppressErrorToast` for mutations that handle their own error
  // UX (e.g. an anti-enumeration flow with a deliberately different message).
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      if (mutation.options.meta?.suppressErrorToast) return
      toast.error(getErrorMessage(error))
    },
  }),
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
  },
})
