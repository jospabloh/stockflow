import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 0, // 30 segundos — evita re-fetches innecesarios al navegar entre páginas
		},
	},
});