'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import HeroBanner from './HeroBanner';

const API_URL = 'https://server-images.soiteg.com';

export default function XVGallery() {
    // --- ESTADOS DE DATOS ---
    const [images, setImages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');

    // --- ESTADOS DE UI (MODAL & CHAT) ---
    const [modalIndex, setModalIndex] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [authorName, setAuthorName] = useState("");
    const [isSheetOpen, setIsSheetOpen] = useState(false); // Para el chat en móvil

    // --- ESTADOS DE GESTIÓN (SELECCIÓN & UPLOAD) ---
    const [selectedForZip, setSelectedForZip] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Estado para subida masiva
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    const commentsEndRef = useRef(null);

    // --- EFECTOS ---
    useEffect(() => { fetchCategories(); }, []);
    useEffect(() => { fetchImages(); }, [selectedCategory]);

    // Control del Modal y Scroll del Body
    useEffect(() => {
        if (modalIndex !== null) {
            const imgId = images[modalIndex].id;
            fetchComments(imgId);
            setIsSheetOpen(false); // Empezar con chat cerrado en móvil
            document.body.style.overflow = 'hidden'; // Bloquear scroll de fondo
        } else {
            document.body.style.overflow = 'unset'; // Desbloquear scroll
        }
    }, [modalIndex]); // Dependencia simplificada para evitar loops

    // Scroll automático al último comentario
    useEffect(() => {
        if (isSheetOpen || modalIndex !== null) {
            commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [comments, isSheetOpen]);

    // --- API CALLS ---
    const fetchCategories = async () => {
        try { const res = await fetch(`${API_URL}/categories`); setCategories(await res.json()); } catch (e) { }
    };

    const fetchImages = async () => {
        try { const res = await fetch(`${API_URL}/images?category_id=${selectedCategory}`); setImages(await res.json()); } catch (e) { }
    };

    const fetchComments = async (imgId) => {
        try { const res = await fetch(`${API_URL}/images/${imgId}/comments`); setComments(await res.json()); } catch (e) { }
    };

    const postComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const imgId = images[modalIndex].id;
        try {
            const res = await fetch(`${API_URL}/images/${imgId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ author: authorName, text: newComment })
            });
            const data = await res.json();
            if (data.success) {
                setComments(prev => [data.comment, ...prev]);
                setNewComment("");
            }
        } catch (e) { alert("Error al conectar"); }
    };

    const toggleEditRequest = async (imgId) => {
        const res = await fetch(`${API_URL}/images/${imgId}/toggle-edit`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) updateImageState(imgId, { is_requested: data.is_requested });
    };

    const toggleDeleteRequest = async (imgId) => {
        if (!confirm("¿Marcar para eliminar?")) return;
        const res = await fetch(`${API_URL}/images/${imgId}/toggle-delete`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) updateImageState(imgId, { is_deletion_requested: data.is_deletion_requested });
    };

    const updateImageState = (id, newProps) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, ...newProps } : img));
    };

    // --- SUBIDA MASIVA POR LOTES (BATCH UPLOAD) ---
    const handleUpload = async (e) => {
        const allFiles = Array.from(e.target.files);
        if (allFiles.length === 0) return;

        setIsUploading(true);
        setUploadProgress({ current: 0, total: allFiles.length });

        const BATCH_SIZE = 10; // Subir de 10 en 10
        const totalBatches = Math.ceil(allFiles.length / BATCH_SIZE);

        try {
            for (let i = 0; i < totalBatches; i++) {
                const start = i * BATCH_SIZE;
                const end = start + BATCH_SIZE;
                const batch = allFiles.slice(start, end);

                const formData = new FormData();
                batch.forEach(file => formData.append('images', file));
                formData.append('category_id', selectedCategory === 'all' ? 1 : selectedCategory);

                await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });

                // Actualizar progreso visual
                setUploadProgress(prev => ({
                    ...prev,
                    current: Math.min(prev.total, end)
                }));
            }
            alert("¡Carga completa! 🚀");
            e.target.value = null;
            fetchImages();
        } catch (error) {
            console.error(error);
            alert("Hubo un error en la carga.");
        } finally {
            setIsUploading(false);
            setUploadProgress({ current: 0, total: 0 });
        }
    };

    // --- DESCARGA ZIP ---
    const toggleZipSelection = (imgId) => {
        const newSet = new Set(selectedForZip);
        newSet.has(imgId) ? newSet.delete(imgId) : newSet.add(imgId);
        setSelectedForZip(newSet);
    };

    const downloadZip = async () => {
        if (selectedForZip.size === 0) return alert("Selecciona fotos primero");
        const zip = new JSZip();
        const folder = zip.folder("XV-Seleccion");
        const targets = images.filter(img => selectedForZip.has(img.id));
        alert(`Comprimiendo ${targets.length} fotos...`);

        const promises = targets.map(async (img) => {
            const filename = img.url.split('/').pop();
            try {
                const resp = await fetch(`${API_URL}${img.url}`);
                const blob = await resp.blob();
                folder.file(filename, blob);
            } catch (e) { console.error(e); }
        });

        await Promise.all(promises);
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "mis-fotos-xv.zip");
    };

    // --- NAVEGACIÓN TECLADO ---
    const handleKeyDown = useCallback((e) => {
        if (modalIndex === null) return;
        if (e.key === 'ArrowRight') setModalIndex(prev => (prev + 1) % images.length);
        if (e.key === 'ArrowLeft') setModalIndex(prev => (prev - 1 + images.length) % images.length);
        if (e.key === 'Escape') setModalIndex(null);
    }, [modalIndex, images.length]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const modalImage = modalIndex !== null ? images[modalIndex] : null;

    return (
        <div className="bg-neutral-50 min-h-screen pb-20 font-sans selection:bg-pink-200">

            <HeroBanner images={images.map(img => ({ ...img, url: `${API_URL}${img.url}` }))} />

            <div className="max-w-7xl mx-auto px-4 -mt-10 relative z-10">
                {/* BARRA DE HERRAMIENTAS STICKY */}
                <div className="bg-white rounded-xl shadow-xl p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center sticky top-2 z-20 border border-gray-100">

                    {/* Filtros Categorías */}
                    <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                        <button onClick={() => setSelectedCategory('all')} className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${selectedCategory === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>Todas</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${selectedCategory == cat.id ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{cat.name}</button>
                        ))}
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex gap-3 w-full md:w-auto items-center">
                        <label className={`flex-1 md:flex-none text-center cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-gray-700 transition flex items-center justify-center gap-2 ${isUploading ? 'opacity-80 cursor-wait' : ''}`}>
                            {isUploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs">Subiendo {uploadProgress.current}/{uploadProgress.total}</span>
                                </>
                            ) : (
                                <>
                                    <span>Subir 📷</span>
                                    <input type="file" className="hidden" onChange={handleUpload} accept="image/*" multiple disabled={isUploading} />
                                </>
                            )}
                        </label>

                        <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={`flex-1 md:flex-none px-4 py-2 border rounded-lg text-sm font-bold transition ${isSelectionMode ? 'bg-pink-50 border-pink-500 text-pink-700' : 'bg-white'}`}>
                            {isSelectionMode ? 'Cancelar' : 'Seleccionar'}
                        </button>

                        {isSelectionMode && selectedForZip.size > 0 && (
                            <button onClick={downloadZip} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold animate-pulse shadow-lg">
                                ⬇️ ({selectedForZip.size})
                            </button>
                        )}
                    </div>
                </div>

                {/* GRID DE FOTOS */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {images.map((img, idx) => {
                        const isZipSelected = selectedForZip.has(img.id);
                        return (
                            <div key={img.id} onClick={() => isSelectionMode ? toggleZipSelection(img.id) : setModalIndex(idx)}
                                className={`relative aspect-[3/4] group rounded-lg overflow-hidden cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl
                                ${isZipSelected ? 'ring-4 ring-blue-500 scale-95' : ''} 
                                ${img.is_requested ? 'ring-4 ring-green-500' : ''}
                                ${img.is_deletion_requested ? 'grayscale opacity-60 ring-4 ring-red-500' : ''}
                            `}>
                                <Image
                                    src={`${API_URL}${img.url}`}
                                    alt="Foto XV" fill className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                />
                                {/* Badges */}
                                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                                    {img.is_requested && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md backdrop-blur-md">Edición ✅</span>}
                                    {img.is_deletion_requested && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md backdrop-blur-md">Borrar 🗑️</span>}
                                    {isZipSelected && <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md">Descargar</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- MODAL / LIGHTBOX (Responsive) --- */}
            {modalImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">

                    {/* Contenedor Principal Adaptable */}
                    <div className="relative w-full h-[100dvh] md:h-[90vh] md:max-w-6xl md:rounded-xl md:bg-black md:flex md:flex-row overflow-hidden">

                        {/* 1. SECCIÓN IMAGEN */}
                        <div className="relative w-full h-full md:w-2/3 bg-black flex items-center justify-center">

                            {/* Imagen con ajuste de altura dinámica en móvil */}
                            <div className={`relative w-full h-full transition-all duration-300 ${isSheetOpen ? 'h-[40%] opacity-50' : 'h-full opacity-100'} md:h-full md:opacity-100`}>
                                <Image
                                    src={`${API_URL}${modalImage.url}`}
                                    alt="Full View" fill className="object-contain" priority
                                    onClick={() => setIsSheetOpen(false)} // Click cierra chat móvil
                                />
                            </div>

                            {/* Botón Cerrar Global */}
                            <button onClick={() => setModalIndex(null)} className="absolute top-4 right-4 z-50 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl backdrop-blur-sm hover:bg-red-500 transition">&times;</button>

                            {/* Navegación Desktop */}
                            <button className="hidden md:block absolute left-4 text-white text-5xl hover:bg-white/10 rounded-full p-2" onClick={(e) => { e.stopPropagation(); setModalIndex(prev => (prev - 1 + images.length) % images.length); }}>&#8249;</button>
                            <button className="hidden md:block absolute right-4 text-white text-5xl hover:bg-white/10 rounded-full p-2" onClick={(e) => { e.stopPropagation(); setModalIndex(prev => (prev + 1) % images.length); }}>&#8250;</button>

                            {/* Barra Inferior Móvil (Visible solo si chat cerrado) */}
                            {!isSheetOpen && (
                                <div className="md:hidden absolute bottom-0 left-0 w-full p-6 pb-10 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-between items-end z-40">
                                    <div className="flex gap-6">
                                        <button onClick={(e) => { e.stopPropagation(); toggleEditRequest(modalImage.id); }} className="flex flex-col items-center gap-1">
                                            <div className={`p-2 rounded-full transition ${modalImage.is_requested ? 'bg-green-500 text-white' : 'bg-white/20 text-white'}`}>✨</div>
                                            <span className="text-[10px] text-white">Editar</span>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); toggleDeleteRequest(modalImage.id); }} className="flex flex-col items-center gap-1">
                                            <div className={`p-2 rounded-full transition ${modalImage.is_deletion_requested ? 'bg-red-500 text-white' : 'bg-white/20 text-white'}`}>🗑️</div>
                                            <span className="text-[10px] text-white">Borrar</span>
                                        </button>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setIsSheetOpen(true); }} className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold text-sm shadow-xl active:scale-95 transition">
                                        💬 Comentar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 2. SECCIÓN CHAT (Bottom Sheet Móvil / Sidebar Desktop) */}
                        <div
                            className={`
                                fixed bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.3)]
                                flex flex-col transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) z-50
                                md:relative md:w-1/3 md:rounded-none md:shadow-none md:translate-y-0
                                ${isSheetOpen ? 'translate-y-0 h-[60dvh]' : 'translate-y-full h-0 md:h-full'}
                            `}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Manija Móvil */}
                            <div className="md:hidden w-full h-10 flex items-center justify-center cursor-pointer border-b active:bg-gray-50 rounded-t-3xl" onClick={() => setIsSheetOpen(false)}>
                                <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
                            </div>

                            {/* Header Desktop */}
                            <div className="hidden md:flex p-4 border-b justify-between items-center bg-gray-50">
                                <h3 className="font-bold">Comentarios</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleEditRequest(modalImage.id)} className={`p-2 rounded-full transition ${modalImage.is_requested ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Editar">✨</button>
                                    <button onClick={() => toggleDeleteRequest(modalImage.id)} className={`p-2 rounded-full transition ${modalImage.is_deletion_requested ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`} title="Borrar">🗑️</button>
                                </div>
                            </div>

                            {/* Lista Comentarios */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                                {comments.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                        <span className="text-3xl">💬</span>
                                        <p className="text-sm mt-2">Sé el primero en comentar</p>
                                    </div>
                                ) : (
                                    comments.map((c, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                {c.author ? c.author.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div className="bg-gray-100 rounded-2xl rounded-tl-none p-3 text-sm w-full">
                                                <p className="font-bold text-gray-900 text-xs mb-1">{c.author || 'Invitado'}</p>
                                                <p className="text-gray-700 leading-snug">{c.text}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={commentsEndRef} />
                            </div>

                            {/* Input Fijo */}
                            <form onSubmit={postComment} className="p-3 border-t bg-gray-50 pb-safe">
                                {authorName === "" && (
                                    <input type="text" placeholder="Tu nombre..." className="text-xs text-gray-500 px-2 py-1 bg-transparent focus:outline-none w-full" onChange={e => setAuthorName(e.target.value)} />
                                )}
                                <div className="flex gap-2 items-center bg-white rounded-full px-4 py-2 border focus-within:border-pink-500 shadow-sm transition">
                                    <input type="text" placeholder="Escribe un comentario..." className="bg-transparent w-full text-sm focus:outline-none" value={newComment} onChange={e => setNewComment(e.target.value)} onFocus={() => setAuthorName(authorName || "Invitado")} />
                                    <button type="submit" disabled={!newComment.trim()} className="text-pink-600 font-bold text-sm disabled:opacity-30 hover:scale-105 transition">Enviar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}