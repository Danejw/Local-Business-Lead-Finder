import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { SearchForm } from './components/SearchForm';
import { BusinessTable } from './components/BusinessTable';
import { BusinessMap } from './components/BusinessMap';
import { findBusinessesStream, researchBusiness, geocodeAddress } from './services/geminiService';
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
      const researchedData = await researchBusiness(business.discoveryName, business.discoveryWebsite);
      let coords;
      if (researchedData.address && researchedData.address !== 'Not Found') {
        coords = await geocodeAddress(researchedData.address);
      }
      setBusinesses(prev =>
        prev.map(b =>
          b.id === business.id
            ? { ...b, ...researchedData, ...coords, isResearching: false }
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

  const handleSearch = useCallback(async (location: string, businessType: string, numResults: string) => {
    setIsLoading(true);
    setError(null);
    setResearchMessage('Discovering businesses...');

    const discoveredWebsitesThisRun = new Set<string>();

    const onDiscovery = (discovery: { name: string; website: string; }) => {
      setBusinesses(currentBusinesses => {
        const alreadyExists = currentBusinesses.some(b => b.discoveryWebsite === discovery.website) || discoveredWebsitesThisRun.has(discovery.website);
        
        if (!discovery.website || alreadyExists) {
            return currentBusinesses;
        }
        
        discoveredWebsitesThisRun.add(discovery.website);

        const newBusiness: Business = {
          id: `${Date.now()}-${discovery.website}`,
          discoveryName: discovery.name,
          discoveryWebsite: discovery.website,
          companyName: '',
          contactName: '',
          address: '',
          phone: '',
          email: '',
          description: '',
          status: BusinessStatus.DISCOVERED,
          dateFound: new Date().toISOString().split('T')[0],
          emailThreadId: 'N/A',
          isResearching: true,
          areaSearched: location,
          businessType: businessType,
        };
        
        processResearchAndGeocoding(newBusiness);
        
        return [...currentBusinesses, newBusiness];
      });
    };

    try {
      await findBusinessesStream(location, businessType, numResults, onDiscovery);
      setResearchMessage('Discovery stream complete. Research may still be in progress.');
    } catch (err) {
      console.error(err);
      setError('An error occurred during discovery. Please check the console and try again.');
      setResearchMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [processResearchAndGeocoding]);

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
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg mb-8">
          <h2 className="text-xl font-bold text-gray-700 mb-2">Generate Business Leads</h2>
          <p className="text-gray-500 mb-6">Enter a location and business type to start discovering and researching potential leads.</p>
          <SearchForm onSearch={handleSearch} isLoading={isLoading} />
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
                <button
                    onClick={exportToCsv}
                    disabled={businesses.length === 0 || businesses.some(b => b.isResearching)}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 self-end md:self-auto"
                >
                    Export to CSV
                </button>
            </div>
            <div className="flex flex-col xl:flex-row gap-8">
              {googleMapsApiKey && (
                  <div className="xl:w-1/4 w-full h-96 xl:h-auto rounded-xl shadow-md overflow-hidden">
                    <BusinessMap 
                      apiKey={googleMapsApiKey} 
                      businesses={businesses} 
                      highlightedBusinessId={highlightedBusinessId}
                      onHighlight={setHighlightedBusinessId}
                    />
                  </div>
              )}
              <div className={googleMapsApiKey ? "xl:w-3/4 w-full" : "w-full"}>
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