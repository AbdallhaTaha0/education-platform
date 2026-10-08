export interface CoursePhoto {
  filename: string;
  mime: string;
  base64: string;
}

/** Resize and re-encode a chosen photo before sending it with the course details. */
export async function prepareCoursePhoto(file: File): Promise<CoursePhoto> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('PHOTO_INVALID');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw new Error('PHOTO_INVALID');
    const canvas = document.createElement('canvas');
    let width = Math.min(1200, image.naturalWidth);
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.round(width);
      canvas.height = Math.max(1, Math.round((width * image.naturalHeight) / image.naturalWidth));
      // Bound tall photos too, preserving their aspect ratio.
      if (canvas.height > 1200) {
        canvas.width = Math.max(1, Math.round((canvas.width * 1200) / canvas.height));
        canvas.height = 1200;
      }
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PHOTO_INVALID');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]!;
      if (base64.length <= Math.floor(131072 / 3) * 4)
        return { filename: 'course-cover.jpg', mime: 'image/jpeg', base64 };
      width *= 0.75;
    }
    throw new Error('PHOTO_INVALID');
  } finally {
    URL.revokeObjectURL(url);
  }
}
