import { useEffect, useRef } from 'react';
import lottie from 'lottie-web';

export default function SuccessOverlay({ show, message, onDone }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!show || !ref.current) return;
    const anim = lottie.loadAnimation({
      container: ref.current,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      path: '/Done.json',
    });
    const t = setTimeout(onDone, 2200);
    return () => {
      anim.destroy();
      clearTimeout(t);
    };
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="success-overlay">
      <div className="success-box">
        <div ref={ref} className="success-lottie" />
        <p className="success-text">{message || 'Done!'}</p>
      </div>
    </div>
  );
}