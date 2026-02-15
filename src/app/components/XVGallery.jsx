'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import HeroBanner from './HeroBanner';

const API_URL = 'https://server-images.soiteg.com';

export default function XVGallery() {
    // --- ESTADOS ---
    const [images, setImages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Modal y Comentarios
    const [modalIndex, setModalIndex] = useState(null);
    const [comments, setComments] = useState([]); // Lista de comentarios de la foto actual
    const [newComment, setNewComment] = useState(""); // Input del nuevo comentario
    const [authorName, setAuthorName] = useState(""); // Input del nombre (opcional)

    const [selectedForZip, setSelectedForZip] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // --- EFECTOS ---
    useEffect(() => { fetchCategories(); }, []);
    useEffect(() => { fetchImages(); }, [selectedCategory]);

    // Cuando se abre una foto (modalIndex cambia), cargamos sus comentarios
    useEffect(() => {
        if (modalIndex !== null) {
            const imgId = images[modalIndex].id;
            fetchComments(imgId);
        } else {
            setComments([]); // Limpiar al cerrar
        }
    }, [modalIndex]); // Dependencia: modalIndex (y images si cambia el orden)

    // --- API CALLS ---
    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories`);
            setCategories(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchImages = async () => {
        try {
            const res = await fetch(`${API_URL}/images?category_id=${selectedCategory}`);
            setImages(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchComments = async (imgId) => {
        try {
            const res = await fetch(`${API_URL}/images/${imgId}/comments`);
            setComments(await res.json());
        } catch (e) { console.error(e); }
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
                setComments(prev => [data.comment, ...prev]); // Añadir al inicio
                setNewComment(""); // Limpiar input
            }
        } catch (e) { alert("Error al comentar"); }
    };

    // --- ACCIONES DE FOTO ---
    const toggleEditRequest = async (imgId) => {
        // ... (Tu código existente para editar)
        const res = await fetch(`${API_URL}/images/${imgId}/toggle-edit`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) updateImageState(imgId, { is_requested: data.is_requested });
    };

    const toggleDeleteRequest = async (imgId) => {
        if (!confirm("¿Quieres marcar esta foto para que sea eliminada?")) return;

        const res = await fetch(`${API_URL}/images/${imgId}/toggle-delete`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            updateImageState(imgId, { is_deletion_requested: data.is_deletion_requested });
            alert(data.is_deletion_requested ? "Marcada para eliminar 🗑️" : "Desmarcada ✅");
        }
    };

    const updateImageState = (id, newProps) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, ...newProps } : img));
    };

    // --- UTILIDADES ---
    const toggleZipSelection = (imgId) => {
        const newSet = new Set(selectedForZip);
        newSet.has(imgId) ? newSet.delete(imgId) : newSet.add(imgId);
        setSelectedForZip(newSet);
    };

    const downloadZip = async () => { /* ... Tu código de ZIP existente ... */ };
    const handleUpload = async (e) => { /* ... Tu código de Upload existente ... */ };

    // Teclado
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
        <div className="bg-neutral-50 min-h-screen pb-20 font-sans">
            {/* OJO: Actualiza la URL aquí también */}
            <HeroBanner images={images.map(img => ({ ...img, url: `${API_URL}${img.url}` }))} />

            <div className="max-w-7xl mx-auto px-4 -mt-10 relative z-10">
                {/* BARRA DE CONTROL */}
                <div className="bg-white rounded-xl shadow-xl p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
                    {/* ... (Categorías y Botones igual que antes) ... */}
                    <div className="flex gap-2 overflow-x-auto w-full md:w-auto">
                        <button onClick={() => setSelectedCategory('all')} className="px-4 py-2 bg-gray-100 rounded-full font-bold text-sm">Todas</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="px-4 py-2 bg-gray-100 rounded-full font-bold text-sm whitespace-nowrap">{cat.name}</button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <label className="cursor-pointer bg-black text-white px-4 py-2 rounded-lg text-sm font-bold">
                            Subir 📷 <input type="file" className="hidden" onChange={handleUpload} accept="image/*" />
                        </label>
                        <button onClick={() => setIsSelectionMode(!isSelectionMode)} className="px-4 py-2 border rounded-lg text-sm font-bold">
                            {isSelectionMode ? 'Cancelar' : 'Seleccionar'}
                        </button>
                    </div>
                </div>

                {/* GRID */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((img, idx) => {
                        const isZipSelected = selectedForZip.has(img.id);
                        return (
                            <div key={img.id} onClick={() => isSelectionMode ? toggleZipSelection(img.id) : setModalIndex(idx)}
                                className={`relative aspect-[3/4] group rounded-lg overflow-hidden cursor-pointer transition-all
                                ${isZipSelected ? 'ring-4 ring-blue-400 scale-95' : ''} 
                                ${img.is_requested ? 'ring-4 ring-green-500' : ''}
                                ${img.is_deletion_requested ? 'grayscale opacity-50 ring-4 ring-red-500' : ''}
                            `}>
                                <Image
                                    src={`${API_URL}${img.url}`}
                                    alt="Foto" fill className="object-cover"
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                />

                                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                                    {img.is_requested && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow">Edición ✅</span>}
                                    {img.is_deletion_requested && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow">Borrar 🗑️</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- MODAL AVANZADO (CON COMENTARIOS) --- */}
            {modalImage && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-md p-4 overflow-y-auto">
                    <button onClick={() => setModalIndex(null)} className="fixed top-5 right-5 text-white text-4xl z-[60] hover:text-pink-500">&times;</button>

                    <div className="bg-white w-full max-w-6xl rounded-xl overflow-hidden flex flex-col md:flex-row shadow-2xl h-[90vh]">

                        {/* 1. LADO IZQUIERDO: IMAGEN */}
                        <div className="w-full md:w-2/3 bg-black relative flex items-center justify-center h-1/2 md:h-full group">
                            <div className="relative w-full h-full">
                                <Image src={`${API_URL}${modalImage.url}`} alt="Full" fill className="object-contain" />
                            </div>

                            {/* Flechas de navegación */}
                            <button className="absolute left-4 text-white text-5xl hover:bg-black/50 rounded-full p-2"
                                onClick={(e) => { e.stopPropagation(); setModalIndex(prev => (prev - 1 + images.length) % images.length); }}>&#8249;</button>
                            <button className="absolute right-4 text-white text-5xl hover:bg-black/50 rounded-full p-2"
                                onClick={(e) => { e.stopPropagation(); setModalIndex(prev => (prev + 1) % images.length); }}>&#8250;</button>
                        </div>

                        {/* 2. LADO DERECHO: INTERACCIÓN */}
                        <div className="w-full md:w-1/3 bg-white flex flex-col h-1/2 md:h-full">

                            {/* Header del Panel */}
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-700">Detalles de la foto</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleDeleteRequest(modalImage.id)}
                                        className={`p-2 rounded-full text-white text-xs font-bold transition ${modalImage.is_deletion_requested ? 'bg-red-600' : 'bg-gray-300 hover:bg-red-500'}`}
                                        title="Solicitar eliminar"
                                    >
                                        🗑️
                                    </button>
                                    <button
                                        onClick={() => toggleEditRequest(modalImage.id)}
                                        className={`p-2 rounded-full text-white text-xs font-bold transition ${modalImage.is_requested ? 'bg-green-600' : 'bg-gray-300 hover:bg-green-500'}`}
                                        title="Solicitar edición"
                                    >
                                        ✏️
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Comentarios (Scrollable) */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {comments.length === 0 ? (
                                    <p className="text-gray-400 text-center italic text-sm mt-10">Sé el primero en comentar...</p>
                                ) : (
                                    comments.map((c, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 font-bold text-xs shrink-0">
                                                {c.author.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="bg-gray-100 rounded-lg p-3 text-sm w-full">
                                                <p className="font-bold text-gray-800 text-xs">{c.author}</p>
                                                <p className="text-gray-600">{c.text}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Input para Comentar */}
                            <form onSubmit={postComment} className="p-4 border-t bg-gray-50">
                                <input
                                    type="text"
                                    placeholder="Tu nombre (opcional)"
                                    className="w-full mb-2 p-2 text-sm border rounded focus:outline-none focus:border-pink-500"
                                    value={authorName}
                                    onChange={e => setAuthorName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Escribe un comentario..."
                                        className="w-full p-2 text-sm border rounded focus:outline-none focus:border-pink-500"
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                    />
                                    <button type="submit" className="bg-pink-600 text-white px-4 rounded font-bold hover:bg-pink-700">
                                        ➤
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}