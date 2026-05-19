import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, UploadSimple, Camera } from '@phosphor-icons/react';
import { db } from '../services/db';
import ePub from 'epubjs';
import Tesseract from 'tesseract.js';
import Navigation from '../components/Navigation';
import gsap from 'gsap';
import { loadPDF, getPDFMetadata } from '../services/pdfService';

export default function AddBook() {
  const navigate = useNavigate();
  const [entryMode, setEntryMode] = useState('manual');
  const [fileBlob, setFileBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    type: 'physical',
    status: 'wantToRead',
    totalPages: '',
    cover: null
  });

  const pageContainer = useRef(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // Entrance GSAP animation
  useEffect(() => {
    if (!pageContainer.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(pageContainer.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      );
    });
    return () => ctx.revert();
  }, []);

  const handleScanCover = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        setFormData(prev => ({ ...prev, cover: base64Image }));

        try {
          const result = await Tesseract.recognize(file, 'eng');
          const text = result.data.text;
          
          const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 3);
            
          if (lines.length > 0) {
            setFormData(prev => ({
              ...prev,
              title: prev.title || lines[0],
              author: prev.author || (lines.length > 1 ? lines[1] : prev.author)
            }));
          }
        } catch (ocrErr) {
          console.error("OCR failed", ocrErr);
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      alert("Failed to process cover image.");
      setIsScanning(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const isPDFFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      
      if (isPDFFile) {
        const pdf = await loadPDF(file);
        const metadata = await getPDFMetadata(pdf);

        setFileBlob(file);
        setFormData(prev => ({
          ...prev,
          title: metadata.title && metadata.title !== 'Untitled PDF' ? metadata.title : file.name.replace(/\.[^/.]+$/, ""),
          author: metadata.author && metadata.author !== 'Unknown' ? metadata.author : 'Unknown Author',
          type: 'pdf',
          totalPages: metadata.numPages || ''
        }));
        setEntryMode('manual');
      } else {
        const book = ePub(file);
        const metadata = await book.loaded.metadata;
        
        let coverBase64 = null;
        try {
          const coverUrl = await book.coverUrl();
          if (coverUrl) {
            const response = await fetch(coverUrl);
            const blob = await response.blob();
            coverBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            URL.revokeObjectURL(coverUrl);
          }
        } catch (err) {
          console.warn("Could not extract cover", err);
        }

        setFileBlob(file);
        setFormData(prev => ({
          ...prev,
          title: metadata.title || prev.title,
          author: metadata.creator || prev.author,
          type: 'ebook',
          cover: coverBase64
        }));
        setEntryMode('manual');
      }
    } catch (error) {
      alert("Failed to parse file. Please try again or enter manually.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newBook = {
        id: crypto.randomUUID(),
        title: formData.title,
        author: formData.author,
        isbn: formData.isbn,
        type: formData.type,
        status: formData.status,
        cover: formData.cover,
        dateAdded: new Date().toISOString(),
        dateCompleted: formData.status === 'completed' ? new Date().toISOString() : null,
        metadata: { totalPages: parseInt(formData.totalPages) || null },
        progress: formData.status === 'completed'
          ? { type: 'pages', value: `${formData.totalPages}/${formData.totalPages}` }
          : { type: 'percentage', value: 0 },
        fileBlob: fileBlob,
        updatedAt: new Date().toISOString(),
        synced: 0
      };
      
      await db.books.add(newBook);
      navigate('/');
    } catch (err) {
      alert("Error saving book: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo/20 lg:pl-64 pb-28 lg:pb-12">
      {/* Shared Responsive Sidebar Nav */}
      <Navigation />

      {/* Main Sandbox */}
      <main ref={pageContainer} className="container mx-auto px-6 py-8 lg:px-12 max-w-2xl">
        
        {/* Literary Header */}
        <header className="flex flex-col gap-4 py-6 border-b border-foreground-tertiary/10 mb-8">
          <h1 className="text-5xl font-serif font-normal text-foreground leading-tight">Add Volume</h1>
          <p className="text-foreground-secondary font-sans text-base max-w-md">Catalog a new physical companion or upload a digital EPUB or PDF manuscript.</p>
        </header>

        {/* Sharp Editorial Segmented Mode Toggles */}
        <div className="mb-10 flex border border-foreground-tertiary/20 bg-background-secondary p-1 rounded-none">
          <button 
            type="button"
            onClick={() => setEntryMode('manual')}
            className={`flex-1 py-3 text-xs font-sans font-medium uppercase tracking-wider rounded-none transition-colors duration-300 ${
              entryMode === 'manual' 
                ? 'bg-indigo text-background font-semibold' 
                : 'text-foreground-secondary hover:text-foreground'
            }`}
          >
            Manual Entry
          </button>
          <button 
            type="button"
            onClick={() => setEntryMode('upload')}
            className={`flex-1 py-3 text-xs font-sans font-medium uppercase tracking-wider rounded-none transition-colors duration-300 ${
              entryMode === 'upload' 
                ? 'bg-indigo text-background font-semibold' 
                : 'text-foreground-secondary hover:text-foreground'
            }`}
          >
            Upload Manuscript
          </button>
        </div>

        {/* EPUB / PDF Drag & Drop Upload Frame */}
        {entryMode === 'upload' && (
          <div 
            className="rounded-none border border-dashed border-foreground-tertiary/40 p-14 text-center bg-background-secondary space-y-6"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center bg-indigo/10 text-indigo rounded-none">
              <UploadSimple size={32} weight="thin" />
            </div>
            <h3 className="text-xl font-serif font-normal text-foreground">Upload Manuscript</h3>
            <p className="text-sm text-foreground-secondary max-w-sm mx-auto">
              Drop your EPUB or PDF here or click below to parse details automatically.
            </p>
            <input 
              type="file" 
              accept=".epub,.pdf"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-none bg-indigo px-6 py-3.5 text-sm font-sans font-medium text-background hover:bg-clay transition duration-300 disabled:opacity-50"
            >
              {isLoading ? "Parsing Manuscript..." : "Select Manuscript"}
            </button>
          </div>
        )}

        {entryMode === 'manual' && (
          <form 
            onSubmit={handleSubmit} 
            className="space-y-6 rounded-none border border-foreground-tertiary/20 bg-background-secondary p-8"
          >
            {/* OCR / Cover Scan Banner */}
            <div className="flex flex-col items-center justify-center rounded-none border border-dashed border-foreground-tertiary/30 bg-background/30 p-8 text-center space-y-4">
              {formData.cover ? (
                <div className="relative group">
                  <img src={formData.cover} alt="Cover Preview" className="h-44 w-32 rounded-none object-cover shadow-md border border-foreground-tertiary/20" />
                  <button 
                    type="button" 
                    onClick={() => coverInputRef.current?.click()} 
                    className="absolute inset-0 flex items-center justify-center bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-none text-foreground text-xs font-sans font-medium backdrop-blur-sm"
                  >
                    Change Cover
                  </button>
                </div>
              ) : (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center bg-indigo/5 text-indigo rounded-none">
                    <Camera size={26} weight="thin" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-serif font-normal text-foreground">Snap a companion's cover</p>
                    <p className="text-xs text-foreground-tertiary font-sans max-w-xs">We will attempt to OCR auto-extract titles and creators.</p>
                  </div>
                  <button 
                    type="button"
                    disabled={isScanning}
                    onClick={() => coverInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-none border border-foreground-tertiary/30 bg-transparent px-5 py-2.5 text-xs font-sans font-medium text-foreground hover:bg-background transition duration-300 disabled:opacity-50"
                  >
                    {isScanning ? "Analyzing..." : "Scan Cover"}
                  </button>
                </>
              )}
              <input type="file" accept="image/*" capture="environment" ref={coverInputRef} className="hidden" onChange={handleScanCover} />
            </div>
            
            {/* Elegant Form Inputs */}
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-accent uppercase tracking-widest text-foreground-tertiary">Title *</label>
                <input 
                  required 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange} 
                  className="w-full rounded-none border border-foreground-tertiary/20 bg-background px-4 py-3 text-sm font-serif outline-none transition duration-200 focus:border-indigo" 
                />
              </div>
              
              <div>
                <label className="mb-2 block text-xs font-accent uppercase tracking-widest text-foreground-tertiary">Author / Creator *</label>
                <input 
                  required 
                  type="text" 
                  name="author" 
                  value={formData.author} 
                  onChange={handleChange} 
                  className="w-full rounded-none border border-foreground-tertiary/20 bg-background px-4 py-3 text-sm font-sans outline-none transition duration-200 focus:border-indigo" 
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-accent uppercase tracking-widest text-foreground-tertiary">ISBN <span className="opacity-60">(Optional)</span></label>
                  <input 
                    type="text" 
                    name="isbn" 
                    value={formData.isbn} 
                    onChange={handleChange} 
                    className="w-full rounded-none border border-foreground-tertiary/20 bg-background px-4 py-3 text-sm font-sans outline-none transition duration-200 focus:border-indigo" 
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-accent uppercase tracking-widest text-foreground-tertiary">Total Pages</label>
                  <input 
                    type="number" 
                    name="totalPages" 
                    value={formData.totalPages} 
                    onChange={handleChange} 
                    min="1" 
                    className="w-full rounded-none border border-foreground-tertiary/20 bg-background px-4 py-3 text-sm font-sans outline-none transition duration-200 focus:border-indigo" 
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-accent uppercase tracking-widest text-foreground-tertiary">Format</label>
                  <select 
                    name="type" 
                    value={formData.type} 
                    onChange={handleChange} 
                    className="w-full rounded-none border border-foreground-tertiary/20 bg-background px-4 py-3 text-sm font-sans outline-none transition duration-200 focus:border-indigo cursor-pointer"
                  >
                    <option value="physical">Physical Companion</option>
                    <option value="ebook">Ebook (EPUB)</option>
                    <option value="pdf">PDF Document</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-accent uppercase tracking-widest text-foreground-tertiary">Status</label>
                  <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleChange} 
                    className="w-full rounded-none border border-foreground-tertiary/20 bg-background px-4 py-3 text-sm font-sans outline-none transition duration-200 focus:border-indigo"
                  >
                    <option value="wantToRead">Want to Read</option>
                    <option value="reading">Currently Reading</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button with custom Phosphor Icon */}
            <div className="flex justify-end pt-6 mt-6 border-t border-foreground-tertiary/10">
              <button 
                disabled={isLoading} 
                type="submit" 
                className="inline-flex items-center justify-center gap-2 rounded-none bg-indigo px-6 py-3.5 text-sm font-sans font-medium text-background hover:bg-clay transition duration-300 disabled:opacity-50"
              >
                <CheckCircle size={18} weight="thin" />
                {isLoading ? "Saving..." : "Catalog Book"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
