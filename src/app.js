/* ============================================================
   VergeLyrics - app.js (Updated for Pagination & Chips)
   ============================================================ */

const API = 'https://yt-music-api.vergelyrics.workers.dev';

// ============ STATE ============
const state = {
  currentSong: null,
  isPlaying: false,
  queue: [],
  queueIndex: 0,
  player: null,
  playerReady: false,
  duration: 0,
  currentTime: 0,
  volume: 100,
  nextContinuation: null,
  loadingMore: false
};

// ============ ROUTER ============
const router = {
  init() {
    window.addEventListener('popstate', () => this.dispatch());
    this.dispatch();
  },
  dispatch() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

    if (path === '/') {
      document.querySelector('[data-page="home"]')?.classList.add('active');
      pages.home();
    } else if (path.startsWith('/search')) {
      pages.search(params.get('q') || '');
    } else if (path.startsWith('/artist/')) {
      pages.artist(path.replace('/artist/', '').split('?')[0]);
    } else if (path.startsWith('/album/')) {
      pages.album(path.replace('/album/', '').split('?')[0]);
    } else if (path.startsWith('/playlist/')) {
      pages.playlist(path.replace('/playlist/', '').split('?')[0]);
    } else {
      pages.home();
    }
  },
  push(path) {
    history.pushState(null, '', path);
    this.dispatch();
  }
};

function navigate(path) { router.push(path); }

