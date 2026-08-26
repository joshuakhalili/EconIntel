import { Button } from '@/components/base/buttons/button';
import { Badge } from '@/components/base/badges/badge';

// Placeholder shell. Replaced in the next step by the router, the query client
// and the real chrome. It exists now to prove the whole chain end to end:
// Vite builds JSX, the @/ alias resolves, BoardUI's .tsx components compile
// alongside plain .jsx, and its theme tokens actually paint.
export default function App() {
  return (
    <main id="main" className="min-h-screen bg-background-secondary-default p-10 font-sans">
      <h1 className="text-2xl font-semibold text-text-primary">EconIntel</h1>
      <p className="mt-1 text-sm text-text-tertiary">
        React + Tailwind + BoardUI shell is up.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button>Primary</Button>
        <Button color="secondary">Secondary</Button>
        <Badge>Badge</Badge>
      </div>
    </main>
  );
}
