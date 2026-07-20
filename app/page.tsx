import dynamic from 'next/dynamic';

// ponytail: dynamic import with ssr:false — Three.js is browser-only
const CityCanvas = dynamic(() => import('./_components/city-canvas'), {
  ssr: false,
});

export default function Home() {
  return <CityCanvas />;
}
