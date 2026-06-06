import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import type { HomeCarouselSlide } from '../types/home';

const AUTO_SCROLL_INTERVAL_MS = 9000;
const AUTO_SCROLL_RESUME_DELAY_MS = 15000;

export function useHomeCarousel({
  bannerWidth,
  slideCount,
}: {
  bannerWidth: number;
  slideCount: number;
}) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<FlatList<HomeCarouselSlide>>(null);
  const carouselIndexRef = useRef(0);
  const autoScrollStoppedRef = useRef(false);
  const autoScrollResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const pauseAutoScrollTemporarily = useCallback(() => {
    autoScrollStoppedRef.current = true;
    if (autoScrollResumeTimerRef.current) {
      clearTimeout(autoScrollResumeTimerRef.current);
    }
    autoScrollResumeTimerRef.current = setTimeout(() => {
      autoScrollStoppedRef.current = false;
    }, AUTO_SCROLL_RESUME_DELAY_MS);
  }, []);

  const handleBannerMomentumEnd = useCallback(
    (event: any) => {
      const layoutWidth =
        event?.nativeEvent?.layoutMeasurement?.width || bannerWidth;
      const offsetX = event?.nativeEvent?.contentOffset?.x || 0;
      const rawIndex = Math.round(offsetX / layoutWidth);
      const index = Math.max(0, Math.min(rawIndex, slideCount - 1));
      carouselIndexRef.current = index;
      setCarouselIndex(index);
    },
    [bannerWidth, slideCount],
  );

  useEffect(() => {
    const maxIndex = slideCount - 1;
    if (carouselIndexRef.current <= maxIndex) {
      return;
    }
    carouselIndexRef.current = 0;
    setCarouselIndex(0);
    carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [slideCount]);

  useEffect(() => {
    if (slideCount <= 1) {
      return;
    }

    const timer = setInterval(() => {
      if (autoScrollStoppedRef.current) {
        return;
      }

      const nextIndex = (carouselIndexRef.current + 1) % slideCount;
      carouselIndexRef.current = nextIndex;
      try {
        carouselRef.current?.scrollToOffset({
          offset: nextIndex * bannerWidth,
          animated: true,
        });
      } catch {
        // Guard against layout-not-ready race conditions.
      }
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      if (autoScrollResumeTimerRef.current) {
        clearTimeout(autoScrollResumeTimerRef.current);
        autoScrollResumeTimerRef.current = null;
      }
    };
  }, [bannerWidth, slideCount]);

  useEffect(() => {
    if (carouselIndexRef.current < slideCount) {
      return;
    }

    const nextIndex = Math.max(0, slideCount - 1);
    carouselIndexRef.current = nextIndex;
    setCarouselIndex(nextIndex);
  }, [slideCount]);

  return {
    carouselIndex,
    carouselRef,
    handleBannerMomentumEnd,
    pauseAutoScrollTemporarily,
  };
}
