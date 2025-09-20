/**
 * CaptionCraft - Fixed version (event-name casing bug fixed,
 * initial pageIndex corrected, avoid duplicate filter-sheet)
 */

/* CONFIG */
const CONFIG = {
  categories: [
    { id: 'love-messages', label_en:'Love messages', label_bn:'ভালোবাসার বার্তা' },
    { id: 'fb-story-captions', label_en:'FB story captions', label_bn:'FB স্টোরি ক্যাপশন' },
    { id: 'post-caption-ideas', label_en:'Post caption ideas', label_bn:'পোস্ট ক্যাপশন আইডিয়া' },
    { id: 'motivational', label_en:'Motivational quotes', label_bn:'অনুপ্রেরণামূলক' },
    { id: 'funny-captions', label_en:'Funny captions', label_bn:'হাস্যকর ক্যাপশন' },
    { id: 'aesthetic-lines', label_en:'Aesthetic lines', label_bn:'সুন্দর লাইন' },
    { id: 'emotional-deep', label_en:'Emotional/deep', label_bn:'আবেগপূর্ণ/গভীর' },
    { id: 'birthday-wishes', label_en:'Birthday wishes', label_bn:'জন্মদিনের শুভেচ্ছা' },
    { id: 'wisdom-nuggets', label_en:'Wisdom nuggets', label_bn:'জ্ঞানকণিকা' },
    { id: 'daily-affirmations', label_en:'Daily affirmations', label_bn:'দৈনিক সংকল্প' },
    { id: 'travel', label_en:'Travel', label_bn:'ভ্রমণ' },
    { id: 'friendship', label_en:'Friendship', label_bn:'বন্ধুত্ব' },
    { id: 'food', label_en:'Food', label_bn:'খাবার' }
  ],
  pageSize: 50,
  dataPath: 'data',
  appTitle: 'CaptionCraft'
};

/* Simple utilities */
const qs = s => document.querySelector(s);
const el = (tag, attrs={}, ...children) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if(k==='class') n.className = v;
    else if(k.startsWith('on')) {
      // FIX: normalize event name to lowercase (onClick, onclick both handled)
      const evt = k.slice(2).toLowerCase();
      n.addEventListener(evt, v);
    } else n.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if(typeof c === 'string') n.appendChild(document.createTextNode(c));
    else if(c) n.appendChild(c);
  });
  return n;
};

const uid = (prefix='id') => prefix + '-' + Math.random().toString(36).slice(2,9);

/* Favorites helper */
const Favorites = {
  key(lang, cat) { return `fav::${lang}::${cat}`; },
  load(lang, cat) {
    const raw = localStorage.getItem(this.key(lang,cat));
    return raw ? JSON.parse(raw) : {};
  },
  save(lang, cat, obj) { localStorage.setItem(this.key(lang,cat), JSON.stringify(obj)); }
};

/* Router */
const Router = {
  start() {
    window.addEventListener('hashchange', () => this.renderFromHash());
    this.renderFromHash();
  },
  parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    if(!h) return {page:'gate'};
    const parts = h.split('/');
    if(parts.length === 1) return {page:'lang', lang:parts[0]};
    if(parts.length === 2) return {page:'category', lang:parts[0], category:parts[1]};
    if(parts.length >=3) return {page:'item', lang:parts[0], category:parts[1], id:parts.slice(2).join('/')};
    return {page:'gate'};
  },
  async renderFromHash() {
    const parsed = this.parseHash();
    const root = qs('#app-root');
    root.innerHTML = '';
    root.appendChild(renderHeader(parsed));
    const content = el('div',{class:'content', role:'main'});
    if(parsed.page === 'gate') content.appendChild(renderLanguageGate());
    else if(parsed.page === 'lang') content.appendChild(renderCategoryGrid(parsed.lang));
    else if(parsed.page === 'category') content.appendChild(await renderCategoryPage(parsed.lang, parsed.category));
    else content.appendChild(renderLanguageGate());
    root.appendChild(content);
    setTimeout(()=>{ const first = root.querySelector('[tabindex], button, a'); if(first) first.focus(); },80);
  }
};

/* Header */
function renderHeader(parsed){
  const header = el('div',{class:'header', role:'banner'});
  const back = el('button',{class:'back', 'aria-label':'Back', onclick: ()=> history.back() }, '◀');
  const title = el('div',{class:'title'}, CONFIG.appTitle);
  header.appendChild(back);
  header.appendChild(title);
  return header;
}

/* Language gate */
function renderLanguageGate(){
  const container = el('div',{class:'app-shell'});
  const grid = el('div',{class:'lang-grid'});
  const bn = el('button',{class:'lang-card', onclick: ()=> location.hash = '#/bn'}, el('h2',{}, 'বাংলা'), el('p',{}, 'বাংলা কনটেন্ট দেখুন'));
  const en = el('button',{class:'lang-card', onclick: ()=> location.hash = '#/en'}, el('h2',{}, 'English'), el('p',{}, 'View English captions'));
  grid.appendChild(bn); grid.appendChild(en);
  container.appendChild(grid);
  return container;
}

