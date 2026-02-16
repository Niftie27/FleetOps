import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from "react";
import {
  type Vehicle,
  type Trip,
  type FleetEvent,
  type VehicleStatus,
} from "@/data/mockData";
import {
  getVehicles,
  getTripHistory,
  getEvents,
  getSpeedChartData,
} from "@/services/dozorApi";

// ─── State shape ────────────────────────────────────────
export interface FleetState {
  vehicles: Vehicle[];
  trips: Trip[];
  events: FleetEvent[];
  speedChart: { time: string; speed: number }[];
  loading: {
    vehicles: boolean;
    trips: boolean;
    events: boolean;
    speedChart: boolean;
  };
  error: string | null;
  lastUpdated: string | null;
  selectedVehicleId: string | null;
  statusFilter: "all" | VehicleStatus;
}

const initialState: FleetState = {
  vehicles: [],
  trips: [],
  events: [],
  speedChart: [],
  loading: { vehicles: false, trips: false, events: false, speedChart: false },
  error: null,
  lastUpdated: null,
  selectedVehicleId: null,
  statusFilter: "all",
};

// ─── Actions ────────────────────────────────────────────
type Action =
  | { type: "SET_LOADING"; key: keyof FleetState["loading"]; value: boolean }
  | { type: "SET_VEHICLES"; payload: Vehicle[] }
  | { type: "SET_TRIPS"; payload: Trip[] }
  | { type: "SET_EVENTS"; payload: FleetEvent[] }
  | { type: "SET_SPEED_CHART"; payload: { time: string; speed: number }[] }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SELECTED_VEHICLE"; payload: string | null }
  | { type: "SET_STATUS_FILTER"; payload: "all" | VehicleStatus };

function reducer(state: FleetState, action: Action): FleetState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    case "SET_VEHICLES":
      return { ...state, vehicles: action.payload, lastUpdated: new Date().toISOString() };
    case "SET_TRIPS":
      return { ...state, trips: action.payload, lastUpdated: new Date().toISOString() };
    case "SET_EVENTS":
      return { ...state, events: action.payload, lastUpdated: new Date().toISOString() };
    case "SET_SPEED_CHART":
      return { ...state, speedChart: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_SELECTED_VEHICLE":
      return { ...state, selectedVehicleId: action.payload };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload };
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────
interface FleetActions {
  fetchVehicles: () => Promise<void>;
  fetchTrips: (code?: string, from?: string, to?: string) => Promise<void>;
  fetchEvents: () => Promise<void>;
  fetchSpeedChart: () => Promise<void>;
  selectVehicle: (id: string | null) => void;
  setStatusFilter: (f: "all" | VehicleStatus) => void;
}

const FleetStateCtx = createContext<FleetState>(initialState);
const FleetDispatchCtx = createContext<FleetActions>(null!);

export const useFleetState = () => useContext(FleetStateCtx);
export const useFleetActions = () => useContext(FleetDispatchCtx);

// ─── Provider ───────────────────────────────────────────
export const FleetProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchVehicles = useCallback(async () => {
    dispatch({ type: "SET_LOADING", key: "vehicles", value: true });
    try {
      const data = await getVehicles();
      dispatch({ type: "SET_VEHICLES", payload: data });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (e: any) {
      dispatch({ type: "SET_ERROR", payload: e.message ?? "Failed to load vehicles" });
    } finally {
      dispatch({ type: "SET_LOADING", key: "vehicles", value: false });
    }
  }, []);

  const fetchTrips = useCallback(async (code?: string, from?: string, to?: string) => {
    dispatch({ type: "SET_LOADING", key: "trips", value: true });
    try {
      const data = await getTripHistory(code, from, to);
      dispatch({ type: "SET_TRIPS", payload: data });
    } catch (e: any) {
      dispatch({ type: "SET_ERROR", payload: e.message ?? "Failed to load trips" });
    } finally {
      dispatch({ type: "SET_LOADING", key: "trips", value: false });
    }
  }, []);

  const fetchEventsAction = useCallback(async () => {
    dispatch({ type: "SET_LOADING", key: "events", value: true });
    try {
      const data = await getEvents();
      dispatch({ type: "SET_EVENTS", payload: data });
    } catch (e: any) {
      dispatch({ type: "SET_ERROR", payload: e.message ?? "Failed to load events" });
    } finally {
      dispatch({ type: "SET_LOADING", key: "events", value: false });
    }
  }, []);

  const fetchSpeedChart = useCallback(async () => {
    dispatch({ type: "SET_LOADING", key: "speedChart", value: true });
    try {
      const data = await getSpeedChartData();
      dispatch({ type: "SET_SPEED_CHART", payload: data });
    } catch {
      // non-critical
    } finally {
      dispatch({ type: "SET_LOADING", key: "speedChart", value: false });
    }
  }, []);

  const selectVehicle = useCallback((id: string | null) => {
    dispatch({ type: "SET_SELECTED_VEHICLE", payload: id });
  }, []);

  const setStatusFilter = useCallback((f: "all" | VehicleStatus) => {
    dispatch({ type: "SET_STATUS_FILTER", payload: f });
  }, []);

  const actions: FleetActions = {
    fetchVehicles,
    fetchTrips,
    fetchEvents: fetchEventsAction,
    fetchSpeedChart,
    selectVehicle,
    setStatusFilter,
  };

  return (
    <FleetStateCtx.Provider value={state}>
      <FleetDispatchCtx.Provider value={actions}>
        {children}
      </FleetDispatchCtx.Provider>
    </FleetStateCtx.Provider>
  );
};
