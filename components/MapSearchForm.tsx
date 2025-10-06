import React, { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Loader as Spinner } from './Loader';
import { SearchArea, createSearchAreaFromBounds, createSearchAreaFromCenter } from '../services/placesService';
import { Business } from '../types';

// Allow JSX to recognize Places UI Kit custom elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-api-loader': any;
      'gmpx-place-overview': any;
      [elemName: string]: any; // ensure standard tags like 'div' remain valid
    }
  }
}

interface MapSearchFormProps {
  onSearch: (location: string, businessType: string, numResults: string, searchArea: SearchArea) => void;
  isLoading: boolean;
  apiKey: string;
  businesses?: Business[];
  highlightedBusinessId?: string | null;
  onHighlight?: (businessId: string | null) => void;
}

const noopHighlight: (id: string | null) => void = () => {};

export const MapSearchForm: React.FC<MapSearchFormProps> = ({ onSearch, isLoading, apiKey, businesses = [], highlightedBusinessId = null, onHighlight = noopHighlight }) => {
  const [businessType, setBusinessType] = useState('Coffee Shops');
  const [numResults, setNumResults] = useState('10');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [searchAreaType, setSearchAreaType] = useState<'circle' | 'rectangle'>('circle');
  const [radiusKm, setRadiusKm] = useState<number>(2);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const businessMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const circleRef = useRef<google.maps.Circle | null>(null);
  const rectangleRef = useRef<google.maps.Rectangle | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const apiLoaderEl = useRef<any>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    // Inject Places UI Kit once
    if (!document.querySelector('script[data-gmpx]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://unpkg.com/@googlemaps/extended-component-library@0.6';
      script.setAttribute('data-gmpx', 'true');
      document.head.appendChild(script);
    }

    const loader = new Loader({
      apiKey,
      version: 'weekly',
    });

    loader.load().then(() => {
      if (mapRef.current) {
        googleMap.current = new google.maps.Map(mapRef.current, {
          center: { lat: 37.7749, lng: -122.4194 }, // San Francisco
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          styles: [
            {
              "featureType": "poi",
              "stylers": [{ "visibility": "off" }]
            },
            {
              "featureType": "transit",
              "stylers": [{ "visibility": "off" }]
            }
          ]
        });

        geocoderRef.current = new google.maps.Geocoder();

        // Add click listener to map for area selection
        googleMap.current.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng && !isDrawing) {
            const lat = event.latLng.lat();
            const lng = event.latLng.lng();
            
            setSelectedCoordinates({ lat, lng });
            
            // Reverse geocode to get address
            geocoderRef.current?.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                setSelectedLocation(results[0].formatted_address);
              }
            });

            // Update marker
            if (markerRef.current) {
              markerRef.current.setPosition({ lat, lng });
            } else {
              markerRef.current = new google.maps.Marker({
                position: { lat, lng },
                map: googleMap.current,
                title: 'Selected Location',
                animation: google.maps.Animation.DROP,
                icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="16" cy="16" r="12" fill="#3B82F6" stroke="#FFFFFF" stroke-width="3"/>
                      <circle cx="16" cy="16" r="4" fill="#FFFFFF"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(32, 32),
                  anchor: new google.maps.Point(16, 16)
                }
              });
            }

            // Update search area visualization
            updateSearchAreaVisualization({ lat, lng });
          }
        });

        setIsMapLoaded(true);
      }
    }).catch(e => {
      console.error("Failed to load Google Maps", e);
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
      if (rectangleRef.current) {
        rectangleRef.current.setMap(null);
      }
    };
  }, [apiKey]);

  // Sync business markers with current businesses list
  useEffect(() => {
    if (!googleMap.current || !isMapLoaded) return;

    const currentMarkerIds = new Set(businessMarkersRef.current.keys());
    const withCoords = (businesses || []).filter(b => b.lat != null && b.lng != null);

    withCoords.forEach(b => {
      currentMarkerIds.delete(b.id);

      const position = { lat: b.lat as number, lng: b.lng as number };

      if (businessMarkersRef.current.has(b.id)) {
        // If we ever need to move markers, we could update position here
      } else {
        const marker = new google.maps.Marker({
          position,
          map: googleMap.current!,
          title: b.companyName || b.discoveryName,
          animation: google.maps.Animation.DROP,
        });

        marker.addListener('mouseover', () => onHighlight(b.id));
        marker.addListener('mouseout', () => onHighlight(null));

        businessMarkersRef.current.set(b.id, marker);

        marker.addListener('click', () => {
          onHighlight(b.id);
          setSelectedPlaceId(b.id);
        });
      }
    });

    // Remove stale markers
    currentMarkerIds.forEach(id => {
      businessMarkersRef.current.get(id)?.setMap(null);
      businessMarkersRef.current.delete(id);
    });

    // Fit bounds when we have markers
    if (withCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      withCoords.forEach(b => bounds.extend({ lat: b.lat as number, lng: b.lng as number }));
      googleMap.current.fitBounds(bounds);
      if (withCoords.length === 1) {
        googleMap.current.setZoom(12);
      }
    }
  }, [businesses, isMapLoaded, onHighlight]);

  // Bounce highlighted marker
  useEffect(() => {
    businessMarkersRef.current.forEach((marker, id) => {
      if (id === highlightedBusinessId) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
      } else {
        marker.setAnimation(null);
      }
    });
  }, [highlightedBusinessId]);

  // Configure Places UI Kit API loader element with the API key
  useEffect(() => {
    if (apiLoaderEl.current && apiKey) {
      apiLoaderEl.current.setAttribute('key', apiKey);
      apiLoaderEl.current.setAttribute('solution-channel', 'GMP_UI_KIT_V1');
    }
  }, [apiKey]);

  // Update search area visualization
  const updateSearchAreaVisualization = (center: { lat: number; lng: number }) => {
    if (!googleMap.current) return;

    // Clear existing visualizations
    if (circleRef.current) {
      circleRef.current.setMap(null);
    }
    if (rectangleRef.current) {
      rectangleRef.current.setMap(null);
    }

    if (searchAreaType === 'circle') {
      // Create circle visualization
      circleRef.current = new google.maps.Circle({
        center,
        radius: radiusKm * 1000, // Convert km to meters
        map: googleMap.current,
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
    } else {
      // Create rectangle visualization (approximate circle as square)
      const offset = (radiusKm * 1000) / 111000; // Rough conversion to degrees
      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(center.lat - offset, center.lng - offset),
        new google.maps.LatLng(center.lat + offset, center.lng + offset)
      );

      rectangleRef.current = new google.maps.Rectangle({
        bounds,
        map: googleMap.current,
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
    }
  };

  // Update visualization when radius or type changes
  useEffect(() => {
    if (selectedCoordinates && isMapLoaded) {
      updateSearchAreaVisualization(selectedCoordinates);
    }
  }, [radiusKm, searchAreaType, selectedCoordinates, isMapLoaded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessType.trim() && selectedCoordinates) {
      const searchArea = searchAreaType === 'circle' 
        ? createSearchAreaFromCenter(
            { latitude: selectedCoordinates.lat, longitude: selectedCoordinates.lng },
            radiusKm * 1000
          )
        : createSearchAreaFromBounds(
            rectangleRef.current?.getBounds() || new google.maps.LatLngBounds(),
            'rectangle'
          );
      
      onSearch(selectedLocation, businessType, numResults, searchArea);
    }
  };

  return (
    <div className="space-y-6">
      {/* Map Selection and Details */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select Search Area</h3>
          <p className="text-sm text-gray-500">Click on the map to select your search location and adjust the search area</p>
          
          {/* Area Selection Controls */}
          <div className="mt-4 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="circle"
                  name="searchArea"
                  value="circle"
                  checked={searchAreaType === 'circle'}
                  onChange={(e) => setSearchAreaType(e.target.value as 'circle' | 'rectangle')}
                  className="text-blue-600"
                />
                <label htmlFor="circle" className="text-sm text-gray-700">Circle Search</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="rectangle"
                  name="searchArea"
                  value="rectangle"
                  checked={searchAreaType === 'rectangle'}
                  onChange={(e) => setSearchAreaType(e.target.value as 'circle' | 'rectangle')}
                  className="text-blue-600"
                />
                <label htmlFor="rectangle" className="text-sm text-gray-700">Rectangle Search</label>
              </div>
            </div>
            
            {searchAreaType === 'circle' && (
              <div className="flex items-center space-x-4">
                <label htmlFor="radius" className="text-sm font-medium text-gray-700">
                  Search Radius: {radiusKm.toFixed(1)} km
                </label>
                <input
                  id="radius"
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                  className="flex-1 max-w-xs"
                />
              </div>
            )}
          </div>
        </div>
        <div className="h-[32rem] md:h-[58rem] bg-gray-200" ref={mapRef} />
        {selectedLocation && (
          <div className="p-4 bg-blue-50 border-t border-blue-200">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Selected:</span> {selectedLocation}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Search area: {searchAreaType === 'circle' ? `${radiusKm.toFixed(1)} km radius` : 'Rectangle bounds'}
            </p>
          </div>
        )}

        {/* Places UI Kit - Place Overview Panel */}
        <gmpx-api-loader key={apiKey} ref={apiLoaderEl} style={{ display: 'none' }}></gmpx-api-loader>
        {selectedPlaceId && (
          <div className="border-t border-gray-200">
            <gmpx-place-overview
              style={{ width: '100%', display: 'block' }}
              place={selectedPlaceId}
              aria-label="Place details"
            ></gmpx-place-overview>
          </div>
        )}
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              id="businessType"
              aria-label="Business Type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full pl-10 pr-3 py-3 text-gray-700 bg-gray-100 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Coffee Shops, Restaurants, Gyms"
              required
              disabled={isLoading}
            />
          </div>
          <div className="relative">
            <label htmlFor="numResults" className="sr-only">Number of Results</label>
            <select
              id="numResults"
              value={numResults}
              onChange={(e) => setNumResults(e.target.value)}
              disabled={isLoading}
              className="w-full h-full appearance-none pl-3 pr-8 py-3 text-gray-700 bg-gray-100 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">Top 1</option>
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="15">Top 15</option>
              <option value="20">Top 20</option>
              <option value="ALL">All</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !businessType.trim() || !selectedCoordinates}
            className="w-full md:w-auto flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isLoading ? (
              <>
                <Spinner />
                Discovering...
              </>
            ) : (
              'Discover Businesses'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
