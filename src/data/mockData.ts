export type VehicleStatus = "moving" | "idle" | "offline";

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  status: VehicleStatus;
  speed: number;
  lat: number;
  lng: number;
  lastUpdate: string;
  driver: string;
  fuelLevel: number;
  ignition: boolean;
  odometer: number;
}

export interface Trip {
  id: string;
  vehicleId: string;
  vehicleName: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
}

export interface FleetEvent {
  id: string;
  vehicleId: string;
  vehicleName: string;
  type: "speeding" | "harsh_braking" | "geofence_exit" | "geofence_enter" | "idle_too_long" | "low_fuel";
  message: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
  lat: number;
  lng: number;
}

// Prague-area coordinates
export const vehicles: Vehicle[] = [
  { id: "v1", name: "Škoda Octavia 1", plate: "1A2 3456", status: "moving", speed: 67, lat: 50.0755, lng: 14.4378, lastUpdate: "2026-02-16T10:32:00Z", driver: "Jan Novák", fuelLevel: 72, ignition: true, odometer: 45230 },
  { id: "v2", name: "VW Transporter", plate: "2B3 7890", status: "moving", speed: 42, lat: 50.0880, lng: 14.4200, lastUpdate: "2026-02-16T10:31:00Z", driver: "Petr Svoboda", fuelLevel: 58, ignition: true, odometer: 89100 },
  { id: "v3", name: "Ford Transit", plate: "3C4 1234", status: "idle", speed: 0, lat: 50.0600, lng: 14.4500, lastUpdate: "2026-02-16T10:28:00Z", driver: "Marie Dvořáková", fuelLevel: 35, ignition: true, odometer: 112500 },
  { id: "v4", name: "Škoda Superb", plate: "4D5 5678", status: "offline", speed: 0, lat: 50.1000, lng: 14.3900, lastUpdate: "2026-02-16T08:15:00Z", driver: "Tomáš Černý", fuelLevel: 90, ignition: false, odometer: 23400 },
  { id: "v5", name: "Renault Kangoo", plate: "5E6 9012", status: "moving", speed: 55, lat: 50.0700, lng: 14.4800, lastUpdate: "2026-02-16T10:33:00Z", driver: "Eva Procházková", fuelLevel: 44, ignition: true, odometer: 67800 },
  { id: "v6", name: "Mercedes Sprinter", plate: "6F7 3456", status: "idle", speed: 0, lat: 50.0500, lng: 14.4100, lastUpdate: "2026-02-16T10:25:00Z", driver: "Karel Veselý", fuelLevel: 62, ignition: false, odometer: 134200 },
  { id: "v7", name: "Peugeot Partner", plate: "7G8 7890", status: "moving", speed: 38, lat: 50.0900, lng: 14.4600, lastUpdate: "2026-02-16T10:33:00Z", driver: "Lucie Králová", fuelLevel: 81, ignition: true, odometer: 51000 },
  { id: "v8", name: "Citroën Berlingo", plate: "8H9 2345", status: "offline", speed: 0, lat: 50.0400, lng: 14.4700, lastUpdate: "2026-02-15T18:30:00Z", driver: "Martin Horák", fuelLevel: 15, ignition: false, odometer: 98700 },
];

export const trips: Trip[] = [
  { id: "t1", vehicleId: "v1", vehicleName: "Škoda Octavia 1", startTime: "2026-02-16T06:30:00Z", endTime: "2026-02-16T07:45:00Z", startLocation: "Praha 1, Václavské nám.", endLocation: "Praha 4, Budějovická", distance: 12.3, duration: 75, maxSpeed: 72, avgSpeed: 38 },
  { id: "t2", vehicleId: "v1", vehicleName: "Škoda Octavia 1", startTime: "2026-02-16T08:15:00Z", endTime: "2026-02-16T09:30:00Z", startLocation: "Praha 4, Budějovická", endLocation: "Praha 10, Strašnice", distance: 8.7, duration: 55, maxSpeed: 65, avgSpeed: 42 },
  { id: "t3", vehicleId: "v2", vehicleName: "VW Transporter", startTime: "2026-02-16T07:00:00Z", endTime: "2026-02-16T08:20:00Z", startLocation: "Praha 6, Dejvice", endLocation: "Praha 3, Žižkov", distance: 15.1, duration: 80, maxSpeed: 58, avgSpeed: 35 },
  { id: "t4", vehicleId: "v5", vehicleName: "Renault Kangoo", startTime: "2026-02-16T06:00:00Z", endTime: "2026-02-16T07:10:00Z", startLocation: "Praha 5, Smíchov", endLocation: "Praha 8, Karlín", distance: 11.5, duration: 70, maxSpeed: 60, avgSpeed: 40 },
  { id: "t5", vehicleId: "v7", vehicleName: "Peugeot Partner", startTime: "2026-02-16T08:00:00Z", endTime: "2026-02-16T09:00:00Z", startLocation: "Praha 2, Vinohrady", endLocation: "Praha 9, Vysočany", distance: 9.8, duration: 60, maxSpeed: 55, avgSpeed: 37 },
  { id: "t6", vehicleId: "v3", vehicleName: "Ford Transit", startTime: "2026-02-15T14:00:00Z", endTime: "2026-02-15T16:30:00Z", startLocation: "Praha 7, Holešovice", endLocation: "Brno, centrum", distance: 205.0, duration: 150, maxSpeed: 130, avgSpeed: 82 },
];

export const events: FleetEvent[] = [
  { id: "e1", vehicleId: "v1", vehicleName: "Škoda Octavia 1", type: "speeding", message: "Překročení rychlosti: 85 km/h v zóně 50 km/h", timestamp: "2026-02-16T09:15:00Z", severity: "high", lat: 50.078, lng: 14.435 },
  { id: "e2", vehicleId: "v2", vehicleName: "VW Transporter", type: "harsh_braking", message: "Prudké brzdění detekováno", timestamp: "2026-02-16T08:45:00Z", severity: "medium", lat: 50.085, lng: 14.425 },
  { id: "e3", vehicleId: "v5", vehicleName: "Renault Kangoo", type: "geofence_exit", message: "Vozidlo opustilo geofence: Praha - centrum", timestamp: "2026-02-16T07:30:00Z", severity: "low", lat: 50.072, lng: 14.482 },
  { id: "e4", vehicleId: "v3", vehicleName: "Ford Transit", type: "idle_too_long", message: "Vozidlo nečinné více než 30 minut", timestamp: "2026-02-16T10:00:00Z", severity: "medium", lat: 50.060, lng: 14.450 },
  { id: "e5", vehicleId: "v8", vehicleName: "Citroën Berlingo", type: "low_fuel", message: "Nízká hladina paliva: 15%", timestamp: "2026-02-15T17:00:00Z", severity: "high", lat: 50.040, lng: 14.470 },
];

export const speedChartData = [
  { time: "06:00", speed: 0 },
  { time: "06:30", speed: 35 },
  { time: "07:00", speed: 52 },
  { time: "07:30", speed: 68 },
  { time: "08:00", speed: 45 },
  { time: "08:30", speed: 0 },
  { time: "09:00", speed: 40 },
  { time: "09:30", speed: 72 },
  { time: "10:00", speed: 58 },
  { time: "10:30", speed: 67 },
];
