
import React from 'react';
import { BusinessStatus } from '../types';

interface StatusBadgeProps {
  status: BusinessStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusColorMap = {
    [BusinessStatus.DISCOVERED]: 'bg-blue-100 text-blue-800',
    [BusinessStatus.EMAILED]: 'bg-yellow-100 text-yellow-800',
    [BusinessStatus.REPLIED]: 'bg-green-100 text-green-800',
  };

  return (
    <span
      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorMap[status]}`}
    >
      {status}
    </span>
  );
};
