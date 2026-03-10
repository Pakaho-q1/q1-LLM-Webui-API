export const parseThinking = (text: string) => {
  const match = text.match(/<(think|thinking)>([\s\S]*?)(?:<\/\1>|$)/i);
  if (match) {
    return {
      thinkingText: match[2].trim(),
      cleanContent: text.replace(/<(think|thinking)>[\s\S]*?(?:<\/\1>|$)/i, '').trim(),
    };
  }
  return { thinkingText: null, cleanContent: text };
};

export const preprocessContent = (text: string) => {
  if (!text) return '';
  return text
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
};
