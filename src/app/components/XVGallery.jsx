'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import HeroBanner from './HeroBanner';

const API_URL = 'https://server-images.soiteg.com';

export default function XVGallery() {
    // ... (El resto de tus estados e imports siguen igual) ...
    const [images, setImages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [modalIndex, setModalIndex] = useState(null);
    const [selectedForZip, setSelectedForZip] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // ... (useEffect y fetchs siguen igual) ...

    useEffect(() => { fetchCategories(); }, []);
    useEffect(() => { fetchImages(); }, [selectedCategory]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories`);
            const data = await res.json();
            setCategories(data);
        } catch (e) { console.error("Error cat:", e); }
    };

    const fetchImages = async () => {
        console.log(API_URL)
        try {
            const res = await fetch(`${API_URL}/images?category_id=${selectedCategory}`);
            const data = await res.json();
            setImages(data);
        } catch (e) { console.error("Error img:", e); }
    };

    const toggleEditRequest = async (imgId) => {
        try {
            const res = await fetch(`${API_URL}/images/${imgId}/toggle-edit`, { method: 'PUT' });
            const data = await res.json();
            if (data.success) {
                setImages(prev => prev.map(img =>
                    img.id === imgId ? { ...img, is_requested: data.is_requested } : img
                ));
            }
        } catch (error) { alert("Error al conectar"); }
    };

    const toggleZipSelection = (imgId) => {
        const newSet = new Set(selectedForZip);
        if (newSet.has(imgId)) newSet.delete(imgId);
        else newSet.add(imgId);
        setSelectedForZip(newSet);
    };

    // --- CORRECCIÓN 1: DESCARGA ZIP ---
    const downloadZip = async () => {
        if (selectedForZip.size === 0) return alert("Selecciona fotos primero");
        const zip = new JSZip();
        const folder = zip.folder("XV-Seleccion");

        const targets = images.filter(img => selectedForZip.has(img.id));
        alert(`Preparando ${targets.length} fotos...`);

        const promises = targets.map(async (img) => {
            const filename = img.url.split('/').pop();
            // ¡AQUÍ FALTABA EL API_URL!
            const fullUrl = `${API_URL}${img.url}`;

            try {
                const resp = await fetch(fullUrl);
                if (!resp.ok) throw new Error("Error fetching image");
                const blob = await resp.blob();
                folder.file(filename, blob);
            } catch (e) {
                console.error("No se pudo descargar:", fullUrl);
            }
        });

        await Promise.all(promises);
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "mis-fotos-xv.zip");
    };

    // ... (Lógica de teclado y upload siguen igual) ...
    const handleKeyDown = useCallback((e) => {
        if (modalIndex === null) return;
        if (e.key === 'ArrowRight') setModalIndex((prev) => (prev + 1) % images.length);
        if (e.key === 'ArrowLeft') setModalIndex((prev) => (prev - 1 + images.length) % images.length);
        if (e.key === 'Escape') setModalIndex(null);
    }, [modalIndex, images.length]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        formData.append('category_id', selectedCategory === 'all' ? 1 : selectedCategory);
        await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        fetchImages();
    };

    const modalImage = modalIndex !== null ? images[modalIndex] : null;

    return (
        <div className="bg-neutral-50 min-h-screen pb-20">
            {/* OJO: HeroBanner también necesita recibir las imágenes con URLs completas si el componente no lo maneja internamente. 
               Si HeroBanner usa img.url directo, pásale las imagenes ya "mapeadas" o edita HeroBanner.
            */}
            <HeroBanner images={images.map(img => ({ ...img, url: `${API_URL}${img.url}` }))} />

            <div className="max-w-7xl mx-auto px-4 -mt-10 relative z-10">
                {/* BARRA DE CONTROL (Igual que antes) */}
                <div className="bg-white rounded-xl shadow-xl p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                        <button onClick={() => setSelectedCategory('all')} className={`px-4 py-2 rounded-full font-bold transition ${selectedCategory === 'all' ? 'bg-pink-600 text-white' : 'bg-gray-100'}`}>Todas</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-2 rounded-full font-bold transition ${selectedCategory == cat.id ? 'bg-pink-600 text-white' : 'bg-gray-100'}`}>{cat.name}</button>
                        ))}
                    </div>
                    <div className="flex gap-3 items-center">
                        <label className="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700">
                            Subir 📷 <input type="file" className="hidden" onChange={handleUpload} accept="image/*" />
                        </label>
                        <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${isSelectionMode ? 'bg-pink-100 border-pink-500 text-pink-700' : 'bg-white border-gray-300'}`}>
                            {isSelectionMode ? 'Cancelar Selección' : 'Seleccionar para ZIP'}
                        </button>
                        {isSelectionMode && (
                            <button onClick={downloadZip} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg animate-pulse">Descargar ({selectedForZip.size})</button>
                        )}
                    </div>
                </div>

                {/* GRID DE IMÁGENES */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((img, idx) => {
                        const isZipSelected = selectedForZip.has(img.id);
                        return (
                            <div key={img.id} onClick={() => isSelectionMode ? toggleZipSelection(img.id) : setModalIndex(idx)}
                                className={`relative aspect-[3/4] group rounded-lg overflow-hidden cursor-pointer transition-all ${isZipSelected ? 'ring-4 ring-blue-400 scale-95' : ''} ${img.is_requested ? 'ring-4 ring-green-500' : ''}`}>

                                {/* AQUÍ ESTABA BIEN, PERO CONFIRMAMOS */}
                                <Image
                                    src={`${API_URL}${img.url}`}
                                    alt="Foto XV"
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                />

                                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                    {img.is_requested && <span className="bg-green-500 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-full shadow-md">Solicitada ✅</span>}
                                    {isZipSelected && <span className="bg-blue-500 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-full shadow-md">Descargar ⬇️</span>}
                                </div>
                                {!isSelectionMode && (
                                    <button onClick={(e) => { e.stopPropagation(); toggleEditRequest(img.id); }} className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white p-2 rounded-full hover:bg-black">
                                        {img.is_requested ? '✖️' : '✏️'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- CORRECCIÓN 2: MODAL / LIGHTBOX --- */}
            {modalImage && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-md">
                    <button onClick={() => setModalIndex(null)} className="absolute top-5 right-5 text-white text-5xl z-50 hover:text-pink-500">&times;</button>
                    <button className="hidden md:block absolute left-5 text-white text-6xl hover:text-gray-400 p-4" onClick={(e) => { e.stopPropagation(); setModalIndex((prev) => (prev - 1 + images.length) % images.length); }}>&#8249;</button>

                    <div className="relative w-full h-[85vh] max-w-5xl flex flex-col items-center justify-center">
                        <div className="relative w-full h-full">
                            {/* ¡AQUÍ FALTABA EL API_URL! */}
                            <Image
                                src={`${API_URL}${modalImage.url}`}
                                alt="Full View"
                                fill
                                className="object-contain"
                                quality={100}
                            />
                        </div>
                        <div className="mt-4 flex gap-4">
                            <button onClick={(e) => { e.stopPropagation(); toggleEditRequest(modalImage.id); }} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all shadow-lg ${modalImage.is_requested ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-black hover:bg-gray-200'}`}>
                                {modalImage.is_requested ? '✅ Solicitada para Edición' : '✨ Solicitar Edición'}
                            </button>
                        </div>
                    </div>

                    <button className="hidden md:block absolute right-5 text-white text-6xl hover:text-gray-400 p-4" onClick={(e) => { e.stopPropagation(); setModalIndex((prev) => (prev + 1) % images.length); }}>&#8250;</button>
                </div>
            )}
        </div>
    );
}