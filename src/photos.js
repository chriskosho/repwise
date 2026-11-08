// Reading a picked photo into something we can store: shrunk to a sensible size when the
// browser can do it, otherwise stored as it was picked.
const MAX_SIDE = 1280;

function readBuffer(file) {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

export async function prepareImage(file) {
  if (!file || !/^image\//.test(file.type || 'image/jpeg')) throw new Error('Pick an image file.');
  try {
    if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
      if (blob && blob.size) return { data: await readBuffer(blob), type: 'image/jpeg' };
    }
  } catch {
    /* fall back to the original */
  }
  return { data: await readBuffer(file), type: file.type || 'image/jpeg' };
}

// Object URLs for showing stored photos; the caller revokes them.
export function photoUrl(photo) {
  try {
    return URL.createObjectURL(new Blob([photo.data], { type: photo.type }));
  } catch {
    return '';
  }
}
