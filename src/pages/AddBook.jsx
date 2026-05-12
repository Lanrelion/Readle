import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ArrowLeft, Save, Upload, BookOpen, User, Hash, Info, FileCode } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AddBook() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    type: 'physical',
    status: 'wantToRead',
    cover: '',
    fileBlob: null,
    metadata: {}
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    setIsLoading(true);
    
    // Check if it's an EPUB
    if (file.name.toLowerCase().endsWith('.epub')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // In a real app, use epubjs to extract metadata here
          // For MVP, we'll just set the title from filename and store blob
          setFormData(prev => ({
            ...prev,
            title: file.name.replace('.epub', ''),
            type: 'ebook',
            fileBlob: file
          }));
        } catch (err) {
          console.error("Failed to parse EPUB", err);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setIsLoading(false);
      alert('Please upload a valid EPUB file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.author) {
      alert('Title and Author are required.');
      return;
    }

    setIsLoading(true);
    try {
      await db.books.add({
        ...formData,
        id: crypto.randomUUID(),
        dateAdded: new Date().toISOString(),
        progress: formData.status === 'completed' 
          ? { type: 'percentage', value: 100 }
          : { type: 'percentage', value: 0 }
      });
      navigate('/');
    } catch (err) {
      console.error("Failed to save book", err);
      alert('Error saving book to local database.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border/60 bg-background/80 px-6 py-5 backdrop-blur-md lg:px-12">
        <div className="container mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2.5 hover:bg-muted/50 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Add New Book</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-6 py-10 lg:px-12">
        <div className="mb-10 rounded-[20px] bg-primary/5 p-6 border border-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Upload size={20} />
            </div>
            <h2 className="text-lg font-semibold">Quick Import</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Upload an EPUB file to automatically extract details and add it to your library.
          </p>
          
          <label 
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${dragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload({ target: { files: e.dataTransfer.files } }); }}
          >
            <div className="flex flex-col items-center justify-center py-10">
              <FileCode className="mb-3 text-muted-foreground/40" size={40} />
              <p className="text-sm font-medium">Click to upload or drag & drop</p>
              <p className="mt-1 text-xs text-muted-foreground">EPUB files only</p>
            </div>
            <input type="file" className="hidden" accept=".epub" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="relative mb-10 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60"></span>
          </div>
          <span className="relative bg-background px-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">Or Enter Details Manually</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <BookOpen size={14} /> Title
                </label>
                <input required name="title" value={formData.title} onChange={handleChange} className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background" placeholder="The Great Gatsby" />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User size={14} /> Author
                </label>
                <input required name="author" value={formData.author} onChange={handleChange} className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background" placeholder="F. Scott Fitzgerald" />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Hash size={14} /> ISBN (Optional)
                </label>
                <input name="isbn" value={formData.isbn} onChange={handleChange} className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background" placeholder="978-0743273565" />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Info size={14} /> Format
                </label>
                <select name="type" value={formData.type} onChange={handleChange} className="w-full appearance-none rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background">
                  <option value="physical">Physical Book</option>
                  <option value="ebook">Ebook</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Reading Status</label>
              <div className="grid grid-cols-3 gap-3">
                {['wantToRead', 'reading', 'completed'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status }))}
                    className={`rounded-xl border py-3 text-xs font-medium transition-all ${formData.status === status ? 'border-primary bg-primary/5 text-primary' : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/30'}`}
                  >
                    {status === 'wantToRead' ? 'Want to Read' : status === 'reading' ? 'Reading' : 'Completed'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-border/60">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50"
            >
              <Save size={18} />
              {isLoading ? 'Saving...' : 'Save Book to Library'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
