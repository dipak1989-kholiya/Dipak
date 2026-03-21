import { useEffect } from 'react';

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
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, []);

  return (
    <div className="w-full overflow-hidden my-4 flex justify-center bg-zinc-900/50 rounded-xl border border-white/5 p-2">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={import.meta.env.VITE_ADMOB_APP_ID?.split('~')[0] || ''}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
    </div>
  );
}
