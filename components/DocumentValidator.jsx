'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function EnhancedDocumentValidator() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const [documentType, setDocumentType] = useState('tax-clearance-online');
  const [formFields, setFormFields] = useState({
    organizationName: '',
    ownerName: '',
    fein: ''
  });
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [requiredFields, setRequiredFields] = useState({
    organizationName: false,
    ownerName: false,
    fein: false
  });

  const documentTypes =  [
    { value: 'tax-clearance-online', label: 'Tax Clearance Certificate (Online Generated)' },
    { value: 'tax-clearance-manual', label: 'Tax Clearance Certificate (Manually Generated)' },
    { value: 'cert-alternative-name', label: 'Certificate of Alternative Name' },
    { value: 'cert-trade-name', label: 'Certificate of Trade Name' },
    { value: 'cert-formation', label: 'Certificate of Formation' },
    { value: 'cert-formation-independent', label: 'Certificate of Formation - Independent' },
    { value: 'cert-good-standing-long', label: 'Certificate of Good Standing (Long Form)' },
    { value: 'cert-good-standing-short', label: 'Certificate of Good Standing (Short Form)' },
    { value: 'operating-agreement', label: 'Operating Agreement' },
    { value: 'cert-incorporation', label: 'Certificate of Incorporation' },
    { value: 'irs-determination', label: 'IRS Determination Letter' },
    { value: 'bylaws', label: 'By-laws' },
    { value: 'cert-authority', label: 'Certificate of Authority' },
    { value: 'cert-authority-auto', label: 'Certificate of Authority - Automatic' }
  ];

  // Set required fields based on document type
  useEffect(() => {
    const newRequiredFields = {
      organizationName: false,
      fein: false
    };
    
    switch(documentType) {
      case 'tax-clearance-online':
      case 'tax-clearance-manual':
        newRequiredFields.organizationName = true;
        newRequiredFields.fein = true;
        break;
      case 'operating-agreement':
        newRequiredFields.organizationName = true;
        break;
      case 'cert-formation':
      case 'cert-formation-independent':
      case 'cert-good-standing-long':
      case 'cert-good-standing-short':
      case 'cert-incorporation':
        newRequiredFields.organizationName = true;
        break;
      default:
        break;
    }
    
    setRequiredFields(newRequiredFields);
    
    // Reset validation result when document type changes
    setValidationResult(null);
    setError(null);
  }, [documentType]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setValidationResult(null);
      setError(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormFields(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFeedbackChange = (e) => {
    setFeedback(e.target.value);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const validateDocument = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    
    try {
      // Create form data for the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      
      // Add form fields to the request
      Object.entries(formFields).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

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

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    
    setFeedbackSubmitting(true);
    setFeedbackSuccess(false);
    setFeedbackError(null);
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback,
          documentType,
          email: email || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      setFeedbackSuccess(true);
      setFeedback('');
      setEmail('');
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setFeedbackError(err.message || 'Something went wrong');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Header - Spans full width */}
        <div className="col-span-full rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-center text-white">NJ EASE - Entrepreneurial Application Screening Engine</h1>
        </div>
        
        {/* Document Upload Section - Left */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-sm">
          
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => {
                setDocumentType(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Centralized form fields */}
          <div className="mb-5">
            {requiredFields.organizationName && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  name="organizationName"
                  value={formFields.organizationName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter organization name"
                />
              </div>
            )}
            
            {requiredFields.fein && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">FEIN (Federal Employer Identification Number)</label>
                <input
                  type="text"
                  name="fein"
                  value={formFields.fein}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
                  placeholder="Enter FEIN"
                />
                <p className="text-xs text-gray-500 mt-1">This will be used to verify the last 3 digits on the tax clearance</p>
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Document</label>
            <div 
              className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors
                ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
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
                  <p className="text-xs text-gray-500 mt-1">PDF, DOCX, DOC, JPG, PNG</p>
                </>
              )}
            </div>
          </div>
          
          <div className="flex justify-center">
            <button
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
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
          </div>
          
          {error && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-md w-full">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right side column for validation results and feedback */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Validation Results Section - Right top */}
          <div 
            className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-200 flex-grow"
          >
            
            {validationResult ? (
              <>
                <div className="flex items-center mb-3 bg-gray-50 p-3 rounded-md">
                  <div className={`w-4 h-4 rounded-full mr-2 ${validationResult.missingElements && validationResult.missingElements.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <span className={`font-medium ${validationResult.missingElements && validationResult.missingElements.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {validationResult.missingElements && validationResult.missingElements.length > 0 ? 'Validation Failed' : 'Validation Passed'}
                  </span>
                </div>
                
                {validationResult.missingElements && validationResult.missingElements.length > 0 ? (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-medium text-gray-700 mb-2">The following issues were found:</p>
                    <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                      {validationResult.missingElements.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600 mb-2">All validation checks passed successfully!</p>
                    
                    {validationResult.documentInfo && (
                      <div className="mt-3 text-xs text-gray-600">
                        <p className="font-medium mb-1">Document Information:</p>
                        <ul className="list-disc list-inside ml-2 mt-1">
                          {validationResult.documentInfo.pageCount && (
                            <li>Pages: {validationResult.documentInfo.pageCount}</li>
                          )}
                          {validationResult.documentInfo.wordCount && (
                            <li>Words: {validationResult.documentInfo.wordCount}</li>
                          )}
                          {validationResult.documentInfo.containsHandwriting !== undefined && (
                            <li>Contains handwriting: {validationResult.documentInfo.containsHandwriting ? 'Yes' : 'No'}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {validationResult.suggestedActions && validationResult.suggestedActions.length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-gray-700 mb-1">Suggested Actions:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                      {validationResult.suggestedActions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              // Empty state when no validation has been performed
              <div className="mt-2 p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center min-h-[260px]">
                <div className="bg-blue-50 rounded-full p-4 mb-4">
                  <FileText className="h-14 w-14 text-blue-500" />
                </div>
                <h3 className="text-gray-800 text-lg font-medium mb-2 text-center">No Document Validated</h3>
                <p className="text-gray-600 text-center max-w-xs mb-4">
                  Your document validation results will appear here after you upload and validate a document.
                </p>
              </div>
            )}
          </div>
          
          {/* Feedback Section - Right bottom */}
          <div className="bg-blue-50 p-6 rounded-lg shadow-sm border border-blue-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Share Your Feedback</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Feedback</label>
              <textarea
                value={feedback}
                onChange={handleFeedbackChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 min-h-[60px]"
                placeholder="Tell us about your experience or suggestions..."
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
                placeholder="Your email for follow-up (optional)"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  feedback.trim() 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                onClick={submitFeedback}
                disabled={!feedback.trim() || feedbackSubmitting}
              >
                {feedbackSubmitting ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </div>
                ) : "Submit Feedback"}
              </button>
            </div>
            
            {feedbackSuccess && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md w-full">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <p className="text-sm text-green-600">Thank you for your feedback!</p>
                </div>
              </div>
            )}
            
            {feedbackError && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md w-full">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                  <p className="text-sm text-red-600">{feedbackError}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}