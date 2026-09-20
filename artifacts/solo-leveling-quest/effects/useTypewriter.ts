import { useState, useEffect } from 'react';

export const useTypewriter = (
  text: string,
  speed: number = 35,
  startDelay: number = 0,
  active: boolean = true
) => {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    setDisplayed('');
    setIsDone(false);
    let index = 0;

    const delayTimer = setTimeout(() => {
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayed(text.slice(0, index + 1));
          index++;
        } else {
          setIsDone(true);
          clearInterval(interval);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(delayTimer);
  }, [text, speed, startDelay, active]);

  return { displayed, isDone };
};
