import React, { useState } from 'react';
import { Package, Milk, Coffee, Wheat, Apple, Sparkles, Egg } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  category?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function getCategoryIcon(category?: string) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('dairy') || cat.includes('milk')) {
    return <Milk className="w-1/2 h-1/2 text-brand" />;
  }
  if (cat.includes('egg')) {
    return <Egg className="w-1/2 h-1/2 text-amber-500" />;
  }
  if (cat.includes('bakery') || cat.includes('bread') || cat.includes('cereal') || cat.includes('oat')) {
    return <Wheat className="w-1/2 h-1/2 text-amber-600" />;
  }
  if (cat.includes('beverage') || cat.includes('coffee') || cat.includes('tea')) {
    return <Coffee className="w-1/2 h-1/2 text-orange-600" />;
  }
  if (cat.includes('produce') || cat.includes('fruit') || cat.includes('vegetable')) {
    return <Apple className="w-1/2 h-1/2 text-emerald-600" />;
  }
  if (cat.includes('household') || cat.includes('care') || cat.includes('detergent')) {
    return <Sparkles className="w-1/2 h-1/2 text-cyan-600" />;
  }
  return <Package className="w-1/2 h-1/2 text-ink-muted" />;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  category,
  className = '',
  size = 'md',
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-14 h-14 rounded-xl',
    lg: 'w-16 h-16 rounded-xl',
    xl: 'w-20 h-20 rounded-2xl',
  }[size];

  if (!src || imageFailed) {
    return (
      <div
        className={`flex items-center justify-center shrink-0 bg-paper border border-secondary-tint/60 text-ink-muted ${sizeClasses} ${className}`}
        aria-label={alt}
      >
        {getCategoryIcon(category)}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden shrink-0 bg-white border border-secondary-tint/60 shadow-xs flex items-center justify-center ${sizeClasses} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
        className="w-full h-full object-contain p-1 transition duration-200"
      />
    </div>
  );
};

