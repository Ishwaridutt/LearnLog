import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { api, ApiError } from './api/client';
import { ActionsProvider } from './components/Actions';
import { LongSessionGuard } from './components/LongSessionGuard';
import { TimerBar } from './components/TimerBar';
import { ToastProvider } from './components/Toasts';
import { ErrorText, Spinner } from './components/ui';
import { FieldPage } from './pages/FieldPage';
import { LandingPage } from './pages/LandingPage';
import { Onboarding } from './pages/Onboarding';
import { ProfilePage } from './pages/ProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <ProfileGate />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

/** F-01: no profile yet → onboarding. */
function ProfileGate() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile });
  if (profile.isPending) return <Spinner />;
  if (profile.error) {
    if (profile.error instanceof ApiError && profile.error.status === 404) return <Onboarding />;
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorText error={new Error(`Can't reach the API. Is it running? (${profile.error.message})`)} />
      </div>
    );
  }
  return (
    <ActionsProvider>
      <Routes>
        <Route element={<Layout name={profile.data.name} />}>
          <Route index element={<LandingPage name={profile.data.name} />} />
          <Route path="fields/:fieldId" element={<FieldPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </ActionsProvider>
  );
}

function Layout({ name }: { name: string }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">S</span>
            Study Tracker
          </Link>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-full px-2 py-1 text-sm hover:bg-slate-100 ${isActive ? 'bg-slate-100' : ''}`
            }
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-slate-700">{name}</span>
          </NavLink>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <TimerBar />
      <LongSessionGuard />
    </div>
  );
}
