import { vehicles, trips, events, speedChartData, type Vehicle, type Trip, type FleetEvent } from "@/data/mockData";

export const isConfigured = () => {
  return Boolean(
    import.meta.env.VITE_DOZOR_BASE_URL &&
    import.meta.env.VITE_DOZOR_TOKEN
  );
};

export const getVehicles = async (): Promise<Vehicle[]> => {
  return vehicles;
};

export const getLivePositions = async () => {
  return vehicles.map(v => ({
    vehicleId: v.id,
    lat: v.lat,
    lng: v.lng,
    speedKph: v.speed,
    status: v.status,
    timestamp: v.lastUpdate
  }));
};

export const getTripHistory = async (): Promise<Trip[]> => {
  return trips;
};

export const getEvents = async (): Promise<FleetEvent[]> => {
  return events;
};

export const getSpeedChartData = async () => {
  return speedChartData;
};
