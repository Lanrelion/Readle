import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, UploadCloud, Camera } from 'lucide-react';
import { db } from '../services/db';
import ePub from 'epubjs';
import Tesseract from 'tesseract.js';
import { motion } from 'framer-motion';

export default function AddBook() {
  const navigate = useNavigate();
  const [entryMode, setEntryMode] = useState('manual');
  const [fileBlob, setFileBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    type: 'physical',
    status: 'wantToRead',
    totalPages: '',
    cover: null
  });

  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

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
            .filter(l => l.length > 3); // Filter out tiny artifacts
            
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
    } catch (error) {
      alert("Failed to parse EPUB file. Please try again or enter manually.");
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
        fileBlob: fileBlob
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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-5 lg:px-12 flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="mr-5 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add New Book</h1>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 lg:px-12 max-w-2xl">
        <div className="mb-8 flex rounded-full bg-muted/30 p-1.5 border border-border/50">
          <button 
            onClick={() => setEntryMode('manual')}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${entryMode === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Manual Entry
          </button>
          <button 
            onClick={() => setEntryMode('upload')}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all ${entryMode === 'upload' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Upload Ebook
          </button>
        </div>

        {entryMode === 'upload' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-dashed border-border/80 p-14 text-center bg-muted/10"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud size={28} />
            </div>
            <h3 className="mb-2 text-xl font-medium text-foreground">Upload an EPUB file</h3>
            <p className="mb-8 text-sm text-muted-foreground max-w-sm mx-auto">
              We'll automatically extract the book details and save it for offline reading.
            </p>
            <input 
              type="file" 
              accept=".epub"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-full bg-[#3B4A6B] px-[20px] py-[14px] text-[14px] font-medium text-[#FAF8F4] shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            >
              {isLoading ? "Parsing EPUB..." : "Select EPUB File"}
            </button>
          </motion.div>
        )}

        {entryMode === 'manual' && (
          <motion.form 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit} 
            className="space-y-6 rounded-3xl border border-border/60 bg-card p-8"
          >
            <div className="mb-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/10 p-8 text-center">
              {formData.cover ? (
                <div className="relative group">
                  <img src={formData.cover} alt="Cover Preview" className="h-40 w-28 rounded-lg object-cover shadow-sm border border-border/60" />
                  <button 
                    type="button" 
                    onClick={() => coverInputRef.current?.click()} 
                    className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-foreground text-xs font-medium backdrop-blur-sm"
                  >
                    Change Cover
                  </button>
                </div>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Camera size={24} />
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">Snap a photo of the cover to auto-fill details.</p>
                  <button 
                    type="button"
                    disabled={isScanning}
                    onClick={() => coverInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-full border border-[#D8D0C7] dark:border-[#4E4741] bg-transparent px-[20px] py-[14px] text-[14px] font-medium text-[#1F1A17] dark:text-[#F7F3ED] transition-all duration-300 ease-out hover:bg-muted/50 disabled:opacity-50"
                  >
                    {isScanning ? "Scanning Cover..." : "Scan physical cover"}
                  </button>
                </>
              )}
              <input type="file" accept="image/*" capture="environment" ref={coverInputRef} className="hidden" onChange={handleScanCover} />
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Title *</label>
                <input required type="text" name="title" value={formData.title} onChange={handleChange} className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background" />
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Author *</label>
                <input required type="text" name="author" value={formData.author} onChange={handleChange} className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">ISBN <span className="font-normal opacity-60">(Optional)</span></label>
                  <input type="text" name="isbn" value={formData.isbn} onChange={handleChange} className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">Total Pages</label>
                  <input type="number" name="totalPages" value={formData.totalPages} onChange={handleChange} min="1" className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background" />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">Format</label>
                  <select name="type" value={formData.type} onChange={handleChange} className="w-full appearance-none rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background">
                    <option value="physical">Physical Book</option>
                    <option value="ebook">Ebook</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full appearance-none rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background">
                    <option value="wantToRead">Want to Read</option>
                    <option value="reading">Currently Reading</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 mt-6 border-t border-border/60">
              <button disabled={isLoading} type="submit" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3B4A6B] px-[20px] py-[14px] text-[14px] font-medium text-[#FAF8F4] shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm">
                <Save size={18} />
                {isLoading ? "Saving..." : "Save Book"}
              </button>
            </div>
          </motion.form>
        )}
      </main>
    </div>
  );
}
