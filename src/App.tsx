import { BottomPanel } from './app/components/BottomPanel';
import { ChartPanel } from './features/chart/components/ChartPanel';
import { ConnectionStatus } from './features/market/components/ConnectionStatus';
import { MarketList } from './features/market/components/MarketList';
import { Panel } from './ui/Panel';

function Placeholder({ children }: { children: string }) {
  return <p className="px-3 py-3 text-muted">{children}</p>;
}

function App() {
  return (
    <div className="flex min-h-full flex-col xl:h-full">
      <header className="flex h-9 shrink-0 items-center border-b border-line bg-panel px-3">
        <h1 className="text-sm font-semibold tracking-tight">Crypto Terminal</h1>
        <span className="ml-3 text-xs text-muted">Paper trading</span>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[280px_1fr_320px] xl:grid-rows-[1fr_240px]">
        <section
          aria-label="Market"
          className="border-b border-line bg-panel xl:border-r xl:border-b-0"
        >
          <Panel title="Market">
            <MarketList />
          </Panel>
        </section>
        <section aria-label="Chart" className="min-h-72 border-b border-line bg-bg xl:border-b-0">
          <ChartPanel />
        </section>
        <section
          aria-label="Trade"
          className="border-b border-line bg-panel xl:border-b-0 xl:border-l"
        >
          <Panel title="Trade">
            <Placeholder>Order form loads here</Placeholder>
          </Panel>
        </section>
        <BottomPanel status={<ConnectionStatus />} />
      </main>
    </div>
  );
}

export default App;
