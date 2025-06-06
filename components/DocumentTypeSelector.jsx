'use client';

export default function DocumentTypeSelector({ 
  documentType, 
  setDocumentType, 
  documentTypes, 
  isDarkMode 
}) {
  return (
    <div className="mb-6">
      <label className={`block text-sm md:text-base font-semibold ${
        isDarkMode ? 'text-gray-200' : 'text-gray-800'
      } mb-3`}>Document Type</label>
      <div className="relative">
        <select
          value={documentType}
          onChange={(e) => {
            setDocumentType(e.target.value);
          }}
          className={`w-full px-4 py-2 border-2 rounded-xl focus:outline-none focus:ring-4 text-sm md:text-base backdrop-blur-sm transition-all duration-200 appearance-none ${
            isDarkMode
              ? 'border-gray-600 text-gray-200 bg-gray-700/50 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-500'
              : 'border-gray-200 text-gray-700 bg-white/50 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300'
          }`}
        >
          {documentTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
          <svg className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
} 