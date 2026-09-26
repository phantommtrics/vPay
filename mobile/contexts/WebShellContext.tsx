import { useLocalSearchParams } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  registerConsumerShell,
  type PanelEntry,
} from '@/lib/consumer-nav';

export type EmbedMode = 'page' | 'home' | 'activity' | 'wallet' | 'cards' | 'profile';

const EmbedContext = createContext<EmbedMode>('page');
const InPanelContext = createContext(false);
const PanelParamsContext = createContext<Record<string, string> | null>(null);

type FlowReporters = {
  walletFlowActive: boolean;
  cardsExpanded: boolean;
  reportWalletFlow: (active: boolean) => void;
  reportCardsExpanded: (active: boolean) => void;
};

const FlowContext = createContext<FlowReporters>({
  walletFlowActive: false,
  cardsExpanded: false,
  reportWalletFlow: () => {},
  reportCardsExpanded: () => {},
});

type ShellState = {
  stack: PanelEntry[];
  setShellActive: (active: boolean) => void;
};

const ShellStateContext = createContext<ShellState>({
  stack: [],
  setShellActive: () => {},
});

export function WebShellProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<PanelEntry[]>([]);
  const [shellActive, setShellActiveState] = useState(false);
  const [walletFlowActive, setWalletFlowActive] = useState(false);
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const api = useMemo(
    () => ({
      pushPanel: (entry: PanelEntry) => setStack((current) => [...current, entry]),
      replacePanel: (entry: PanelEntry) =>
        setStack((current) => (current.length ? [...current.slice(0, -1), entry] : [entry])),
      popPanel: () => setStack((current) => current.slice(0, -1)),
      closePanel: () => setStack([]),
      resetTo: (entry: PanelEntry) => setStack([entry]),
      hasPanel: () => stackRef.current.length > 0,
    }),
    [],
  );

  useEffect(() => {
    registerConsumerShell(api, shellActive);
    return () => registerConsumerShell(null, false);
  }, [api, shellActive]);

  const setShellActive = useCallback((active: boolean) => {
    setShellActiveState(active);
    if (!active) setStack([]);
  }, []);

  const reportWalletFlow = useCallback((active: boolean) => {
    setWalletFlowActive(active);
  }, []);

  const reportCardsExpanded = useCallback((active: boolean) => {
    setCardsExpanded(active);
  }, []);

  const shellState = useMemo(
    () => ({ stack, setShellActive }),
    [stack, setShellActive],
  );

  const flow = useMemo(
    () => ({
      walletFlowActive,
      cardsExpanded,
      reportWalletFlow,
      reportCardsExpanded,
    }),
    [walletFlowActive, cardsExpanded, reportWalletFlow, reportCardsExpanded],
  );

  return (
    <ShellStateContext.Provider value={shellState}>
      <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>
    </ShellStateContext.Provider>
  );
}

export function usePanelStack() {
  return useContext(ShellStateContext).stack;
}

export function useSetShellActive() {
  return useContext(ShellStateContext).setShellActive;
}

export function useWalletFlowActive() {
  return useContext(FlowContext).walletFlowActive;
}

export function useCardsExpanded() {
  return useContext(FlowContext).cardsExpanded;
}

export function useReportWalletFlow() {
  return useContext(FlowContext).reportWalletFlow;
}

export function useReportCardsExpanded() {
  return useContext(FlowContext).reportCardsExpanded;
}

export function EmbedModeProvider({
  mode,
  children,
}: {
  mode: EmbedMode;
  children: ReactNode;
}) {
  return <EmbedContext.Provider value={mode}>{children}</EmbedContext.Provider>;
}

export function useEmbedMode() {
  return useContext(EmbedContext);
}

export function PanelScope({
  params,
  children,
}: {
  params: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <InPanelContext.Provider value={true}>
      <PanelParamsContext.Provider value={params}>{children}</PanelParamsContext.Provider>
    </InPanelContext.Provider>
  );
}

export function useInPanel() {
  return useContext(InPanelContext);
}

export function useShellSearchParams<T extends Record<string, string | undefined>>(): T {
  const panel = useContext(PanelParamsContext);
  const route = useLocalSearchParams();
  if (panel) return panel as T;
  return route as T;
}
