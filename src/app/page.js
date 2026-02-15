import XVGallery from "./components/XVGallery";


export const metadata = {
  title: 'XV Años Camila - Galería',
  description: 'Selecciona tus fotos favoritas',
};

export default function Home() {
  return (
    <main>
      <XVGallery />
    </main>
  );
}