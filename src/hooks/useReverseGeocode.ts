import { useState, useEffect } from "react";
import { reverseGeocode } from "@/services/geocoder";

export function useReverseGeocode(lat: number, lng: number) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reverseGeocode(lat, lng).then((addr) => {
      if (!cancelled) {
        setAddress(addr);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [lat, lng]);

  return { address, loading };
}
