
export enum BusinessStatus {
  DISCOVERED = 'Discovered',
  EMAILED = 'Emailed',
  REPLIED = 'Replied',
}

export interface Business {
  id: string;
  discoveryName: string;
  discoveryWebsite: string;
  companyName: string;
  contactName: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  status: BusinessStatus;
  dateFound: string;
  emailThreadId: string;
  isResearching: boolean;
  areaSearched: string;
  businessType: string;
}

export interface BusinessDiscovery {
  name: string;
  website: string;
}

export interface ResearchedBusinessData {
    companyName: string;
    contactName: string;
    address: string;
    phone: string;
    email: string;
    description: string;
}