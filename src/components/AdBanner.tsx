import { useEffect, useRef } from 'react';

interface AdBannerProps {
  adSlot?: string;
  adFormat?: 'auto' | 'fluid' | 'rectangle';
  fullWidthResponsive?: boolean;
}

export default function AdBanner({ 
  adSlot = 'YOUR_AD_SLOT', 
  adFormat = 'auto', 
  fullWidthResponsive = true 
}: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once per mount and if the container has width
    if (initialized.current) return;

    const pushAd = () => {
      if (adRef.current && adRef.current.offsetWidth > 0) {
        try {
          // @ts-ignore
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          initialized.current = true;
        } catch (e) {
          console.error('AdSense error:', e);
        }
      }
    };

    // Small delay to ensure layout
    const timer = setTimeout(pushAd, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={adRef} className="w-full overflow-hidden my-4 flex justify-center bg-zinc-900/50 rounded-xl border border-white/5 p-2 min-h-[100px]">
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minWidth: '250px' }}
        data-ad-client={import.meta.env.VITE_ADMOB_APP_ID?.split('~')[0].replace('ca-app-pub-', 'ca-pub-') || ''}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
    </div>
  );
}
