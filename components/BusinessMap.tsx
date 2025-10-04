// Fix: Add a triple-slash directive to include Google Maps type definitions, which resolves errors related to the 'google' namespace not being found.
/// <reference types="google.maps" />

import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Business } from '../types';

interface BusinessMapProps {
  apiKey: string;
  businesses: Business[];
  highlightedBusinessId: string | null;
  onHighlight: (businessId: string | null) => void;
}

export const BusinessMap: React.FC<BusinessMapProps> = ({ apiKey, businesses, highlightedBusinessId, onHighlight }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize and load the map
  useEffect(() => {
    const loader = new Loader({
      apiKey,
      version: 'weekly',
    });

    loader.load().then(() => {
      if (mapRef.current) {
        googleMap.current = new google.maps.Map(mapRef.current, {
          center: { lat: 39.8283, lng: -98.5795 }, // Center of the US
          zoom: 4,
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
        setIsMapLoaded(true);
      }
    }).catch(e => {
      console.error("Failed to load Google Maps", e);
    });

    // Cleanup
    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current.clear();
    };
  }, [apiKey]);

  // Update markers when businesses change
  useEffect(() => {
    if (!googleMap.current || !isMapLoaded) return;

    const currentMarkerIds = new Set(markersRef.current.keys());
    const businessesWithCoords = businesses.filter(b => b.lat != null && b.lng != null);

    // Add/Update markers
    businessesWithCoords.forEach(business => {
      currentMarkerIds.delete(business.id);

      const position = { lat: business.lat!, lng: business.lng! };
      
      if (markersRef.current.has(business.id)) {
        // Marker exists, maybe update its position if it could change
        // markersRef.current.get(business.id)?.setPosition(position);
      } else {
        // Create new marker
        const marker = new google.maps.Marker({
          position,
          map: googleMap.current,
          title: business.companyName || business.discoveryName,
          animation: google.maps.Animation.DROP,
        });

        marker.addListener('mouseover', () => onHighlight(business.id));
        marker.addListener('mouseout', () => onHighlight(null));
        
        markersRef.current.set(business.id, marker);
      }
    });

    // Remove old markers
    currentMarkerIds.forEach(id => {
      markersRef.current.get(id)?.setMap(null);
      markersRef.current.delete(id);
    });

    // Adjust map bounds
    if (businessesWithCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      businessesWithCoords.forEach(b => bounds.extend({ lat: b.lat!, lng: b.lng! }));
      googleMap.current.fitBounds(bounds);
      
      if (businessesWithCoords.length === 1) {
          googleMap.current.setZoom(12);
      }
    }

  }, [businesses, isMapLoaded, onHighlight]);

  // Handle highlighting
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      if (id === highlightedBusinessId) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
      } else {
        marker.setAnimation(null);
      }
    });
  }, [highlightedBusinessId]);

  return <div className="w-full h-full bg-gray-200" ref={mapRef} />;
};
