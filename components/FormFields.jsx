'use client';

export default function FormFields({ 
  requiredFields, 
  formFields, 
  handleInputChange, 
  fieldErrors, 
  isDarkMode 
}) {
  return (
    <div className="mb-6 space-y-6">
      {requiredFields.organizationName && (
        <div className="space-y-2">
          <label className={`block text-sm md:text-base font-semibold ${
            isDarkMode ? 'text-gray-200' : 'text-gray-800'
          }`}>
            Organization Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="organizationName"
            value={formFields.organizationName}
            onChange={handleInputChange}
            className={`w-full px-4 py-2 border-2 rounded-xl focus:outline-none focus:ring-4 text-sm md:text-base backdrop-blur-sm transition-all duration-200 ${
              fieldErrors.organizationName 
                ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                : isDarkMode
                  ? 'border-gray-600 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-500 bg-gray-700/50 text-gray-200 placeholder-gray-400'
                  : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 bg-white/50 text-gray-700 placeholder-gray-400'
            }`}
            placeholder="Enter organization name"
          />
        </div>
      )}
      
      {requiredFields.fein && (
        <div className="space-y-2">
          <label className={`block text-sm md:text-base font-semibold ${
            isDarkMode ? 'text-gray-200' : 'text-gray-800'
          }`}>
            FEIN (Federal Employer Identification Number) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="fein"
            value={formFields.fein}
            onChange={handleInputChange}
            className={`w-full px-4 py-2 border-2 rounded-xl focus:outline-none focus:ring-4 text-sm md:text-base backdrop-blur-sm transition-all duration-200 ${
              fieldErrors.fein 
                ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                : isDarkMode
                  ? 'border-gray-600 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-500 bg-gray-700/50 text-gray-200 placeholder-gray-400'
                  : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 bg-white/50 text-gray-700 placeholder-gray-400'
            }`}
            placeholder="Enter FEIN"
          />
        </div>
      )}
    </div>
  );
} 