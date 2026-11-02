// Runs in the head before first paint, without adding a server-side cache dependency.
export const themeBootstrap = `(()=>{const r=document.documentElement;r.dataset.seasonalPreference="off";try{const t=localStorage.getItem("theme");if(t==="light"||t==="dark")r.dataset.theme=t}catch{}})()`
