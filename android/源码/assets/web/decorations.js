// Keep reference files unchanged. Remove only dark pixels connected to the image edge.
// Interior eyes, hair accessories and character colours are never recoloured.
const cutouts=Array.from({length:5},(_,i)=>extract(`./assets/decor-${i+1}.jpg`));
async function extract(src){
 const img=new Image();img.src=src;await img.decode();
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
 const w=canvas.width,h=canvas.height,n=w*h,seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
 function add(p){if(seen[p])return;seen[p]=1;const k=p*4;if(Math.max(data[k],data[k+1],data[k+2])<=65)queue[tail++]=p;}
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 while(head<tail){const p=queue[head++];data[p*4+3]=0;const x=p%w;if(x)add(p-1);if(x<w-1)add(p+1);if(p>=w)add(p-w);if(p<n-w)add(p+w);}
 ctx.putImageData(pixels,0,0);
 return await new Promise(resolve=>canvas.toBlob(blob=>resolve(URL.createObjectURL(blob)),'image/png'));
}
export function decorateCards(root){
 root.querySelectorAll('.card').forEach((card,i)=>{
  card.style.setProperty('--decal','none');
  cutouts[i%5].then(url=>{if(card.isConnected)card.style.setProperty('--decal',`url("${url}")`);}).catch(()=>{});
 });
}