/* Category grid */
function renderCategoryGrid(lang){
  const shell = el('div',{class:'app-shell'});
  const inner = el('div',{style:'max-width:980px;margin:12px auto;'});
  const h1 = el('h1',{}, lang === 'bn' ? 'বিভাগসমূহ' : 'Categories');
  inner.appendChild(h1);
  const grid = el('div',{class:'cat-grid'});
  CONFIG.categories.forEach(c => {
    const label = lang==='bn' ? c.label_bn : c.label_en;
    const card = el('button',{class:'cat-card', onclick: ()=> location.hash = `#/${lang}/${c.id}`, 'aria-label':label},
      el('div',{}, el('strong',{}, label)),
      el('div',{}, el('span',{class:'badge'}, '500+'))
    );
    grid.appendChild(card);
  });
  inner.appendChild(grid);
  shell.appendChild(inner);
  return shell;
}

/* Fetch data JSON lazily */
async function fetchCategoryData(lang, category) {
  const url = `${CONFIG.dataPath}/${lang}/${category}.json`;
  try {
    const res = await fetch(url, {cache: 'reload'});
    if(!res.ok) throw new Error('Not found');
    const arr = await res.json();
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    return [];
  }
}

/* render category page with pagination, search, filters */
async function renderCategoryPage(lang, category){
  const container = el('div',{class:'app-shell'});
  const controls = el('div',{style:'max-width:980px;margin:10px auto;display:flex;gap:8px;align-items:center;'},
    el('h2',{}, getCategoryLabel(category,lang)),
    el('div',{style:'margin-left:auto;display:flex;gap:8px'},
      el('button',{class:'icon-btn', onclick: ()=> toggleFilterSheet(true), title:'Filter', 'aria-label':'Filter'}, '⚙'),
      el('button',{class:'icon-btn', onclick: ()=> surpriseMe(lang,category), title:'Surprise me', 'aria-label':'Surprise me'}, '❝'),
      el('button',{class:'icon-btn', onclick: ()=> location.hash = `#/${lang}`, title:'Back to categories', 'aria-label':'Back to categories'}, '🏠')
    )
  );
  container.appendChild(controls);

  const main = el('div',{class:'content-inner', style:'max-width:980px;margin:8px auto'});
  container.appendChild(main);

  // state (FIX: initial pageIndex should start at 1 so first page renders)
  const state = {
    all: [],
    filtered: [],
    pageIndex: 1,
    pageSize: CONFIG.pageSize,
    query: '',
    tags: new Set(),
    lengthFilter: null,
    mood: null,
    lastRandomId: null
  };

  const raw = await fetchCategoryData(lang, category);
  state.all = raw;
  state.filtered = raw;

  const searchBar = el('div',{style:'display:flex;gap:8px;align-items:center;margin-bottom:12px'},
    el('input',{type:'search', placeholder: lang==='bn' ? 'সার্চ করুন' : 'Search captions', value:'', oninput: (e)=>{ state.query = e.target.value; applyFilters(); }}),
    el('button',{class:'icon-btn', onclick: ()=>{ state.query=''; const inp = main.querySelector('input[type=search]'); if(inp) inp.value=''; applyFilters(); }}, '✖'),
    el('div',{style:'margin-left:auto;display:flex;gap:8px'},
      el('button',{class:'icon-btn', onclick: ()=> openFavorites(lang,category)}, '★'),
      el('button',{class:'icon-btn', onclick: ()=> toggleFilterSheet(true) }, '⚙')
    )
  );
  main.appendChild(searchBar);

  const list = el('div',{class:'item-list', id:'item-list'});
  main.appendChild(list);

  const loadMoreBtn = el('button',{class:'icon-btn', style:'margin:12px auto;display:block', onclick: ()=> loadMore()}, 'Load more');

  // filter sheet - only append once to body (avoid duplicates)
  if(!qs('#filter-sheet')){
    const bottomSheet = el('div',{class:'bottom-sheet', id:'filter-sheet'},
      el('div',{}, el('strong',{}, lang==='bn' ? 'ফিল্টার' : 'Filters')),
      el('div',{style:'margin-top:8px'}, el('label',{}, lang==='bn' ? 'লম্বা' : 'Length:'), 
        el('select',{onchange:(e)=>{ state.lengthFilter = e.target.value || null; applyFilters(); }},
          el('option',{value:''}, lang==='bn' ? 'সকল' : 'All'),
          el('option',{value:'short'}, 'Short'),
          el('option',{value:'medium'}, 'Medium'),
          el('option',{value:'long'}, 'Long')
        )
      ),
      el('div',{style:'margin-top:8px'},
        el('label',{}, lang==='bn' ? 'মুড' : 'Mood:'),
        el('input',{placeholder: lang==='bn' ? 'উদাহরণ: romantic, witty' : 'e.g. romantic, witty', oninput:(e)=>{ state.mood = e.target.value.trim() || null; applyFilters(); }})
      ),
      el('div',{style:'margin-top:12px;display:flex;gap:8px;justify-content:flex-end'},
        el('button',{onclick: ()=> toggleFilterSheet(false)}, 'Close')
      )
    );
    document.body.appendChild(bottomSheet);
  }

  renderPageItems();

  function applyFilters(){
    let s = state.query.trim().toLowerCase();
    state.filtered = state.all.filter(item => {
      if(s){
        if(!item.text.toLowerCase().includes(s) && !(item.tags||[]).some(t => t.includes(s))) return false;
      }
      if(state.lengthFilter){
        if(state.lengthFilter === 'short' && item.length > 60) return false;
        if(state.lengthFilter === 'medium' && (item.length <= 60 || item.length > 140)) return false;
        if(state.lengthFilter === 'long' && item.length <= 140) return false;
      }
      if(state.mood){
        if(!item.mood) return false;
        if(!item.mood.toLowerCase().includes(state.mood.toLowerCase())) return false;
      }
      return true;
    });
    state.pageIndex = 1;
    list.innerHTML = '';
    renderPageItems();
  }

  function renderPageItems(){
    const start = 0;
    const end = state.pageIndex * state.pageSize;
    const slice = state.filtered.slice(start, end);
    list.innerHTML = '';
    if(slice.length === 0) list.appendChild(el('div',{}, lang==='bn' ? 'কোনও আইটেম পাওয়া যায়নি' : 'No items found.'));
    slice.forEach(item => list.appendChild(renderItem(item, lang, category)));
    if(end < state.filtered.length){
      if(!list.contains(loadMoreBtn)) list.appendChild(loadMoreBtn);
    } else {
      loadMoreBtn.remove();
    }
  }

  function loadMore(){
    state.pageIndex += 1;
    renderPageItems();
  }

  function toggleFilterSheet(open){
    const s = qs('#filter-sheet');
    if(!s) return;
    s.classList.toggle('open', !!open);
  }

  return container;
}

