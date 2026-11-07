// Message proposé au visiteur qui écrit pour contribuer. Pas un numéro :
// le numéro est toujours celui saisi par l’administrateur.
const WHATSAPP_MESSAGE = 'Bonjour, j’aimerais contribuer à l’ajout de cantiques dans Atmosphère. Comment puis-je participer ?';

const normalizeWhatsappNumber = (value) => String(value ?? '').trim();

// Format international : commence par +, 8 à 15 chiffres (E.164), espaces autorisés.
const isInternationalWhatsappNumber = (value) => {
  const raw = normalizeWhatsappNumber(value);
  if (!raw.startsWith('+')) return false;
  if (!/^\+\d[\d\s().-]{6,22}$/.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

const whatsappUrl = (number, text = WHATSAPP_MESSAGE) => {
  const digits = normalizeWhatsappNumber(number).replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || WHATSAPP_MESSAGE)}`;
};

module.exports = {
  WHATSAPP_MESSAGE,
  normalizeWhatsappNumber,
  isInternationalWhatsappNumber,
  whatsappUrl,
};
