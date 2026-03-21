export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  /** Array de puntos de la ruta en formato React Native Maps */
  points: RoutePoint[];
  /** Distancia total en metros */
  distance_m: number;
  /** Duración estimada en segundos */
  duration_s: number;
  /** Distancia total en kilómetros (redondeado a 2 decimales) */
  distance_km: number;
  /** Duración estimada en minutos (redondeado a 1 decimal) */
  duration_min: number;
}