// ============ API ============
async function api(endpoint, params = {}) {
  const url = new URL(`${API}${endpoint}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ============ PAGES ============
const pages = {
  async home(params = {}) {
    const el = document.getElementById('pageContent');
    el.innerHTML = `<div class="home-page"><div class="loading"><div class="spinner"></div></div></div>`;
    try {
      const data = await api('/home', params);
      state.nextContinuation = data.continuation;
      
      let html = `<div class="home-page">`;
      if (data.chips?.length) {
        html += `<div class="chip-cloud">${data.chips.map(c => 
          `<button class="chip ${c.isSelected ? 'active' : ''}" data-params="${c.params || ''}">${escHtml(c.title)}</button>`
        ).join('')}</div>`;
      }
      html += `<div id="homeSections">${renderSections(data.sections)}</div></div>`;
      el.innerHTML = html;
      bindHomeEvents();
      bindCardEvents();
    } catch (e) {
      el.innerHTML = `<div class="home-page"><div class="empty-state"><p>Failed to load.</p></div></div>`;
    }
  },

  async search(query) {
    const el = document.getElementById('pageContent');
    if (!query) return el.innerHTML = `<div class="search-page"><p>Search something...</p></div>`;
    el.innerHTML = `<div class="search-page"><div class="loading"><div class="spinner"></div></div></div>`;
    try {
      const data = await api(`/search`, { q: query });
      el.innerHTML = renderSearch(query, data);
      bindResultEvents();
    } catch (e) { el.innerHTML = `<p>Search failed.</p>`; }
  },

  async artist(id) { 
    const el = document.getElementById('pageContent');
    el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const data = await api(`/artist`, { id: id });
      el.innerHTML = renderArtist(data);
      bindCardEvents();
      bindTrackEvents();
    } catch (e) { el.innerHTML = `<p>Failed to load artist.</p>`; }
  },

  async album(id) {
    const el = document.getElementById('pageContent');
    el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const data = await api(`/album`, { id: id });
      el.innerHTML = renderAlbum(data);
      bindTrackEvents();
      bindCollectionPlayAll(data.tracks);
    } catch (e) { el.innerHTML = `<p>Failed to load album.</p>`; }
  },

  async playlist(id) {
    const el = document.getElementById('pageContent');
    el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const data = await api(`/playlist`, { id: id });
      el.innerHTML = renderPlaylist(data, id);
      bindTrackEvents();
      bindCollectionPlayAll(data.tracks || []);
    } catch (e) { el.innerHTML = `<p>Failed to load playlist.</p>`; }
  }
};

// ============ HELPERS ============
function renderSections(sections) {
  if (!sections) return '';
  return sections.map(section => {
    if (!section || !section.items || !section.items.length) return '';
    return `<div class="section">
      <div class="section-header"><h2 class="section-title">${escHtml(section.title || '')}</h2></div>
      <div class="shelf">${section.items.map(renderCard).join('')}</div>
    </div>`;
  }).join('');
}

function bindHomeEvents() {
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const params = btn.dataset.params;
      pages.home(params ? { params } : {});
    });
  });

  window.addEventListener('scroll', () => {
    if (state.loadingMore || !state.nextContinuation) return;
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
      loadMoreHome();
    }
  });
}

async function loadMoreHome() {
  state.loadingMore = true;
  try {
    const data = await api('/home', { continuation: state.nextContinuation });
    state.nextContinuation = data.continuation;
    const container = document.getElementById('homeSections');
    container.insertAdjacentHTML('beforeend', renderSections(data.sections));
    bindCardEvents();
  } catch(e) { console.error("End of feed"); }
  finally { state.loadingMore = false; }
}

// ============ OTHER RENDERERS ============
function renderCard(item) {
  const typeLabel = { song: 'Song', video: 'Video', album: 'Album', playlist: 'Playlist', artist: 'Artist' }[item.type] || '';
  return `<div class="card" ${itemNavAttr(item)}>
    <div class="card-thumb-wrap">${thumb(item.thumbnail)}</div>
    <div class="card-title">${item.explicit ? '<span class="explicit-badge">E</span>' : ''}${escHtml(item.title)}</div>
    <div class="card-subtitle">${escHtml(item.subtitle || typeLabel)}</div>
  </div>`;
}

function itemNavAttr(item) {
  if (item.videoId) return `data-videoid="${escHtml(item.videoId)}" data-title="${escHtml(item.title)}" data-thumb="${escHtml(item.thumbnail || '')}"`;
  if (item.browseId && item.type === 'artist') return `data-nav="/artist/${escHtml(item.browseId)}"`;
  if (item.browseId) return `data-nav="/album/${escHtml(item.browseId)}"`;
  if (item.playlistId) return `data-nav="/playlist/${escHtml(item.playlistId)}"`;
  return '';
}

function thumb(url) { return url ? `<img src="${escHtml(url)}" loading="lazy" />` : `<div class="card-thumb-placeholder">♪</div>`; }
function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function itemNavAttr(item) {
  if (!item) return '';
  if (item.videoId) return `data-videoid="${escHtml(item.videoId)}" data-title="${escHtml(item.title)}" data-artist="${escHtml(item.subtitle || (item.artists ? item.artists.map(a=>a.name).join(', ') : ''))}" data-thumb="${escHtml(item.thumbnail || '')}"`; 
  if (item.browseId && item.type === 'artist') return `data-nav="/artist/${escHtml(item.browseId)}"`;
  if (item.browseId) return `data-nav="/album/${escHtml(item.browseId)}"`;
  if (item.playlistId) return `data-nav="/playlist/${escHtml(item.playlistId)}"`;
  return '';
}

function renderCard(item) {
  const isArtist = item.type === 'artist';
  const typeLabel = { song: 'Song', video: 'Video', album: 'Album', ep: 'EP', single: 'Single', artist: 'Artist', playlist: 'Playlist' }[item.type] || '';
  
  return `<div class="card" ${itemNavAttr(item)}>
    <div class="card-thumb-wrap${isArtist ? ' rounded' : ''}">
      ${thumb(item.thumbnail)}
      ${item.videoId ? `<button class="card-play" data-videoid="${escHtml(item.videoId)}" data-title="${escHtml(item.title)}" data-artist="${escHtml(item.subtitle||'')}" data-thumb="${escHtml(item.thumbnail||'')}">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
      </button>` : ''}
    </div>
    <div class="card-title">${item.explicit ? '<span class="explicit-badge">E</span>' : ''}${escHtml(item.title)}</div>
    <div class="card-subtitle">${escHtml(item.subtitle || typeLabel)}</div>
  </div>`;
}

function renderHome(sections) {
  if (!sections || !sections.length) return `<div class="home-page"><div class="empty-state"><p>Nothing to show right now.</p></div></div>`;
  
  return `<div class="home-page">${sections.map(section => {
    if (!section || !section.items || !section.items.length) return '';
    return `<div class="section">
      <div class="section-header">
        <h2 class="section-title">${escHtml(section.title || '')}</h2>
        ${section.browseId ? `<a class="section-more" href="/album/${escHtml(section.browseId)}">More</a>` : ''}
      </div>
      <div class="shelf">${section.items.map(renderCard).join('')}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderSearch(query, items) {
  if (!items || !items.length) {
    return `<div class="search-page"><h1 class="search-page-title">No results for "${escHtml(query)}"</h1></div>`;
  }

  const groups = { song: [], video: [], artist: [], album: [], ep: [], single: [], playlist: [] };
  items.forEach(item => {
    const g = groups[item.type];
    if (g) g.push(item);
  });

  const renderResultItem = (item) => {
    const isArtist = item.type === 'artist';
    const subtitle = item.subtitle || [item.type, item.duration].filter(Boolean).join(' • ');
    return `<div class="result-item" ${itemNavAttr(item)}>
      <div class="result-thumb-wrap${isArtist ? ' rounded' : ''}">
        ${item.thumbnail ? `<img class="result-thumb" src="${escHtml(item.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        ${item.videoId ? `<div class="result-play" data-videoid="${escHtml(item.videoId)}" data-title="${escHtml(item.title)}" data-artist="${escHtml(subtitle)}" data-thumb="${escHtml(item.thumbnail||'')}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
        </div>` : ''}
      </div>
      <div class="result-info">
        <div class="result-title">${item.explicit ? '<span class="explicit-badge">E</span>' : ''}${escHtml(item.title)}</div>
        <div class="result-subtitle">${escHtml(subtitle)}</div>
      </div>
    </div>`;
  };

  let html = `<div class="search-page"><h1 class="search-page-title">Results for "${escHtml(query)}"</h1>`;

  const order = ['song', 'video', 'artist', 'album', 'ep', 'single', 'playlist'];
  const labels = { song: 'Songs', video: 'Videos', artist: 'Artists', album: 'Albums', ep: 'EPs', single: 'Singles', playlist: 'Playlists' };

  order.forEach(type => {
    if (!groups[type].length) return;
    html += `<div class="section">
      <div class="section-header"><h2 class="section-title">${labels[type]}</h2></div>
      <div class="result-list">${groups[type].map(renderResultItem).join('')}</div>
    </div>`;
  });

  return html + '</div>';
}

function renderArtist(data) {
  const sections = (data.sections || []).map(section => {
    if (!section) return '';
    const isShelf = section.items && section.items[0]?.videoId && section.items[0]?.type === 'song';
    
    if (isShelf) {
      return `<div class="section">
        <div class="section-header"><h2 class="section-title">${escHtml(section.title || 'Songs')}</h2></div>
        <div class="track-list">${(section.items || []).map((track, i) => renderTrack(track, i, false, section.items)).join('')}</div>
      </div>`;
    }

    return `<div class="section">
      <div class="section-header"><h2 class="section-title">${escHtml(section.title || '')}</h2></div>
      <div class="shelf">${(section.items || []).map(renderCard).join('')}</div>
    </div>`;
  }).join('');

  return `<div class="artist-page">
    <div class="artist-header">
      <div class="artist-header-bg" style="background-image:url('${escHtml(data.thumbnail || '')}')"></div>
      <div class="artist-header-gradient"></div>
      <div class="artist-header-content">
        <h1 class="artist-name">${escHtml(data.name || '')}</h1>
        ${data.description ? `<p class="artist-followers">${escHtml(data.description.slice(0,120))}${data.description.length > 120 ? '…' : ''}</p>` : ''}
      </div>
    </div>
    <div class="artist-body">${sections}</div>
  </div>`;
}

function renderTrack(track, index, showThumb = true, allTracks = []) {
  if (!track) return '';
  const artist = track.artists ? track.artists.map(a => a.name).join(', ') : (track.subtitle || '');
  const allIds = JSON.stringify(allTracks.filter(t => t?.videoId).map(t => t.videoId));
  
  return `<div class="track-item" 
    data-videoid="${escHtml(track.videoId)}" 
    data-title="${escHtml(track.title)}" 
    data-artist="${escHtml(artist)}" 
    data-thumb="${escHtml(track.thumbnail || '')}"
    data-queue='${escHtml(allIds)}'>
    <span class="track-num">${index + 1}</span>
    ${showThumb ? `<div class="track-thumb-wrap"><img class="track-thumb" src="${escHtml(track.thumbnail||'')}" alt="" loading="lazy" onerror="this.style.display='none'" /></div>` : ''}
    <div class="track-info">
      <div class="track-title">${track.explicit ? '<span class="explicit-badge">E</span>' : ''}${escHtml(track.title)}</div>
      <div class="track-subtitle">${escHtml(artist)}</div>
    </div>
    <span class="track-duration">${escHtml(track.duration || '')}</span>
  </div>`;
}

function renderAlbum(data) {
  const tracks = data.tracks || [];
  const subtitle = [data.subtitle, data.description].filter(Boolean).join(' • ').slice(0, 120);
  const allIds = JSON.stringify(tracks.filter(t => t?.videoId).map(t => t.videoId));

  return `<div class="collection-page">
    <div class="collection-header">
      <div class="collection-art">${data.thumbnail ? `<img src="${escHtml(data.thumbnail)}" alt="" />` : ''}</div>
      <div class="collection-meta">
        <div class="collection-type">Album</div>
        <h1 class="collection-title">${escHtml(data.title || '')}</h1>
        <div class="collection-subtitle">${escHtml(subtitle)}</div>
        <div class="collection-actions">
          <button class="btn-play-all" data-queue='${escHtml(allIds)}'>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Play all
          </button>
        </div>
      </div>
    </div>
    <div class="collection-body">
      <div class="track-list">${tracks.map((t, i) => renderTrack(t, i, true, tracks)).join('')}</div>
    </div>
  </div>`;
}

function renderPlaylist(data, id) {
  const tracks = data.tracks || [];
  const subtitle = data.subtitle || '';
  const allIds = JSON.stringify(tracks.filter(t => t?.videoId).map(t => t.videoId));

  return `<div class="collection-page">
    <div class="collection-header">
      <div class="collection-art">${data.thumbnail ? `<img src="${escHtml(data.thumbnail)}" alt="" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted)"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg></div>'}</div>
      <div class="collection-meta">
        <div class="collection-type">Playlist</div>
        <h1 class="collection-title">${escHtml(data.title || 'Playlist')}</h1>
        ${subtitle ? `<div class="collection-subtitle">${escHtml(subtitle)}</div>` : ''}
        <div class="collection-actions">
          <button class="btn-play-all" data-queue='${escHtml(allIds)}'>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Play all
          </button>
        </div>
      </div>
    </div>
    <div class="collection-body">
      <div class="track-list">${tracks.map((t, i) => renderTrack(t, i, true, tracks)).join('')}</div>
    </div>
  </div>`;
}

// ============ EVENT BINDING ============
function bindCardEvents() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-play')) return;
      const nav = card.dataset.nav;
      const videoId = card.dataset.videoid;
      if (nav) { navigate(nav); return; }
      if (videoId) playSong({ videoId, title: card.dataset.title, artist: card.dataset.artist, thumbnail: card.dataset.thumb });
    });
  });

  document.querySelectorAll('.card-play').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      playSong({ videoId: btn.dataset.videoid, title: btn.dataset.title, artist: btn.dataset.artist, thumbnail: btn.dataset.thumb });
    });
  });
}

function bindResultEvents() {
  document.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.result-play')) return;
      const nav = item.dataset.nav;
      const videoId = item.dataset.videoid;
      if (nav) { navigate(nav); return; }
      if (videoId) playSong({ videoId, title: item.dataset.title, artist: item.dataset.artist, thumbnail: item.dataset.thumb });
    });
  });

  document.querySelectorAll('.result-play').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      playSong({ videoId: btn.dataset.videoid, title: btn.dataset.title, artist: btn.dataset.artist, thumbnail: btn.dataset.thumb });
    });
  });
}

function bindTrackEvents() {
  document.querySelectorAll('.track-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      const videoId = item.dataset.videoid;
      if (!videoId) return;

      let queueIds = [];
      try { queueIds = JSON.parse(item.dataset.queue || '[]'); } catch {}
      
      const song = { videoId, title: item.dataset.title, artist: item.dataset.artist, thumbnail: item.dataset.thumb };
      playSong(song, queueIds);
    });
  });
}

function bindCollectionPlayAll(tracks) {
  const btn = document.querySelector('.btn-play-all');
  if (!btn) return;
  btn.addEventListener('click', () => {
    let queueIds = [];
    try { queueIds = JSON.parse(btn.dataset.queue || '[]'); } catch {}
    if (!queueIds.length) return;
    
    const first = tracks.find(t => t?.videoId === queueIds[0]);
    if (first) {
      const artist = first.artists ? first.artists.map(a => a.name).join(', ') : (first.subtitle || '');
      playSong({ videoId: first.videoId, title: first.title, artist, thumbnail: first.thumbnail }, queueIds);
    }
  });
}

// ============ PLAYER ============
function initYouTubePlayer() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    const div = document.createElement('div');
    div.id = 'ytPlayer';
    document.getElementById('ytContainer').appendChild(div);

    state.player = new YT.Player('ytPlayer', {
      height: '1',
      width: '1',
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, enablejsapi: 1, playsinline: 1, iv_load_policy: 3, rel: 0 },
      events: {
        onReady: () => { state.playerReady = true; },
        onStateChange: onPlayerStateChange,
      }
    });
  };
}

function onPlayerStateChange(event) {
  const YT = window.YT;
  if (event.data === YT.PlayerState.PLAYING) {
    state.isPlaying = true;
    state.duration = state.player.getDuration();
    updatePlayUI();
    startProgressInterval();
    updateTotalTime();
  } else if (event.data === YT.PlayerState.PAUSED) {
    state.isPlaying = false;
    updatePlayUI();
    stopProgressInterval();
  } else if (event.data === YT.PlayerState.ENDED) {
    playNext();
  }
}

let progressInterval = null;
function startProgressInterval() {
  stopProgressInterval();
  progressInterval = setInterval(updateProgress, 500);
}
function stopProgressInterval() {
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
}

function updateProgress() {
  if (!state.player || !state.isPlaying) return;
  try {
    const cur = state.player.getCurrentTime();
    const dur = state.player.getDuration();
    if (!dur) return;
    state.currentTime = cur;
    state.duration = dur;
    const pct = (cur / dur) * 100;

    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressThumb').style.left = pct + '%';
    document.getElementById('expProgressFill').style.width = pct + '%';
    document.getElementById('currentTime').textContent = formatTime(cur);
    document.getElementById('expCurrentTime').textContent = formatTime(cur);
  } catch {}
}

function updateTotalTime() {
  try {
    const dur = state.player?.getDuration() || 0;
    document.getElementById('totalTime').textContent = formatTime(dur);
    document.getElementById('expTotalTime').textContent = formatTime(dur);
  } catch {}
}

function formatTime(s) {
  s = Math.floor(s || 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function updatePlayUI() {
  const playing = state.isPlaying;
  [document.querySelector('#playPauseBtn .icon-play'), document.querySelector('#expPlayPause .icon-play')].forEach(el => { if(el) el.style.display = playing ? 'none' : 'block'; });
  [document.querySelector('#playPauseBtn .icon-pause'), document.querySelector('#expPlayPause .icon-pause')].forEach(el => { if(el) el.style.display = playing ? 'block' : 'none'; });
}

async function playSong(song, queueIds = []) {
  if (!song?.videoId) return;

  // Show player bar
  const playerEl = document.getElementById('player');
  playerEl.style.display = 'flex';

  // Update mini player UI immediately
  state.currentSong = song;
  document.getElementById('playerTitle').textContent = song.title || '';
  document.getElementById('playerArtist').textContent = song.artist || '';
  document.getElementById('expTitle').textContent = song.title || '';
  document.getElementById('expArtist').textContent = song.artist || '';

  if (song.thumbnail) {
    document.getElementById('playerThumb').src = song.thumbnail;
    document.getElementById('expThumb').src = song.thumbnail;
  }

  // Reset progress
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressThumb').style.left = '0%';
  document.getElementById('expProgressFill').style.width = '0%';
  document.getElementById('currentTime').textContent = '0:00';
  document.getElementById('expCurrentTime').textContent = '0:00';

  // Load song data for queue
  loadSongData(song.videoId, queueIds);

  // Play via YouTube IFrame
  if (!state.playerReady) {
    // Wait for player ready
    const check = setInterval(() => {
      if (state.playerReady) {
        clearInterval(check);
        state.player.loadVideoById(song.videoId);
        state.isPlaying = true;
        updatePlayUI();
      }
    }, 100);
  } else {
    state.player.loadVideoById(song.videoId);
    state.isPlaying = true;
    updatePlayUI();
  }
}

async function loadSongData(videoId, hintQueueIds = []) {
  try {
    const data = await api(`/song?id=${videoId}`);

    const queueRaw = data.queue || data.related || [];
    state.queue = queueRaw;
    state.queueIndex = queueRaw.findIndex(t => t?.videoId === videoId);
    if (state.queueIndex < 0) state.queueIndex = 0;

    renderQueue(queueRaw, state.queueIndex);
    renderRelated(data.related || []);

    if (data.lyrics) {
      document.getElementById('expLyricsText').textContent = data.lyrics;
    } else {
      document.getElementById('expLyricsText').textContent = 'No lyrics available.';
    }

    // Update thumbnail to best quality
    const bestThumb = data.thumbnails?.at(-1)?.url || state.currentSong?.thumbnail;
    if (bestThumb) {
      document.getElementById('playerThumb').src = bestThumb;
      document.getElementById('expThumb').src = bestThumb;
      if (document.getElementById('expBackdrop')) {
        document.getElementById('expBackdrop').style.background = `linear-gradient(135deg, rgba(0,0,0,0.9), rgba(15,15,15,0.97)), url('${bestThumb}') center/cover`;
      }
    }
  } catch (e) {
    console.error('Failed to load song data', e);
  }
}

function renderQueue(tracks, activeIndex) {
  const el = document.getElementById('expQueueList');
  if (!el) return;
  el.innerHTML = tracks.map((track, i) => {
    if (!track) return '';
    const isActive = i === activeIndex;
    const artist = track.artists ? track.artists.map(a => a.name).join(', ') : (track.subtitle || '');
    return `<div class="queue-item${isActive ? ' active' : ''}" data-index="${i}" data-videoid="${escHtml(track.videoId)}" data-title="${escHtml(track.title)}" data-artist="${escHtml(artist)}" data-thumb="${escHtml(track.thumbnail||'')}">
      <div class="queue-thumb-wrap">
        ${track.thumbnail ? `<img class="queue-thumb" src="${escHtml(track.thumbnail)}" alt="" loading="lazy" />` : ''}
        ${isActive ? `<div class="queue-now-playing"><div class="now-playing-bars"><span></span><span></span><span></span></div></div>` : ''}
      </div>
      <div class="queue-info">
        <div class="queue-title">${escHtml(track.title)}</div>
        <div class="queue-artist">${escHtml(artist)}</div>
      </div>
      <span class="queue-duration">${escHtml(track.duration || '')}</span>
    </div>`;
  }).join('');

  el.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      state.queueIndex = idx;
      const track = state.queue[idx];
      if (track?.videoId) {
        playSong({ videoId: track.videoId, title: track.title, artist: item.dataset.artist, thumbnail: item.dataset.thumb });
      }
    });
  });
}

function renderRelated(tracks) {
  const el = document.getElementById('expRelatedList');
  if (!el) return;
  el.innerHTML = tracks.map((track, i) => {
    if (!track) return '';
    const artist = track.artists ? track.artists.map(a => a.name).join(', ') : (track.subtitle || '');
    return `<div class="queue-item" data-videoid="${escHtml(track.videoId)}" data-title="${escHtml(track.title)}" data-artist="${escHtml(artist)}" data-thumb="${escHtml(track.thumbnail||'')}">
      <div class="queue-thumb-wrap">${track.thumbnail ? `<img class="queue-thumb" src="${escHtml(track.thumbnail)}" alt="" loading="lazy" />` : ''}</div>
      <div class="queue-info">
        <div class="queue-title">${escHtml(track.title)}</div>
        <div class="queue-artist">${escHtml(artist)}</div>
      </div>
      <span class="queue-duration">${escHtml(track.duration || '')}</span>
    </div>`;
  }).join('');

  el.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      playSong({ videoId: item.dataset.videoid, title: item.dataset.title, artist: item.dataset.artist, thumbnail: item.dataset.thumb });
    });
  });
}

function playNext() {
  if (!state.queue.length) return;
  state.queueIndex = (state.queueIndex + 1) % state.queue.length;
  const track = state.queue[state.queueIndex];
  if (track?.videoId) {
    const artist = track.artists ? track.artists.map(a => a.name).join(', ') : (track.subtitle || '');
    playSong({ videoId: track.videoId, title: track.title, artist, thumbnail: track.thumbnail });
  }
}

function playPrev() {
  if (!state.queue.length) return;
  if (state.currentTime > 5) {
    state.player?.seekTo(0);
    return;
  }
  state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
  const track = state.queue[state.queueIndex];
  if (track?.videoId) {
    const artist = track.artists ? track.artists.map(a => a.name).join(', ') : (track.subtitle || '');
    playSong({ videoId: track.videoId, title: track.title, artist, thumbnail: track.thumbnail });
  }
}

// ============ UI CONTROLS ============
function initControls() {
  // Play/Pause
  document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
  document.getElementById('expPlayPause').addEventListener('click', togglePlay);

  // Next / Prev
  document.getElementById('nextBtn').addEventListener('click', playNext);
  document.getElementById('prevBtn').addEventListener('click', playPrev);
  document.getElementById('expNext').addEventListener('click', playNext);
  document.getElementById('expPrev').addEventListener('click', playPrev);

  // Progress bar
  document.getElementById('progressBar').addEventListener('click', e => seekTo(e, 'progressBar'));
  document.getElementById('expProgressBar').addEventListener('click', e => seekTo(e, 'expProgressBar'));

  // Volume
  document.getElementById('volumeSlider').addEventListener('input', e => {
    const vol = parseInt(e.target.value);
    state.volume = vol;
    state.player?.setVolume(vol);
  });

  document.getElementById('muteBtn').addEventListener('click', () => {
    const slider = document.getElementById('volumeSlider');
    if (state.player?.isMuted()) {
      state.player.unMute();
      slider.value = state.volume;
    } else {
      state.player?.mute();
      slider.value = 0;
    }
  });

  // Expand / collapse player
  document.getElementById('expandPlayer').addEventListener('click', () => {
    document.getElementById('expandedPlayer').style.display = 'flex';
  });
  document.getElementById('collapsePlayer').addEventListener('click', () => {
    document.getElementById('expandedPlayer').style.display = 'none';
  });
  // Click on thumbnail to expand
  document.getElementById('playerThumb').addEventListener('click', () => {
    document.getElementById('expandedPlayer').style.display = 'flex';
  });
  document.getElementById('playerTitle').addEventListener('click', () => {
    document.getElementById('expandedPlayer').style.display = 'flex';
  });

  // Expanded tabs
  document.querySelectorAll('.exp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.exp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panels = { queue: 'expQueuePanel', related: 'expRelatedPanel', lyrics: 'expLyricsPanel' };
      Object.values(panels).forEach(p => document.getElementById(p).style.display = 'none');
      const panel = panels[tab.dataset.tab];
      if (panel) document.getElementById(panel).style.display = 'block';
    });
  });

  // Lyrics btn
  document.getElementById('lyricsBtn').addEventListener('click', () => {
    document.getElementById('expandedPlayer').style.display = 'flex';
    document.querySelectorAll('.exp-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="lyrics"]').classList.add('active');
    document.getElementById('expQueuePanel').style.display = 'none';
    document.getElementById('expRelatedPanel').style.display = 'none';
    document.getElementById('expLyricsPanel').style.display = 'block';
  });

  // Queue btn
  document.getElementById('queueBtn').addEventListener('click', () => {
    document.getElementById('expandedPlayer').style.display = 'flex';
    document.querySelectorAll('.exp-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="queue"]').classList.add('active');
    document.getElementById('expQueuePanel').style.display = 'block';
    document.getElementById('expRelatedPanel').style.display = 'none';
    document.getElementById('expLyricsPanel').style.display = 'none';
  });
}

function togglePlay() {
  if (!state.player) return;
  if (state.isPlaying) {
    state.player.pauseVideo();
  } else {
    state.player.playVideo();
  }
}

function seekTo(e, barId) {
  const bar = document.getElementById(barId);
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (state.player && state.duration) {
    state.player.seekTo(pct * state.duration, true);
  }
}

// ============ SEARCH UI ============
function initSearch() {
  const input = document.getElementById('searchInput');
  const clear = document.getElementById('searchClear');
  const submit = document.getElementById('searchSubmit');
  const suggestions = document.getElementById('searchSuggestions');
  const navSearchIcon = document.getElementById('navSearchIcon');
  const searchBackBtn = document.getElementById('searchBackBtn');

  let suggestTimeout = null;

  input.addEventListener('input', () => {
    const v = input.value.trim();
    clear.classList.toggle('visible', v.length > 0);
    clearTimeout(suggestTimeout);
    if (v.length > 1) {
      suggestTimeout = setTimeout(() => fetchSuggestions(v), 300);
    } else {
      hideSuggestions();
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      hideSuggestions();
      doSearch(input.value.trim());
    }
    if (e.key === 'Escape') {
      hideSuggestions();
      input.blur();
    }
  });

  submit.addEventListener('click', () => {
    hideSuggestions();
    doSearch(input.value.trim());
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.classList.remove('visible');
    hideSuggestions();
    input.focus();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-container')) hideSuggestions();
  });

  async function fetchSuggestions(q) {
    try {
      const data = await api(`/search/suggestions?q=${encodeURIComponent(q)}`);
      if (!data || !data.length) { hideSuggestions(); return; }
      suggestions.innerHTML = data.slice(0, 8).map(s =>
        `<div class="suggestion-item" data-q="${escHtml(s)}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <span>${escHtml(s)}</span>
        </div>`
      ).join('');
      suggestions.classList.add('visible');
      suggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          input.value = item.dataset.q;
          hideSuggestions();
          doSearch(item.dataset.q);
        });
      });
    } catch {}
  }

  function hideSuggestions() {
    suggestions.classList.remove('visible');
    suggestions.innerHTML = '';
  }

  function doSearch(q) {
    if (!q) return;
    input.value = q;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  // Sync input with URL on navigation
  const origDispatch = router.dispatch.bind(router);
  router.dispatch = function() {
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q');
    if (window.location.pathname.startsWith('/search') && q) {
      input.value = q;
      clear.classList.toggle('visible', q.length > 0);
    } else if (!window.location.pathname.startsWith('/search')) {
      // keep input as is
    }
    origDispatch();
  };
}

// ============ SIDEBAR TOGGLE ============
function initSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main');
    sidebar.classList.toggle('hidden');
    if (sidebar.classList.contains('hidden')) {
      sidebar.style.display = 'none';
      main.classList.add('no-sidebar');
    } else {
      sidebar.style.display = '';
      main.classList.remove('no-sidebar');
    }
  });

  // Sidebar nav links
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;
      const href = item.getAttribute('href');
      navigate(href || '/');
    });
  });

  // Section "more" links
  document.addEventListener('click', e => {
    const more = e.target.closest('.section-more');
    if (more) {
      e.preventDefault();
      navigate(more.getAttribute('href'));
    }
  });
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  initControls();
  initSearch();
  initSidebar();
  initYouTubePlayer();
  router.init();
});
