import { useReverseGeocode } from "@/hooks/useReverseGeocode";

interface Props {
  lat: number;
  lng: number;
  fallback: string;
}

const GeocodedAddress = ({ lat, lng, fallback }: Props) => {
  const { address, loading } = useReverseGeocode(lat, lng);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        <span className="text-xs">{fallback}</span>
      </span>
    );
  }

  return <span title={`${lat}, ${lng}`}>{address ?? fallback}</span>;
};

export default GeocodedAddress;
