'use client';

import { useState } from 'react';
import { Upload, CheckCircle, FileWarning } from 'lucide-react';

// Azure Document Intelligence client configuration
const DI_ENDPOINT = process.env.NEXT_PUBLIC_DI_ENDPOINT;

export default function DocumentValidator() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setValidationResult(null);
      setError(null);
    }
  };

  const validateDocument = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    
    try {
      // Create form data for the file
      const formData = new FormData();
      formData.append('file', file);

      // Call your API route that will interface with Azure AI
      const response = await fetch('/api/validate-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const result = await response.json();
      setValidationResult(result);
    } catch (err) {
      console.error('Error validating document:', err);
      setError(err.message || 'Failed to validate document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
      <div className="flex flex-col items-center">
        
        {/* Upload Area */}
        <div 
          className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors
            ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
          onClick={() => document.getElementById('file-upload').click()}
        >
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.docx,.doc,.txt,.png"
            className="hidden"
            onChange={handleFileChange}
          />
          
          {file ? (
            <>
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-sm text-gray-600 text-center">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">Click to change file</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Click to upload your document</p>
              <p className="text-xs text-gray-500 mt-1">PDF, DOCX, DOC, TXT</p>
            </>
          )}
        </div>
        
        {/* Validate Button */}
        <button
          className={`mt-6 px-6 py-2 rounded-md font-medium transition-colors ${
            file 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          onClick={validateDocument}
          disabled={!file || isUploading}
        >
          {isUploading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Validating...
            </div>
          ) : "Validate Document"}
        </button>
        
        {/* Error Message */}
        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-md w-full">
            <div className="flex items-center">
              <FileWarning className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}
        
        {/* Validation Results */}
        {validationResult && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md w-full">
            <h3 className="font-semibold text-gray-800 mb-2">Validation Results</h3>
            
            {validationResult.missingElements && validationResult.missingElements.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 mb-2">Missing elements in document:</p>
                <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                  {validationResult.missingElements.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="text-sm text-green-600 font-semibold">✓ Document validation passed!</p>
                <p className="text-sm text-green-600 mt-1">The document contains all required elements:</p>
                <ul className="list-disc list-inside text-sm text-green-600 mt-1">
                  <li>Contains "Department of the Treasurey"</li>
                  <li>Contains "Internal Revenue Services"</li>
                  <li>Contains "Tax Exempt and Government Entities"</li>
                  <li>Has a valid signature</li>
                  <li>Date is within the last 6 months</li> {/* not sure if <6mos applies to this too*/}
                </ul> 
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}