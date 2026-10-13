const CACHE='meow-ledger-v0.2.2';
const ASSETS=['./','./index.html','./style.css','./app.js','./engine.js','./decorations.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/companion.png','./assets/decor-1.jpg','./assets/decor-2.jpg','./assets/decor-3.jpg','./assets/decor-4.jpg','./assets/decor-5.jpg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;
  }).catch(async()=>{
    const hit=await caches.match(event.request);if(hit)return hit;
    if(event.request.mode==='navigate')return caches.match('./index.html');
    return new Response('Offline resource unavailable',{status:503});
  }));
});
