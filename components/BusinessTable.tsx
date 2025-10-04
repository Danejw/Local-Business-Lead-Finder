import React from 'react';
import { Business } from '../types';
import { StatusBadge } from './StatusBadge';
import { Loader } from './Loader';

interface BusinessTableProps {
  businesses: Business[];
  onRetryResearch: (businessId: string) => void;
  highlightedBusinessId: string | null;
  onHighlight: (businessId: string | null) => void;
}

const Shimmer: React.FC = () => (
    <div className="animate-pulse bg-gray-200 h-4 rounded-md w-full"></div>
);

export const BusinessTable: React.FC<BusinessTableProps> = ({ businesses, onRetryResearch, highlightedBusinessId, onHighlight }) => {
  if (businesses.length === 0) {
    return null;
  }
  
  const handleMouseEnter = (id: string) => onHighlight(id);
  const handleMouseLeave = () => onHighlight(null);

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {businesses.map((business) => (
          <div 
            key={business.id} 
            className={`bg-white rounded-xl shadow-md p-4 space-y-4 transition-all duration-200 ${highlightedBusinessId === business.id ? 'ring-2 ring-blue-500 scale-105' : ''}`}
            onMouseEnter={() => handleMouseEnter(business.id)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex-grow pr-4">
                <p className="text-base font-bold text-gray-900 break-words">{business.companyName || business.discoveryName}</p>
                {business.discoveryWebsite && (
                  <a href={business.discoveryWebsite} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                    {business.discoveryWebsite}
                  </a>
                )}
              </div>
              <div className="flex-shrink-0">
                {business.isResearching ? <Loader /> : <StatusBadge status={business.status} />}
              </div>
            </div>

            {/* Body */}
            <div className="border-t border-gray-200 pt-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-gray-500 mb-1">Contact</p>
                  {business.isResearching ? (
                    <div className="space-y-2"><Shimmer /><div className="w-5/6"><Shimmer /></div></div>
                  ) : (
                    <>
                      <p className="text-gray-800 break-words">{business.contactName}</p>
                      <p className="text-gray-800 break-words">{business.email}</p>
                      <p className="text-gray-800 break-words">{business.phone}</p>
                    </>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-500 mb-1">Location</p>
                  {business.isResearching ? (
                    <div className="space-y-2"><Shimmer /><div className="w-5/6"><Shimmer /></div></div>
                  ) : (
                    <p className="text-gray-800 break-words">{business.address}</p>
                  )}
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-500 mb-1">Description</p>
                 {business.isResearching ? (
                    <div className="space-y-2"><Shimmer /><Shimmer /><div className="w-3/4"><Shimmer /></div></div>
                  ) : (
                    <p className="text-gray-700 break-words">{business.description}</p>
                  )}
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="border-t border-gray-200 pt-3 flex justify-end items-center">
              {!business.isResearching && (
                <button 
                  onClick={() => onRetryResearch(business.id)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-semibold"
                  aria-label={`Retry research for ${business.companyName || business.discoveryName}`}
                  title="Retry Research"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl shadow-md overflow-hidden">
        <table className="min-w-full w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company Info
              </th>
              <th scope="col" className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th scope="col" className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th scope="col" className="w-[30%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th scope="col" className="w-[7.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="w-[7.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {businesses.map((business) => (
              <tr 
                key={business.id} 
                className={`transition-colors duration-150 ${highlightedBusinessId === business.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onMouseEnter={() => handleMouseEnter(business.id)}
                onMouseLeave={handleMouseLeave}
              >
                <td className="px-6 py-4 align-top">
                  {business.isResearching ? (
                    <div className="space-y-2">
                      <Shimmer />
                      <div className="w-5/6"><Shimmer /></div>
                      <div className="w-3/4"><Shimmer /></div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-gray-900 break-words">
                        {business.companyName || business.discoveryName}
                      </div>
                      {business.discoveryWebsite && (
                        <div className="text-sm text-gray-500 break-words truncate">
                          <a
                            href={business.discoveryWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline"
                            title={business.discoveryWebsite}
                          >
                            {business.discoveryWebsite}
                          </a>
                        </div>
                      )}
                      <div className="text-sm text-gray-500 break-words">
                        {business.phone}
                      </div>
                    </>
                  )}
                </td>
                <td className="px-6 py-4 align-top">
                  {business.isResearching ? (
                    <div className="space-y-2">
                      <Shimmer />
                      <div className="w-5/6"><Shimmer /></div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-gray-900 break-words">
                        {business.contactName}
                      </div>
                      <div className="text-sm text-gray-500 break-words">
                        {business.email}
                      </div>
                    </>
                  )}
                </td>
                <td className="px-6 py-4 align-top text-sm text-gray-500 break-words">
                  {business.isResearching ? (
                      <div className="space-y-2">
                          <Shimmer />
                          <div className="w-5/6"><Shimmer /></div>
                      </div>
                  ) : business.address}
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="text-sm text-gray-900 break-words">
                    {business.isResearching ? (
                      <div className="space-y-2">
                          <Shimmer />
                          <Shimmer />
                          <div className="w-3/4"><Shimmer /></div>
                      </div>
                    ) : business.description}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  {business.isResearching ? <Loader /> : <StatusBadge status={business.status} />}
                </td>
                <td className="px-6 py-4 align-top">
                  {!business.isResearching && (
                    <button 
                      onClick={() => onRetryResearch(business.id)}
                      className="text-blue-600 hover:text-blue-800 transition-colors duration-150"
                      aria-label={`Retry research for ${business.companyName || business.discoveryName}`}
                      title="Retry Research"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};