/* render item */
function renderItem(item, lang, category){
  const itemNode = el('div',{class:'item', tabindex:0},
    el('div',{class:'text'}, item.text),
    el('div',{class:'meta'},
      el('div',{class:'chips'}, ...(item.tags||[]).slice(0,5).map(t=> el('span',{class:'chip'}, t))),
      el('div',{class:'actions'},
        el('button',{class:'icon-btn', title:'Copy', onclick: ()=>{ copyText(item.text); toast(lang==='bn' ? 'কপি হয়েছে!' : 'Copied!'); }}, '⎘'),
        el('button',{class:'icon-btn', title:'Share', onclick: ()=>{ shareText(item); }}, '⇪'),
        favoriteButton(item, lang, category)
      )
    )
  );
  return itemNode;
}

/* favorites */
function favoriteButton(item, lang, category){
  const favs = Favorites.load(lang, category);
  const isFav = !!favs[item.id];
  const btn = el('button',{class:'icon-btn', title:isFav ? 'Remove favorite' : 'Add favorite'}, isFav ? '★' : '☆');
  btn.addEventListener('click', ()=>{
    const f = Favorites.load(lang, category);
    if(f[item.id]) { delete f[item.id]; btn.textContent='☆'; toast(lang==='bn' ? 'ফেভারিট থেকে সরানো হয়েছে' : 'Removed from favorites'); }
    else { f[item.id] = item; btn.textContent='★'; toast(lang==='bn' ? 'ফেভারিটে যোগ করা হয়েছে' : 'Added to favorites'); }
    Favorites.save(lang, category, f);
  });
  return btn;
}

/* helpers */
async function copyText(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  }catch(e){}
}

function shareText(item){
  const payload = {text: item.text};
  if(navigator.share) {
    navigator.share(payload).catch(()=>{ toast('Share cancelled') });
  } else {
    const url = `https://wa.me/?text=${encodeURIComponent(item.text)}`;
    window.open(url,'_blank');
  }
}

async function surpriseMe(lang, category){
  const arr = await fetchCategoryData(lang, category);
  if(!arr.length) { toast('No content'); return; }
  const pick = arr[Math.floor(Math.random()*arr.length)];
  toast(pick.text);
}

function openFavorites(lang, category){
  const f = Favorites.load(lang, category);
  const list = Object.values(f || {});
  if(list.length === 0) return toast(lang==='bn' ? 'কোনো ফেভারিট নেই' : 'No favorites yet');
  toast((lang==='bn' ? 'ফেভারিট: ' : 'Favorites: ') + (list[0].text.slice(0,120)));
}

function toast(msg, ms=2200){
  const root = qs('#toast-root');
  if(!root) return;
  const t = el('div',{class:'toast'}, msg);
  root.appendChild(t);
  setTimeout(()=> t.remove(), ms);
}

function getCategoryLabel(id, lang){
  const c = CONFIG.categories.find(x => x.id === id);
  if(!c) return id;
  return lang==='bn' ? c.label_bn : c.label_en;
}

/* start */
document.addEventListener('DOMContentLoaded', ()=> Router.start());
