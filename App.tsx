import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { MapSearchForm } from './components/MapSearchForm';
import { BusinessTable } from './components/BusinessTable';
import { findBusinessesStream, researchBusiness, geocodeAddress } from './services/geminiService';
import { searchPlacesInArea, getPlaceDetails, SearchArea } from './services/placesService';
import { Business, BusinessStatus } from './types';

const App: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [researchMessage, setResearchMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [highlightedBusinessId, setHighlightedBusinessId] = useState<string | null>(null);

  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!googleMapsApiKey) {
      setError("Google Maps API key is not configured. The map will not be displayed.");
    }
  }, [googleMapsApiKey]);

  const processResearchAndGeocoding = useCallback(async (business: Business) => {
    try {
      // Step 2: Use Place Details API for enrichment
      const placeDetails = await getPlaceDetails(business.id);
      
      // Also run Gemini research for additional insights
      const researchedData = await researchBusiness(business.discoveryName, business.discoveryWebsite);
      
      setBusinesses(prev =>
        prev.map(b =>
          b.id === business.id
            ? { 
                ...b, 
                ...researchedData,
                // Override with Places API data where available
                websiteUri: placeDetails.websiteUri || b.discoveryWebsite,
                phone: placeDetails.nationalPhoneNumber || b.phone,
                address: placeDetails.formattedAddress || b.address,
                rating: placeDetails.rating || 0,
                userRatingCount: placeDetails.userRatingCount || 0,
                isResearching: false 
              }
            : b
        )
      );
    } catch (researchError) {
      console.error(`Failed to research ${business.discoveryName}:`, researchError);
      setBusinesses(prev =>
        prev.map(b =>
          b.id === business.id
            ? { ...b, description: 'Research failed.', isResearching: false }
            : b
        )
      );
    }
  }, []);

  const handleSearch = useCallback(async (location: string, businessType: string, numResults: string, searchArea: SearchArea) => {
    setIsLoading(true);
    setError(null);
    setResearchMessage('Discovering businesses...');

    try {
      // Step 1: Use Google Places API for discovery
      const maxResults = numResults === 'ALL' ? 20 : parseInt(numResults, 10);
      const places = await searchPlacesInArea(businessType, searchArea, maxResults);

      // Convert Places API results to Business objects
      const newBusinesses: Business[] = places.map((place) => ({
        id: place.id,
        discoveryName: place.displayName,
        discoveryWebsite: place.websiteUri || '',
        companyName: place.displayName,
        contactName: '',
        address: place.formattedAddress || '',
        phone: place.nationalPhoneNumber || '',
        email: '',
        description: '',
        status: BusinessStatus.DISCOVERED,
        dateFound: new Date().toISOString().split('T')[0],
        emailThreadId: 'N/A',
        isResearching: false,
        areaSearched: location,
        businessType: businessType,
        lat: place.location.latitude,
        lng: place.location.longitude,
      }));

      setBusinesses(prev => {
        // Filter out duplicates based on place ID
        const existingIds = new Set(prev.map(b => b.id));
        const uniqueNewBusinesses = newBusinesses.filter(b => !existingIds.has(b.id));
        return [...prev, ...uniqueNewBusinesses];
      });

      setResearchMessage(`Found ${places.length} businesses. Select businesses to research or use "Research All" to enrich all results.`);
    } catch (err) {
      console.error(err);
      setError('An error occurred during discovery. Please check the console and try again.');
      setResearchMessage('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRetryResearch = useCallback(async (businessId: string) => {
    const businessToRetry = businesses.find(b => b.id === businessId);
    if (!businessToRetry) return;

    setBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, isResearching: true } : b));

    // Create a temporary business object with updated date for the retry
    const updatedBusiness: Business = {
      ...businessToRetry,
      dateFound: new Date().toISOString().split('T')[0],
    };

    await processResearchAndGeocoding(updatedBusiness);

  }, [businesses, processResearchAndGeocoding]);


  const exportToCsv = () => {
    if (businesses.length === 0) return;

    const headers = [
      'Company Name',
      'Contact Name',
      'Address',
      'Phone',
      'Email',
      'Website',
      'Description',
      'Status',
      'Date Found/Updated',
      'Email Thread ID',
      'Area Searched',
      'Business Type',
    ];

    const rows = businesses.map(b => [
      b.companyName,
      b.contactName,
      b.address,
      b.phone,
      b.email,
      b.discoveryWebsite,
      b.description,
      b.status,
      b.dateFound,
      b.emailThreadId,
      b.areaSearched,
      b.businessType,
    ]);

    const escapeCsvCell = (cell: string) => `"${cell ? cell.replace(/"/g, '""') : ''}"`;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.map(escapeCsvCell).join(',') + '\r\n';
    rows.forEach(rowArray => {
      const row = rowArray.map(escapeCsvCell).join(',');
      csvContent += row + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'business_leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen text-gray-800">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto bg-white p-8 rounded-2xl shadow-lg mb-8">
          <h2 className="text-xl font-bold text-gray-700 mb-2">Generate Business Leads</h2>
          <p className="text-gray-500 mb-6">Select a location on the map and enter a business type to discover potential leads in that area.</p>
          <MapSearchForm 
            onSearch={handleSearch} 
            isLoading={isLoading} 
            apiKey={googleMapsApiKey || ''} 
            businesses={businesses}
            highlightedBusinessId={highlightedBusinessId}
            onHighlight={setHighlightedBusinessId}
          />
        </div>

        {error && (
          <div className="max-w-7xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {(isLoading || businesses.length > 0) && (
          <div className="w-full mt-8">
             <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
                <h3 className="text-lg font-semibold text-gray-700">{researchMessage}</h3>
                 <div className="flex gap-3 self-end md:self-auto">
                   <button
                       onClick={async () => {
                         const toResearch = businesses.filter(b => !b.isResearching && b.status === BusinessStatus.DISCOVERED);
                         for (const b of toResearch) {
                           setBusinesses(prev => prev.map(x => x.id === b.id ? { ...x, isResearching: true } : x));
                           await processResearchAndGeocoding({ ...b, isResearching: true });
                         }
                       }}
                       disabled={businesses.length === 0 || businesses.every(b => b.status !== BusinessStatus.DISCOVERED)}
                       className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                   >
                       Research All
                   </button>
                   <button
                       onClick={exportToCsv}
                       disabled={businesses.length === 0 || businesses.some(b => b.isResearching)}
                       className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                   >
                       Export to CSV
                   </button>
                 </div>
             </div>
             <div className="space-y-8">
              <div className="w-full">
                <BusinessTable 
                    businesses={businesses} 
                    onRetryResearch={handleRetryResearch}
                    highlightedBusinessId={highlightedBusinessId}
                    onHighlight={setHighlightedBusinessId}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;