export type VehicleStatus = "moving" | "idle" | "offline";

export interface Vehicle {
  id: string;
  code: string;
  name: string;
  plate: string;
  status: VehicleStatus;
  speed: number;
  lat: number;
  lng: number;
  lastUpdate: string;
  driver: string | null;
  odometer: number;
  fuelLevel: number | null;
  ignition: boolean;
}

export interface Trip {
  id: string;
  vehicleId: string;
  vehicleName: string;
  /** Driver name from GPS Dozor DriverName field — separate from vehicle name */
  driver: string | null;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distance: number;
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
}

export type EventType     = "speeding" | "long_trip";
export type EventSeverity = "high" | "medium" | "low";

export interface FleetEvent {
  id: string;
  vehicleId: string;
  vehicleName: string;
  type: EventType;
  message: string;
  timestamp: string;
  severity: EventSeverity;
  lat: number;
  lng: number;
}

export interface SpeedPoint {
  time: string;
  speed: number;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  condition: string;
  icon: string;
}

export interface DateRange {
  from: string;
  to: string;
}
