import useSWR from 'swr';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const fetcher = url => axios.get(url).then(res => res.data);

// Cities Hook
export function useCities() {
    const { data, error, isLoading } = useSWR(`${API_BASE_URL}/cities`, fetcher);
    return { cities: data, isError: error, isLoading };
}

// Locations Hook
export function useLocations(city) {
    const { data, error, isLoading } = useSWR(city ? `${API_BASE_URL}/locations?city=${city}` : null, fetcher);
    return { locations: data, isError: error, isLoading };
}

// Current Snapshot Hook (Polls every 5 minutes automatically)
export function useCurrentSnapshot(city, location) {
    const { data, error, isLoading } = useSWR(
        city && location ? `${API_BASE_URL}/current?city=${city}&location=${location}` : null,
        fetcher,
        { refreshInterval: 300000 }
    );
    return { snapshot: data, isError: error, isLoading };
}

// History Hook
export function useHistory(city, location, hours = 6) {
    const { data, error, isLoading } = useSWR(
        city && location ? `${API_BASE_URL}/history?city=${city}&location=${location}&hours=${hours}` : null,
        fetcher
    );
    return { history: data, isError: error, isLoading };
}

// Forecast Hook
export function useForecast(city, location, hours = 24) {
    const { data, error, isLoading, mutate } = useSWR(
        city && location ? `${API_BASE_URL}/forecast?city=${city}&location=${location}&hours=${hours}` : null,
        fetcher
    );
    return { forecast: data, isError: error, isLoading, mutateForecast: mutate };
}

// OSM Sources Hook
export function useOsmSources(city) {
    const { data, error, isLoading } = useSWR(
        city ? `${API_BASE_URL}/osm-sources?city=${city}` : null,
        fetcher
    );
    return { sources: data, isError: error, isLoading };
}

// Trigger XGBoost forecast generation (POST) — returns promise
export async function generateForecast(city, location) {
    const res = await axios.post(
        `${API_BASE_URL}/forecast/generate?city=${encodeURIComponent(city)}&location=${encodeURIComponent(location)}`
    );
    return res.data;
}
