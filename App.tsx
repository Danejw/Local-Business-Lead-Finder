import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { SearchForm } from './components/SearchForm';
import { BusinessTable } from './components/BusinessTable';
import { findBusinessesStream, researchBusiness } from './services/geminiService';
import { Business, BusinessStatus } from './types';

const App: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [researchMessage, setResearchMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

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
        
        researchBusiness(discovery.name, discovery.website)
          .then(researchedData => {
            setBusinesses(prev =>
              prev.map(b =>
                b.id === newBusiness.id
                  ? { ...b, ...researchedData, isResearching: false }
                  : b
              )
            );
          })
          .catch(researchError => {
            console.error(`Failed to research ${discovery.name}:`, researchError);
            setBusinesses(prev =>
              prev.map(b =>
                b.id === newBusiness.id
                  ? { ...b, description: 'Research failed.', isResearching: false }
                  : b
              )
            );
          });
        
        return [...currentBusinesses, newBusiness];
      });
    };

    try {
      await findBusinessesStream(location, businessType, numResults, onDiscovery);
      setResearchMessage('Discovery stream complete.');
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

    // Set researching state for the specific business
    setBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, isResearching: true } : b));

    try {
        const researchedData = await researchBusiness(businessToRetry.discoveryName, businessToRetry.discoveryWebsite);
        setBusinesses(prev => prev.map(b => 
            b.id === businessId 
            ? { ...b, ...researchedData, isResearching: false, dateFound: new Date().toISOString().split('T')[0] } 
            : b
        ));
    } catch (error) {
        console.error(`Failed to retry research for ${businessToRetry.discoveryName}:`, error);
        setBusinesses(prev => prev.map(b => 
            b.id === businessId 
            ? { ...b, description: 'Research failed again.', isResearching: false } 
            : b
        ));
    }
  }, [businesses]);


  const exportToCsv = () => {
    if (businesses.length === 0) return;

    const headers = [
      'Company Name',
      'Contact Name',
      'Address',
      'Phone',
      'Email',
      'Description',
      'Website',
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
      b.description,
      b.discoveryWebsite,
      b.status,
      b.dateFound,
      b.emailThreadId,
      b.areaSearched,
      b.businessType,
    ]);

    const escapeCsvCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;

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
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
          <h2 className="text-xl font-bold text-gray-700 mb-2">Generate Business Leads</h2>
          <p className="text-gray-500 mb-6">Enter a location and business type to start discovering and researching potential leads.</p>
          <SearchForm onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {error && (
          <div className="max-w-4xl mx-auto mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {(isLoading || businesses.length > 0) && (
          <div className="max-w-4xl mx-auto mt-8">
             <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
               <h3 className="text-lg font-semibold text-gray-700">{researchMessage}</h3>
                <button
                    onClick={exportToCsv}
                    disabled={businesses.length === 0 || businesses.some(b => b.isResearching)}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    Export to CSV
                </button>
            </div>
            <BusinessTable businesses={businesses} onRetryResearch={handleRetryResearch} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;