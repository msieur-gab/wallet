/**
 * Avatar Utility Module
 *
 * Handles avatar generation, cropping, and resizing:
 * - Generate letter-based avatars (initials with colored background)
 * - Crop and resize uploaded images
 * - Convert images to optimized base64 format
 */

/**
 * Generate a letter-based avatar (initials on colored background)
 * @param {string} name - User's display name or username
 * @param {number} size - Avatar size in pixels (default: 128)
 * @returns {string} Base64 encoded PNG image
 */
export function generateLetterAvatar(name, size = 128) {
  if (!name || typeof name !== 'string') {
    name = '?';
  }

  // Extract initials (max 2 characters)
  const initials = getInitials(name);

  // Generate consistent color based on name
  const color = getColorForName(name);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  // Draw text (initials)
  ctx.fillStyle = '#ffffff'; // White text
  ctx.font = `bold ${Math.floor(size * 0.4)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2);

  // Convert to base64
  return canvas.toDataURL('image/png');
}

/**
 * Extract initials from name (max 2 characters)
 */
function getInitials(name) {
  const cleaned = name.trim().toUpperCase();

  // Split by spaces or common separators
  const parts = cleaned.split(/[\s\-_\.]+/).filter(p => p.length > 0);

  if (parts.length === 0) {
    return '?';
  } else if (parts.length === 1) {
    // Single word: take first 2 characters
    return parts[0].substring(0, 2);
  } else {
    // Multiple words: take first character of first 2 words
    return parts[0].charAt(0) + parts[1].charAt(0);
  }
}

/**
 * Generate consistent color based on name
 * Uses a predefined palette of professional colors
 */
function getColorForName(name) {
  const colors = [
    '#1e40af', // Blue
    '#7c3aed', // Purple
    '#db2777', // Pink
    '#dc2626', // Red
    '#ea580c', // Orange
    '#d97706', // Amber
    '#65a30d', // Lime
    '#059669', // Green
    '#0891b2', // Cyan
    '#4f46e5', // Indigo
    '#be185d', // Rose
    '#c2410c', // Orange-red
  ];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Resize and crop image to a square with max dimensions
 * @param {File|Blob} imageFile - Image file or blob
 * @param {number} maxSize - Maximum width/height (default: 256)
 * @param {number} quality - JPEG quality 0-1 (default: 0.85)
 * @returns {Promise<string>} Base64 encoded image
 */
export async function resizeAndCropImage(imageFile, maxSize = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    // Create file reader
    const reader = new FileReader();

    reader.onload = (e) => {
      // Create image element
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate crop dimensions (center crop to square)
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = (img.height - size) / 2;

          // Calculate final dimensions (maintain aspect ratio, max size)
          const finalSize = Math.min(size, maxSize);

          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = finalSize;
          canvas.height = finalSize;
          const ctx = canvas.getContext('2d');

          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw cropped and resized image
          ctx.drawImage(
            img,
            x, y, size, size,           // Source rectangle (crop)
            0, 0, finalSize, finalSize  // Destination rectangle (resize)
          );

          // Convert to base64 (use JPEG for smaller size if no transparency)
          const hasAlpha = imageFile.type === 'image/png';
          const format = hasAlpha ? 'image/png' : 'image/jpeg';
          const base64 = canvas.toDataURL(format, quality);

          resolve(base64);
        } catch (error) {
          reject(new Error('Failed to process image: ' + error.message));
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(imageFile);
  });
}

/**
 * Create an avatar canvas for editing (with crop/resize preview)
 * @param {HTMLImageElement} img - Source image
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {Object} options - Crop options {x, y, size, zoom}
 */
export function drawAvatarPreview(img, canvas, options = {}) {
  const {
    x = 0,
    y = 0,
    size = Math.min(img.width, img.height),
    zoom = 1
  } = options;

  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calculate dimensions with zoom
  const sourceSize = size / zoom;
  const sourceX = x - (sourceSize - size) / 2;
  const sourceY = y - (sourceSize - size) / 2;

  // Enable smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw image
  ctx.drawImage(
    img,
    sourceX, sourceY, sourceSize, sourceSize,
    0, 0, canvas.width, canvas.height
  );
}

/**
 * Validate image file
 * @param {File} file - File to validate
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateImageFile(file, maxSizeMB = 5) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please use JPEG, PNG, GIF, or WebP.'
    };
  }

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB.`
    };
  }

  return { valid: true, error: null };
}

/**
 * Get estimated base64 size in KB
 * @param {string} base64String - Base64 encoded string
 * @returns {number} Size in KB
 */
export function getBase64Size(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.split(',')[1] || base64String;

  // Calculate size (base64 is ~33% larger than binary)
  const sizeInBytes = (base64Data.length * 3) / 4;
  return Math.round(sizeInBytes / 1024);
}

/**
 * Create a data URL from canvas
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {string} format - Image format (default: 'image/jpeg')
 * @param {number} quality - Quality 0-1 (default: 0.85)
 * @returns {string} Data URL
 */
export function canvasToDataURL(canvas, format = 'image/jpeg', quality = 0.85) {
  return canvas.toDataURL(format, quality);
}

/**
 * Generate avatar for display (returns letter avatar if no image)
 * @param {string} name - User's name
 * @param {string|null} profilePicture - Base64 image or null
 * @param {number} size - Avatar size (default: 128)
 * @returns {string} Base64 image (either profilePicture or generated letter avatar)
 */
export function getAvatarForDisplay(name, profilePicture, size = 128) {
  if (profilePicture && profilePicture.length > 0) {
    return profilePicture;
  }
  return generateLetterAvatar(name, size);
}
