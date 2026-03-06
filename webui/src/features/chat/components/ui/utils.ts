export const parseThinking = (text: string) => {
  const match = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  if (match) {
    return {
      thinkingText: match[1].trim(),
      cleanContent: text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim(),
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
