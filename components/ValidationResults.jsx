'use client';

import { CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function ValidationResults({ validationResult, isDarkMode }) {
  if (!validationResult) {
    return (
      <div className={`p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center h-full ${
        isDarkMode
          ? 'bg-gradient-to-br from-gray-800/50 to-slate-800/50 border-gray-600'
          : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-300'
      }`}>
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-6 mb-6 shadow-xl">
          <FileText className="h-16 w-16 text-white" />
        </div>
        <h3 className={`text-base md:text-2xl font-bold mb-3 text-center ${
          isDarkMode ? 'text-gray-200' : 'text-gray-800'
        }`}>No Document Validated</h3>
        <p className={`text-center max-w-xs mb-6 text-sm md:text-base leading-relaxed ${
          isDarkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Your document validation results will appear here after you upload and validate a document.
        </p>
        <div className="w-16 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></div>
      </div>
    );
  }

  return (
    <>
      <div className={`flex items-center mb-8 p-6 rounded-2xl shadow-lg border-2 backdrop-blur-sm ${validationResult.missingElements && validationResult.missingElements.length > 0 
        ? isDarkMode
          ? 'bg-gradient-to-r from-red-900/40 via-red-800/40 to-pink-900/40 border-red-700/50'
          : 'bg-gradient-to-r from-red-50 via-red-100 to-pink-50 border-red-200/50'
        : isDarkMode
          ? 'bg-gradient-to-r from-emerald-900/40 via-emerald-800/40 to-green-900/40 border-emerald-700/50'
          : 'bg-gradient-to-r from-emerald-50 via-emerald-100 to-green-50 border-emerald-200/50'
      }`}>
        {validationResult.missingElements && validationResult.missingElements.length > 0 ? (
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 shadow-xl mr-4">
            <AlertCircle className="h-6 w-6 text-white" />
          </div>
        ) : (
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-xl mr-4">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
        )}
        <div className="flex-1">
          <h3 className={`font-bold text-lg md:text-xl mb-2 ${validationResult.missingElements && validationResult.missingElements.length > 0 
            ? isDarkMode ? 'text-red-300' : 'text-red-800'
            : isDarkMode ? 'text-emerald-300' : 'text-emerald-800'
          }`}>
            {validationResult.missingElements && validationResult.missingElements.length > 0 ? 'Validation Failed' : 'Validation Passed'}
          </h3>
          <p className={`text-sm md:text-base font-medium ${validationResult.missingElements && validationResult.missingElements.length > 0 
            ? isDarkMode ? 'text-red-400' : 'text-red-600'
            : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
          }`}>
            {validationResult.missingElements && validationResult.missingElements.length > 0 
              ? 'Document validation completed with issues' 
              : 'Document validation completed successfully'
            }
          </p>
        </div>
      </div>
      
      {validationResult.missingElements && validationResult.missingElements.length > 0 && (
        <div className={`mb-8 p-6 border rounded-2xl shadow-lg backdrop-blur-sm ${
          isDarkMode
            ? 'bg-gradient-to-br from-red-900/40 to-pink-900/40 border-red-700/50'
            : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200/50'
        }`}>
          <div className="flex items-center mb-4">
            <div className="bg-red-500 rounded-xl p-2 mr-3 shadow-md">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <p className={`text-sm md:text-base font-bold ${
              isDarkMode ? 'text-red-300' : 'text-red-800'
            }`}>Issues Found</p>
          </div>
          <ul className="space-y-3 ml-2">
            {validationResult.missingElements.map((item, index) => (
              <li key={index} className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-2.5 mr-4 flex-shrink-0 shadow-sm"></div>
                <p className={`text-sm md:text-base leading-relaxed ${
                  isDarkMode ? 'text-red-300' : 'text-red-700'
                }`}>{item}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {(!validationResult.missingElements || validationResult.missingElements.length === 0) && validationResult.documentInfo && (
        <div className={`mb-8 p-6 border rounded-2xl shadow-lg backdrop-blur-sm ${
          isDarkMode
            ? 'bg-gradient-to-br from-emerald-900/40 to-green-900/40 border-emerald-700/50'
            : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/50'
        }`}>
          <div className="flex items-center mb-4">
            <div className="bg-emerald-500 rounded-xl p-2 mr-3 shadow-md">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <p className={`text-sm md:text-base font-bold ${
              isDarkMode ? 'text-emerald-300' : 'text-emerald-800'
            }`}>Document Information</p>
          </div>
          <div className={`backdrop-blur-sm p-5 rounded-xl border shadow-sm ${
            isDarkMode
              ? 'bg-gray-800/70 border-emerald-700/50'
              : 'bg-white/70 border-emerald-200/50'
          }`}>
            <div className="grid grid-cols-1 gap-3">
              {validationResult.documentInfo.pageCount && (
                <div className={`flex items-center text-xs md:text-sm px-3 py-2 ${
                  isDarkMode
                    ? 'text-emerald-300'
                    : 'text-emerald-700'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-sm"></div>
                  <span className="font-medium">Pages: <span className="font-bold">{validationResult.documentInfo.pageCount}</span></span>
                </div>
              )}
              {validationResult.documentInfo.wordCount && (
                <div className={`flex items-center text-xs md:text-sm px-3 py-2 ${
                  isDarkMode
                    ? 'text-emerald-300'
                    : 'text-emerald-700'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-sm"></div>
                  <span className="font-medium">Words: <span className="font-bold">{validationResult.documentInfo.wordCount}</span></span>
                </div>
              )}
              {validationResult.documentInfo.containsHandwriting !== undefined && (
                <div className={`flex items-center text-xs md:text-sm px-3 py-2 ${
                  isDarkMode
                    ? 'text-emerald-300'
                    : 'text-emerald-700'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-sm"></div>
                  <span className="font-medium">Contains handwriting: <span className="font-bold">{validationResult.documentInfo.containsHandwriting ? 'Yes' : 'No'}</span></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {validationResult.suggestedActions && validationResult.suggestedActions.length > 0 && (
        <div className={`p-6 border rounded-2xl shadow-lg backdrop-blur-sm ${
          isDarkMode
            ? 'bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border-blue-700/50'
            : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50'
        }`}>
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center mr-3 shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className={`text-sm md:text-base font-bold ${
              isDarkMode ? 'text-blue-300' : 'text-blue-800'
            }`}>Suggested Actions</p>
          </div>
          <ul className="space-y-3 ml-2">
            {validationResult.suggestedActions.map((action, index) => (
              <li key={index} className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2.5 mr-4 flex-shrink-0 shadow-sm"></div>
                <p className={`text-sm md:text-base leading-relaxed ${
                  isDarkMode ? 'text-blue-300' : 'text-blue-700'
                }`}>{action}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
} 