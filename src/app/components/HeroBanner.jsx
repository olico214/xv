'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function HeroBanner({ images }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fade, setFade] = useState(true);

    // Solo usamos las primeras 5 fotos para el banner para no cargar de más
    const bannerImages = images.slice(0, 5);

    useEffect(() => {
        if (bannerImages.length <= 1) return;

        const interval = setInterval(() => {
            setFade(false); // Fade out
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % bannerImages.length);
                setFade(true); // Fade in
            }, 500); // Tiempo que tarda la transición CSS
        }, 5000); // Cambia cada 5 segundos

        return () => clearInterval(interval);
    }, [bannerImages.length]);

    if (bannerImages.length === 0) return null;

    return (
        <div className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden bg-black">
            {/* Imagen de Fondo con Transición */}
            <div
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${fade ? 'opacity-100' : 'opacity-40'
                    }`}
            >
                <Image
                    src={bannerImages[currentIndex].url}
                    alt="Hero XV"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />
            </div>

            {/* Textos */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4 z-10">
                <h1 className="text-6xl md:text-8xl font-serif tracking-widest mb-4 drop-shadow-lg text-pink-200">
                    Mis XV Años
                </h1>
                <p className="text-xl md:text-2xl font-light tracking-wide uppercase border-t border-b border-pink-500 py-2 px-8">
                    Galería Oficial
                </p>
            </div>
        </div>
    );
}