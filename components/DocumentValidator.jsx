'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function DocumentValidator() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const [documentType, setDocumentType] = useState('tax-clearance-online');
  const [formFields, setFormFields] = useState({
    organizationName: '',
    fein: ''
  });
  const [requiredFields, setRequiredFields] = useState({
    organizationName: false,
    fein: false
  });
  // Add validation error states
  const [fieldErrors, setFieldErrors] = useState({
    organizationName: '',
    fein: ''
  });
  // Add drag & drop states
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const documentTypes =  [
    { value: 'tax-clearance-online', label: 'Tax Clearance Certificate (Online Generated)' },
    { value: 'tax-clearance-manual', label: 'Tax Clearance Certificate (Manually Generated)' },
    { value: 'cert-alternative-name', label: 'Certificate of Alternative Name' },
    { value: 'cert-trade-name', label: 'Certificate of Trade Name' },
    { value: 'cert-formation', label: 'Certificate of Formation' },
    { value: 'cert-formation-independent', label: 'Certificate of Formation - Independent' },
    { value: 'operating-agreement', label: 'Operating Agreement' },
    { value: 'cert-incorporation', label: 'Certificate of Incorporation' },
    { value: 'irs-determination', label: 'IRS Determination Letter' },
    { value: 'bylaws', label: 'By-laws' },
    { value: 'cert-authority', label: 'Certificate of Authority' }
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
      case 'cert-formation':
      case 'cert-formation-independent':
      case 'cert-incorporation':
      case 'cert-authority':
      case 'cert-alternative-name':
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

  // Enhanced file handling function
  const handleFile = (selectedFile) => {
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'image/png', 'image/jpeg', 'image/jpg'];
      const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg'];
      
      const fileExtension = '.' + selectedFile.name.split('.').pop().toLowerCase();
      const isValidType = allowedTypes.includes(selectedFile.type) || allowedExtensions.includes(fileExtension);
      
      if (!isValidType) {
        setError('Please select a valid file type: PDF, DOCX, DOC, TXT, PNG, JPG, or JPEG');
        return;
      }
      
      // Check file size (50MB limit)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setValidationResult(null);
      setError(null);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFile(selectedFile);
  };

  // Drag & Drop event handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDragOver(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
      e.dataTransfer.clearData();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormFields(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Add validation function for required fields
  const validateRequiredFields = () => {
    const errors = {};
    let isValid = true;

    if (requiredFields.organizationName && !formFields.organizationName.trim()) {
      errors.organizationName = 'Organization Name is required';
      isValid = false;
    }

    if (requiredFields.fein && !formFields.fein.trim()) {
      errors.fein = 'FEIN is required';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const validateDocument = async () => {
    // Check if file is uploaded
    if (!file) {
      setError('Please upload a document first');
      return;
    }
    
    // Validate required fields first
    if (!validateRequiredFields()) {
      setError('Please fill in all required fields');
      return;
    }
    
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex justify-center items-center">
      <div className="w-full h-screen flex flex-col px-6 py-6">
        {/* Header */}
        <div className="text-center mb-6 flex-shrink-0">
          <h1 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            NJ EASE <span className="text-gray-400 mx-2">|</span> <span className="bg-gradient-to-r from-gray-700 via-slate-700 to-gray-800 bg-clip-text text-transparent">Entrepreneurial Application Screening Engine</span>
          </h1>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
          {/* Document Upload Section - Left */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 flex-1 overflow-y-auto">
              <div className="mb-6">
                <label className="block text-sm md:text-base font-semibold text-gray-800 mb-3">Document Type</label>
                <div className="relative">
                  <select
                    value={documentType}
                    onChange={(e) => {
                      setDocumentType(e.target.value);
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm md:text-base bg-white/50 backdrop-blur-sm transition-all duration-200 hover:border-gray-300"
                  >
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Form fields */}
              <div className="mb-6 space-y-6">
                {requiredFields.organizationName && (
                  <div className="space-y-2">
                    <label className="block text-sm md:text-base font-semibold text-gray-800">
                      Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="organizationName"
                      value={formFields.organizationName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 text-gray-700 text-sm md:text-base bg-white/50 backdrop-blur-sm transition-all duration-200 placeholder-gray-400 ${
                        fieldErrors.organizationName 
                          ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                          : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300'
                      }`}
                      placeholder="Enter organization name"
                    />
                  </div>
                )}
                
                {requiredFields.fein && (
                  <div className="space-y-2">
                    <label className="block text-sm md:text-base font-semibold text-gray-800">
                      FEIN (Federal Employer Identification Number) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fein"
                      value={formFields.fein}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 text-gray-700 text-sm md:text-base bg-white/50 backdrop-blur-sm transition-all duration-200 placeholder-gray-400 ${
                        fieldErrors.fein 
                          ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                          : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300'
                      }`}
                      placeholder="Enter FEIN"
                    />
                  </div>
                )}
              </div>
              
              {/* Modern Upload Area */}
              <div className="mb-8">
                <label className="block text-sm md:text-base font-semibold text-gray-800 mb-3">Upload Document</label>
                <div 
                  className={`relative w-full h-60 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group ${
                    isDragOver 
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-[1.02]' 
                      : file 
                        ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-50 hover:border-emerald-500 hover:scale-[1.01]' 
                        : 'border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:scale-[1.01]'
                  }`}
                  onClick={() => !isDragOver && document.getElementById('file-upload').click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  
                  {isDragOver ? (
                    <>
                      <div className="bg-blue-500 rounded-full p-4 mb-4 shadow-lg animate-bounce">
                        <Upload className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-base md:text-lg font-semibold text-blue-700">Drop your file here!</p>
                      <p className="text-sm md:text-base text-blue-600 mt-1">Release to upload</p>
                    </>
                  ) : file ? (
                    <>
                      <div className="bg-emerald-500 rounded-full p-4 mb-4 shadow-lg">
                        <CheckCircle className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-sm md:text-base text-gray-700 text-center font-semibold">{fileName}</p>
                      <p className="text-xs md:text-sm text-gray-500 mt-2 bg-white/60 px-3 py-1 rounded-full">
                        Click to change file or drag a new one
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="bg-gradient-to-r from-gray-200 to-slate-200 rounded-full p-4 mb-4 group-hover:from-blue-200 group-hover:to-indigo-200 transition-all duration-300">
                        <Upload className="h-8 w-8 text-gray-500 group-hover:text-blue-600 transition-colors duration-300" />
                      </div>
                      <p className="text-sm md:text-base text-gray-700 font-semibold mb-1">Click to browse files</p>
                      <p className="text-xs md:text-sm text-gray-500 mb-3">or drag & drop your document here</p>
                      <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200">
                        <p className="text-xs md:text-sm text-gray-600 font-medium">
                          PDF, DOCX, DOC, JPG, PNG (Max 50MB)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Modern Button */}
              <div className="flex justify-center">
                <button
                  className={`relative px-8 py-4 rounded-2xl font-semibold text-sm md:text-base transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 ${
                    isUploading
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl focus:ring-blue-500/50'
                  }`}
                  onClick={validateDocument}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Validating...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Validate Document
                    </div>
                  )}
                </button>
              </div>
              
              {error && (
                <div className="mt-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-xl shadow-sm">
                  <div className="flex items-center">
                    <div className="bg-red-500 rounded-full p-1 mr-3">
                      <AlertCircle className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm md:text-base text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Enhanced Validation Results Section */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 flex-1 overflow-y-auto">
              {validationResult ? (
                <>
                  <div className={`flex items-center mb-8 p-6 rounded-2xl shadow-lg border-2 backdrop-blur-sm ${validationResult.missingElements && validationResult.missingElements.length > 0 
                    ? 'bg-gradient-to-r from-red-50 via-red-100 to-pink-50 border-red-200/50' 
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
                      <h3 className={`font-bold text-lg md:text-xl mb-2 ${validationResult.missingElements && validationResult.missingElements.length > 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                        {validationResult.missingElements && validationResult.missingElements.length > 0 ? 'Validation Failed' : 'Validation Passed'}
                      </h3>
                      <p className={`text-sm md:text-base font-medium ${validationResult.missingElements && validationResult.missingElements.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {validationResult.missingElements && validationResult.missingElements.length > 0 
                          ? 'Document validation completed with issues' 
                          : 'Document validation completed successfully'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {validationResult.missingElements && validationResult.missingElements.length > 0 && (
                    <div className="mb-8 p-6 bg-gradient-to-br from-red-50 to-pink-50 border border-red-200/50 rounded-2xl shadow-lg backdrop-blur-sm">
                      <div className="flex items-center mb-4">
                        <div className="bg-red-500 rounded-xl p-2 mr-3 shadow-md">
                          <AlertCircle className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-sm md:text-base font-bold text-red-800">Issues Found</p>
                      </div>
                      <ul className="space-y-3 ml-2">
                        {validationResult.missingElements.map((item, index) => (
                          <li key={index} className="flex items-start">
                            <div className="w-2 h-2 rounded-full bg-red-500 mt-3 mr-4 flex-shrink-0 shadow-sm"></div>
                            <p className="text-sm md:text-base text-red-700 leading-relaxed">{item}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {(!validationResult.missingElements || validationResult.missingElements.length === 0) && validationResult.documentInfo && (
                    <div className="mb-8 p-6 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50 rounded-2xl shadow-lg backdrop-blur-sm">
                      <div className="flex items-center mb-4">
                        <div className="bg-emerald-500 rounded-xl p-2 mr-3 shadow-md">
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-sm md:text-base font-bold text-emerald-800">Document Information</p>
                      </div>
                      <div className="bg-white/70 backdrop-blur-sm p-5 rounded-xl border border-emerald-200/50 shadow-sm">
                        <div className="grid grid-cols-1 gap-3">
                          {validationResult.documentInfo.pageCount && (
                            <div className="flex items-center text-xs md:text-sm text-emerald-700 bg-emerald-50/50 px-3 py-2 rounded-lg">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-sm"></div>
                              <span className="font-medium">Pages: <span className="font-bold">{validationResult.documentInfo.pageCount}</span></span>
                            </div>
                          )}
                          {validationResult.documentInfo.wordCount && (
                            <div className="flex items-center text-xs md:text-sm text-emerald-700 bg-emerald-50/50 px-3 py-2 rounded-lg">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-sm"></div>
                              <span className="font-medium">Words: <span className="font-bold">{validationResult.documentInfo.wordCount}</span></span>
                            </div>
                          )}
                          {validationResult.documentInfo.containsHandwriting !== undefined && (
                            <div className="flex items-center text-xs md:text-sm text-emerald-700 bg-emerald-50/50 px-3 py-2 rounded-lg">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-sm"></div>
                              <span className="font-medium">Contains handwriting: <span className="font-bold">{validationResult.documentInfo.containsHandwriting ? 'Yes' : 'No'}</span></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {validationResult.suggestedActions && validationResult.suggestedActions.length > 0 && (
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl shadow-lg backdrop-blur-sm">
                      <div className="flex items-center mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center mr-3 shadow-md">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm md:text-base font-bold text-blue-800">Suggested Actions</p>
                      </div>
                      <ul className="space-y-3 ml-2">
                        {validationResult.suggestedActions.map((action, index) => (
                          <li key={index} className="flex items-start">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-3 mr-4 flex-shrink-0 shadow-sm"></div>
                            <p className="text-sm md:text-base text-blue-700 leading-relaxed">{action}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                // Modern empty state
                <div className="p-12 bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center h-full">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-6 mb-6 shadow-xl">
                    <FileText className="h-16 w-16 text-white" />
                  </div>
                  <h3 className="text-gray-800 text-base md:text-2xl font-bold mb-3 text-center">No Document Validated</h3>
                  <p className="text-gray-600 text-center max-w-xs mb-6 text-sm md:text-base leading-relaxed">
                    Your document validation results will appear here after you upload and validate a document.
                  </p>
                  <div className="w-16 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}