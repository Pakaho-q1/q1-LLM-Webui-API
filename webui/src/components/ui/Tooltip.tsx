import React, { useState } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
};

const placementClass: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      {visible && (
        <div
          className={`pointer-events-none absolute z-50 max-w-xs whitespace-normal rounded-md bg-gray-700/80 px-2 py-1 text-xs text-white shadow-lg backdrop-blur-[2px] ${placementClass[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
