import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  return (
    <main className="starter-shell flex min-h-[100dvh] flex-col px-6 sm:px-10 lg:px-[7.2vw]">
      <header className="flex h-[82px] items-center justify-between border-b border-foreground/10">
        <div className="flex items-center gap-3" data-testid="text-starter-identity">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-primary/60">
            <span className="h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-foreground/75">
            UNTITLED
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.12em] text-foreground/45">
          STARTER SPACE <span className="px-1.5 text-accent">/</span> 001
        </span>
      </header>

      <section className="relative flex flex-1 flex-col items-center justify-center py-20 text-center">
        <div className="starter-orbit pointer-events-none absolute left-1/2 top-[13%] -z-0 h-[min(64vw,590px)] w-[min(64vw,590px)] -translate-x-1/2 sm:top-[8%]">
          <svg
            aria-hidden="true"
            className="h-full w-full overflow-visible"
            viewBox="0 0 600 600"
            fill="none"
          >
            <circle cx="300" cy="300" r="220" stroke="currentColor" strokeOpacity=".09" />
            <circle cx="300" cy="300" r="166" stroke="currentColor" strokeOpacity=".09" strokeDasharray="2 8" />
            <path d="M300 52V548M52 300H548" stroke="currentColor" strokeOpacity=".07" />
            <path d="M300 119C400 119 481 200 481 300C481 400 400 481 300 481C200 481 119 400 119 300" stroke="currentColor" strokeOpacity=".15" />
            <circle cx="300" cy="119" r="5" fill="hsl(var(--accent))" />
            <circle cx="119" cy="300" r="3" fill="currentColor" fillOpacity=".22" />
            <circle cx="481" cy="300" r="3" fill="currentColor" fillOpacity=".22" />
            <path d="M300 258C323.196 258 342 276.804 342 300C342 323.196 323.196 342 300 342C276.804 342 258 323.196 258 300C258 276.804 276.804 258 300 258Z" fill="hsl(var(--primary))" fillOpacity=".08" stroke="hsl(var(--primary))" strokeOpacity=".32" />
            <path d="M300 286V314M286 300H314" stroke="hsl(var(--primary))" strokeOpacity=".75" strokeWidth="1.2" />
          </svg>
        </div>

        <div className="starter-copy relative z-10 mx-auto flex max-w-[760px] flex-col items-center">
          <span className="mb-8 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            A blank starting point
          </span>
          <h1
            className="max-w-[780px] text-balance font-serif text-[clamp(3.4rem,9.4vw,7.8rem)] font-normal leading-[0.91] tracking-[-0.055em] text-foreground"
            data-testid="text-starter-title"
          >
            A place for
            <br />
            what’s next<span className="text-accent">.</span>
          </h1>
          <p
            className="mt-8 max-w-[350px] text-[13px] leading-6 text-foreground/60 sm:text-sm"
            data-testid="text-starter-description"
          >
            Your app starts here. Replace this page with the first thing you want to make.
          </p>
        </div>
      </section>

      <footer className="flex min-h-[64px] items-center justify-between border-t border-foreground/10">
        <span className="font-mono text-[9px] tracking-[0.16em] text-foreground/45">
          OPEN CANVAS
        </span>
        <span className="font-mono text-[9px] tracking-[0.12em] text-foreground/45">
          READY WHEN YOU ARE
        </span>
      </footer>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
