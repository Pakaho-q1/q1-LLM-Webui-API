import React from 'react';

interface MessageiconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
}

const Messageicon: React.FC<MessageiconProps> = ({
  size = 30,
  color = 'black',
  strokeWidth = 1.6,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.6893 3.4654 15.2698 4.27497 16.6205C4.48399 16.9692 4.5885 17.1435 4.62422 17.2941C4.63426 17.3364 4.63937 17.3653 4.64443 17.4085C4.66244 17.5622 4.62975 17.7318 4.56438 18.0711C4.33499 19.2615 4.2203 19.8567 4.50189 20.2155C4.56874 20.3007 4.64899 20.3744 4.73948 20.4339C5.12068 20.6843 5.70412 20.52 6.87102 20.1912L7.01153 20.1517C7.35175 20.0558 7.52186 20.0079 7.68109 20.0145C7.69872 20.0152 7.71035 20.016 7.72793 20.0176C7.88666 20.0316 8.07813 20.1136 8.46103 20.2775C9.5473 20.7425 10.7436 21 12 21Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <path
        d="M7.04962 12L7 12.005"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M11.9998 12.0049L11.9502 12.0098"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M16.9998 12.0049L16.9502 12.0098"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  );
};

export default Messageicon;
