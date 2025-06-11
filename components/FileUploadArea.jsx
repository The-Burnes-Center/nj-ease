'use client';
/**
 * FileUploadArea.jsx
 * ------------------
 * Drag-and-drop + click-to-browse component that collects the document
 * to be validated.  All heavy lifting (file validation, base64 encoding)
 * is done in the parent (DocumentValidator) – this component is strictly
 * concerned with UI and UX behaviour.
 *
 * Props
 * -----
 * • file:          File|null – currently selected file; controls success UI.
 * • fileName:      string    – derived display name.
 * • isDragOver:    boolean   – highlights area when file is dragged over.
 * • handleFileChange: (e) => void – fires on <input type="file" /> change.
 * • handleDragEnter / Leave / Over / Drop – standard DnD handlers.
 * • isDarkMode:    boolean   – theme toggle for Tailwind classes.
 */

import { Upload, CheckCircle } from 'lucide-react';

export default function FileUploadArea({ 
  file, 
  fileName, 
  isDragOver, 
  handleFileChange, 
  handleDragEnter, 
  handleDragLeave, 
  handleDragOver, 
  handleDrop, 
  isDarkMode 
}) {
  return (
    <div className="mb-8">
      <label className={`block text-sm md:text-base font-semibold ${
        isDarkMode ? 'text-gray-200' : 'text-gray-800'
      } mb-3`}>Upload Document</label>
      <div 
        className={`relative w-full h-58 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group ${
          isDragOver 
            ? isDarkMode
              ? 'border-blue-400 bg-gradient-to-br from-blue-900/30 to-indigo-900/30 scale-[1.02]'
              : 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-[1.02]'
            : file 
              ? isDarkMode
                ? 'border-emerald-400 bg-gradient-to-br from-emerald-900/30 to-green-900/30 hover:border-emerald-300 hover:scale-[1.01]'
                : 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-50 hover:border-emerald-500 hover:scale-[1.01]'
              : isDarkMode
                ? 'border-gray-600 bg-gradient-to-br from-gray-800/50 to-slate-800/50 hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-900/30 hover:to-indigo-900/30 hover:scale-[1.01]'
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
            <p className={`text-sm md:text-base text-center font-semibold ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>{fileName}</p>
            <p className={`text-xs md:text-sm mt-2 px-3 py-1 rounded-full ${
              isDarkMode ? 'text-gray-400 bg-gray-700/60' : 'text-gray-500 bg-white/60'
            }`}>
              Click to change file or drag a new one
            </p>
          </>
        ) : (
          <>
            <div className={`rounded-full p-4 mb-4 transition-all duration-300 ${
              isDarkMode
                ? 'bg-gradient-to-r from-gray-700 to-slate-700 group-hover:from-blue-700 group-hover:to-indigo-700'
                : 'bg-gradient-to-r from-gray-200 to-slate-200 group-hover:from-blue-200 group-hover:to-indigo-200'
            }`}>
              <Upload className={`h-8 w-8 transition-colors duration-300 ${
                isDarkMode
                  ? 'text-gray-400 group-hover:text-blue-400'
                  : 'text-gray-500 group-hover:text-blue-600'
              }`} />
            </div>
            <p className={`text-sm md:text-base font-semibold mb-1 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>Click to browse files</p>
            <p className={`text-xs md:text-sm mb-3 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>or drag & drop your document here</p>
            <div className={`backdrop-blur-sm px-4 py-2 rounded-full border ${
              isDarkMode
                ? 'bg-gray-700/80 border-gray-600'
                : 'bg-white/80 border-gray-200'
            }`}>
              <p className={`text-xs md:text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                PDF, DOCX, DOC, JPG, PNG (Max 50MB)
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 