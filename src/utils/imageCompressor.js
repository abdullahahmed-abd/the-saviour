/**
 * Client-side image compression and resizing utility using HTML5 Canvas.
 * Keeps uploads fast, within free-tier quotas, and under 5MB.
 */
export async function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.82) {
  // Validate MIME type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Unsupported image format. Please use JPEG, PNG, or WebP.');
  }

  // If file is already small (e.g. under 400KB), return as is
  if (file.size < 400 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio bounds
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP or JPEG blob
        const outputMime = file.type === 'image/png' ? 'image/webp' : file.type;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // fallback
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
              type: outputMime,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          outputMime,
          quality
        );
      };
      img.onerror = (err) => reject(new Error('Failed to load image for compression.'));
    };
    reader.onerror = (err) => reject(new Error('Failed to read image file.'));
  });
}
