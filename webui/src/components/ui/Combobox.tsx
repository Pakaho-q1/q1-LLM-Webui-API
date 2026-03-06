// src/components/ui/Combobox.tsx
import React, { useState, useRef, useEffect } from 'react';

export interface ComboboxOption {
  value: string;
  label: React.ReactNode;
  searchText?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search or select...',
  disabled = false,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions =
    query === ''
      ? options
      : options.filter((opt) => {
          const text =
            opt.searchText ?? (typeof opt.label === 'string' ? opt.label : '');

          return text.toLowerCase().includes(query.toLowerCase());
        });
  const selectedOption = options.find((opt) => opt.value === value);
  const selectedLabel = selectedOption
    ? typeof selectedOption.label === 'string'
      ? selectedOption.label
      : (selectedOption.searchText ?? selectedOption.value)
    : '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          className={`
            w-full py-2 ps-4 pe-9 block bg-white/70  rounded-lg text-sm text-black/70
            outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:text-black
            disabled:opacity-50 disabled:bg-slate-400/70  disabled:cursor-not-allowed 
          `}
          placeholder={placeholder}
          value={isOpen ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <div
          className="absolute top-1/2 end-3 -translate-y-1/2 cursor-pointer p-1"
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <svg
            className={`shrink-0 size-3.5 text-neutral-50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full max-h-60 mt-1 p-1 bg-slate-400/70 backdrop-blur-[2px] border border-neutral-200 rounded-lg shadow-xl overflow-y-auto  custom-scrollbar">
          {filteredOptions.length === 0 ? (
            <div className="py-2 px-4 text-sm text-black text-center italic">
              No results found
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className={`
                  cursor-pointer py-2 px-3 w-full text-sm text-black rounded-md flex justify-between items-center transition-colors
                  ${value === opt.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-400 text-slate-200'}
                `}
                onClick={() => {
                  onChange(opt.value);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                <span className="truncate pr-2">{opt.label}</span>
                {value === opt.value && (
                  <svg
                    className="shrink-0 size-3.5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
