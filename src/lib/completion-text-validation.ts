export const COMPLETION_TEXT_MAX_WORDS = 500;

export interface CompletionTextValidation {
  wordCount: number;
  error: string | null;
}

export function validateCompletionText(value: string): CompletionTextValidation {
  const text = value.trim();
  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
  const wordCount = words.length;

  if (!text) return { wordCount: 0, error: null };
  if (wordCount > COMPLETION_TEXT_MAX_WORDS) {
    return { wordCount, error: `Maximum of ${COMPLETION_TEXT_MAX_WORDS} words only.` };
  }
  if (/(.)\1{4,}/iu.test(text)) {
    return { wordCount, error: 'Please enter meaningful English or Filipino text; repeated random characters are not allowed.' };
  }
  if (/\b(?:qwerty|asdfg?|zxcv|hjkl|qazwsx|random)\w*\b/iu.test(text)) {
    return { wordCount, error: 'Random or keyboard-mashed words are not allowed.' };
  }

  const normalizedWords = words.map((word) => word.toLocaleLowerCase('en-PH'));
  const repeatedRun = normalizedWords.some((word, index) =>
    index >= 4 && normalizedWords.slice(index - 4, index + 1).every((item) => item === word),
  );
  if (repeatedRun) {
    return { wordCount, error: 'Repeated random words are not allowed.' };
  }

  const letterWords = words.filter((word) => /\p{L}/u.test(word));
  const suspiciousWords = letterWords.filter((word) => {
    const letters = word.replace(/[^\p{L}]/gu, '');
    const isAcronym = letters.length <= 6 && letters === letters.toUpperCase();
    return letters.length >= 4 && !isAcronym && !/[aeiouáéíóú]/iu.test(letters);
  });
  if (suspiciousWords.length >= Math.max(1, Math.ceil(letterWords.length * 0.35))) {
    return { wordCount, error: 'Please enter meaningful English or Filipino words.' };
  }

  const symbols = (text.match(/[^\p{L}\p{N}\s.,!?;:'"()/%&+@#–—-]/gu) ?? []).length;
  if (symbols > Math.max(3, Math.floor(text.length * 0.15))) {
    return { wordCount, error: 'Too many random symbols are not allowed.' };
  }

  return { wordCount, error: null };
}
