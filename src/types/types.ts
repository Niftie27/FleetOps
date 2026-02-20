// ─── Domain model ─────────────────────────────────────────────────────────────
// Typed representations of all GPS Dozor API concepts.
// The service layer maps raw API responses to these types.
// No 'any' types permitted. All optional fields are explicitly marked.

export type VehicleStatus = "moving" | "idle" | "offline"

export interface Vehicle {
  /** Unique GPS Dozor vehicle code — used as primary key everywhere */
  id:         string
  code:       string
  name:       string
  plate:      string
  status:     VehicleStatus
  /** Current speed in km/h (0 when stationary) */
  speed:      number
  lat:        number
  lng:        number
  /** ISO 8601 — last GPS ping received */
  lastUpdate: string
  /** Driver assigned to vehicle, or null if not set / not returned by API */
  driver:     string | null
  /** Cumulative total km from vehicle odometer */
  odometer:   number
  /** Fuel level 0–100, or null if not available in this API plan */
  fuelLevel:  number | null
  ignition:   boolean
}

export interface Trip {
  id:            string
  vehicleId:     string
  /** Human-readable vehicle name — derived from vehicle list, not trip response */
  vehicleName:   string
  /** Driver name from GPS Dozor DriverName field — null if not present */
  driver:        string | null
  startTime:     string  // ISO 8601
  endTime:       string  // ISO 8601
  startLocation: string
  endLocation:   string
  startLat:      number
  startLng:      number
  endLat:        number
  endLng:        number
  /** Distance in km */
  distance:      number
  /** Duration in minutes */
  duration:      number
  maxSpeed:      number
  avgSpeed:      number
}

export type EventType     = "speeding" | "long_trip"
export type EventSeverity = "high" | "medium" | "low"

export interface FleetEvent {
  id:          string
  vehicleId:   string
  vehicleName: string
  /** Driver name from the trip record that generated this event */
  driver:      string | null
  type:        EventType
  message:     string
  timestamp:   string  // ISO 8601
  severity:    EventSeverity
  lat:         number
  lng:         number
}

export interface SpeedPoint {
  /** e.g. "08:00" */
  time:  string
  speed: number
}

export interface WeatherData {
  temperature: number
  windSpeed:   number
  condition:   string
  icon:        string
}

export interface DateRange {
  from: string  // YYYY-MM-DD
  to:   string  // YYYY-MM-DD
}
