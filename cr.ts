export interface SampleCRInput {
  dueDate: Date | string;
  standardP: number; // Dalam satuan HARI
}

/**
 * Menghitung Critical Ratio (CR)
 * CR = (DueDate - CurrentTime) / StandardP
 */
export function calculateCR(dueDate: Date | string, standardP: number): {
  cr: number;
  badge: 'DANGER' | 'WARNING' | 'SAFE';
} {
  const due = new Date(dueDate).getTime();
  const now = new Date().getTime();
  
  // Sisa waktu D - t dalam HARI
  const diffDays = (due - now) / (1000 * 60 * 60 * 24);
  const p = standardP > 0 ? standardP : 1;
  
  const cr = parseFloat((diffDays / p).toFixed(2));
  
  let badge: 'DANGER' | 'WARNING' | 'SAFE' = 'SAFE';
  if (cr < 0) {
    badge = 'DANGER';
  } else if (cr <= 1) {
    badge = 'WARNING';
  }
  
  return { cr, badge };
}