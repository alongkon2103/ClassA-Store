// Runs in the head before first paint, without adding a server-side cache dependency.
export const themeBootstrap = `(()=>{try{const r=document.documentElement,t=localStorage.getItem("theme");if(t==="light"||t==="dark")r.dataset.theme=t;r.dataset.seasonalPreference=localStorage.getItem("halloween-theme")==="off"?"off":"on"}catch{}})()`
