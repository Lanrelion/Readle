import { BookOpen, BookText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function BookCard({ book }) {
  const getStatusLabel = (status) => {
    switch(status) {
      case 'reading': return 'Reading';
      case 'completed': return 'Completed';
      case 'wantToRead': return 'Want to Read';
      default: return status;
    }
  };

  const getStatusIndicator = (status) => {
    switch(status) {
      case 'reading': return 'bg-matcha'; 
      case 'completed': return 'bg-primary';
      case 'wantToRead': return 'bg-muted-foreground/40';
      default: return 'bg-muted-foreground';
    }
  };

  const getStatusTextColor = (status) => {
    switch(status) {
      case 'reading': return 'text-[#4B5E41] dark:text-[#A5BBA0] font-semibold';
      case 'completed': return 'text-[#3B4A6B] dark:text-[#A8B7CD] font-semibold'; // Deep Indigo
      case 'wantToRead': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getTagStyle = (tagValue) => {
    switch(tagValue) {
      case 'ebook': return 'bg-[#E3E9F1] text-[#4A5B7A] dark:bg-[#2A3445] dark:text-[#A8B7CD]';
      case 'physical': return 'bg-[#F1EBE3] text-[#5A534D] dark:bg-[#38312B] dark:text-[#B8AEA4]';
      case 'reading': return 'bg-[#E8F1E3] text-[#4B5E41] dark:bg-[#2D3A26] dark:text-[#A5BBA0]';
      case 'completed': return 'bg-[#F1E3E8] text-[#7A4A5E] dark:bg-[#452A36] dark:text-[#CDA8B9]';
      case 'wantToRead': return 'bg-[#EFEFEF] text-[#666666] dark:bg-[#333333] dark:text-[#AAAAAA]';
      default: return 'bg-[#F1EBE3] text-[#5A534D] dark:bg-[#38312B] dark:text-[#B8AEA4]';
    }
  };

  return (
    <motion.div 
      variants={itemVariants} 
      initial="hidden"
      animate="show"
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Link to={`/book/${book.id}`} className="group flex h-full flex-col overflow-hidden rounded-[20px] bg-card shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 ease-out hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1">
        {/* Cover Image */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
          {book.cover ? (
            <img 
              src={book.cover} 
              alt={`Cover of ${book.title}`} 
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-muted/50 p-4 text-center transition-transform duration-500 group-hover:scale-105">
              <span className="text-lg font-serif font-semibold text-foreground/80 line-clamp-3 leading-snug">{book.title}</span>
              <span className="mt-2 text-[10px] font-medium text-muted-foreground line-clamp-1">{book.author}</span>
            </div>
          )}
          
          {/* Type Badge Overlay */}
          <div className={`absolute right-3 top-3 rounded-full px-[10px] py-[6px] shadow-sm ${getTagStyle(book.type)}`}>
            <span className="text-[11px] font-medium">
              {book.type === 'ebook' ? 'Ebook' : 'Physical'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-4">
            <h3 className="line-clamp-1 font-serif text-[18px] font-semibold tracking-tight text-foreground" title={book.title}>
              {book.title}
            </h3>
            <p className="line-clamp-1 text-sm text-muted-foreground mt-0.5" title={book.author}>
              {book.author}
            </p>
          </div>

          {/* Status & Progress */}
          <div className="mt-auto pt-2">
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`h-1.5 w-1.5 rounded-full ${getStatusIndicator(book.status)}`} />
              <span className={`text-xs font-medium ${getStatusTextColor(book.status)}`}>
                {getStatusLabel(book.status)}
              </span>
            </div>
            
            {(book.status === 'reading' || book.status === 'completed') && book.progress && (
              <div className="w-full mt-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2 font-medium">
                  <span>Progress</span>
                  <span>
                    {book.progress.type === 'percentage' 
                      ? `${book.progress.value}%` 
                      : book.progress.value}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#E7DED4] dark:bg-[#38312B]">
                  <div 
                    className="h-full rounded-full bg-matcha transition-all duration-700 ease-out"
                    style={{ 
                      width: book.progress.type === 'percentage' 
                        ? `${book.progress.value}%` 
                        : (book.status === 'completed' ? '100%' : '0%') 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
